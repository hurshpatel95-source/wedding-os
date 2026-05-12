import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "../../_guard";
import { isValidRecurrenceRule } from "@/lib/wave2-types";
import {
  dbUpdate,
  dbDelete,
  dbWriteErrorResponse,
} from "@/lib/db-write-guard";

export const runtime = "nodejs";

const VALID_RECURRENCE_ANCHORS = new Set([
  "wedding_date",
  "phase_start",
  "created_at",
]);

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
    recurrence_rule?: string | null;
    recurrence_anchor?: string | null;
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

  if (body.recurrence_rule !== undefined) {
    if (body.recurrence_rule === null || body.recurrence_rule === "") {
      patch.recurrence_rule = null;
    } else if (!isValidRecurrenceRule(body.recurrence_rule)) {
      return NextResponse.json(
        { error: `invalid recurrence_rule: ${body.recurrence_rule}` },
        { status: 400 },
      );
    } else {
      patch.recurrence_rule = body.recurrence_rule;
    }
  }
  if (body.recurrence_anchor !== undefined) {
    if (body.recurrence_anchor === null || body.recurrence_anchor === "") {
      patch.recurrence_anchor = null;
    } else if (!VALID_RECURRENCE_ANCHORS.has(body.recurrence_anchor)) {
      return NextResponse.json(
        { error: `invalid recurrence_anchor: ${body.recurrence_anchor}` },
        { status: 400 },
      );
    } else {
      patch.recurrence_anchor = body.recurrence_anchor;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const supabase = createClient();
  try {
    await dbUpdate(
      "update playbook_task",
      supabase
        .from("playbook_tasks")
        .update(patch as never)
        .eq("id", params.id)
        .select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body: errBody } = dbWriteErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const guard = await requireOrgAdmin();
  if (!guard.ok) return guard.response;

  const supabase = createClient();
  try {
    await dbDelete(
      "delete playbook_task",
      supabase.from("playbook_tasks").delete().eq("id", params.id).select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
