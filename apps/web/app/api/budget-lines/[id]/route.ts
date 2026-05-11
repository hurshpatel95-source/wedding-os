import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbUpdate, dbDelete, dbWriteErrorResponse } from "@/lib/db-write-guard";

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

  // T1.3 — write-guard. RLS scopes by workspace_id; we constrain by id.
  const sb = supabase as unknown as {
    from: (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (col: string, val: string) => {
          select: (cols: string) => Promise<{
            data: Array<Record<string, unknown>> | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  try {
    const rows = await dbUpdate(
      "update budget_line",
      sb
        .from("budget_lines")
        .update(patch)
        .eq("id", params.id)
        .select("*"),
    );
    return NextResponse.json({ ok: true, line: rows[0] });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
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

  // T1.3 — write-guard on delete too.
  const sb = supabase as unknown as {
    from: (t: string) => {
      delete: () => {
        eq: (col: string, val: string) => {
          select: (cols: string) => Promise<{
            data: Array<{ id: string }> | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  try {
    await dbDelete(
      "delete budget_line",
      sb.from("budget_lines").delete().eq("id", params.id).select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
