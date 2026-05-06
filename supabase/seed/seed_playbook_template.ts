// Port the existing 73 `planning_tasks` rows from the demo workspace into
// the org-scoped `playbook_phases` + `playbook_tasks` tables, so the planner's
// master A-Z template is populated. Future client workspaces can then receive
// this whole template via /api/admin/playbook/apply.
//
// Idempotent — UPSERT keyed on (org_id, label) for phases and
// (playbook_phase_id, title) for tasks.
//
// PRECONDITION: 20260506000012_planner_os.sql must be applied. The data
// migration (db:migrate-planner-os) must have run, so an org_id exists with
// at least one workspace. Existing planning_tasks must already be seeded
// (db:seed + db:seed-planning-tasks).

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
loadEnv({ path: path.join(repoRoot, "apps/web/.env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Map the legacy `phase` enum → playbook phase metadata.
// Sort order matches the order the original seed used.
// anchor_value_int is "months before wedding" — pinned to the upper bound
// of the phase's months_before window so /admin/playbook editing is intuitive.
const PHASE_META: Record<
  string,
  { label: string; sort_order: number; anchor_value_int: number }
> = {
  pre_12_months: { label: "12+ months before", sort_order: 0, anchor_value_int: 14 },
  months_9_12: { label: "9–12 months before", sort_order: 1, anchor_value_int: 12 },
  months_6_9: { label: "6–9 months before", sort_order: 2, anchor_value_int: 9 },
  months_3_6: { label: "3–6 months before", sort_order: 3, anchor_value_int: 6 },
  months_1_3: { label: "1–3 months before", sort_order: 4, anchor_value_int: 3 },
  final_month: { label: "Final month", sort_order: 5, anchor_value_int: 1 },
  final_week: { label: "Final week", sort_order: 6, anchor_value_int: 0 },
  day_of: { label: "Day of", sort_order: 7, anchor_value_int: 0 },
  post_wedding: { label: "Post-wedding", sort_order: 8, anchor_value_int: 0 },
};

interface PlanningTaskRow {
  id: string;
  title: string;
  description: string | null;
  phase: string;
  category: string | null;
  owner: string | null;
  sort_order: number | null;
  auto_derive_kind: string | null;
}

async function main() {
  // 1. Resolve org_id from any existing workspace
  const { data: workspace } = await sb
    .from("workspaces")
    .select("id, org_id")
    .limit(1)
    .maybeSingle();
  if (!workspace) throw new Error("no workspace; run pnpm db:seed first");
  const orgId = workspace.org_id;

  // 2. Read the existing 73 planning_tasks (use the demo workspace's rows
  //    as canonical — they were seeded from the original task spec)
  const { data: tasks, error: tErr } = (await sb
    .from("planning_tasks")
    .select("id, title, description, phase, category, owner, sort_order, auto_derive_kind")
    .eq("workspace_id", workspace.id)
    .order("phase")
    .order("sort_order")) as unknown as {
    data: PlanningTaskRow[] | null;
    error: { message: string } | null;
  };
  if (tErr) throw tErr;
  if (!tasks || tasks.length === 0) {
    throw new Error(
      "no planning_tasks rows found — run pnpm db:seed-planning-tasks first",
    );
  }

  // 3. Group by phase
  const tasksByPhase = new Map<string, PlanningTaskRow[]>();
  for (const t of tasks) {
    const arr = tasksByPhase.get(t.phase) ?? [];
    arr.push(t);
    tasksByPhase.set(t.phase, arr);
  }

  let phasesCreated = 0;
  let phasesExisting = 0;
  let tasksCreated = 0;
  let tasksExisting = 0;

  // 4. For each unique phase enum value, ensure a playbook_phases row exists
  for (const [phaseEnum, phaseTasks] of tasksByPhase) {
    const meta = PHASE_META[phaseEnum];
    if (!meta) {
      console.warn(`! unknown phase enum '${phaseEnum}' — skipping`);
      continue;
    }

    // Look for existing phase by (org_id, label)
    const sbAny = sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            eq: (
              col: string,
              val: string,
            ) => {
              maybeSingle: () => Promise<{
                data: { id: string } | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
        insert: (payload: Record<string, unknown>) => {
          select: (cols: string) => {
            single: () => Promise<{
              data: { id: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };

    const { data: existing } = await sbAny
      .from("playbook_phases")
      .select("id")
      .eq("org_id", orgId)
      .eq("label", meta.label)
      .maybeSingle();

    let phaseId: string;
    if (existing) {
      phaseId = existing.id;
      phasesExisting += 1;
    } else {
      const { data: created, error: insErr } = await sbAny
        .from("playbook_phases")
        .insert({
          org_id: orgId,
          label: meta.label,
          sort_order: meta.sort_order,
          anchor_kind: "months_before_wedding",
          anchor_value_int: meta.anchor_value_int,
        })
        .select("id")
        .single();
      if (insErr || !created) throw new Error(`phase insert: ${insErr?.message}`);
      phaseId = created.id;
      phasesCreated += 1;
    }

    // 5. For each task in the phase, ensure a playbook_tasks row exists
    for (let idx = 0; idx < phaseTasks.length; idx += 1) {
      const t = phaseTasks[idx];

      const sbT = sb as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (
              col: string,
              val: string,
            ) => {
              eq: (
                col: string,
                val: string,
              ) => {
                maybeSingle: () => Promise<{
                  data: { id: string } | null;
                  error: { message: string } | null;
                }>;
              };
            };
          };
          insert: (payload: Record<string, unknown>) => Promise<{
            error: { message: string } | null;
          }>;
        };
      };

      const { data: existingTask } = await sbT
        .from("playbook_tasks")
        .select("id")
        .eq("playbook_phase_id", phaseId)
        .eq("title", t.title)
        .maybeSingle();

      if (existingTask) {
        tasksExisting += 1;
        continue;
      }

      const { error: tInsErr } = await sbT.from("playbook_tasks").insert({
        playbook_phase_id: phaseId,
        title: t.title,
        description: t.description,
        owner_default: t.owner,
        category: t.category,
        sort_order: idx,
        auto_derive_kind: t.auto_derive_kind,
      });
      if (tInsErr) throw new Error(`task insert (${t.title}): ${tInsErr.message}`);
      tasksCreated += 1;
    }
  }

  console.log("");
  console.log("Playbook seeded:");
  console.log(`  phases: ${phasesCreated} created, ${phasesExisting} existing`);
  console.log(`  tasks:  ${tasksCreated} created, ${tasksExisting} existing`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
