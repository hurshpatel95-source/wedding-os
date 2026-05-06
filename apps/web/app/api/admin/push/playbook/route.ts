// POST /api/admin/push/playbook
//
// Walks the org's playbook_phases → playbook_tasks and inserts one
// planning_tasks row per playbook_task into the target workspace, with
// `phase_id` pointing back to the playbook_phase and `is_user_added=false`.
//
// Those two columns (phase_id, is_user_added) are added by Agent C's migration
// (`20260506000013_plan_customization.sql`). If that migration hasn't landed
// yet we still try the insert — a not-null/missing-column failure surfaces as
// a 503 with a clear message rather than a half-applied push.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";
import type {
  PushPlaybookRequest,
  PushPlaybookResponse,
} from "@/lib/admin-onboarding-types";

export const runtime = "nodejs";
export const maxDuration = 60;

function buildServiceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Map playbook_phases.anchor_kind/anchor_value_int → planning_tasks.phase enum.
// Falls back to `pre_12_months` for unknown anchors.
function phaseFromAnchor(
  anchorKind: string | null,
  anchorValueInt: number | null,
):
  | "pre_12_months"
  | "months_9_12"
  | "months_6_9"
  | "months_3_6"
  | "months_1_3"
  | "final_month"
  | "final_week"
  | "day_of"
  | "post_wedding" {
  if (!anchorKind || anchorValueInt == null) return "pre_12_months";
  // Convert everything to "months before" for bucketing.
  let months = 0;
  if (anchorKind === "months_before_wedding") months = anchorValueInt;
  else if (anchorKind === "weeks_before_wedding")
    months = anchorValueInt / 4;
  else if (anchorKind === "days_before_wedding")
    months = anchorValueInt / 30;
  else if (anchorKind === "absolute") return "pre_12_months";
  if (months >= 12) return "pre_12_months";
  if (months >= 9) return "months_9_12";
  if (months >= 6) return "months_6_9";
  if (months >= 3) return "months_3_6";
  if (months >= 1) return "months_1_3";
  if (anchorKind === "weeks_before_wedding" && anchorValueInt <= 1)
    return "final_week";
  if (anchorKind === "days_before_wedding" && anchorValueInt <= 1)
    return "day_of";
  if (months > 0) return "final_month";
  return "day_of";
}

const TASK_CATEGORIES = new Set([
  "venue",
  "vendor",
  "attire",
  "paperwork",
  "guest",
  "logistics",
  "design",
  "ritual",
  "finance",
  "honeymoon",
  "other",
]);
const TASK_OWNERS = new Set([
  "couple",
  "planner",
  "groom",
  "bride",
  "family",
  "vendor",
]);

export async function POST(request: NextRequest) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json(
      { error: "Supabase service role key not configured." },
      { status: 503 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const profileSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
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
  const orgId: string = profile.org_id;

  let body: PushPlaybookRequest;
  try {
    body = (await request.json()) as PushPlaybookRequest;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.workspace_id) {
    return NextResponse.json(
      { error: "workspace_id required" },
      { status: 400 },
    );
  }

  const service = buildServiceClient();

  const { data: ws } = await service
    .from("workspaces")
    .select("id, org_id")
    .eq("id", body.workspace_id)
    .maybeSingle();
  if (!ws || ws.org_id !== orgId) {
    return NextResponse.json(
      { error: "workspace not found in your org" },
      { status: 404 },
    );
  }

  // Pull phases in this org. Optional filter by playbook_phase_ids.
  let phasesQuery = service
    .from("playbook_phases")
    .select("id, label, sort_order, anchor_kind, anchor_value_int")
    .eq("org_id", orgId)
    .order("sort_order", { ascending: true });
  if (body.playbook_phase_ids && body.playbook_phase_ids.length > 0) {
    phasesQuery = phasesQuery.in("id", body.playbook_phase_ids);
  }
  const { data: phases, error: phasesErr } = await phasesQuery;
  if (phasesErr) {
    return NextResponse.json(
      { error: `couldn't load phases: ${phasesErr.message}` },
      { status: 500 },
    );
  }
  if (!phases || phases.length === 0) {
    const empty: PushPlaybookResponse = {
      phases_pushed: 0,
      tasks_pushed: 0,
    };
    return NextResponse.json(empty);
  }

  const phaseIds = phases.map((p) => p.id);

  const { data: pTasks, error: tasksErr } = await service
    .from("playbook_tasks")
    .select(
      "id, playbook_phase_id, title, description, owner_default, category, sort_order, auto_derive_kind",
    )
    .in("playbook_phase_id", phaseIds)
    .order("sort_order", { ascending: true });
  if (tasksErr) {
    return NextResponse.json(
      { error: `couldn't load playbook_tasks: ${tasksErr.message}` },
      { status: 500 },
    );
  }

  const phasesById = new Map(phases.map((p) => [p.id, p]));

  // Build the planning_tasks rows.
  type PlanningInsert = Database["public"]["Tables"]["planning_tasks"]["Insert"];
  // `phase_id` and `is_user_added` aren't yet in types.gen.ts — Agent C's
  // migration adds them. We attach them via a loose extension below.
  type PlanningInsertExt = PlanningInsert & {
    phase_id?: string | null;
    is_user_added?: boolean;
  };

  const inserts: PlanningInsertExt[] = (pTasks ?? []).map((t) => {
    const phase = phasesById.get(t.playbook_phase_id)!;
    const phaseEnum = phaseFromAnchor(
      phase.anchor_kind,
      phase.anchor_value_int,
    );
    const category = (
      t.category && TASK_CATEGORIES.has(t.category) ? t.category : "other"
    ) as PlanningInsert["category"];
    const owner = (
      t.owner_default && TASK_OWNERS.has(t.owner_default)
        ? t.owner_default
        : "couple"
    ) as PlanningInsert["owner"];
    return {
      workspace_id: ws.id,
      org_id: orgId,
      title: t.title,
      description: t.description ?? null,
      category,
      phase: phaseEnum,
      owner,
      sort_order: t.sort_order,
      auto_derive_kind: t.auto_derive_kind ?? null,
      phase_id: phase.id,
      is_user_added: false,
    };
  });

  let inserted = 0;
  if (inserts.length > 0) {
    const { error: insErr, count } = await service
      .from("planning_tasks")
      .insert(inserts as PlanningInsert[], { count: "exact" });
    if (insErr) {
      // If the migration (phase_id / is_user_added columns) isn't applied,
      // Postgres throws PGRST204 / 42703 / similar "column does not exist".
      const msg = insErr.message ?? "";
      if (
        /column .* does not exist/i.test(msg) ||
        msg.includes("phase_id") ||
        msg.includes("is_user_added")
      ) {
        return NextResponse.json(
          {
            error:
              "Plan customization migration not yet applied — apply Agent C's 20260506000013_plan_customization.sql before pushing playbook.",
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: `couldn't insert planning tasks: ${msg}` },
        { status: 500 },
      );
    }
    inserted = count ?? inserts.length;
  }

  const response: PushPlaybookResponse = {
    phases_pushed: phases.length,
    tasks_pushed: inserted,
  };
  return NextResponse.json(response);
}
