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
    label?: string;
    anchor_kind?: string | null;
    anchor_value_int?: number | null;
    sort_order?: number;
  };

  const patch: Record<string, unknown> = {};
  if (typeof body.label === "string") patch.label = body.label.trim();
  if (body.anchor_kind !== undefined) patch.anchor_kind = body.anchor_kind ?? null;
  if (body.anchor_value_int !== undefined)
    patch.anchor_value_int = body.anchor_value_int ?? null;
  if (typeof body.sort_order === "number") patch.sort_order = body.sort_order;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("playbook_phases")
    .update(patch as never)
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
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
    .from("playbook_phases")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
