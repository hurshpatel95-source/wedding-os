import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  BUDGET_CATEGORIES,
  type BudgetLineRow,
} from "@/lib/autopilot-types";

export const runtime = "nodejs";

interface CreateBody {
  parent_line_id?: string | null;
  category?: string;
  label?: string;
  qty?: number | null;
  unit_price_eur?: number | null;
  total_eur?: number | null;
  amount_estimated?: number | null;
  amount_committed?: number | null;
  amount_paid?: number | null;
  vendor_id?: string | null;
  status?: string;
  source?: string;
  sort_order?: number;
  notes?: string | null;
}

const ALLOWED_STATUS = [
  "placeholder",
  "researching",
  "quoted",
  "booked",
  "paid",
] as const;
const ALLOWED_SOURCE = [
  "ai_baseline",
  "industry_avg",
  "vendor_quote",
  "manual",
  "imported",
] as const;

export async function POST(request: NextRequest) {
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
  if (!profileTyped?.workspace_id || !profileTyped?.org_id) {
    return NextResponse.json({ error: "no workspace" }, { status: 403 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.label?.trim()) {
    return NextResponse.json({ error: "label required" }, { status: 400 });
  }

  const category = (BUDGET_CATEGORIES as readonly string[]).includes(
    body.category ?? "",
  )
    ? body.category!
    : "misc";
  const status = (ALLOWED_STATUS as readonly string[]).includes(
    body.status ?? "",
  )
    ? body.status!
    : "placeholder";
  const source = (ALLOWED_SOURCE as readonly string[]).includes(
    body.source ?? "",
  )
    ? body.source!
    : "manual";

  // For sort_order: if not given, place at end of siblings.
  let sortOrder = body.sort_order;
  if (sortOrder == null) {
    const sb = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            col: string,
            val: string,
          ) => Promise<{ data: Array<{ sort_order: number }> | null }>;
        };
      };
    };
    let q = sb.from("budget_lines").select("sort_order");
    if (body.parent_line_id) {
      const r = await q.eq("parent_line_id", body.parent_line_id);
      const max = (r.data ?? []).reduce(
        (a, x) => Math.max(a, x.sort_order ?? 0),
        -1,
      );
      sortOrder = max + 1;
    } else {
      sortOrder = 99;
    }
  }

  const insertRow = {
    workspace_id: profileTyped.workspace_id,
    org_id: profileTyped.org_id,
    parent_line_id: body.parent_line_id ?? null,
    category,
    label: body.label.trim(),
    qty: body.qty ?? null,
    unit_price_eur: body.unit_price_eur ?? null,
    total_eur: body.total_eur ?? null,
    amount_estimated: body.amount_estimated ?? body.total_eur ?? null,
    amount_committed: body.amount_committed ?? 0,
    amount_paid: body.amount_paid ?? 0,
    vendor_id: body.vendor_id ?? null,
    status,
    source,
    sort_order: sortOrder ?? 0,
    notes: body.notes ?? null,
  };

  const sb = supabase as unknown as {
    from: (t: string) => {
      insert: (row: Record<string, unknown>) => {
        select: (cols: string) => {
          single: () => Promise<{
            data: BudgetLineRow | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  const { data: line, error: insErr } = await sb
    .from("budget_lines")
    .insert(insertRow)
    .select("*")
    .single();

  if (insErr || !line) {
    return NextResponse.json(
      { error: `Couldn't create line: ${insErr?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, line });
}
