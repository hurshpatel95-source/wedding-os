// POST /api/admin/welcome/apply-playbook
//
// Seeds a starter playbook (phases + tasks) into the caller's org if the org
// doesn't already have one. The existing /api/admin/playbook/apply route
// expects the org's playbook_phases + playbook_tasks to already exist; for a
// brand-new planner these tables are empty. This route fills them in from a
// hard-coded JSON template (a 9-phase / 20-task starter that loosely mirrors
// the 12-month wedding-os playbook).
//
// Behavior:
//   - If the org already has any playbook_phases rows, the route is a no-op
//     and returns { phases_inserted: 0, tasks_inserted: 0, already_seeded: true }.
//   - Otherwise insert phases first, then tasks linked to those phase ids.
//
// Auth: org_admin only.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

interface StarterTask {
  title: string;
  description?: string;
  owner_default?:
    | "couple"
    | "planner"
    | "groom"
    | "bride"
    | "family"
    | "vendor";
  category?:
    | "venue"
    | "vendor"
    | "attire"
    | "paperwork"
    | "guest"
    | "logistics"
    | "design"
    | "ritual"
    | "finance"
    | "honeymoon"
    | "other";
}

interface StarterPhase {
  label: string;
  anchor_kind: "months_before_wedding";
  anchor_value_int: number;
  tasks: StarterTask[];
}

const STARTER_PHASES: StarterPhase[] = [
  {
    label: "Vision & budget",
    anchor_kind: "months_before_wedding",
    anchor_value_int: 12,
    tasks: [
      {
        title: "Set total budget + savings plan",
        owner_default: "couple",
        category: "finance",
      },
      {
        title: "Draft guest list (rough count)",
        owner_default: "couple",
        category: "guest",
      },
      {
        title: "Pick 3 candidate venues + visit dates",
        owner_default: "planner",
        category: "venue",
      },
    ],
  },
  {
    label: "Lock the date & venue",
    anchor_kind: "months_before_wedding",
    anchor_value_int: 11,
    tasks: [
      {
        title: "Sign venue contract + pay deposit",
        owner_default: "couple",
        category: "venue",
      },
      {
        title: "Book officiant",
        owner_default: "couple",
        category: "ritual",
      },
    ],
  },
  {
    label: "Core vendors",
    anchor_kind: "months_before_wedding",
    anchor_value_int: 9,
    tasks: [
      {
        title: "Book photographer + videographer",
        owner_default: "planner",
        category: "vendor",
      },
      {
        title: "Book caterer + tasting",
        owner_default: "planner",
        category: "vendor",
      },
      {
        title: "Book band / DJ",
        owner_default: "planner",
        category: "vendor",
      },
    ],
  },
  {
    label: "Design & invites",
    anchor_kind: "months_before_wedding",
    anchor_value_int: 6,
    tasks: [
      {
        title: "Send save-the-dates",
        owner_default: "couple",
        category: "guest",
      },
      {
        title: "Order custom invitations",
        owner_default: "couple",
        category: "design",
      },
      {
        title: "Finalize wedding website",
        owner_default: "planner",
        category: "design",
      },
    ],
  },
  {
    label: "Attire & paperwork",
    anchor_kind: "months_before_wedding",
    anchor_value_int: 4,
    tasks: [
      {
        title: "Order wedding dress (final fitting at -1mo)",
        owner_default: "bride",
        category: "attire",
      },
      {
        title: "Order tuxedo / suit",
        owner_default: "groom",
        category: "attire",
      },
      {
        title: "Apply for marriage license",
        owner_default: "couple",
        category: "paperwork",
      },
    ],
  },
  {
    label: "Logistics lock-in",
    anchor_kind: "months_before_wedding",
    anchor_value_int: 3,
    tasks: [
      {
        title: "Send formal invitations",
        owner_default: "couple",
        category: "guest",
      },
      {
        title: "Confirm hotel block + transport",
        owner_default: "planner",
        category: "logistics",
      },
    ],
  },
  {
    label: "Final month",
    anchor_kind: "months_before_wedding",
    anchor_value_int: 1,
    tasks: [
      {
        title: "Lock final guest count with caterer",
        owner_default: "planner",
        category: "guest",
      },
      {
        title: "Build minute-by-minute timeline",
        owner_default: "planner",
        category: "logistics",
      },
    ],
  },
  {
    label: "Wedding week",
    anchor_kind: "months_before_wedding",
    anchor_value_int: 0,
    tasks: [
      {
        title: "Run rehearsal + dinner",
        owner_default: "planner",
        category: "logistics",
      },
      {
        title: "Pay all final vendor balances",
        owner_default: "couple",
        category: "finance",
      },
    ],
  },
  {
    label: "After the wedding",
    anchor_kind: "months_before_wedding",
    anchor_value_int: -1,
    tasks: [
      {
        title: "Send thank-you notes",
        owner_default: "couple",
        category: "guest",
      },
      {
        title: "File marriage license + name change",
        owner_default: "couple",
        category: "paperwork",
      },
    ],
  },
];

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profileSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { org_role?: string | null; org_id?: string | null } | null;
          }>;
        };
      };
    };
  };
  const { data: profile } = await profileSb
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.org_id || profile.org_role !== "org_admin") {
    return NextResponse.json({ error: "org admin only" }, { status: 403 });
  }
  const orgId = profile.org_id;

  // Idempotency: bail if the org already has phases.
  const { data: existing } = await supabase
    .from("playbook_phases")
    .select("id")
    .eq("org_id", orgId)
    .limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({
      phases_inserted: 0,
      tasks_inserted: 0,
      already_seeded: true,
    });
  }

  // Insert phases.
  const phaseRows = STARTER_PHASES.map((p, i) => ({
    org_id: orgId,
    label: p.label,
    sort_order: i,
    anchor_kind: p.anchor_kind,
    anchor_value_int: p.anchor_value_int,
  }));

  const { data: insertedPhases, error: phasesErr } = await supabase
    .from("playbook_phases")
    .insert(phaseRows as never)
    .select("id, sort_order");
  if (phasesErr || !insertedPhases) {
    return NextResponse.json(
      { error: phasesErr?.message ?? "could not insert phases" },
      { status: 500 },
    );
  }

  // Map insertion order back to the starter phase definitions so we can
  // attach tasks. Sort by sort_order to be safe regardless of the DB's
  // returning-order guarantees.
  const sortedPhases = [...insertedPhases].sort(
    (a, b) =>
      (a as { sort_order: number }).sort_order -
      (b as { sort_order: number }).sort_order,
  );

  const taskRows: Array<{
    playbook_phase_id: string;
    title: string;
    description: string | null;
    owner_default: string | null;
    category: string | null;
    sort_order: number;
  }> = [];

  STARTER_PHASES.forEach((phase, phaseIdx) => {
    const phaseRow = sortedPhases[phaseIdx] as { id: string };
    if (!phaseRow) return;
    phase.tasks.forEach((t, taskIdx) => {
      taskRows.push({
        playbook_phase_id: phaseRow.id,
        title: t.title,
        description: t.description ?? null,
        owner_default: t.owner_default ?? "planner",
        category: t.category ?? "other",
        sort_order: taskIdx,
      });
    });
  });

  if (taskRows.length > 0) {
    const { error: tasksErr } = await supabase
      .from("playbook_tasks")
      .insert(taskRows as never);
    if (tasksErr) {
      return NextResponse.json(
        { error: tasksErr.message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    phases_inserted: phaseRows.length,
    tasks_inserted: taskRows.length,
    already_seeded: false,
  });
}
