// POST /api/couples-signup
//
// Self-serve B2C couple signup. Mirrors /api/signup (the planner front door)
// but provisions a couple-side workspace with everything pre-populated:
//   1. New organization (one-couple-per-org for now — keeps RLS clean and
//      lets the couple later upgrade to a "team mode" if they want a partner
//      to co-plan).
//   2. New workspace inside that org, currency derived from region.
//   3. Magic-link via service_role generateLink.
//   4. public.users row with role='couple' + org_role='org_admin' so the
//      couple can manage their own library + playbook.
//   5. Default workspace_branding row.
//   6. Seed playbook_phases + playbook_tasks for the org from a starter
//      template (loosely the wedding-os 9-phase 12-month playbook).
//   7. Expand those into planning_tasks rows for the couple's workspace so
//      /plan is non-empty when they land.
//
// SECURITY: anyone can hit this. Soft IP rate-limit + honeypot. Service-role
// is used; the org/workspace/user is created from scratch so there's no
// existing data to authorize against.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";
import { isValidEmail, sanitizeText } from "@/lib/lead-types";

export const runtime = "nodejs";
export const maxDuration = 30;

function buildServiceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 5;

function ratelimit(key: string): boolean {
  const now = Date.now();
  const bucket = RATE_BUCKETS.get(key);
  if (!bucket || bucket.resetAt < now) {
    RATE_BUCKETS.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_PER_HOUR) return false;
  bucket.count += 1;
  return true;
}

interface CouplesSignupBody {
  your_name?: string;
  partner_name?: string | null;
  wedding_date?: string | null;
  region?: string;
  guest_count?: number | null;
  email?: string;
  // Optional honeypot — clients shouldn't send it; bots will.
  site?: string;
}

// EUR-region heuristic: matches the same set of European wedding markets
// the rest of the app uses. Default everything else to USD (our primary
// US-couple beta market — e.g. Newport, RI).
function pickCurrency(region: string): string {
  if (
    /spain|france|italy|portugal|germany|barcelona|paris|tuscany|berlin|lisbon|madrid|rome|milan|nice|provence/i.test(
      region,
    )
  ) {
    return "EUR";
  }
  return "USD";
}

// 9-phase / ~22-task starter playbook. Copied from
// /api/admin/welcome/apply-playbook so the couple's planning_tasks are
// pre-filled with a sensible 12-month checklist out of the gate.
type Owner = "couple" | "planner" | "groom" | "bride" | "family" | "vendor";
type Category =
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
type PhaseEnum =
  | "pre_12_months"
  | "months_9_12"
  | "months_6_9"
  | "months_3_6"
  | "months_1_3"
  | "final_month"
  | "final_week"
  | "day_of"
  | "post_wedding";

interface StarterTask {
  title: string;
  owner: Owner;
  category: Category;
}

interface StarterPhase {
  label: string;
  // months before wedding the phase fires
  months_before: number;
  // mapped task_phase enum bucket for the planning_tasks row
  phase_enum: PhaseEnum;
  tasks: StarterTask[];
}

const STARTER_PHASES: StarterPhase[] = [
  {
    label: "Vision & budget",
    months_before: 12,
    phase_enum: "pre_12_months",
    tasks: [
      { title: "Set total budget + savings plan", owner: "couple", category: "finance" },
      { title: "Draft guest list (rough count)", owner: "couple", category: "guest" },
      { title: "Pick 3 candidate venues + visit dates", owner: "couple", category: "venue" },
    ],
  },
  {
    label: "Lock the date & venue",
    months_before: 11,
    phase_enum: "months_9_12",
    tasks: [
      { title: "Sign venue contract + pay deposit", owner: "couple", category: "venue" },
      { title: "Book officiant", owner: "couple", category: "ritual" },
    ],
  },
  {
    label: "Core vendors",
    months_before: 9,
    phase_enum: "months_6_9",
    tasks: [
      { title: "Book photographer + videographer", owner: "couple", category: "vendor" },
      { title: "Book caterer + tasting", owner: "couple", category: "vendor" },
      { title: "Book band / DJ", owner: "couple", category: "vendor" },
    ],
  },
  {
    label: "Design & invites",
    months_before: 6,
    phase_enum: "months_3_6",
    tasks: [
      { title: "Send save-the-dates", owner: "couple", category: "guest" },
      { title: "Order custom invitations", owner: "couple", category: "design" },
      { title: "Finalize wedding website", owner: "couple", category: "design" },
    ],
  },
  {
    label: "Attire & paperwork",
    months_before: 4,
    phase_enum: "months_3_6",
    tasks: [
      { title: "Order wedding dress (final fitting at -1mo)", owner: "bride", category: "attire" },
      { title: "Order tuxedo / suit", owner: "groom", category: "attire" },
      { title: "Apply for marriage license", owner: "couple", category: "paperwork" },
    ],
  },
  {
    label: "Logistics lock-in",
    months_before: 3,
    phase_enum: "months_1_3",
    tasks: [
      { title: "Send formal invitations", owner: "couple", category: "guest" },
      { title: "Confirm hotel block + transport", owner: "couple", category: "logistics" },
    ],
  },
  {
    label: "Final month",
    months_before: 1,
    phase_enum: "final_month",
    tasks: [
      { title: "Lock final guest count with caterer", owner: "couple", category: "guest" },
      { title: "Build minute-by-minute timeline", owner: "couple", category: "logistics" },
    ],
  },
  {
    label: "Wedding week",
    months_before: 0,
    phase_enum: "final_week",
    tasks: [
      { title: "Run rehearsal + dinner", owner: "couple", category: "logistics" },
      { title: "Pay all final vendor balances", owner: "couple", category: "finance" },
    ],
  },
  {
    label: "After the wedding",
    months_before: -1,
    phase_enum: "post_wedding",
    tasks: [
      { title: "Send thank-you notes", owner: "couple", category: "guest" },
      { title: "File marriage license + name change", owner: "couple", category: "paperwork" },
    ],
  },
];

// Compute a YYYY-MM-DD due_date for a planning task given the wedding date
// and how many months before it the task should fire. Returns null when the
// couple hasn't picked a date yet — /plan handles null due_dates fine.
function computeDueDate(
  weddingDate: string | null,
  monthsBefore: number,
): string | null {
  if (!weddingDate) return null;
  const wd = new Date(weddingDate + "T00:00:00Z");
  if (Number.isNaN(wd.getTime())) return null;
  const due = new Date(wd);
  due.setUTCMonth(due.getUTCMonth() - monthsBefore);
  return due.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Service role key not configured" },
      { status: 503 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (!ratelimit(ip)) {
    return NextResponse.json(
      { error: "rate limited — try again soon" },
      { status: 429 },
    );
  }

  let body: CouplesSignupBody;
  try {
    body = (await request.json()) as CouplesSignupBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Honeypot: silent success. Don't tip off bots that we filtered them.
  if (body.site && typeof body.site === "string" && body.site.trim()) {
    return NextResponse.json({ ok: true });
  }

  const yourName = sanitizeText(body.your_name, 120);
  const partnerName = sanitizeText(body.partner_name, 120);
  const region = sanitizeText(body.region, 200);
  const weddingDate =
    typeof body.wedding_date === "string" && body.wedding_date.trim()
      ? body.wedding_date.trim()
      : null;
  const guestCount =
    typeof body.guest_count === "number" && Number.isFinite(body.guest_count)
      ? Math.floor(body.guest_count)
      : null;
  const email = (body.email ?? "").trim().toLowerCase();

  if (!yourName) {
    return NextResponse.json({ error: "your_name required" }, { status: 400 });
  }
  if (!region) {
    return NextResponse.json({ error: "region required" }, { status: 400 });
  }
  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "valid email required" },
      { status: 400 },
    );
  }

  const orgName = partnerName
    ? `${yourName} & ${partnerName}'s wedding`
    : `${yourName}'s wedding`;
  const baseCurrency = pickCurrency(region);

  const service = buildServiceClient();
  const warnings: string[] = [];

  // 1. Create the organization
  const { data: org, error: orgErr } = await service
    .from("organizations")
    .insert({ name: orgName })
    .select("id")
    .single();
  if (orgErr || !org) {
    return NextResponse.json(
      { error: `Couldn't create org: ${orgErr?.message}` },
      { status: 500 },
    );
  }

  // 2. Create the workspace
  const { data: workspace, error: wsErr } = await service
    .from("workspaces")
    .insert({
      org_id: org.id,
      name: orgName,
      wedding_date: weddingDate,
      base_currency: baseCurrency,
    })
    .select("id")
    .single();
  if (wsErr || !workspace) {
    return NextResponse.json(
      { error: `Couldn't create workspace: ${wsErr?.message}` },
      { status: 500 },
    );
  }

  // 3. Magic link
  let magicLink: string | null = null;
  let authUserId: string | null = null;
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200"}/auth/callback`;
  try {
    const { data: linkData, error: linkErr } =
      await service.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });
    if (linkErr) {
      warnings.push(`Magic link generation failed: ${linkErr.message}`);
    } else {
      magicLink = linkData.properties?.action_link ?? null;
      authUserId = linkData.user?.id ?? null;
    }
  } catch (err) {
    warnings.push(`Magic link error: ${(err as Error).message}`);
  }

  // 4. Resolve auth user id if generateLink didn't return one (existing email)
  if (!authUserId) {
    try {
      const { data: list } = await service.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const match = list.users.find(
        (u) => (u.email ?? "").toLowerCase() === email,
      );
      authUserId = match?.id ?? null;
    } catch (err) {
      warnings.push(`listUsers error: ${(err as Error).message}`);
    }
  }

  // 5. public.users row — couple owns their own org so they can edit their
  //    library + playbook later, hence org_admin. role='couple' is the
  //    legacy workspace-level axis.
  if (authUserId) {
    const { error: userErr } = await service.from("users").upsert(
      {
        id: authUserId,
        email,
        role: "couple",
        org_role: "org_admin",
        org_id: org.id,
        workspace_id: workspace.id,
      },
      { onConflict: "id" },
    );
    if (userErr) {
      warnings.push(`User link failed: ${userErr.message}`);
    }
  } else {
    warnings.push("Auth user could not be resolved");
  }

  // 6. Default workspace_branding
  {
    const { error: brandErr } = await service
      .from("workspace_branding")
      .upsert(
        { workspace_id: workspace.id },
        { onConflict: "workspace_id" },
      );
    if (brandErr) {
      warnings.push(`Branding default insert failed: ${brandErr.message}`);
    }
  }

  // 7. Seed playbook_phases + playbook_tasks for the org so the planner-side
  //    /admin/playbook editor isn't empty if they ever flip a switch.
  const phaseRows = STARTER_PHASES.map((p, i) => ({
    org_id: org.id,
    label: p.label,
    sort_order: i,
    anchor_kind: "months_before_wedding",
    anchor_value_int: p.months_before,
  }));
  const { data: insertedPhases, error: phasesErr } = await service
    .from("playbook_phases")
    .insert(phaseRows)
    .select("id, sort_order");
  if (phasesErr || !insertedPhases) {
    warnings.push(
      `Playbook phases insert failed: ${phasesErr?.message ?? "unknown"}`,
    );
  } else {
    const sortedPhases = [...insertedPhases].sort(
      (a, b) =>
        (a as { sort_order: number }).sort_order -
        (b as { sort_order: number }).sort_order,
    );

    const taskRows: Array<{
      playbook_phase_id: string;
      title: string;
      owner_default: string;
      category: string;
      sort_order: number;
    }> = [];
    STARTER_PHASES.forEach((phase, phaseIdx) => {
      const phaseRow = sortedPhases[phaseIdx] as { id: string } | undefined;
      if (!phaseRow) return;
      phase.tasks.forEach((t, taskIdx) => {
        taskRows.push({
          playbook_phase_id: phaseRow.id,
          title: t.title,
          owner_default: t.owner,
          category: t.category,
          sort_order: taskIdx,
        });
      });
    });
    if (taskRows.length > 0) {
      const { error: tasksErr } = await service
        .from("playbook_tasks")
        .insert(taskRows);
      if (tasksErr) {
        warnings.push(`Playbook tasks insert failed: ${tasksErr.message}`);
      }
    }
  }

  // 8. Expand starter playbook directly into planning_tasks for /plan.
  //    We don't depend on the playbook_phases insert above — even if that
  //    failed, the couple still gets a populated /plan view from this step.
  const planningInserts: Array<{
    workspace_id: string;
    org_id: string;
    phase: PhaseEnum;
    title: string;
    owner: Owner;
    category: Category;
    months_before: number | null;
    due_date: string | null;
    status: "not_started";
    sort_order: number;
    is_user_added: false;
  }> = [];

  let globalSort = 0;
  for (const phase of STARTER_PHASES) {
    for (const task of phase.tasks) {
      planningInserts.push({
        workspace_id: workspace.id,
        org_id: org.id,
        phase: phase.phase_enum,
        title: task.title,
        owner: task.owner,
        category: task.category,
        months_before: phase.months_before,
        due_date: computeDueDate(weddingDate, phase.months_before),
        status: "not_started",
        sort_order: globalSort++,
        is_user_added: false,
      });
    }
  }
  if (planningInserts.length > 0) {
    const { error: planErr } = await service
      .from("planning_tasks")
      .insert(planningInserts);
    if (planErr) {
      warnings.push(`Planning tasks insert failed: ${planErr.message}`);
    }
  }

  // 9. Stash signup metadata (guest count etc) on the org as a soft hint.
  //    This is best-effort — we don't fail the signup if it doesn't land.
  if (guestCount != null) {
    try {
      // Most installs have an organizations.metadata JSONB column; if not,
      // this becomes a no-op.
      await (
        service as unknown as {
          from: (t: string) => {
            update: (rows: unknown) => {
              eq: (
                col: string,
                val: string,
              ) => Promise<{ error: { message: string } | null }>;
            };
          };
        }
      )
        .from("organizations")
        .update({ metadata: { signup_guest_count_estimate: guestCount } })
        .eq("id", org.id);
    } catch {
      // ignore; metadata column may not exist
    }
  }

  return NextResponse.json({
    ok: true,
    org_id: org.id,
    workspace_id: workspace.id,
    user_id: authUserId,
    magic_link: magicLink,
    warnings,
    your_name: yourName,
    partner_name: partnerName,
    region,
    base_currency: baseCurrency,
  });
}
