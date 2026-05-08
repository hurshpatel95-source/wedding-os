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
import type {
  IntakeChatMessage,
  IntakeExtractedData,
  IntakeSessionRow,
} from "@/lib/autopilot-types";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_OUTPUT_TOKENS = 700;
// Hard ceiling on transcript size sent each turn — keeps prompt cost bounded
// even on a long, meandering conversation.
const MAX_TRANSCRIPT_TURNS = 24;

interface TurnRequest {
  session_id: string;
  user_message: string;
}

const SYSTEM_PROMPT = `You are the wedding-os onboarding host — a warm, conversational AI that interviews newly-engaged couples to populate their workspace.

Your job is to collect these fields, conversationally, ONE QUESTION AT A TIME. You don't need to ask in this order, but cover them all:

  - partner_a_name           (required)
  - partner_b_name           (nice to have)
  - wedding_date             (ISO yyyy-mm-dd; ask only if they have one in mind — totally fine if "TBD")
  - wedding_region           (required — city, region, or country, e.g. "Newport, RI" or "Tuscany")
  - venue_name               (only if they have one — likely null this early)
  - venue_locked             (true if they've actually signed a venue contract)
  - style_tags               (array of 1-3 short tags: "modern", "rustic", "destination", "intimate", etc.)
  - guest_count_estimate     (required — single integer; their best guess)
  - budget_target_eur        (single integer in EUR; ask but don't push if uncomfortable)
  - completed_tasks          (array of strings — what's already done? "set date", "booked venue", etc.)
  - top_concerns             (required — array of 1-3 short strings, e.g. "guest list overwhelm", "destination logistics")
  - first_priority_category  (one of: "venue", "photo_video", "catering", "music", "flowers_decor", "attire", "stationery", "other")

Tone:
- Warm, brief, conversational. Address them like friends, not customers.
- ONE question at a time. NEVER list multiple questions in one message.
- React to what they say before pivoting ("Lovely! Tuscany is gorgeous —" then ask the next thing).
- If they say "skip" or "I don't know" or seem reluctant, just move on — don't pressure.
- If they answer multiple fields in one message, capture them ALL via extract_intake_fields, then ask the next missing one.

Required fields for completion: partner_a_name, wedding_region, guest_count_estimate, top_concerns.
Once those four are filled, set complete=true and your ai_message should be a warm wrap-up like "That's everything I needed — let me set up your dashboard."

EVERY turn you MUST call the extract_intake_fields tool. The extracted_patch can be empty {} if the user said something that didn't add new info, but the tool call is required so we always have ai_message.

Never invent values. If they don't tell you a number, don't guess one.`;

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "extract_intake_fields",
  description:
    "Emit any newly-extracted onboarding fields plus the next assistant message and a completeness flag.",
  input_schema: {
    type: "object",
    required: ["extracted_patch", "ai_message", "complete"],
    properties: {
      extracted_patch: {
        type: "object",
        description:
          "Newly-learned fields ONLY (don't repeat already-known ones). Omit fields you didn't learn this turn.",
        properties: {
          partner_a_name: { type: "string" },
          partner_b_name: { type: "string" },
          wedding_date: {
            type: "string",
            description: "ISO yyyy-mm-dd, or omit if no date yet.",
          },
          wedding_season: { type: "string" },
          wedding_region: { type: "string" },
          venue_name: { type: "string" },
          venue_locked: { type: "boolean" },
          style_tags: {
            type: "array",
            items: { type: "string" },
          },
          guest_count_estimate: { type: "integer" },
          budget_target_eur: { type: "integer" },
          completed_tasks: {
            type: "array",
            items: { type: "string" },
          },
          top_concerns: {
            type: "array",
            items: { type: "string" },
          },
          first_priority_category: { type: "string" },
        },
      },
      ai_message: {
        type: "string",
        description:
          "The next thing to say to the couple. Warm, brief, ONE question or a wrap-up.",
      },
      complete: {
        type: "boolean",
        description:
          "True once partner_a_name, wedding_region, guest_count_estimate, and top_concerns are all filled (after this turn's patch is applied).",
      },
    },
  },
};

interface IntakeSessionsTable {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{
          data: IntakeSessionRow | null;
        }>;
      };
    };
    update: (
      payload: Record<string, unknown>,
    ) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ error: { message: string } | null }>;
    };
    insert: (
      payload: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
  };
}

export async function POST(request: NextRequest) {
  if (!anthropicReady) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on the server." },
      { status: 503 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id) {
    return NextResponse.json({ error: "no workspace" }, { status: 403 });
  }

  // Cost guard
  const overBudget = await assertNonChatAiQuota(supabase, profile.org_id);
  if (overBudget) {
    return NextResponse.json({ error: overBudget }, { status: 429 });
  }

  const body = (await request.json()) as TurnRequest;
  if (!body.session_id || !body.user_message?.trim()) {
    return NextResponse.json(
      { error: "missing session_id or user_message" },
      { status: 400 },
    );
  }

  const sb = supabase as unknown as IntakeSessionsTable;

  const { data: session } = await sb
    .from("intake_sessions")
    .select(
      "id, workspace_id, org_id, status, started_at, completed_at, chat_messages, extracted_data, total_cost_usd, created_at, updated_at",
    )
    .eq("id", body.session_id)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (session.workspace_id !== profile.workspace_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (session.status !== "active") {
    return NextResponse.json(
      { error: "session no longer active" },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const userMsg: IntakeChatMessage = {
    role: "user",
    content: body.user_message.trim(),
    ts: now,
  };

  const transcript: IntakeChatMessage[] = [...(session.chat_messages ?? [])];
  transcript.push(userMsg);

  // Build messages array for Claude — role must be 'user' or 'assistant'
  // (drop 'system' entries from history; system prompt is set globally).
  const trimmed = transcript.slice(-MAX_TRANSCRIPT_TURNS);
  const claudeMessages: Anthropic.MessageParam[] = trimmed
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  // Inject the running extracted_data state so Claude doesn't re-ask things.
  const knownStateText = `Already known so far (don't re-ask):\n${JSON.stringify(
    session.extracted_data ?? {},
    null,
    2,
  )}`;

  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: SYSTEM_PROMPT },
    {
      type: "text",
      text: knownStateText,
    },
  ];

  const anthropic = getAnthropic();
  let resp;
  const startedAt = Date.now();
  try {
    resp = await anthropic.messages.create({
      model: DEFAULT_INTAKE_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: systemBlocks,
      tool_choice: { type: "tool", name: EXTRACT_TOOL.name },
      tools: [EXTRACT_TOOL],
      messages: claudeMessages,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Claude error: ${(err as Error).message}` },
      { status: 502 },
    );
  }
  const durationMs = Date.now() - startedAt;

  const toolBlock = resp.content.find((c) => c.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    return NextResponse.json(
      { error: "Claude did not return a tool call" },
      { status: 500 },
    );
  }

  const out = toolBlock.input as {
    extracted_patch: Record<string, unknown>;
    ai_message: string;
    complete: boolean;
  };

  const cost = estimateCost(resp.usage.input_tokens, resp.usage.output_tokens);

  // Persist to ai_usage_daily for the global non-chat budget guard
  await recordNonChatAiCall(
    supabase,
    profile.org_id,
    profile.workspace_id,
    cost,
  );

  // Append AI message to transcript and merge extracted_patch into the
  // running extracted_data.
  const aiMsg: IntakeChatMessage = {
    role: "assistant",
    content: out.ai_message,
    ts: new Date().toISOString(),
  };
  const newTranscript: IntakeChatMessage[] = [...transcript, aiMsg];
  const mergedExtracted: IntakeExtractedData = {
    ...(session.extracted_data ?? {}),
    ...(out.extracted_patch as IntakeExtractedData),
  };

  const newCost = Number(session.total_cost_usd ?? 0) + cost;

  const { error: updateErr } = await sb.from("intake_sessions").update({
    chat_messages: newTranscript as unknown as object,
    extracted_data: mergedExtracted as unknown as object,
    total_cost_usd: newCost,
  }).eq("id", session.id);
  if (updateErr) {
    return NextResponse.json(
      { error: `Couldn't save session: ${updateErr.message}` },
      { status: 500 },
    );
  }

  // Emit autopilot_runs trace row (best-effort — RLS policy is org_admin
  // for write but the table is workspace-scoped; we cast through anyway).
  await sb.from("autopilot_runs").insert({
    workspace_id: profile.workspace_id,
    org_id: profile.org_id,
    kind: "intake_extract",
    input_ref: { session_id: session.id },
    output: {
      extracted_patch: out.extracted_patch,
      complete: out.complete,
    },
    model: DEFAULT_INTAKE_MODEL,
    input_tokens: resp.usage.input_tokens,
    output_tokens: resp.usage.output_tokens,
    cost_usd: cost,
    status: "success",
    duration_ms: durationMs,
    triggered_by: "manual",
  });

  return NextResponse.json({
    message: out.ai_message,
    extracted_patch: out.extracted_patch,
    complete: Boolean(out.complete),
  });
}
