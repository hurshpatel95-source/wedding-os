import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "../_guard";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = await requireOrgAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as {
    playbook_phase_id?: string;
    title?: string;
    description?: string | null;
    owner_default?: string | null;
    category?: string | null;
    auto_derive_kind?: string | null;
    sort_order?: number;
  };

  if (!body.playbook_phase_id || !body.title) {
    return NextResponse.json(
      { error: "playbook_phase_id + title required" },
      { status: 400 },
    );
  }

  const supabase = createClient();

  // Verify the phase belongs to caller's org so we don't leak across orgs
  // even if RLS is bypassed somehow.
  const { data: phase } = await supabase
    .from("playbook_phases")
    .select("id, org_id")
    .eq("id", body.playbook_phase_id)
    .maybeSingle();
  if (!phase || phase.org_id !== guard.orgId) {
    return NextResponse.json({ error: "phase not found" }, { status: 404 });
  }

  let nextSortOrder = body.sort_order;
  if (nextSortOrder == null) {
    const { data: maxRows } = await supabase
      .from("playbook_tasks")
      .select("sort_order")
      .eq("playbook_phase_id", body.playbook_phase_id)
      .order("sort_order", { ascending: false })
      .limit(1);
    nextSortOrder = (maxRows?.[0]?.sort_order ?? -1) + 1;
  }

  const { data, error } = await supabase
    .from("playbook_tasks")
    .insert({
      playbook_phase_id: body.playbook_phase_id,
      title: body.title.trim(),
      description: body.description ?? null,
      owner_default: body.owner_default ?? null,
      category: body.category ?? null,
      auto_derive_kind: body.auto_derive_kind ?? null,
      sort_order: nextSortOrder,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ task: data });
}
