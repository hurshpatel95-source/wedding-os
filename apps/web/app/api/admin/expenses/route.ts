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

interface CreateBody {
  label: string;
  amount_eur: number;
  category?: string | null;
  paid_at?: string | null;
  due_at?: string | null;
  workspace_id?: string | null;
  vendor_id?: string | null;
  notes?: string | null;
  external_url?: string | null;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { org_role?: string | null; org_id?: string | null } | null;
          }>;
        };
      };
      insert: (p: Record<string, unknown>) => {
        select: (c: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  const { data: profile } = await sb
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.org_role !== "org_admin" || !profile.org_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as CreateBody;
  if (!body.label || body.amount_eur == null) {
    return NextResponse.json(
      { error: "label, amount_eur required" },
      { status: 400 },
    );
  }
  const category =
    body.category && VALID_CATEGORIES.has(body.category) ? body.category : "misc";

  const { data, error } = await sb
    .from("planner_expenses")
    .insert({
      org_id: profile.org_id,
      workspace_id: body.workspace_id ?? null,
      vendor_id: body.vendor_id ?? null,
      label: body.label.trim(),
      amount_eur: Number(body.amount_eur),
      category,
      paid_at: body.paid_at ?? null,
      due_at: body.due_at ?? null,
      notes: body.notes ?? null,
      external_url: body.external_url ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "insert failed" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, id: data.id });
}
