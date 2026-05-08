// POST /api/autopilot/run-followup
//
// "No-reply auto-followup". For a vendor whose last_outbound_at is older
// than 7 days AND has had no inbound since, drafts a polite 4-line
// follow-up via Claude. If the user has Gmail connected we save it as a
// draft via the gmail-server helper; otherwise we just return the draft
// for the couple to copy-paste into their email client.
//
// The couple opts-in to autopilot follow-ups by toggling
// vendors.autopilot_enabled = true.
//
// Auth: workspace member.

import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import {
  anthropicReady,
  getAnthropic,
  DEFAULT_INTAKE_MODEL,
  estimateCost,
} from "@/lib/anthropic";
import { assertNonChatAiQuota, recordNonChatAiCall } from "@/lib/ai-quota";
import { FOLLOWUP_SYSTEM, FOLLOWUP_TOOL } from "@/lib/autopilot-analyzer";

export const runtime = "nodejs";
export const maxDuration = 60;

const FOLLOWUP_AGE_DAYS = 7;

interface FollowupRequest {
  vendor_id: string;
}

interface VendorRow {
  id: string;
  workspace_id: string;
  org_id: string;
  name: string;
  category: string | null;
  contact_name: string | null;
  contact_email: string | null;
  autopilot_enabled: boolean;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
}

interface OutboundLite {
  id: string;
  subject: string;
  body_text: string | null;
  to_email: string;
  sent_at: string | null;
  created_at: string;
}

interface DraftToolInput {
  subject: string;
  body_text: string;
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

  const overBudget = await assertNonChatAiQuota(supabase, profile.org_id);
  if (overBudget) {
    return NextResponse.json({ error: overBudget }, { status: 429 });
  }

  let body: FollowupRequest;
  try {
    body = (await request.json()) as FollowupRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.vendor_id) {
    return NextResponse.json({ error: "vendor_id required" }, { status: 400 });
  }

  if (!anthropicReady) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on the server." },
      { status: 503 },
    );
  }

  const sbAny = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          maybeSingle?: () => Promise<{ data: VendorRow | null }>;
          order?: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (
              n: number,
            ) => Promise<{ data: OutboundLite[] | null }>;
          };
          eq?: (
            col: string,
            v: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (n: number) => Promise<{
                data: OutboundLite[] | null;
              }>;
            };
          };
        };
      };
    };
  };

  // Fetch vendor (RLS scopes; double-check workspace)
  const { data: vendor } = await sbAny
    .from("vendors")
    .select(
      "id, workspace_id, org_id, name, category, contact_name, contact_email, autopilot_enabled, last_inbound_at, last_outbound_at",
    )
    .eq("id", body.vendor_id)
    .maybeSingle!();
  if (!vendor) {
    return NextResponse.json({ error: "vendor not found" }, { status: 404 });
  }
  if (vendor.workspace_id !== profile.workspace_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // ─── Eligibility check ───────────────────────────────────────────
  const now = Date.now();
  const lastOutbound = vendor.last_outbound_at
    ? new Date(vendor.last_outbound_at).getTime()
    : 0;
  const lastInbound = vendor.last_inbound_at
    ? new Date(vendor.last_inbound_at).getTime()
    : 0;

  if (!lastOutbound) {
    return NextResponse.json({
      ok: false,
      skipped: true,
      reason: "no outbound message yet — send the original outreach first",
    });
  }
  if (lastInbound > lastOutbound) {
    return NextResponse.json({
      ok: false,
      skipped: true,
      reason: "vendor already replied — analyze the thread instead",
    });
  }
  const ageDays = (now - lastOutbound) / (1000 * 60 * 60 * 24);
  if (ageDays < FOLLOWUP_AGE_DAYS) {
    return NextResponse.json({
      ok: false,
      skipped: true,
      reason: `last outbound is only ${ageDays.toFixed(
        1,
      )} days old (need ${FOLLOWUP_AGE_DAYS}+)`,
    });
  }

  // ─── Pull the most recent outbound to reference ──────────────────
  const sbThread = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          eq: (
            col: string,
            v: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (n: number) => Promise<{
                data: OutboundLite[] | null;
              }>;
            };
          };
        };
      };
    };
  };

  const { data: outboundRows } = await sbThread
    .from("email_messages")
    .select("id, subject, body_text, to_email, sent_at, created_at")
    .eq("related_vendor_id", body.vendor_id)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(3);

  const recentOutbound = (outboundRows ?? []) as OutboundLite[];
  const original = recentOutbound[recentOutbound.length - 1];
  const lastSent = recentOutbound[0];

  if (!original) {
    return NextResponse.json({
      ok: false,
      skipped: true,
      reason: "no outbound messages on file for this vendor",
    });
  }

  // ─── Prompt ──────────────────────────────────────────────────────
  const lines: string[] = [
    `Vendor: ${vendor.name}${vendor.category ? ` (${vendor.category})` : ""}`,
    vendor.contact_name ? `Contact: ${vendor.contact_name}` : null,
    vendor.contact_email ? `Email: ${vendor.contact_email}` : null,
    `Last outbound was ${ageDays.toFixed(0)} days ago and the vendor has not replied.`,
    "",
    "Original outreach (most recent first):",
  ]
    .filter((s): s is string => Boolean(s));

  for (const m of recentOutbound) {
    lines.push("");
    lines.push(`Subject: ${m.subject}`);
    if (m.body_text) {
      const trimmed =
        m.body_text.length > 1500
          ? `${m.body_text.slice(0, 1500)}…`
          : m.body_text;
      lines.push(trimmed);
    }
  }
  lines.push("");
  lines.push(
    "Draft the follow-up now via the emit_followup_draft tool. 4 lines max.",
  );

  const userMessage = lines.join("\n");

  // ─── Call Claude ─────────────────────────────────────────────────
  const startedAt = Date.now();
  const anthropic = getAnthropic();
  let resp: Anthropic.Message;
  try {
    resp = await anthropic.messages.create({
      model: DEFAULT_INTAKE_MODEL,
      max_tokens: 600,
      system: FOLLOWUP_SYSTEM,
      tool_choice: { type: "tool", name: FOLLOWUP_TOOL.name },
      tools: [FOLLOWUP_TOOL],
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "anthropic call failed" },
      { status: 500 },
    );
  }
  const durationMs = Date.now() - startedAt;

  const inputTokens = resp.usage?.input_tokens ?? 0;
  const outputTokens = resp.usage?.output_tokens ?? 0;
  const costUsd = estimateCost(inputTokens, outputTokens);
  await recordNonChatAiCall(
    supabase,
    vendor.org_id,
    vendor.workspace_id,
    costUsd,
  );

  const toolBlock = resp.content.find((c) => c.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    return NextResponse.json(
      { error: "Claude did not return a draft" },
      { status: 500 },
    );
  }
  const draft = toolBlock.input as DraftToolInput;
  const subject = draft.subject?.startsWith("Re:")
    ? draft.subject
    : `Re: ${lastSent?.subject ?? original.subject ?? draft.subject}`;

  // ─── Trace ───────────────────────────────────────────────────────
  const sbInsert = supabase as unknown as {
    from: (t: string) => {
      insert: (row: Record<string, unknown>) => Promise<{
        error: { message: string } | null;
      }>;
    };
  };
  await sbInsert.from("autopilot_runs").insert({
    workspace_id: vendor.workspace_id,
    org_id: vendor.org_id,
    kind: "follow_up",
    input_ref: {
      vendor_id: vendor.id,
      last_outbound_age_days: Number(ageDays.toFixed(1)),
    },
    output: { subject, body_text: draft.body_text } as Record<string, unknown>,
    model: DEFAULT_INTAKE_MODEL,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
    status: "success",
    duration_ms: durationMs,
    triggered_by: "manual",
  });

  // ─── Optional: save as Gmail draft if connected ──────────────────
  // We delegate to /api/gmail/draft (when GMAIL-CONNECTOR ships it). For
  // now we always return the draft body so the couple can copy-paste —
  // and best-effort attempt the draft endpoint, swallowing errors.
  let savedToGmail = false;
  try {
    const draftRes = await fetch(new URL("/api/gmail/draft", request.url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Forward the auth cookie so the draft endpoint sees the user.
        cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        to: vendor.contact_email,
        subject,
        body_text: draft.body_text,
        related_vendor_id: vendor.id,
      }),
    });
    if (draftRes.ok) savedToGmail = true;
  } catch {
    // gmail-connector may not be wired yet — that's fine
  }

  return NextResponse.json({
    ok: true,
    draft: {
      to: vendor.contact_email,
      subject,
      body_text: draft.body_text,
    },
    saved_to_gmail: savedToGmail,
    cost_usd: costUsd,
  });
}
