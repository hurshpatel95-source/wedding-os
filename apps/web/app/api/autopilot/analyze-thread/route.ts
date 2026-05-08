// POST /api/autopilot/analyze-thread
//
// The heart of autopilot. Given a vendor_id, pulls the email_messages
// thread for that vendor, asks Claude (Sonnet 4.6) to emit a structured
// status update — new autopilot status, quote (if any), 1-line summary,
// and any couple-side alerts to fire — then patches the vendors row,
// inserts the alerts, and writes an autopilot_runs trace.
//
// Triggered by:
//   - The /vendors/[id] page "Analyze with AI" button (manual)
//   - The Resend inbound webhook (?triggered_by=webhook)
//   - The Gmail sync route (?triggered_by=webhook)
//
// Auth: workspace member. Cost-guarded via assertNonChatAiQuota.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertNonChatAiQuota } from "@/lib/ai-quota";
import { analyzeVendorThread } from "@/lib/autopilot-analyzer";

export const runtime = "nodejs";
export const maxDuration = 60;

interface AnalyzeRequest {
  vendor_id: string;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id || !profile?.org_id) {
    return NextResponse.json({ error: "no profile" }, { status: 403 });
  }

  // Cost guard
  const overBudget = await assertNonChatAiQuota(supabase, profile.org_id);
  if (overBudget) {
    return NextResponse.json({ error: overBudget }, { status: 429 });
  }

  let body: AnalyzeRequest;
  try {
    body = (await request.json()) as AnalyzeRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.vendor_id) {
    return NextResponse.json({ error: "vendor_id required" }, { status: 400 });
  }

  // Workspace-scoped fetch — RLS already enforces, but check vendor is in
  // user's workspace to give a clean 403 instead of a silent skip.
  const sbAny = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { workspace_id: string } | null;
          }>;
        };
      };
    };
  };
  const { data: vendorScope } = await sbAny
    .from("vendors")
    .select("workspace_id")
    .eq("id", body.vendor_id)
    .maybeSingle();
  if (!vendorScope) {
    return NextResponse.json({ error: "vendor not found" }, { status: 404 });
  }
  if (vendorScope.workspace_id !== profile.workspace_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const triggeredByParam = url.searchParams.get("triggered_by");
  const triggeredBy =
    triggeredByParam === "webhook" ||
    triggeredByParam === "cron" ||
    triggeredByParam === "batch"
      ? triggeredByParam
      : "manual";

  const outcome = await analyzeVendorThread(
    supabase,
    body.vendor_id,
    triggeredBy,
  );

  if (outcome.skipped) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: outcome.reason,
    });
  }
  if (!outcome.ok) {
    return NextResponse.json(
      { ok: false, error: outcome.reason ?? "analyze failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    status: outcome.status,
    quote_eur: outcome.quote_eur,
    alerts_created: outcome.alerts_created,
    cost_usd: outcome.cost_usd,
    ai_summary: outcome.ai_summary,
  });
}
