import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface PatchBody {
  label?: string;
  qty?: number | null;
  unit_price_eur?: number | null;
  total_eur?: number | null;
  amount_estimated?: number | null;
  amount_committed?: number | null;
  amount_paid?: number | null;
  status?: string;
  notes?: string | null;
  vendor_id?: string | null;
  sort_order?: number;
  source?: string;
}

const ALLOWED_STATUS = [
  "placeholder",
  "researching",
  "quoted",
  "booked",
  "paid",
];
const ALLOWED_SOURCE = [
  "ai_baseline",
  "industry_avg",
  "vendor_quote",
  "manual",
  "imported",
];

const PATCHABLE_KEYS: (keyof PatchBody)[] = [
  "label",
  "qty",
  "unit_price_eur",
  "total_eur",
  "amount_estimated",
  "amount_committed",
  "amount_paid",
  "status",
  "notes",
  "vendor_id",
  "sort_order",
  "source",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("users")
    .select("org_id, workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  const profileTyped = profile as
    | { org_id: string; workspace_id: string }
    | null;
  if (!profileTyped?.workspace_id) {
    return NextResponse.json({ error: "no workspace" }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Whitelist only patchable fields
  const patch: Record<string, unknown> = {};
  for (const k of PATCHABLE_KEYS) {
    if (k in body) {
      patch[k] = body[k];
    }
  }
  if (patch.status && !ALLOWED_STATUS.includes(patch.status as string)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  if (patch.source && !ALLOWED_SOURCE.includes(patch.source as string)) {
    return NextResponse.json({ error: "invalid source" }, { status: 400 });
  }
  if (typeof patch.label === "string") {
    const t = (patch.label as string).trim();
    if (!t) {
      delete patch.label;
    } else {
      patch.label = t;
    }
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no patchable fields" }, { status: 400 });
  }

  // RLS scopes by workspace_id; we still constrain by id.
  const sb = supabase as unknown as {
    from: (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (
          col: string,
          val: string,
        ) => {
          select: (cols: string) => {
            single: () => Promise<{
              data: { id: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };

  const { data, error: updErr } = await sb
    .from("budget_lines")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();

  if (updErr) {
    return NextResponse.json(
      { error: `Couldn't update: ${updErr.message}` },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, line: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  const profileTyped = profile as { workspace_id: string } | null;
  if (!profileTyped?.workspace_id) {
    return NextResponse.json({ error: "no workspace" }, { status: 403 });
  }

  const sb = supabase as unknown as {
    from: (t: string) => {
      delete: () => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };

  const { error: delErr } = await sb
    .from("budget_lines")
    .delete()
    .eq("id", params.id);

  if (delErr) {
    return NextResponse.json(
      { error: `Couldn't delete: ${delErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
