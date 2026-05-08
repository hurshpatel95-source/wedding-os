// POST /api/autopilot/run-all
//
// Walks every vendor in the user's workspace where:
//   - autopilot_enabled = true, AND
//   - either vendors.ai_summary IS NULL (never analyzed)
//     or there's at least one inbound email_messages newer than
//     vendors.last_inbound_at (a fresh reply we haven't processed)
//
// For each match we run analyzeVendorThread() inline. Capped at 20
// vendors per call to bound cost (20 × Sonnet × ~3k input tokens ≈ $0.50
// worst case — also caught by the daily org quota).
//
// Auth: workspace member.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertNonChatAiQuota } from "@/lib/ai-quota";
import { analyzeVendorThread } from "@/lib/autopilot-analyzer";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_VENDORS_PER_CALL = 20;

interface VendorScanRow {
  id: string;
  workspace_id: string;
  autopilot_enabled: boolean;
  last_inbound_at: string | null;
  ai_summary: string | null;
}

interface InboundCheckRow {
  id: string;
  related_vendor_id: string;
  created_at: string;
}

export async function POST(_request: NextRequest) {
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

  const overBudget = await assertNonChatAiQuota(supabase, profile.org_id);
  if (overBudget) {
    return NextResponse.json({ error: overBudget }, { status: 429 });
  }

  const sbAny = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string | boolean,
        ) => {
          eq: (
            col: string,
            val: string | boolean,
          ) => {
            limit: (n: number) => Promise<{
              data: VendorScanRow[] | null;
            }>;
          };
          limit: (n: number) => Promise<{ data: VendorScanRow[] | null }>;
        };
      };
    };
  };

  const { data: candidates } = await sbAny
    .from("vendors")
    .select("id, workspace_id, autopilot_enabled, last_inbound_at, ai_summary")
    .eq("workspace_id", profile.workspace_id)
    .eq("autopilot_enabled", true)
    .limit(200);

  const list = (candidates ?? []) as VendorScanRow[];
  if (list.length === 0) {
    return NextResponse.json({ ok: true, analyzed: 0, cost_usd_total: 0 });
  }

  // Pull inbound message timestamps for these vendors so we know which
  // ones have a fresh reply since last_inbound_at. One query.
  const sbAny2 = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        in: (
          col: string,
          arr: string[],
        ) => {
          eq: (
            col: string,
            val: string,
          ) => Promise<{ data: InboundCheckRow[] | null }>;
        };
      };
    };
  };
  const { data: inboundRows } = await sbAny2
    .from("email_messages")
    .select("id, related_vendor_id, created_at")
    .in(
      "related_vendor_id",
      list.map((v) => v.id),
    )
    .eq("direction", "inbound");

  const latestInboundByVendor = new Map<string, string>();
  for (const r of inboundRows ?? []) {
    const prev = latestInboundByVendor.get(r.related_vendor_id);
    if (!prev || new Date(r.created_at) > new Date(prev)) {
      latestInboundByVendor.set(r.related_vendor_id, r.created_at);
    }
  }

  const toAnalyze = list.filter((v) => {
    const latest = latestInboundByVendor.get(v.id);
    if (!latest) return false; // no inbound at all → nothing to analyze
    if (!v.ai_summary) return true; // never analyzed
    if (!v.last_inbound_at) return true;
    return new Date(latest) > new Date(v.last_inbound_at);
  });

  const slice = toAnalyze.slice(0, MAX_VENDORS_PER_CALL);

  let analyzed = 0;
  let costTotal = 0;
  const failures: Array<{ vendor_id: string; reason: string }> = [];

  for (const v of slice) {
    // Re-check quota each iteration so a runaway batch can't blow past
    // the cap mid-loop.
    const overNow = await assertNonChatAiQuota(supabase, profile.org_id);
    if (overNow) {
      failures.push({ vendor_id: v.id, reason: overNow });
      break;
    }
    try {
      const outcome = await analyzeVendorThread(supabase, v.id, "batch");
      if (outcome.ok && !outcome.skipped) {
        analyzed += 1;
        costTotal += outcome.cost_usd ?? 0;
      } else if (outcome.skipped) {
        // skipped is fine, not a failure
      } else {
        failures.push({
          vendor_id: v.id,
          reason: outcome.reason ?? "unknown",
        });
      }
    } catch (err) {
      failures.push({
        vendor_id: v.id,
        reason: (err as Error).message ?? "exception",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    analyzed,
    candidates: toAnalyze.length,
    cost_usd_total: Number(costTotal.toFixed(4)),
    failures: failures.length > 0 ? failures : undefined,
  });
}
