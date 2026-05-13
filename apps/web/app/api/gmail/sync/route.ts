import { NextResponse } from "next/server";
import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { clientWithCredentials, gmailOauthReady } from "@/lib/gmail-server";
import { loadActiveGmailConnection } from "@/lib/gmail-connection-loader";
import {
  parseGmailMessage,
  type GmailMessage,
} from "@/lib/gmail-thread-importer";
import { analyzeVendorThread } from "@/lib/autopilot-analyzer";
import { assertNonChatAiQuota } from "@/lib/ai-quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGES_PER_RUN = 50;
// Cap how many vendor threads we auto-analyze per sync to bound cost
// (each call is ~$0.02-$0.05 against Sonnet). Couples with bigger reply
// bursts can still re-trigger via /api/autopilot/run-all.
const MAX_AUTO_ANALYZE_PER_SYNC = 5;

interface SyncResultBody {
  ok: boolean;
  messages_processed?: number;
  vendor_threads?: number;
  auto_analyzed?: number;
  error?: string;
}

// POST /api/gmail/sync
// Workspace member only. Pulls new messages since last_history_id and
// inserts inbound rows into email_messages, attempting to bind each
// to a known vendor by from_email match.
export async function POST(): Promise<NextResponse<SyncResultBody>> {
  if (!gmailOauthReady) {
    return NextResponse.json(
      { ok: false, error: "gmail_not_configured" },
      { status: 503 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Resolve workspace + connection.
  const profileSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { workspace_id?: string | null; org_id?: string | null } | null;
          }>;
        };
      };
    };
  };
  const { data: profile } = await profileSb
    .from("users")
    .select("workspace_id, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id || !profile?.org_id) {
    return NextResponse.json({ ok: false, error: "no_workspace" }, { status: 400 });
  }

  const connection = await loadActiveGmailConnection(supabase, profile.workspace_id);
  if (!connection) {
    return NextResponse.json(
      { ok: false, error: "no_connection" },
      { status: 404 },
    );
  }

  if (!connection.refresh_token) {
    return NextResponse.json(
      { ok: false, error: "connection_revoked" },
      { status: 400 },
    );
  }

  // Hydrate OAuth client + refresh access token if needed
  let oauth2;
  try {
    oauth2 = await clientWithCredentials(
      connection.refresh_token,
      connection.access_token,
      connection.access_token_expires_at,
    );
  } catch (err) {
    await markConnectionError(
      supabase,
      connection.id,
      err instanceof Error ? err.message : "token_refresh_failed",
    );
    return NextResponse.json(
      { ok: false, error: "token_refresh_failed" },
      { status: 502 },
    );
  }

  const gmail = google.gmail({ version: "v1", auth: oauth2 });

  // Find candidate message ids: history.list when we have a startHistoryId,
  // otherwise an initial 7-day inbox sweep.
  let candidateIds: string[] = [];
  let nextHistoryId = connection.last_history_id ?? null;

  try {
    if (connection.last_history_id) {
      const historyRes = await gmail.users.history.list({
        userId: "me",
        startHistoryId: connection.last_history_id,
        historyTypes: ["messageAdded"],
        maxResults: 500,
      });
      const events = historyRes.data.history ?? [];
      const seen = new Set<string>();
      for (const ev of events) {
        for (const m of ev.messagesAdded ?? []) {
          const id = m.message?.id;
          if (id && !seen.has(id)) {
            seen.add(id);
            candidateIds.push(id);
          }
        }
      }
      if (historyRes.data.historyId) {
        nextHistoryId = historyRes.data.historyId;
      }
    } else {
      const listRes = await gmail.users.messages.list({
        userId: "me",
        q: "newer_than:7d in:inbox",
        maxResults: MAX_MESSAGES_PER_RUN,
      });
      candidateIds = (listRes.data.messages ?? [])
        .map((m) => m.id)
        .filter((id): id is string => Boolean(id));
    }
  } catch (err) {
    await markConnectionError(
      supabase,
      connection.id,
      err instanceof Error ? err.message : "history_list_failed",
    );
    return NextResponse.json(
      { ok: false, error: "history_list_failed" },
      { status: 502 },
    );
  }

  // Cap how many we fetch in one run
  const ids = candidateIds.slice(0, MAX_MESSAGES_PER_RUN);

  // Pre-fetch known provider_message_ids in this batch so we don't dupe
  const existingIds = await loadExistingProviderMessageIds(
    supabase,
    profile.workspace_id,
    ids,
  );

  // Pre-fetch vendor email map
  const vendorEmailMap = await loadVendorEmailMap(supabase, profile.workspace_id);

  let processed = 0;
  let vendorThreads = 0;
  // Track vendor ids that received a fresh inbound in this sync so we
  // can auto-trigger the autopilot analyzer once the loop ends. Without
  // this, inbound replies sit unanalyzed until the couple manually clicks
  // "Analyze with AI" — defeating the autopilot's main promise.
  const vendorIdsWithNewInbound = new Set<string>();
  let maxHistoryFromMessages: bigint | null = nextHistoryId
    ? safeBigInt(nextHistoryId)
    : null;

  for (const id of ids) {
    if (existingIds.has(id)) continue;

    let msg: gmail_v1.Schema$Message;
    try {
      const r = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "full",
      });
      msg = r.data;
    } catch {
      continue;
    }

    const parsed = parseGmailMessage(msg as GmailMessage);
    if (!parsed.provider_message_id) continue;

    // Try to resolve in_reply_to FK
    let inReplyToUuid: string | null = null;
    if (parsed.in_reply_to_header) {
      inReplyToUuid = await findUuidByHeaderId(
        supabase,
        profile.workspace_id,
        parsed.in_reply_to_header,
      );
    }

    // Bind to a vendor by from_email
    const vendorId = parsed.from_email
      ? vendorEmailMap.get(parsed.from_email) ?? null
      : null;
    if (vendorId) vendorThreads += 1;

    const insertRow = {
      org_id: profile.org_id,
      workspace_id: profile.workspace_id,
      direction: "inbound" as const,
      kind: vendorId ? "vendor_inbound" : null,
      thread_key: parsed.thread_key,
      in_reply_to_message_id: inReplyToUuid,
      provider: "gmail",
      provider_message_id: parsed.provider_message_id,
      to_email: parsed.to_email ?? connection.email,
      to_name: parsed.to_name,
      from_email: parsed.from_email,
      from_name: parsed.from_name,
      cc: parsed.cc,
      subject: parsed.subject,
      body_text: parsed.body_text,
      body_html: parsed.body_html,
      related_vendor_id: vendorId,
      status: "received" as const,
      status_detail: parsed.message_id_header,
      sent_at: parsed.received_at,
      created_by: null,
    };

    const insSb = supabase as unknown as {
      from: (t: string) => {
        insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error: insErr } = await insSb.from("email_messages").insert(insertRow);
    if (!insErr) {
      processed += 1;
      if (vendorId) {
        vendorIdsWithNewInbound.add(vendorId);
      }
    }

    // Track historyId for the highest-numbered message we saw
    if (msg.historyId) {
      const hb = safeBigInt(msg.historyId);
      if (hb !== null && (maxHistoryFromMessages === null || hb > maxHistoryFromMessages)) {
        maxHistoryFromMessages = hb;
      }
    }
  }

  // Update connection bookkeeping
  const updSb = supabase as unknown as {
    from: (t: string) => {
      update: (vals: unknown) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
  await updSb
    .from("gmail_connections")
    .update({
      last_synced_at: new Date().toISOString(),
      last_history_id: maxHistoryFromMessages
        ? maxHistoryFromMessages.toString()
        : connection.last_history_id ?? null,
      status: "active",
      last_error: null,
    })
    .eq("id", connection.id);

  // ─── Auto-trigger the autopilot analyzer for vendors that received
  //     a fresh inbound in this sync ──────────────────────────────────
  //
  // The /autopilot dashboard's main promise is that vendor replies show
  // up as alerts in "Today's queue" automatically. Without this trigger
  // the couple has to click "Analyze with AI" per vendor. We cap the
  // batch to bound cost; the quota guard ($5/day, 50 calls/day per org)
  // is the hard backstop. Analyzer failure is swallowed — sync result
  // is the contract; analysis is a best-effort follow-on.
  let autoAnalyzed = 0;
  const vendorBatch = Array.from(vendorIdsWithNewInbound).slice(
    0,
    MAX_AUTO_ANALYZE_PER_SYNC,
  );
  for (const vId of vendorBatch) {
    try {
      const overBudget = await assertNonChatAiQuota(supabase, profile.org_id);
      if (overBudget) break;
      const outcome = await analyzeVendorThread(supabase, vId, "webhook");
      if (outcome.ok && !outcome.skipped) {
        autoAnalyzed += 1;
      }
    } catch (err) {
      // Swallow — analyzer failure should never break Gmail sync.
      // eslint-disable-next-line no-console
      console.warn(
        "[gmail-sync] post-sync analyzer call failed:",
        (err as Error).message ?? "unknown",
      );
    }
  }

  return NextResponse.json({
    ok: true,
    messages_processed: processed,
    vendor_threads: vendorThreads,
    auto_analyzed: autoAnalyzed,
  });
}

// ─── helpers ─────────────────────────────────────────────────────────

async function loadExistingProviderMessageIds(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  ids: string[],
): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          in: (
            col: string,
            vals: string[],
          ) => Promise<{
            data: { provider_message_id: string | null }[] | null;
          }>;
        };
      };
    };
  };
  const { data } = await sb
    .from("email_messages")
    .select("provider_message_id")
    .eq("workspace_id", workspaceId)
    .in("provider_message_id", ids);
  const out = new Set<string>();
  for (const r of data ?? []) {
    if (r.provider_message_id) out.add(r.provider_message_id);
  }
  return out;
}

async function loadVendorEmailMap(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
): Promise<Map<string, string>> {
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => Promise<{
          data: { id: string; contact_email: string | null }[] | null;
        }>;
      };
    };
  };
  const { data } = await sb
    .from("vendors")
    .select("id, contact_email")
    .eq("workspace_id", workspaceId);
  const map = new Map<string, string>();
  for (const v of data ?? []) {
    if (v.contact_email) {
      map.set(v.contact_email.trim().toLowerCase(), v.id);
    }
  }
  return map;
}

async function findUuidByHeaderId(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  headerId: string,
): Promise<string | null> {
  // We stash the inbound RFC Message-ID in status_detail, and outbound
  // sends use the Gmail-issued provider_message_id. Try both.
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          or: (
            expr: string,
          ) => {
            limit: (n: number) => {
              maybeSingle: () => Promise<{
                data: { id: string } | null;
              }>;
            };
          };
        };
      };
    };
  };
  const escaped = headerId.replace(/,/g, "");
  const { data } = await sb
    .from("email_messages")
    .select("id")
    .eq("workspace_id", workspaceId)
    .or(`status_detail.eq.${escaped},provider_message_id.eq.${escaped}`)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function markConnectionError(
  supabase: ReturnType<typeof createClient>,
  connectionId: string,
  message: string,
) {
  const sb = supabase as unknown as {
    from: (t: string) => {
      update: (vals: unknown) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
  await sb
    .from("gmail_connections")
    .update({ status: "error", last_error: message.slice(0, 500) })
    .eq("id", connectionId);
}

function safeBigInt(s: string | null | undefined): bigint | null {
  if (!s) return null;
  try {
    return BigInt(s);
  } catch {
    return null;
  }
}
