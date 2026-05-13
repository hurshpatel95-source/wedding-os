// Shared logic for the autopilot thread analyzer.
//
// Pulls the email_messages thread for a vendor, asks Claude to emit a
// structured update (status, quote, alerts, summary), and patches the
// vendors row + autopilot_runs trace + alerts feed. Optionally rolls the
// quote into a linked budget_lines row when the vendor is now "quoted".
//
// Used by:
//   - POST /api/autopilot/analyze-thread (one vendor, manual / webhook)
//   - POST /api/autopilot/run-all        (batch — calls this in a loop)

import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anthropicReady,
  getAnthropic,
  DEFAULT_INTAKE_MODEL,
  estimateCost,
} from "@/lib/anthropic";
import { recordNonChatAiCall } from "@/lib/ai-quota";
import { currencySymbol, normalizeCurrency } from "@/lib/utils";
import type {
  AlertSeverity,
  VendorAutopilotStatus,
} from "@/lib/autopilot-types";

// ─── Tool definition (forced) ────────────────────────────────────────

export const ANALYZE_TOOL: Anthropic.Tool = {
  name: "emit_vendor_status_change",
  description:
    "Emit a structured update for the vendor relationship based on the latest email thread. Be conservative — never invent quotes.",
  input_schema: {
    type: "object",
    required: ["new_status", "ai_summary"],
    properties: {
      new_status: {
        type: "string",
        enum: [
          "researching",
          "contacted",
          "quoted",
          "booked",
          "declined",
          "unavailable",
        ],
        description:
          "The most-recent state of the relationship in the thread. Pick the LATEST state, not the cumulative one.",
      },
      quote_eur: {
        type: ["number", "null"],
        description:
          "Numeric quote in the WORKSPACE's base currency (see workspace.base_currency in CONTEXT — typically USD for US couples, EUR for European). NULL unless the vendor explicitly stated a price in this thread. Strip currency symbols and use the raw number. DO NOT convert between currencies — if the vendor priced in a different currency than the workspace, take the number verbatim and note the currency mismatch in quote_summary. The field is named quote_eur for legacy reasons; the value is in workspace currency, not always EUR.",
      },
      quote_summary: {
        type: ["string", "null"],
        description:
          "1-line summary of what's included at that price, in the vendor's own words/symbols (e.g. \"$4,500 includes ceremony + reception florals + delivery\" or \"€6,000 for full-day coverage\"). Keep the vendor's original currency symbol verbatim. NULL when quote_eur is null.",
      },
      ai_summary: {
        type: "string",
        description:
          "2-3 sentence running summary of where the relationship stands and what just happened. Plain English for the couple to read at a glance.",
      },
      next_action_for_couple: {
        type: ["string", "null"],
        description:
          "Single concrete next step the couple should take (e.g. \"Reply to confirm site visit Tue 3pm\"). NULL if waiting on the vendor.",
      },
      alerts: {
        type: "array",
        description:
          "Alerts to fire to the couple's in-app feed for THIS update. Keep concise; emit one per genuinely-new event (quote arrived, declined, booking confirmed, etc.). Empty array is OK if nothing notable.",
        items: {
          type: "object",
          required: ["kind", "severity", "title"],
          properties: {
            kind: {
              type: "string",
              description:
                "Short slug like 'vendor_quote_received', 'vendor_declined', 'vendor_booking_confirmed', 'vendor_followup_needed'.",
            },
            severity: {
              type: "string",
              enum: ["info", "success", "warn", "urgent"],
            },
            title: { type: "string" },
            body: { type: "string" },
          },
        },
      },
    },
  },
};

export const ANALYZE_SYSTEM = `You are an autopilot for a couple planning their wedding. You read the full email thread between the couple and a vendor, decide where the relationship stands, and emit a structured update.

Be conservative — never invent quotes. quote_eur is null unless the vendor sent an actual price. Record the price as-given in the vendor's own currency — DO NOT convert between currencies. The field is named "quote_eur" for legacy column-name reasons, but the value should be the raw number the vendor stated. The CONTEXT block tells you what currency the workspace uses; if the vendor quoted in a different currency, take the number verbatim and call out the mismatch in quote_summary so the couple notices.

new_status is the latest state in the thread, not the entire history. If the most recent message is from the couple awaiting a reply, the state stays "contacted". If the vendor sent a price, it's "quoted". If the vendor said no, it's "declined" or "unavailable".`;

export const FOLLOWUP_TOOL: Anthropic.Tool = {
  name: "emit_followup_draft",
  description:
    "Emit a polite, brief follow-up email referencing the prior outreach when the vendor hasn't replied.",
  input_schema: {
    type: "object",
    required: ["subject", "body_text"],
    properties: {
      subject: {
        type: "string",
        description: "Subject line — usually 'Re: <prior subject>' or short.",
      },
      body_text: {
        type: "string",
        description:
          "4-line follow-up. Polite, references the original outreach without re-explaining the whole project, asks if they're still interested.",
      },
    },
  },
};

export const FOLLOWUP_SYSTEM = `You are drafting a polite follow-up from a couple to a wedding vendor who hasn't replied to the original outreach in 7+ days. Keep it short (4 lines max), warm, low-pressure. End with an easy out so the vendor can decline without friction. Don't re-explain the whole project — assume they read the first email.`;

// ─── Types ───────────────────────────────────────────────────────────

interface VendorLite {
  id: string;
  workspace_id: string;
  org_id: string;
  name: string;
  category: string | null;
  contact_email: string | null;
  autopilot_status: VendorAutopilotStatus | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
}

interface EmailMessageLite {
  id: string;
  direction: "inbound" | "outbound";
  from_email: string | null;
  from_name: string | null;
  to_email: string;
  subject: string;
  body_text: string | null;
  sent_at: string | null;
  created_at: string;
}

interface WorkspaceLite {
  name: string | null;
  wedding_date: string | null;
  base_currency: string | null;
}

interface AnalyzeToolInput {
  new_status: VendorAutopilotStatus;
  quote_eur?: number | null;
  quote_summary?: string | null;
  ai_summary: string;
  next_action_for_couple?: string | null;
  alerts?: Array<{
    kind: string;
    severity: AlertSeverity;
    title: string;
    body?: string;
  }>;
}

export interface AnalyzeOutcome {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  status?: VendorAutopilotStatus;
  quote_eur?: number | null;
  /** Workspace's display currency for formatting the quote in the UI. */
  base_currency?: string;
  alerts_created?: number;
  cost_usd?: number;
  ai_summary?: string;
}

// ─── Casting helpers (vendors / email_messages / alerts / autopilot_runs
//    aren't in the generated Database types yet) ─────────────────────

// Loose type so callers can pass any flavour of typed SupabaseClient — we
// cast through `unknown` immediately to reach untyped tables.
// `SupabaseClient` without generics defaults to GenericSchema so any
// concrete-typed client is assignable.
type AnyDB = SupabaseClient;

function sbCast(sb: AnyDB) {
  return sb as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle?: () => Promise<{
            data: Record<string, unknown> | null;
          }>;
          order?: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (
              n: number,
            ) => Promise<{ data: Record<string, unknown>[] | null }>;
          };
          limit?: (
            n: number,
          ) => Promise<{ data: Record<string, unknown>[] | null }>;
        };
        limit: (n: number) => {
          maybeSingle: () => Promise<{
            data: Record<string, unknown> | null;
          }>;
        };
      };
      update: (row: Record<string, unknown>) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
      insert: (
        row: Record<string, unknown> | Record<string, unknown>[],
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
}

// ─── Public: run a single analysis pass for one vendor ───────────────

export async function analyzeVendorThread(
  sb: AnyDB,
  vendorId: string,
  triggeredBy: "manual" | "webhook" | "cron" | "batch" = "manual",
): Promise<AnalyzeOutcome> {
  const cast = sbCast(sb);

  // Load vendor + workspace name
  const { data: vendorRow } = await cast
    .from("vendors")
    .select(
      "id, workspace_id, org_id, name, category, contact_email, autopilot_status, last_inbound_at, last_outbound_at",
    )
    .eq("id", vendorId)
    .maybeSingle!();
  if (!vendorRow) {
    return { ok: false, skipped: true, reason: "vendor not found" };
  }
  const vendor = vendorRow as unknown as VendorLite;

  const { data: workspaceRow } = await cast
    .from("workspaces")
    .select("name, wedding_date, base_currency")
    .eq("id", vendor.workspace_id)
    .maybeSingle!();
  const workspace = (workspaceRow as unknown as WorkspaceLite | null) ?? null;
  // Workspace currency drives both the prompt context and the in-app
  // display symbol. Normalize unknown → USD as the safe fallback (matches
  // /budget + /payments + Co-pilot fix 903462f).
  const baseCurrency = normalizeCurrency(workspace?.base_currency);
  const currencySym = currencySymbol(baseCurrency);

  // Load last 20 messages for this vendor, oldest first
  const { data: msgsRaw } = await cast
    .from("email_messages")
    .select(
      "id, direction, from_email, from_name, to_email, subject, body_text, sent_at, created_at",
    )
    .eq("related_vendor_id", vendorId)
    .order!("created_at", { ascending: false })
    .limit(20);

  const messages = (
    (msgsRaw as unknown as EmailMessageLite[] | null) ?? []
  )
    .slice()
    .reverse();

  const inboundMessages = messages.filter((m) => m.direction === "inbound");
  if (inboundMessages.length === 0) {
    return { ok: true, skipped: true, reason: "no inbound messages" };
  }

  if (!anthropicReady) {
    return { ok: false, skipped: true, reason: "ANTHROPIC_API_KEY not set" };
  }

  // ─── Build prompt ─────────────────────────────────────────────────
  const lines: string[] = [];
  if (workspace?.name) {
    lines.push(
      `Workspace: ${workspace.name}${
        workspace.wedding_date
          ? ` · wedding date ${workspace.wedding_date}`
          : ""
      }`,
    );
  }
  lines.push(
    `Workspace currency: ${baseCurrency} (symbol ${currencySym}) — quotes should be recorded in this currency without converting.`,
  );
  lines.push(
    `Vendor: ${vendor.name}${vendor.category ? ` (${vendor.category})` : ""}`,
  );
  if (vendor.autopilot_status && vendor.autopilot_status !== "none") {
    lines.push(`Current autopilot status: ${vendor.autopilot_status}`);
  }
  lines.push("");
  lines.push(`Email thread (${messages.length} messages, oldest first):`);
  lines.push("");

  for (const m of messages) {
    const ts = m.sent_at ?? m.created_at;
    const arrow = m.direction === "inbound" ? "←" : "→";
    const fromLabel = m.from_email ?? (m.direction === "inbound" ? "vendor" : "couple");
    lines.push(
      `${arrow} [${ts}] ${m.direction.toUpperCase()} from ${fromLabel} to ${m.to_email}`,
    );
    lines.push(`  Subject: ${m.subject}`);
    const body = (m.body_text ?? "").trim();
    if (body) {
      // Cap each body to ~3000 chars to keep the prompt bounded
      const trimmed = body.length > 3000 ? `${body.slice(0, 3000)}…` : body;
      lines.push(
        trimmed
          .split("\n")
          .map((l) => `  ${l}`)
          .join("\n"),
      );
    }
    lines.push("");
  }
  lines.push(
    "Now emit the structured update via the emit_vendor_status_change tool. Read the FULL thread before deciding new_status — only the latest state matters.",
  );

  const userMessage = lines.join("\n");

  // ─── Call Claude ──────────────────────────────────────────────────
  const startedAt = Date.now();
  const anthropic = getAnthropic();
  let resp: Anthropic.Message;
  try {
    resp = await anthropic.messages.create({
      model: DEFAULT_INTAKE_MODEL,
      max_tokens: 1500,
      system: ANALYZE_SYSTEM,
      tool_choice: { type: "tool", name: ANALYZE_TOOL.name },
      tools: [ANALYZE_TOOL],
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err) {
    const message = (err as Error).message ?? "anthropic call failed";
    await insertRunRow(sb, {
      workspace_id: vendor.workspace_id,
      org_id: vendor.org_id,
      kind: "analyze_thread",
      input_ref: { vendor_id: vendorId, message_count: messages.length },
      output: {},
      model: DEFAULT_INTAKE_MODEL,
      input_tokens: null,
      output_tokens: null,
      cost_usd: 0,
      status: "failed",
      error_message: message,
      duration_ms: Date.now() - startedAt,
      triggered_by: triggeredBy,
    });
    return { ok: false, reason: message };
  }
  const durationMs = Date.now() - startedAt;

  const inputTokens = resp.usage?.input_tokens ?? 0;
  const outputTokens = resp.usage?.output_tokens ?? 0;
  const costUsd = estimateCost(inputTokens, outputTokens);

  // Track usage against the daily AI budget
  await recordNonChatAiCall(
    sb as unknown as SupabaseClient,
    vendor.org_id,
    vendor.workspace_id,
    costUsd,
  );

  const toolBlock = resp.content.find((c) => c.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    await insertRunRow(sb, {
      workspace_id: vendor.workspace_id,
      org_id: vendor.org_id,
      kind: "analyze_thread",
      input_ref: { vendor_id: vendorId, message_count: messages.length },
      output: {},
      model: DEFAULT_INTAKE_MODEL,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      status: "failed",
      error_message: "no tool_use block in response",
      duration_ms: durationMs,
      triggered_by: triggeredBy,
    });
    return { ok: false, reason: "Claude did not return a structured update" };
  }
  const toolInput = toolBlock.input as AnalyzeToolInput;

  // ─── Patch vendor row ─────────────────────────────────────────────
  const latestInbound = inboundMessages[inboundMessages.length - 1];
  const latestInboundTs =
    latestInbound?.sent_at ?? latestInbound?.created_at ?? null;

  const quoteEur =
    typeof toolInput.quote_eur === "number" && Number.isFinite(toolInput.quote_eur)
      ? toolInput.quote_eur
      : null;

  const vendorPatch: Record<string, unknown> = {
    autopilot_status: toolInput.new_status,
    ai_summary: toolInput.ai_summary,
    quote_source_email_id: latestInbound?.id ?? null,
  };
  // Only stamp last_inbound_at if newer than what's already there
  if (latestInboundTs) {
    if (
      !vendor.last_inbound_at ||
      new Date(latestInboundTs) > new Date(vendor.last_inbound_at)
    ) {
      vendorPatch.last_inbound_at = latestInboundTs;
    }
  }
  if (quoteEur !== null) {
    vendorPatch.quote_eur = quoteEur;
    vendorPatch.quote_summary = toolInput.quote_summary ?? null;
  }

  const { error: updateErr } = await cast
    .from("vendors")
    .update(vendorPatch)
    .eq("id", vendorId);
  if (updateErr) {
    console.warn("[autopilot-analyzer] vendor update failed:", updateErr.message);
  }

  // ─── Budget auto-roll: if quoted + quote present + linked line, patch
  //    budget_lines.amount_committed ──────────────────────────────────
  if (toolInput.new_status === "quoted" && quoteEur !== null) {
    try {
      const { data: lineRow } = await cast
        .from("budget_lines")
        .select("id")
        .eq("vendor_id", vendorId)
        .limit!(1);
      const line = (lineRow as unknown as { id: string }[] | null)?.[0];
      if (line?.id) {
        const { error: lineErr } = await cast
          .from("budget_lines")
          .update({
            amount_committed: quoteEur,
            status: "quoted",
            source: "vendor_quote",
          })
          .eq("id", line.id);
        if (lineErr) {
          console.warn(
            "[autopilot-analyzer] budget_lines update failed:",
            lineErr.message,
          );
        }
      }
    } catch (err) {
      console.warn(
        "[autopilot-analyzer] budget roll-up failed:",
        (err as Error).message,
      );
    }
  }

  // ─── Insert alerts ────────────────────────────────────────────────
  const alertsToCreate = (toolInput.alerts ?? []).filter((a) => a && a.title);
  let alertsCreated = 0;
  if (alertsToCreate.length > 0) {
    const alertRows = alertsToCreate.map((a) => ({
      workspace_id: vendor.workspace_id,
      org_id: vendor.org_id,
      audience: "couple" as const,
      kind: a.kind,
      severity: a.severity,
      title: a.title,
      body: a.body ?? null,
      action_url: `/vendors/${vendorId}`,
      payload: {
        quote_eur: quoteEur,
        next_action_for_couple: toolInput.next_action_for_couple ?? null,
      },
      related_vendor_id: vendorId,
    }));
    const { error: alertErr } = await cast.from("alerts").insert(alertRows);
    if (alertErr) {
      console.warn("[autopilot-analyzer] alerts insert failed:", alertErr.message);
    } else {
      alertsCreated = alertRows.length;
    }
  }

  // ─── Trace ────────────────────────────────────────────────────────
  await insertRunRow(sb, {
    workspace_id: vendor.workspace_id,
    org_id: vendor.org_id,
    kind: "analyze_thread",
    input_ref: { vendor_id: vendorId, message_count: messages.length },
    output: toolInput as unknown as Record<string, unknown>,
    model: DEFAULT_INTAKE_MODEL,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
    status: "success",
    error_message: null,
    duration_ms: durationMs,
    triggered_by: triggeredBy,
  });

  return {
    ok: true,
    status: toolInput.new_status,
    quote_eur: quoteEur,
    base_currency: baseCurrency,
    alerts_created: alertsCreated,
    cost_usd: costUsd,
    ai_summary: toolInput.ai_summary,
  };
}

// ─── Trace insert helper ─────────────────────────────────────────────

async function insertRunRow(
  sb: AnyDB,
  row: {
    workspace_id: string;
    org_id: string;
    kind: string;
    input_ref: Record<string, unknown>;
    output: Record<string, unknown>;
    model: string | null;
    input_tokens: number | null;
    output_tokens: number | null;
    cost_usd: number;
    status: "success" | "failed" | "queued" | "running";
    error_message: string | null;
    duration_ms: number | null;
    triggered_by: string | null;
  },
): Promise<void> {
  const cast = sbCast(sb);
  const { error } = await cast.from("autopilot_runs").insert(row);
  if (error) {
    console.warn("[autopilot-analyzer] autopilot_runs insert failed:", error.message);
  }
}
