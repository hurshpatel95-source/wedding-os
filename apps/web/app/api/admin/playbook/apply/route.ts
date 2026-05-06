import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "../_guard";
import {
  PLAYBOOK_CATEGORY_OPTIONS,
  PLAYBOOK_OWNER_OPTIONS,
  anchorToPhaseEnum,
  anchorToMonthsBefore,
} from "@/lib/playbook-types";

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
    .select("id, org_id")
    .eq("id", body.workspace_id)
    .maybeSingle();

  if (!workspace || workspace.org_id !== guard.orgId) {
    return NextResponse.json(
      { error: "workspace not found in your org" },
      { status: 404 },
    );
  }

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
  const { data: tasks, error: tasksErr } = await supabase
    .from("playbook_tasks")
    .select(
      "id, playbook_phase_id, title, description, owner_default, category, sort_order, auto_derive_kind",
    )
    .in("playbook_phase_id", phaseIds)
    .order("sort_order", { ascending: true });
  if (tasksErr) {
    return NextResponse.json({ error: tasksErr.message }, { status: 500 });
  }

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

  const inserts: Array<{
    workspace_id: string;
    org_id: string;
    phase_id: string;
    phase: ReturnType<typeof anchorToPhaseEnum>;
    sort_order: number;
    title: string;
    description: string | null;
    owner: "couple" | "planner" | "groom" | "bride" | "family" | "vendor";
    category:
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
    months_before: number | null;
    auto_derive_kind: string | null;
    is_user_added: false;
  }> = [];

  let skipped = 0;
  for (const t of tasks ?? []) {
    const phase = phaseById.get(t.playbook_phase_id);
    if (!phase) continue;
    const key = `${t.playbook_phase_id}::${t.title.toLowerCase()}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }
    const owner = ownerSet.has(t.owner_default ?? "")
      ? (t.owner_default as "couple" | "planner" | "groom" | "bride" | "family" | "vendor")
      : "couple";
    const category = categorySet.has(t.category ?? "")
      ? (t.category as
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
          | "other")
      : "other";
    inserts.push({
      workspace_id: body.workspace_id,
      org_id: guard.orgId,
      phase_id: t.playbook_phase_id,
      phase: anchorToPhaseEnum(phase.anchor_kind, phase.anchor_value_int),
      sort_order: t.sort_order,
      title: t.title,
      description: t.description ?? null,
      owner,
      category,
      months_before: anchorToMonthsBefore(phase.anchor_kind, phase.anchor_value_int),
      auto_derive_kind: t.auto_derive_kind ?? null,
      is_user_added: false,
    });
  }

  if (inserts.length === 0) {
    return NextResponse.json({ inserted: 0, skipped });
  }

  const { error: insertErr } = await supabase
    .from("planning_tasks")
    .insert(inserts as never);

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: inserts.length, skipped });
}
