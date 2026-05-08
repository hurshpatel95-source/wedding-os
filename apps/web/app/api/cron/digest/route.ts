// Daily digest mailer — cron-callable.
//
// AUTH: requires header `x-cron-secret` matching env CRON_SECRET. Without
// CRON_SECRET set, every request is rejected (defence-in-depth: we'd
// rather have a noisy 401 than an open mailer endpoint).
//
// SCOPE: for every workspace that has at least 1 unread, undismissed,
// not-yet-digested alert from the last 24h, send a single digest email
// to the right audience(s):
//   - audience='couple' or 'both' → first user with role='couple' in workspace
//   - audience='planner' or 'both' → org's org_admins
// After a successful send we mark the included alerts with
// included_in_digest_at = now() so they don't get re-sent tomorrow.
//
// This route is whitelisted under /api/cron/ in supabase/middleware.ts and
// uses the service role since there's no user session on cron requests.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlertRow, AlertAudience } from "@/lib/autopilot-types";
import { sendAndLogEmail } from "@/lib/email-send";
import {
  renderDigestSubject,
  renderDigestBody,
} from "@/lib/digest-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminClient(): SupabaseClient {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  ) as unknown as SupabaseClient;
}

function checkAuth(request: NextRequest): { ok: true } | { ok: false; res: NextResponse } {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "CRON_SECRET not configured on server" },
        { status: 401 },
      ),
    };
  }
  const got = request.headers.get("x-cron-secret");
  if (!got || got !== expected) {
    return {
      ok: false,
      res: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true };
}

interface WorkspaceMeta {
  id: string;
  org_id: string;
  name: string | null;
}

interface CoupleRecipient {
  user_id: string;
  email: string;
}

interface PlannerRecipient {
  user_id: string;
  email: string;
}

export async function POST(request: NextRequest) {
  const auth = checkAuth(request);
  if (!auth.ok) return auth.res;

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200";
  const sb = adminClient();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // ─── 1. Pull all undigested unread alerts in the window ───────────
  const { data: alertsData, error: alertsError } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          is: (col: string, val: null) => {
            is: (col: string, val: null) => {
              is: (col: string, val: null) => {
                gte: (col: string, val: string) => {
                  order: (
                    col: string,
                    opts: { ascending: boolean },
                  ) => Promise<{
                    data: AlertRow[] | null;
                    error: { message: string } | null;
                  }>;
                };
              };
            };
          };
        };
      };
    }
  )
    .from("alerts")
    .select(
      "id, workspace_id, org_id, audience, kind, severity, title, body, action_url, payload, related_vendor_id, related_lead_id, related_budget_line_id, read_at, dismissed_at, included_in_digest_at, created_at",
    )
    .is("included_in_digest_at", null)
    .is("read_at", null)
    .is("dismissed_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (alertsError) {
    return NextResponse.json(
      { error: `alerts query failed: ${alertsError.message}` },
      { status: 500 },
    );
  }
  const alerts = (alertsData ?? []) as AlertRow[];

  if (alerts.length === 0) {
    return NextResponse.json({ sent_to: 0, errored: 0, total_alerts: 0 });
  }

  // ─── 2. Bucket per workspace + audience class ─────────────────────
  // Each workspace will produce up to 2 email batches: one for couple-side
  // alerts (audience couple|both) and one for planner-side (planner|both).
  const coupleBuckets = new Map<string, AlertRow[]>();
  const plannerBuckets = new Map<string, AlertRow[]>();
  const workspaceIdsSet = new Set<string>();

  for (const a of alerts) {
    workspaceIdsSet.add(a.workspace_id);
    const aud: AlertAudience = a.audience;
    if (aud === "couple" || aud === "both") {
      const arr = coupleBuckets.get(a.workspace_id) ?? [];
      arr.push(a);
      coupleBuckets.set(a.workspace_id, arr);
    }
    if (aud === "planner" || aud === "both") {
      const arr = plannerBuckets.get(a.workspace_id) ?? [];
      arr.push(a);
      plannerBuckets.set(a.workspace_id, arr);
    }
  }

  const workspaceIds = Array.from(workspaceIdsSet);

  // ─── 3. Resolve workspace metadata ────────────────────────────────
  const { data: wsData } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          in: (col: string, vals: string[]) => Promise<{
            data: WorkspaceMeta[] | null;
          }>;
        };
      };
    }
  )
    .from("workspaces")
    .select("id, org_id, name")
    .in("id", workspaceIds);

  const workspacesById = new Map<string, WorkspaceMeta>();
  for (const w of (wsData ?? []) as WorkspaceMeta[]) {
    workspacesById.set(w.id, w);
  }

  // ─── 4. Send couple digests ───────────────────────────────────────
  let sent = 0;
  let errored = 0;
  let totalAlertsSent = 0;
  const includedAlertIds: string[] = [];

  for (const [workspaceId, wsAlerts] of coupleBuckets.entries()) {
    if (wsAlerts.length === 0) continue;
    const ws = workspacesById.get(workspaceId);
    if (!ws) {
      errored += 1;
      continue;
    }

    // primary couple recipient — first user with role='couple' in this workspace
    const couple = await firstCoupleInWorkspace(sb, workspaceId);
    if (!couple) {
      errored += 1;
      continue;
    }

    const subject = renderDigestSubject(ws.name ?? "your wedding", wsAlerts.length);
    const { text, html } = renderDigestBody(
      ws.name ?? "there",
      wsAlerts,
      baseUrl,
    );

    const result = await sendAndLogEmail(
      sb,
      {
        to: couple.email,
        subject,
        bodyText: text,
        bodyHtml: html,
      },
      {
        org_id: ws.org_id,
        workspace_id: workspaceId,
        kind: "autopilot_digest",
        thread_key: `digest:${workspaceId}:${new Date().toISOString().slice(0, 10)}`,
      },
    );

    if (result.ok) {
      sent += 1;
      totalAlertsSent += wsAlerts.length;
      for (const a of wsAlerts) includedAlertIds.push(a.id);
    } else {
      errored += 1;
    }
  }

  // ─── 5. Send planner digests ──────────────────────────────────────
  // Group planner buckets by org (so each org_admin gets one email per
  // org per day, not per workspace) — simpler: one email per workspace
  // per org_admin recipient. Keeps the implementation linear; we can
  // dedupe later if planners complain about volume.
  for (const [workspaceId, wsAlerts] of plannerBuckets.entries()) {
    if (wsAlerts.length === 0) continue;
    const ws = workspacesById.get(workspaceId);
    if (!ws) {
      errored += 1;
      continue;
    }

    const planners = await orgAdminsForOrg(sb, ws.org_id);
    if (planners.length === 0) {
      errored += 1;
      continue;
    }

    const subject = renderDigestSubject(
      ws.name ?? "client wedding",
      wsAlerts.length,
    );
    const { text, html } = renderDigestBody(
      ws.name ?? "your client",
      wsAlerts,
      baseUrl,
    );

    let perWorkspaceOk = false;
    for (const p of planners) {
      const result = await sendAndLogEmail(
        sb,
        {
          to: p.email,
          subject,
          bodyText: text,
          bodyHtml: html,
        },
        {
          org_id: ws.org_id,
          workspace_id: workspaceId,
          kind: "autopilot_digest_planner",
          thread_key: `digest_planner:${workspaceId}:${new Date()
            .toISOString()
            .slice(0, 10)}`,
        },
      );
      if (result.ok) {
        sent += 1;
        perWorkspaceOk = true;
      } else {
        errored += 1;
      }
    }

    if (perWorkspaceOk) {
      totalAlertsSent += wsAlerts.length;
      for (const a of wsAlerts) includedAlertIds.push(a.id);
    }
  }

  // ─── 6. Mark alerts as included in digest ─────────────────────────
  // De-dupe the included ID list since an alert with audience='both'
  // could be included via both the couple and planner buckets.
  const uniqueIds = Array.from(new Set(includedAlertIds));
  if (uniqueIds.length > 0) {
    const nowIso = new Date().toISOString();
    const { error: updError } = await (
      sb as unknown as {
        from: (t: string) => {
          update: (row: unknown) => {
            in: (col: string, vals: string[]) => Promise<{
              error: { message: string } | null;
            }>;
          };
        };
      }
    )
      .from("alerts")
      .update({ included_in_digest_at: nowIso })
      .in("id", uniqueIds);
    if (updError) {
      console.error(
        "[cron/digest] failed to mark alerts as included_in_digest_at",
        updError,
      );
    }
  }

  return NextResponse.json({
    sent_to: sent,
    errored,
    total_alerts: totalAlertsSent,
  });
}

// Allow GET as well so manual cron pings work — same auth, same handler.
export async function GET(request: NextRequest) {
  return POST(request);
}

async function firstCoupleInWorkspace(
  sb: SupabaseClient,
  workspaceId: string,
): Promise<CoupleRecipient | null> {
  const { data } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            eq: (col: string, val: string) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => {
                limit: (n: number) => Promise<{
                  data: { id: string; email: string }[] | null;
                }>;
              };
            };
          };
        };
      };
    }
  )
    .from("users")
    .select("id, email")
    .eq("workspace_id", workspaceId)
    .eq("role", "couple")
    .order("created_at", { ascending: true })
    .limit(1);

  const row = (data ?? [])[0];
  if (!row || !row.email) return null;
  return { user_id: row.id, email: row.email };
}

async function orgAdminsForOrg(
  sb: SupabaseClient,
  orgId: string,
): Promise<PlannerRecipient[]> {
  const { data } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            eq: (col: string, val: string) => Promise<{
              data: { id: string; email: string }[] | null;
            }>;
          };
        };
      };
    }
  )
    .from("users")
    .select("id, email")
    .eq("org_id", orgId)
    .eq("org_role", "org_admin");

  const rows = (data ?? []) as { id: string; email: string }[];
  return rows
    .filter((r) => !!r.email)
    .map((r) => ({ user_id: r.id, email: r.email }));
}
