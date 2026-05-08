// Provision Hursh's friend KC's account.
//
// Mirrors what /api/couples-signup does internally: creates an org + a
// workspace + a magic-link, links the user as org_admin (so they can
// manage their own library) + workspace member (so RLS lets them read
// their own data) + team_role='owner'. Applies the 9-phase playbook.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=xxx pnpm db:seed-kc
//
// The output prints the magic link — text it to KC.

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://dfyryyzizxcxtysduono.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wedding-os-production.up.railway.app";

if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY missing");
  process.exit(1);
}

const FRIEND_EMAIL = "kcdevine96@gmail.com";
const ORG_NAME = "KC's wedding";
const WORKSPACE_NAME = "KC's wedding — Newport 2026";
const REGION = "Newport, RI";
const BASE_CURRENCY = "USD";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // Idempotent: if a user already exists with that email, just generate a
  // fresh magic link.
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list.users.find(
    (u) => (u.email ?? "").toLowerCase() === FRIEND_EMAIL,
  );

  if (existing) {
    console.log(`✓ User exists: ${existing.id}`);
    const { data: link } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email: FRIEND_EMAIL,
      options: { redirectTo: `${SITE_URL}/auth/callback` },
    });
    console.log("\n──────────────────────────────────────");
    console.log("Magic link for KC:");
    console.log(link?.properties?.action_link ?? "(generation failed)");
    console.log("──────────────────────────────────────\n");
    return;
  }

  // 1. Create org
  const { data: org, error: orgErr } = await sb
    .from("organizations")
    .insert({ name: ORG_NAME })
    .select("id")
    .single();
  if (orgErr || !org) {
    console.error("Org insert:", orgErr);
    return;
  }
  console.log(`✓ Org created: ${org.id}`);

  // 2. Create workspace
  const { data: ws, error: wsErr } = await sb
    .from("workspaces")
    .insert({
      org_id: org.id,
      name: WORKSPACE_NAME,
      base_currency: BASE_CURRENCY,
    })
    .select("id")
    .single();
  if (wsErr || !ws) {
    console.error("Workspace insert:", wsErr);
    return;
  }
  console.log(`✓ Workspace created: ${ws.id}`);

  // 2b. Set wedding_region for onboarding to skip the region question
  await (sb as unknown as {
    from: (t: string) => {
      update: (row: unknown) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  })
    .from("workspaces")
    .update({ wedding_region: REGION })
    .eq("id", ws.id);

  // 3. Generate magic link + auth user
  const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: FRIEND_EMAIL,
    options: { redirectTo: `${SITE_URL}/auth/callback` },
  });
  if (linkErr) {
    console.error("Magic link:", linkErr);
    return;
  }
  const authUserId = linkData?.user?.id;
  const magicLink = linkData?.properties?.action_link ?? null;

  // 4. Link public.users row
  if (authUserId) {
    const { error: userErr } = await (sb as unknown as {
      from: (t: string) => {
        upsert: (row: unknown, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
      };
    })
      .from("users")
      .upsert(
        {
          id: authUserId,
          email: FRIEND_EMAIL,
          role: "couple",
          org_role: "org_admin",
          team_role: "owner",
          org_id: org.id,
          workspace_id: ws.id,
        },
        { onConflict: "id" },
      );
    if (userErr) console.error("User link:", userErr);
    else console.log(`✓ User linked: ${authUserId}`);
  }

  // 5. Default branding row
  await (sb as unknown as {
    from: (t: string) => {
      upsert: (row: unknown, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
    };
  })
    .from("workspace_branding")
    .upsert({ workspace_id: ws.id }, { onConflict: "workspace_id" });

  // 6. Apply playbook (9 phases × ~8 tasks). Hardcoded literal mirrored from
  // /api/admin/welcome/apply-playbook.
  const PHASES = [
    { sort: 1, name: "Foundation", description: "Pick the wedding date, set total budget, lock down guest count." },
    { sort: 2, name: "Venue search", description: "Tour venues, lock the lead venue, sign the venue contract." },
    { sort: 3, name: "Vendor curation", description: "RFP photographer, florist, DJ, caterer, MUA, transportation." },
    { sort: 4, name: "Design + planning", description: "Lock the look, design the day, finalize timeline." },
    { sort: 5, name: "Guest list + invites", description: "Save the dates, invitations, RSVP tracking." },
    { sort: 6, name: "Logistics", description: "Hotel block, transportation, welcome bags, day-of timeline." },
    { sort: 7, name: "Final details", description: "Final headcount, seating chart, final payments." },
    { sort: 8, name: "Wedding week", description: "Rehearsal, run-of-show with vendors, last-minute logistics." },
    { sort: 9, name: "After", description: "Thank-you cards, photos, vendor reviews." },
  ];
  const TASKS_BY_PHASE: Record<string, Array<{ title: string; months_before: number }>> = {
    "Foundation": [
      { title: "Pick wedding date", months_before: 12 },
      { title: "Set total budget", months_before: 12 },
      { title: "Draft initial guest list", months_before: 11 },
    ],
    "Venue search": [
      { title: "Shortlist 3 venues", months_before: 10 },
      { title: "Tour venues", months_before: 9 },
      { title: "Sign venue contract", months_before: 8 },
    ],
    "Vendor curation": [
      { title: "Book photographer", months_before: 7 },
      { title: "Book florist", months_before: 6 },
      { title: "Book DJ", months_before: 6 },
      { title: "Book caterer", months_before: 6 },
    ],
    "Design + planning": [
      { title: "Build inspiration mood board", months_before: 5 },
      { title: "Approve design deck", months_before: 4 },
    ],
    "Guest list + invites": [
      { title: "Send save the dates", months_before: 6 },
      { title: "Mail invitations", months_before: 3 },
      { title: "Chase RSVPs", months_before: 1 },
    ],
    "Logistics": [
      { title: "Lock hotel block", months_before: 5 },
      { title: "Arrange transportation", months_before: 2 },
    ],
    "Final details": [
      { title: "Final headcount to caterer", months_before: 1 },
      { title: "Build seating chart", months_before: 1 },
    ],
    "Wedding week": [
      { title: "Rehearsal dinner", months_before: 0 },
      { title: "Day-of", months_before: 0 },
    ],
    "After": [
      { title: "Thank-you cards", months_before: 0 },
    ],
  };

  // Insert phases for org
  const phaseRows = PHASES.map((p) => ({
    org_id: org.id,
    sort_order: p.sort,
    name: p.name,
    description: p.description,
  }));
  const { data: insertedPhases, error: phaseErr } = await (sb as unknown as {
    from: (t: string) => {
      insert: (rows: unknown) => {
        select: (cols: string) => Promise<{ data: Array<{ id: string; name: string }> | null; error: { message: string } | null }>;
      };
    };
  })
    .from("playbook_phases")
    .insert(phaseRows)
    .select("id, name");
  if (phaseErr) console.error("Phases insert:", phaseErr);
  const phasesByName = new Map<string, string>();
  for (const p of insertedPhases ?? []) phasesByName.set(p.name, p.id);

  // Insert tasks for each phase
  const taskRows: unknown[] = [];
  const planningRows: unknown[] = [];
  for (const phase of PHASES) {
    const phaseId = phasesByName.get(phase.name);
    if (!phaseId) continue;
    const tasks = TASKS_BY_PHASE[phase.name] ?? [];
    for (const t of tasks) {
      taskRows.push({
        org_id: org.id,
        phase_id: phaseId,
        title: t.title,
        months_before: t.months_before,
      });
      planningRows.push({
        workspace_id: ws.id,
        org_id: org.id,
        phase: phase.name,
        title: t.title,
        status: "todo",
      });
    }
  }
  if (taskRows.length) {
    await (sb as unknown as {
      from: (t: string) => {
        insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
      };
    })
      .from("playbook_tasks")
      .insert(taskRows);
    console.log(`✓ Inserted ${taskRows.length} playbook tasks`);
  }
  if (planningRows.length) {
    await (sb as unknown as {
      from: (t: string) => {
        insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
      };
    })
      .from("planning_tasks")
      .insert(planningRows);
    console.log(`✓ Inserted ${planningRows.length} planning_tasks for KC's workspace`);
  }

  console.log("\n──────────────────────────────────────");
  console.log("✓✓ KC's account ready.");
  console.log(`  Org:       ${ORG_NAME}`);
  console.log(`  Workspace: ${WORKSPACE_NAME}`);
  console.log(`  Email:     ${FRIEND_EMAIL}`);
  console.log("\nMagic link to text to KC:");
  console.log(magicLink ?? "(generation failed)");
  console.log("──────────────────────────────────────\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
