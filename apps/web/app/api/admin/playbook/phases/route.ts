import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "../_guard";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = await requireOrgAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as {
    label?: string;
    anchor_kind?: string | null;
    anchor_value_int?: number | null;
    sort_order?: number;
  };

  if (!body.label || typeof body.label !== "string") {
    return NextResponse.json({ error: "label required" }, { status: 400 });
  }

  const supabase = createClient();

  // Default sort_order to one past the current max for the org.
  let nextSortOrder = body.sort_order;
  if (nextSortOrder == null) {
    const { data: maxRows } = await supabase
      .from("playbook_phases")
      .select("sort_order")
      .eq("org_id", guard.orgId)
      .order("sort_order", { ascending: false })
      .limit(1);
    nextSortOrder = (maxRows?.[0]?.sort_order ?? -1) + 1;
  }

  const { data, error } = await supabase
    .from("playbook_phases")
    .insert({
      org_id: guard.orgId,
      label: body.label.trim(),
      anchor_kind: body.anchor_kind ?? null,
      anchor_value_int: body.anchor_value_int ?? null,
      sort_order: nextSortOrder,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ phase: data });
}
