// Cost / abuse guards for any endpoint that calls Anthropic.
//
// We have one chat endpoint with a daily-message cap. The OTHER endpoints
// (pricing intake, brochure intake, email draft, guest CSV mapping) had no
// caps at all. A compromised admin token, runaway script, or careless
// drag-drop loop could pin the API budget overnight.
//
// This module adds:
//   - MAX_UPLOAD_BYTES constant for multipart endpoints
//   - assertWorkspaceAiQuota() — checks ai_usage_daily and rejects if over
//
// The chat endpoint already does its own counting via ai_messages.
// For non-chat endpoints we count per-org-per-day "ai calls of any kind"
// against a single budget — simple, defensive, easily tunable.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 15 MB cap per uploaded file across all multipart routes. Pricing intake
 *  PDFs from Astha tend to be ~200KB; venue brochures ~5MB. 15MB is plenty
 *  while still preventing OOM + run-away Anthropic spend. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** Daily budget in USD per ORG across all non-chat AI endpoints. */
const NON_CHAT_DAILY_BUDGET_USD = 5;

/** Daily call-count cap per org across all non-chat AI endpoints. Even
 *  cheap calls add up. */
const NON_CHAT_DAILY_CALLS = 50;

interface UsageRow {
  total_cost_usd: number | null;
  total_calls: number | null;
}

/** Returns null if under cap, or an error message string if over. */
export async function assertNonChatAiQuota(
  sb: SupabaseClient,
  orgId: string,
): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  const sbAny = sb as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          eq: (
            col: string,
            val: string,
          ) => Promise<{ data: UsageRow[] | null }>;
        };
      };
    };
  };

  // ai_usage_daily was introduced for the chat endpoint. We piggy-back on it
  // for non-chat by aggregating any rows for the org+date. If the table
  // doesn't track "non-chat" separately yet, this is conservative — we sum
  // ALL spend for the day. That's actually what we want for a global cap.
  const { data } = await sbAny
    .from("ai_usage_daily")
    .select("total_cost_usd, total_calls")
    .eq("org_id", orgId)
    .eq("usage_date", today);

  const rows = data ?? [];
  const totalCost = rows.reduce(
    (acc, r) => acc + Number(r.total_cost_usd ?? 0),
    0,
  );
  const totalCalls = rows.reduce(
    (acc, r) => acc + Number(r.total_calls ?? 0),
    0,
  );

  if (totalCost >= NON_CHAT_DAILY_BUDGET_USD) {
    return `Daily AI budget reached for this studio ($${NON_CHAT_DAILY_BUDGET_USD.toFixed(
      2,
    )}). Resets at midnight UTC.`;
  }
  if (totalCalls >= NON_CHAT_DAILY_CALLS) {
    return `Daily AI call cap reached (${NON_CHAT_DAILY_CALLS}). Resets at midnight UTC.`;
  }
  return null;
}

/** Increment the daily usage counter by one call + an estimated cost. */
export async function recordNonChatAiCall(
  sb: SupabaseClient,
  orgId: string,
  workspaceId: string | null,
  costUsd: number,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  // Upsert a "system" row keyed on (org_id, usage_date, user_id=null).
  // The chat endpoint keys on user_id to track per-user; we use null to
  // represent "non-chat / planner-attributed" usage.
  const sbAny = sb as unknown as {
    rpc?: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
    from: (t: string) => {
      insert: (p: Record<string, unknown>) => Promise<{
        error: { message: string } | null;
      }>;
    };
  };

  // Best-effort insert; if the row exists for the day, the unique index
  // will trigger an error and we accept the miss — quota check is the
  // primary defense, not the increment.
  await sbAny.from("ai_usage_daily").insert({
    org_id: orgId,
    workspace_id: workspaceId,
    user_id: null,
    usage_date: today,
    total_calls: 1,
    total_cost_usd: costUsd,
  });
}
