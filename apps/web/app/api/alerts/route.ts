import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AlertRow } from "@/lib/autopilot-types";

export const runtime = "nodejs";

// Filter builder shape — we treat the supabase-js builder as a black box of
// chainable `.in / .is / .gte / .order` calls and only resolve at the end.
// All filters return the same builder interface; we end with .order which
// resolves to a Promise. RLS in the migration enforces workspace scope.
interface AlertsBuilder {
  in(col: string, vals: string[]): AlertsBuilder;
  is(col: string, val: null): AlertsBuilder;
  gte(col: string, val: string): AlertsBuilder;
  order(
    col: string,
    opts: { ascending: boolean },
  ): Promise<{ data: AlertRow[] | null; error: { message: string } | null }>;
}

// GET /api/alerts?audience=couple,both&dismissed=false&days=30
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl;
  const audienceParam = url.searchParams.get("audience") ?? "couple,both";
  const audiences = audienceParam
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is "couple" | "planner" | "both" =>
      s === "couple" || s === "planner" || s === "both",
    );
  if (audiences.length === 0) {
    return NextResponse.json({ alerts: [] });
  }

  const includeDismissed = url.searchParams.get("dismissed") === "true";
  const daysRaw = Number(url.searchParams.get("days") ?? "30");
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? daysRaw : 30;
  const since = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000,
  ).toISOString();

  // alerts isn't in the generated Database types yet — cast to a builder shape.
  const sb = supabase as unknown as {
    from: (t: string) => { select: (c: string) => AlertsBuilder };
  };

  let q: AlertsBuilder = sb
    .from("alerts")
    .select(
      "id, workspace_id, org_id, audience, kind, severity, title, body, action_url, payload, related_vendor_id, related_lead_id, related_budget_line_id, read_at, dismissed_at, included_in_digest_at, created_at",
    )
    .in("audience", audiences)
    .gte("created_at", since);

  if (!includeDismissed) {
    q = q.is("dismissed_at", null);
  }

  const result = await q.order("created_at", { ascending: false });

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ alerts: result.data ?? [] });
}
