import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "../../_guard";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const guard = await requireOrgAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    description?: string | null;
    owner_default?: string | null;
    category?: string | null;
    auto_derive_kind?: string | null;
    sort_order?: number;
    playbook_phase_id?: string;
  };

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (body.description !== undefined) patch.description = body.description ?? null;
  if (body.owner_default !== undefined) patch.owner_default = body.owner_default ?? null;
  if (body.category !== undefined) patch.category = body.category ?? null;
  if (body.auto_derive_kind !== undefined)
    patch.auto_derive_kind = body.auto_derive_kind ?? null;
  if (typeof body.sort_order === "number") patch.sort_order = body.sort_order;
  if (typeof body.playbook_phase_id === "string")
    patch.playbook_phase_id = body.playbook_phase_id;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("playbook_tasks")
    .update(patch as never)
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const guard = await requireOrgAdmin();
  if (!guard.ok) return guard.response;

  const supabase = createClient();
  const { error } = await supabase
    .from("playbook_tasks")
    .delete()
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
