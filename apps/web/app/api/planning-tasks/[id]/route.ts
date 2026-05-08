// PATCH /api/planning-tasks/[id]
//
// Per-task patch endpoint. Mostly a thin wrapper around supabase.update,
// BUT — and this is the point — it knows how to keep /plan tasks in sync
// with /budget lines:
//
// • If the patch sets `estimated_cost` AND no `budget_line_id` is linked,
//   we auto-create a leaf budget_line under the task's category and
//   back-link it. Couples don't have to think about two places.
//
// • If the patch links/unlinks `budget_line_id`, we also keep the line's
//   amount_estimated in step with the task's estimated_cost (so /budget
//   doesn't drift from /plan).
//
// Anything else (title, phase, status, etc.) just passes through.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  BUDGET_CATEGORY_LABEL,
  type BudgetCategory,
} from "@/lib/autopilot-types";

export const runtime = "nodejs";

interface PatchBody {
  title?: string;
  description?: string | null;
  status?: string;
  phase?: string;
  category?: string;
  owner?: string;
  due_date?: string | null;
  notes?: string | null;
  done_at?: string | null;
  estimated_cost?: number | null;
  budget_line_id?: string | null;
}

// Map planning_tasks.task_category → budget_lines.budget_category. Most
// names match; the ones below need a translation.
function taskCategoryToBudgetCategory(c: string | null | undefined): BudgetCategory {
  switch (c) {
    case "venue":
      return "venue";
    case "vendor":
      return "misc"; // ambiguous — couple should re-link to a real line
    case "attire":
      return "attire";
    case "design":
      return "flowers_decor";
    case "ritual":
      return "officiant";
    case "logistics":
      return "transportation";
    case "guest":
      return "stationery";
    case "finance":
      return "contingency";
    case "honeymoon":
      return "misc";
    case "paperwork":
      return "misc";
    default:
      return "misc";
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const taskId = params.id;
  if (!taskId) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id, org_id")
    .eq("id", user.id)
    .maybeSingle();
  const profileTyped = profile as
    | { workspace_id: string; org_id: string }
    | null;
  if (!profileTyped?.workspace_id || !profileTyped?.org_id) {
    return NextResponse.json({ error: "no workspace" }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Load the existing task to know its current category + budget_line_id.
  const sbTask = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: {
              id: string;
              title: string;
              category: string;
              budget_line_id: string | null;
              estimated_cost: number | null;
              workspace_id: string;
            } | null;
          }>;
        };
      };
      update: (p: unknown) => {
        eq: (col: string, val: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
  };

  const { data: existing } = await sbTask
    .from("planning_tasks")
    .select("id, title, category, budget_line_id, estimated_cost, workspace_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }
  if (existing.workspace_id !== profileTyped.workspace_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.status !== undefined) {
    patch.status = body.status;
    if (body.status === "done") patch.done_at = new Date().toISOString();
    else patch.done_at = null;
  }
  if (body.phase !== undefined) patch.phase = body.phase;
  if (body.category !== undefined) patch.category = body.category;
  if (body.owner !== undefined) patch.owner = body.owner;
  if (body.due_date !== undefined) patch.due_date = body.due_date;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.estimated_cost !== undefined) {
    patch.estimated_cost = body.estimated_cost;
  }
  if (body.budget_line_id !== undefined) {
    patch.budget_line_id = body.budget_line_id;
  }

  // Auto-create a budget line when the user types a cost without linking.
  let createdLineId: string | null = null;
  if (
    body.estimated_cost != null &&
    body.estimated_cost > 0 &&
    body.budget_line_id === undefined &&
    !existing.budget_line_id
  ) {
    const cat = taskCategoryToBudgetCategory(
      (body.category as string | undefined) ?? existing.category,
    );

    // Find or create the parent category row.
    const sbBudget = supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            is: (col: string, v: null) => {
              eq: (col: string, val: string) => Promise<{
                data: Array<{ id: string }> | null;
              }>;
            };
          };
        };
        insert: (row: Record<string, unknown>) => {
          select: (cols: string) => {
            single: () => Promise<{
              data: { id: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };

    const { data: parentRows } = await sbBudget
      .from("budget_lines")
      .select("id")
      .eq("workspace_id", profileTyped.workspace_id)
      .is("parent_line_id", null)
      .eq("category", cat);
    let parentId = parentRows?.[0]?.id ?? null;

    // Create parent if missing.
    if (!parentId) {
      const { data: parentIns } = await sbBudget
        .from("budget_lines")
        .insert({
          workspace_id: profileTyped.workspace_id,
          org_id: profileTyped.org_id,
          parent_line_id: null,
          category: cat,
          label: BUDGET_CATEGORY_LABEL[cat],
          amount_estimated: null,
          status: "placeholder",
          source: "manual",
          sort_order: 99,
        })
        .select("id")
        .single();
      parentId = parentIns?.id ?? null;
    }

    if (parentId) {
      // Now create the leaf line for this task.
      const { data: leafIns, error: leafErr } = await sbBudget
        .from("budget_lines")
        .insert({
          workspace_id: profileTyped.workspace_id,
          org_id: profileTyped.org_id,
          parent_line_id: parentId,
          category: cat,
          label: existing.title,
          amount_estimated: body.estimated_cost,
          total_eur: body.estimated_cost,
          status: "placeholder",
          source: "manual",
          sort_order: 0,
        })
        .select("id")
        .single();
      if (!leafErr && leafIns?.id) {
        patch.budget_line_id = leafIns.id;
        createdLineId = leafIns.id;
      }
    }
  }

  // If a linked budget_line_id is set AND estimated_cost is changing,
  // also push the new amount onto that line so /budget mirrors /plan.
  if (
    body.estimated_cost != null &&
    !createdLineId &&
    (body.budget_line_id ?? existing.budget_line_id)
  ) {
    const lineId = body.budget_line_id ?? existing.budget_line_id;
    if (lineId) {
      const sbBudgetUpd = supabase as unknown as {
        from: (t: string) => {
          update: (p: Record<string, unknown>) => {
            eq: (col: string, val: string) => Promise<{
              error: { message: string } | null;
            }>;
          };
        };
      };
      try {
        await sbBudgetUpd
          .from("budget_lines")
          .update({
            amount_estimated: body.estimated_cost,
            total_eur: body.estimated_cost,
          })
          .eq("id", lineId);
      } catch {
        // best-effort; the task patch still lands.
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error: updErr } = await sbTask
    .from("planning_tasks")
    .update(patch)
    .eq("id", taskId);
  if (updErr) {
    return NextResponse.json(
      { error: `Couldn't save task: ${updErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    created_budget_line_id: createdLineId,
  });
}
