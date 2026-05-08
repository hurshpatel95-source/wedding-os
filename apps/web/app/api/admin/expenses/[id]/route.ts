import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const VALID_CATEGORIES = new Set([
  "vendor_payment",
  "software",
  "travel",
  "marketing",
  "office",
  "taxes",
  "misc",
]);

interface PatchBody {
  label?: string;
  amount_eur?: number;
  category?: string | null;
  paid_at?: string | null;
  due_at?: string | null;
  workspace_id?: string | null;
  vendor_id?: string | null;
  notes?: string | null;
  external_url?: string | null;
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
  if (body.category !== undefined && body.category !== null) {
    if (!VALID_CATEGORIES.has(body.category)) {
      return NextResponse.json({ error: "bad category" }, { status: 400 });
    }
    patch.category = body.category;
  }
  if (body.paid_at !== undefined) patch.paid_at = body.paid_at;
  if (body.due_at !== undefined) patch.due_at = body.due_at;
  if (body.workspace_id !== undefined) patch.workspace_id = body.workspace_id;
  if (body.vendor_id !== undefined) patch.vendor_id = body.vendor_id;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.external_url !== undefined) patch.external_url = body.external_url;

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

  // RLS already restricts to org_admin within the same org_id, so we don't
  // need to manually validate org match here.
  const { error } = await sb
    .from("planner_expenses")
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
    .from("planner_expenses")
    .delete()
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
