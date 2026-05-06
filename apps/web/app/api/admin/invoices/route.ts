import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface CreateBody {
  workspace_id: string;
  label: string;
  amount_eur: number;
  due_at?: string | null;
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
  if (!body.workspace_id || !body.label || body.amount_eur == null) {
    return NextResponse.json(
      { error: "workspace_id, label, amount_eur required" },
      { status: 400 },
    );
  }

  const { data, error } = await sb
    .from("planner_invoices")
    .insert({
      org_id: profile.org_id,
      workspace_id: body.workspace_id,
      label: body.label.trim(),
      amount_eur: Number(body.amount_eur),
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
