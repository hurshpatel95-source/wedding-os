// Server-only helpers for creating alerts. Used by THREAD-ANALYZER agent,
// GMAIL-CONNECTOR, budget watchers, and anywhere else autopilot needs to
// surface a notification in the couple/planner alerts feed.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlertAudience, AlertSeverity } from "@/lib/autopilot-types";

export interface CreateAlertParams {
  workspace_id: string;
  org_id: string;
  audience?: AlertAudience;        // default 'couple'
  kind: string;                    // 'vendor_quote_received' | 'task_overdue' | ...
  severity?: AlertSeverity;        // default 'info'
  title: string;
  body?: string | null;
  action_url?: string | null;
  payload?: Record<string, unknown>;
  related_vendor_id?: string | null;
  related_lead_id?: string | null;
  related_budget_line_id?: string | null;
}

export interface CreateAlertResult {
  id: string;
}

/**
 * Insert an alerts row with sensible defaults. Returns { id } on success
 * or throws if the insert fails — callers should wrap in try/catch when an
 * alert failure must NOT propagate (e.g. a thread analyzer that should still
 * commit its main work even if the user-facing alert errors).
 */
export async function createAlert(
  sb: SupabaseClient,
  params: CreateAlertParams,
): Promise<CreateAlertResult> {
  const insertRow = {
    workspace_id: params.workspace_id,
    org_id: params.org_id,
    audience: params.audience ?? "couple",
    kind: params.kind,
    severity: params.severity ?? "info",
    title: params.title,
    body: params.body ?? null,
    action_url: params.action_url ?? null,
    payload: params.payload ?? {},
    related_vendor_id: params.related_vendor_id ?? null,
    related_lead_id: params.related_lead_id ?? null,
    related_budget_line_id: params.related_budget_line_id ?? null,
  };

  const { data, error } = await (
    sb as unknown as {
      from: (t: string) => {
        insert: (row: unknown) => {
          select: (cols: string) => {
            single: () => Promise<{
              data: { id: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("alerts")
    .insert(insertRow)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`createAlert failed: ${error?.message ?? "unknown"}`);
  }
  return { id: data.id };
}

/**
 * Convenience wrapper: create an alert but swallow errors and log them.
 * Use when alert creation is best-effort and shouldn't fail the parent op.
 */
export async function tryCreateAlert(
  sb: SupabaseClient,
  params: CreateAlertParams,
): Promise<CreateAlertResult | null> {
  try {
    return await createAlert(sb, params);
  } catch (err) {
    console.error("[alert-helpers] tryCreateAlert failed", err);
    return null;
  }
}
