import { NextRequest, NextResponse } from "next/server";
import { addYears } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "../_guard";
import {
  PLAYBOOK_CATEGORY_OPTIONS,
  PLAYBOOK_OWNER_OPTIONS,
  anchorToPhaseEnum,
  anchorToMonthsBefore,
} from "@/lib/playbook-types";
import { isValidRecurrenceRule } from "@/lib/wave2-types";
import {
  computeAnchorDate,
  expandRecurrenceForApply,
} from "@/lib/recurrence-server";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/admin/playbook/apply
// Body: { workspace_id: string, replace?: boolean }
//
// Copies playbook_phases + playbook_tasks for the caller's org into
// planning_tasks rows for the target workspace. Each task carries its
// playbook phase id so /plan can group renamed phases correctly without
// re-keying the enum.
//
// Behavior:
//   - "replace"=false (default): inserts only tasks whose phase_id is not
//     already represented in planning_tasks for this workspace. This is the
//     idempotent path so re-applying the playbook later doesn't duplicate.
//   - "replace"=true: deletes existing rows where phase_id IS NOT NULL and
//     is_user_added=false, then re-inserts. Preserves user-added tasks and
//     legacy seeded rows that pre-date phase_id.
//
// Owner / category strings in the playbook are coerced to the planning_tasks
// enums; unknown values fall back to safe defaults so RLS+CHECK don't reject.

export async function POST(request: NextRequest) {
  const guard = await requireOrgAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as {
    workspace_id?: string;
    replace?: boolean;
  };

  if (!body.workspace_id) {
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
  }

  const supabase = createClient();

  // Verify the workspace is in caller's org.
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, org_id, wedding_date")
    .eq("id", body.workspace_id)
    .maybeSingle();

  if (!workspace || workspace.org_id !== guard.orgId) {
    return NextResponse.json(
      { error: "workspace not found in your org" },
      { status: 404 },
    );
  }
  const workspaceWeddingDate =
    (workspace as { wedding_date?: string | null }).wedding_date ?? null;

  // Pull playbook tree for the org.
  const { data: phases, error: phasesErr } = await supabase
    .from("playbook_phases")
    .select("id, label, sort_order, anchor_kind, anchor_value_int")
    .eq("org_id", guard.orgId)
    .order("sort_order", { ascending: true });
  if (phasesErr) {
    return NextResponse.json({ error: phasesErr.message }, { status: 500 });
  }
  if (!phases || phases.length === 0) {
    return NextResponse.json(
      { error: "playbook is empty — add a phase first" },
      { status: 400 },
    );
  }

  const phaseIds = phases.map((p) => p.id);
  // recurrence_rule + recurrence_anchor are added in 20260507000001 but not
  // yet in generated Database types — cast the table reference to bypass
  // strict select-string parsing while keeping runtime behavior identical.
  type PlaybookTaskRow = {
    id: string;
    playbook_phase_id: string;
    title: string;
    description: string | null;
    owner_default: string | null;
    category: string | null;
    sort_order: number;
    auto_derive_kind: string | null;
    recurrence_rule: string | null;
    recurrence_anchor: string | null;
  };
  const { data: tasksRaw, error: tasksErr } = await (
    supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          in: (
            col: string,
            vals: string[],
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{
              data: PlaybookTaskRow[] | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("playbook_tasks")
    .select(
      "id, playbook_phase_id, title, description, owner_default, category, sort_order, auto_derive_kind, recurrence_rule, recurrence_anchor",
    )
    .in("playbook_phase_id", phaseIds)
    .order("sort_order", { ascending: true });
  if (tasksErr) {
    return NextResponse.json({ error: tasksErr.message }, { status: 500 });
  }
  const tasks: PlaybookTaskRow[] = tasksRaw ?? [];

  // Optional replace step: drop existing playbook-derived rows so re-apply is
  // a clean overwrite.
  if (body.replace) {
    const { error: delErr } = await supabase
      .from("planning_tasks")
      .delete()
      .eq("workspace_id", body.workspace_id)
      .eq("is_user_added", false)
      .not("phase_id", "is", null);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
  }

  // Pull existing rows so non-replace mode can skip duplicates by
  // (phase_id, title) — covers the case where the org admin re-applies after
  // adding a few new tasks to the playbook.
  const { data: existingRows } = await supabase
    .from("planning_tasks")
    .select("phase_id, title")
    .eq("workspace_id", body.workspace_id);
  const existingKeys = new Set<string>();
  for (const r of existingRows ?? []) {
    if (r.phase_id) existingKeys.add(`${r.phase_id}::${r.title.toLowerCase()}`);
  }

  const phaseById = new Map(phases.map((p) => [p.id, p]));
  const ownerSet = new Set<string>(PLAYBOOK_OWNER_OPTIONS);
  const categorySet = new Set<string>(PLAYBOOK_CATEGORY_OPTIONS);

  type TaskOwnerEnum = "couple" | "planner" | "groom" | "bride" | "family" | "vendor";
  type TaskCategoryEnum =
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

  // Parent inserts are the rows that go in first. For recurring tasks, we
  // remember the planning_task we'll need to attach children to once we know
  // the parent's id (post-insert).
  type ParentInsert = {
    workspace_id: string;
    org_id: string;
    phase_id: string;
    phase: ReturnType<typeof anchorToPhaseEnum>;
    sort_order: number;
    title: string;
    description: string | null;
    owner: TaskOwnerEnum;
    category: TaskCategoryEnum;
    months_before: number | null;
    auto_derive_kind: string | null;
    is_user_added: false;
    // Recurrence metadata stays on the parent so the /plan UI can show a pill
    // and child rows reference back to it via recurrence_parent_task_id.
    recurrence_rule: string | null;
  };
  // Pending children captured by the same loop key so we can resolve parent
  // ids after the parent insert returns.
  type PendingChildren = {
    parentLookupKey: string; // `${phase_id}::${title-lower}`
    rows: Array<{
      due_date: string;
    }>;
    base: Omit<ParentInsert, "recurrence_rule">;
  };

  const parentInserts: ParentInsert[] = [];
  const pendingChildren: PendingChildren[] = [];

  let skipped = 0;
  for (const t of tasks) {
    const phase = phaseById.get(t.playbook_phase_id);
    if (!phase) continue;
    const key = `${t.playbook_phase_id}::${t.title.toLowerCase()}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }
    const owner: TaskOwnerEnum = ownerSet.has(t.owner_default ?? "")
      ? (t.owner_default as TaskOwnerEnum)
      : "couple";
    const category: TaskCategoryEnum = categorySet.has(t.category ?? "")
      ? (t.category as TaskCategoryEnum)
      : "other";

    const monthsBefore = anchorToMonthsBefore(
      phase.anchor_kind,
      phase.anchor_value_int,
    );

    const baseRow: Omit<ParentInsert, "recurrence_rule"> = {
      workspace_id: body.workspace_id,
      org_id: guard.orgId,
      phase_id: t.playbook_phase_id,
      phase: anchorToPhaseEnum(phase.anchor_kind, phase.anchor_value_int),
      sort_order: t.sort_order,
      title: t.title,
      description: t.description ?? null,
      owner,
      category,
      months_before: monthsBefore,
      auto_derive_kind: t.auto_derive_kind ?? null,
      is_user_added: false,
    };

    const ruleStr = t.recurrence_rule ?? null;
    const anchorStr = t.recurrence_anchor ?? "wedding_date";
    const isRecurring = Boolean(ruleStr) && isValidRecurrenceRule(ruleStr ?? "");

    parentInserts.push({
      ...baseRow,
      recurrence_rule: isRecurring ? ruleStr : null,
    });

    // Compute child due-dates only when we can resolve an anchor. If the
    // workspace has no wedding_date and the task is anchored to it, we still
    // create the parent (with the rule attached) so the planner UI shows it
    // as recurring; children expand on a future apply once the date is set.
    if (isRecurring && ruleStr) {
      const anchorDate = computeAnchorDate(
        workspaceWeddingDate,
        monthsBefore,
        anchorStr,
      );
      if (anchorDate) {
        const endDate = workspaceWeddingDate
          ? new Date(workspaceWeddingDate)
          : addYears(anchorDate, 1);
        const childRows = expandRecurrenceForApply(
          ruleStr,
          anchorDate,
          endDate,
          60,
        );
        if (childRows.length > 0) {
          pendingChildren.push({
            parentLookupKey: key,
            rows: childRows,
            base: baseRow,
          });
        }
      }
    }
  }

  if (parentInserts.length === 0) {
    return NextResponse.json({ inserted: 0, skipped, recurrence_children: 0 });
  }

  // Insert parents and ask Supabase to return ids so we can wire children up.
  // Cast: recurrence_rule isn't yet in generated Database types.
  const { data: insertedParents, error: insertErr } = await supabase
    .from("planning_tasks")
    .insert(parentInserts as never)
    .select("id, phase_id, title");

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Build a lookup so we can attach child rows to their freshly-inserted
  // parent's id. Multiple parents with the same (phase_id, title) within a
  // single apply call shouldn't happen since duplicates are filtered above,
  // so first-match is fine.
  const parentIdByKey = new Map<string, string>();
  for (const row of (insertedParents ?? []) as Array<{
    id: string;
    phase_id: string | null;
    title: string;
  }>) {
    if (!row.phase_id) continue;
    const k = `${row.phase_id}::${row.title.toLowerCase()}`;
    if (!parentIdByKey.has(k)) parentIdByKey.set(k, row.id);
  }

  let childrenInserted = 0;
  if (pendingChildren.length > 0) {
    const childInserts: Array<
      Omit<ParentInsert, "recurrence_rule"> & {
        due_date: string;
        recurrence_parent_task_id: string;
      }
    > = [];
    for (const pc of pendingChildren) {
      const parentId = parentIdByKey.get(pc.parentLookupKey);
      if (!parentId) continue;
      for (const row of pc.rows) {
        childInserts.push({
          ...pc.base,
          // Children share metadata with the parent, but each gets a concrete
          // due_date and points back at the parent. Sort_order is bumped so
          // children sit just below the parent within the phase.
          due_date: row.due_date,
          recurrence_parent_task_id: parentId,
        });
      }
    }
    if (childInserts.length > 0) {
      const { error: childErr } = await supabase
        .from("planning_tasks")
        .insert(childInserts as never);
      if (childErr) {
        return NextResponse.json(
          {
            error: `parent rows inserted but child expansion failed: ${childErr.message}`,
          },
          { status: 500 },
        );
      }
      childrenInserted = childInserts.length;
    }
  }

  return NextResponse.json({
    inserted: parentInserts.length,
    skipped,
    recurrence_children: childrenInserted,
  });
}
