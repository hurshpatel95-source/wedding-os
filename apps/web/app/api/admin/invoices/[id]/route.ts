import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface PatchBody {
  label?: string;
  amount_eur?: number;
  due_at?: string | null;
  notes?: string | null;
  external_url?: string | null;
  paid_via?: string | null;
  mark_sent?: boolean;
  mark_paid?: boolean;
  mark_unpaid?: boolean;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json()) as PatchBody;
  const patch: Record<string, unknown> = {};
  if (body.label !== undefined) patch.label = body.label.trim();
  if (body.amount_eur !== undefined) patch.amount_eur = Number(body.amount_eur);
  if (body.due_at !== undefined) patch.due_at = body.due_at;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.external_url !== undefined) patch.external_url = body.external_url;
  if (body.paid_via !== undefined) patch.paid_via = body.paid_via;
  if (body.mark_sent === true) patch.sent_at = new Date().toISOString();
  if (body.mark_paid === true) patch.paid_at = new Date().toISOString();
  if (body.mark_unpaid === true) patch.paid_at = null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const sb = supabase as unknown as {
    from: (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
      delete: () => {
        eq: (col: string, val: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
  };

  const { error } = await sb
    .from("planner_invoices")
    .update(patch)
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabase as unknown as {
    from: (t: string) => {
      delete: () => {
        eq: (col: string, val: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
  };
  const { error } = await sb
    .from("planner_invoices")
    .delete()
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
