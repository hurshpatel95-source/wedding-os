// AI Studio — prompt-optimizer wedge.
//
// Two functions, each calls Claude Sonnet 4.6 via the existing
// Anthropic SDK pattern with forced tool-use for structured output:
//
//   clarify()        → returns 3-5 wedding-domain clarification
//                      questions + a preview prompt using smart defaults.
//   finalizePrompt() → returns the dense Higgsfield-ready generation
//                      prompt, given the user's answers.
//
// Per-tool system prompts live in `lib/studio/tools/<slug>.ts`. As new
// tools graduate, add a new tools file + map it into the switch below.
//
// Both functions are cost-callouts — caller (route handler) is the one
// that runs the AI-quota guard. We just call Claude + report cost.

import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import {
  anthropicReady,
  getAnthropic,
  DEFAULT_INTAKE_MODEL,
  estimateCost,
} from "@/lib/anthropic";
import type {
  ClarificationQuestion,
  ClarifyResult,
  FinalizeResult,
  StudioToolSlug,
  WorkspaceContext,
} from "./types";
import {
  MOOD_BOARD_CLARIFICATION_FALLBACK,
  MOOD_BOARD_CLARIFY_SYSTEM,
  MOOD_BOARD_FINALIZE_SYSTEM,
} from "./tools/mood-board";

// ─── Per-tool prompt resolver ──────────────────────────────────────────
// As new tools graduate, add a case here that returns the right system
// prompts + the fallback template. The structure is uniform across
// tools so the route handlers don't have to fork.

interface ToolPrompts {
  clarify_system: string;
  finalize_system: string;
  /** Returned verbatim if Claude is unavailable or returns malformed JSON. */
  fallback_questions: ClarificationQuestion[];
}

function getToolPrompts(tool: StudioToolSlug): ToolPrompts | null {
  switch (tool) {
    case "mood-board":
      return {
        clarify_system: MOOD_BOARD_CLARIFY_SYSTEM,
        finalize_system: MOOD_BOARD_FINALIZE_SYSTEM,
        fallback_questions: MOOD_BOARD_CLARIFICATION_FALLBACK.questions,
      };
    case "dress-on-me":
    case "venue-mockup":
    case "florals":
    case "cake":
    case "hair-makeup":
    case "invitation-mockup":
    case "color-palette":
    case "day-of-viz":
    case "pricing-analyzer":
      // Day 1-2 only ships mood-board. The other tools are
      // status="coming_soon" in the registry and shouldn't reach this
      // path. Returning null forces the caller to 404, which is
      // honest UX for a route that doesn't yet exist.
      return null;
  }
}

// ─── Tool definitions for forced tool-use ──────────────────────────────

const CLARIFY_TOOL: Anthropic.Tool = {
  name: "emit_clarification_questions",
  description:
    "Emit 3-5 wedding-domain clarification questions with workspace-aware defaults + a preview generation prompt.",
  input_schema: {
    type: "object",
    required: ["questions", "preview_prompt"],
    properties: {
      questions: {
        type: "array",
        description: "3-5 questions to clarify the user's vague input.",
        items: {
          type: "object",
          required: ["id", "label", "kind", "options", "allow_other", "default"],
          properties: {
            id: {
              type: "string",
              description: "Stable ID (snake_case). E.g., 'vibe', 'palette'.",
            },
            label: {
              type: "string",
              description: "Conversational question. E.g., 'What's your vibe?'",
            },
            kind: {
              type: "string",
              enum: ["single_choice", "multi_choice", "text"],
            },
            options: {
              type: "array",
              items: {
                type: "object",
                required: ["value", "label"],
                properties: {
                  value: { type: "string" },
                  label: { type: "string" },
                },
              },
            },
            allow_other: { type: "boolean" },
            hint: { type: "string" },
            default: {
              type: "string",
              description:
                "Pre-selected option value (or comma-separated values for multi_choice). MUST be set.",
            },
          },
        },
      },
      preview_prompt: {
        type: "string",
        description:
          "Dense one-paragraph generation prompt assembled from the user's input + workspace context using the inferred defaults. 80-150 words.",
      },
    },
  },
};

const FINALIZE_TOOL: Anthropic.Tool = {
  name: "emit_optimized_prompt",
  description:
    "Emit the finalized photographic generation prompt as a single string.",
  input_schema: {
    type: "object",
    required: ["optimized_prompt"],
    properties: {
      optimized_prompt: {
        type: "string",
        description:
          "Dense, photographic, vendor-grade generation prompt. 120-200 words.",
      },
    },
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────

function workspaceContextLines(ctx: WorkspaceContext): string {
  // Compact JSON-ish bullet list. Kept narrow on purpose — too much
  // context fuzzes the inference.
  const lines: string[] = [];
  lines.push(
    `workspace.name: ${ctx.workspace_name ? `"${ctx.workspace_name}"` : "(unset)"}`,
  );
  lines.push(
    `workspace.wedding_region: ${ctx.wedding_region ? `"${ctx.wedding_region}"` : "(unset — assume US, prefer neutrals)"}`,
  );
  lines.push(
    `workspace.wedding_date: ${ctx.wedding_date ?? "(unset — pick season from user input or default to fall)"}`,
  );
  lines.push(
    `workspace.guest_count_estimate: ${ctx.guest_count_estimate ?? "(unset — assume ~120)"}`,
  );
  lines.push(
    `workspace.style_tags: ${ctx.style_tags.length > 0 ? JSON.stringify(ctx.style_tags) : "[]"}`,
  );
  lines.push(`workspace.base_currency: ${ctx.base_currency}`);
  return lines.join("\n");
}

function sanitizeQuestions(raw: unknown): ClarificationQuestion[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ClarificationQuestion[] = [];
  for (const r of raw as Array<Record<string, unknown>>) {
    if (typeof r.id !== "string" || typeof r.label !== "string") continue;
    const kind = r.kind;
    if (
      kind !== "single_choice" &&
      kind !== "multi_choice" &&
      kind !== "text"
    ) {
      continue;
    }
    const options = Array.isArray(r.options)
      ? (r.options as Array<Record<string, unknown>>)
          .filter(
            (o) =>
              typeof o.value === "string" && typeof o.label === "string",
          )
          .map((o) => ({
            value: String(o.value),
            label: String(o.label),
          }))
      : [];
    out.push({
      id: r.id,
      label: r.label,
      kind,
      options,
      allow_other: Boolean(r.allow_other),
      hint: typeof r.hint === "string" ? r.hint : undefined,
      default: typeof r.default === "string" ? r.default : undefined,
    });
  }
  return out.length > 0 ? out : null;
}

// ─── clarify() ─────────────────────────────────────────────────────────

export async function clarify(
  tool: StudioToolSlug,
  userInput: string,
  workspaceContext: WorkspaceContext,
): Promise<ClarifyResult> {
  const prompts = getToolPrompts(tool);
  if (!prompts) {
    throw new Error(
      `Studio tool "${tool}" is not yet wired for clarify. Coming soon.`,
    );
  }

  // If Anthropic isn't configured (local dev without key), return the
  // fallback template — UX still walks end-to-end.
  if (!anthropicReady) {
    return {
      questions: prompts.fallback_questions,
      preview_prompt: `(Stub) Mood board for: ${userInput.trim() || "your wedding"} — ANTHROPIC_API_KEY missing, defaults applied.`,
      cost_usd: 0,
    };
  }

  const anthropic = getAnthropic();
  const userBlock: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text: `WORKSPACE CONTEXT\n${workspaceContextLines(workspaceContext)}\n\nUSER INPUT\n"${userInput.trim()}"`,
    },
  ];

  let resp;
  try {
    resp = await anthropic.messages.create({
      model: DEFAULT_INTAKE_MODEL,
      max_tokens: 1500,
      system: prompts.clarify_system,
      tool_choice: { type: "tool", name: CLARIFY_TOOL.name },
      tools: [CLARIFY_TOOL],
      messages: [{ role: "user", content: userBlock }],
    });
  } catch (err) {
    // Network / API failure → fall back to template so the UX still
    // walks. Cost 0 because the call didn't bill.
    return {
      questions: prompts.fallback_questions,
      preview_prompt: `Mood board for ${userInput.trim() || "your wedding"} (fallback — Claude error: ${(err as Error).message}).`,
      cost_usd: 0,
    };
  }

  const toolBlock = resp.content.find((c) => c.type === "tool_use");
  const raw =
    toolBlock && toolBlock.type === "tool_use"
      ? (toolBlock.input as Record<string, unknown>)
      : null;

  const sanitized = raw ? sanitizeQuestions(raw.questions) : null;
  const previewPrompt =
    raw && typeof raw.preview_prompt === "string"
      ? raw.preview_prompt
      : `Mood board for ${userInput.trim() || "your wedding"}.`;

  const cost = estimateCost(resp.usage.input_tokens, resp.usage.output_tokens);

  return {
    questions: sanitized ?? prompts.fallback_questions,
    preview_prompt: previewPrompt,
    cost_usd: cost,
  };
}

// ─── finalizePrompt() ──────────────────────────────────────────────────

export async function finalizePrompt(
  tool: StudioToolSlug,
  userInput: string,
  answers: Record<string, string>,
  workspaceContext: WorkspaceContext,
): Promise<FinalizeResult> {
  const prompts = getToolPrompts(tool);
  if (!prompts) {
    throw new Error(
      `Studio tool "${tool}" is not yet wired for finalize. Coming soon.`,
    );
  }

  // Stub fallback when Anthropic isn't configured.
  if (!anthropicReady) {
    const answerLines = Object.entries(answers)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    return {
      optimized_prompt: `(Stub prompt) Mood board for "${userInput.trim() || "your wedding"}". Answers: ${answerLines}. ANTHROPIC_API_KEY missing — finalize bypassed.`,
      cost_usd: 0,
    };
  }

  const anthropic = getAnthropic();
  const answerLines = Object.entries(answers)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const userBlock: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text: `WORKSPACE CONTEXT\n${workspaceContextLines(workspaceContext)}\n\nUSER INPUT\n"${userInput.trim()}"\n\nANSWERS (user's picks — these OVERRIDE workspace inference where they conflict)\n${answerLines || "(none — user accepted all defaults)"}`,
    },
  ];

  let resp;
  try {
    resp = await anthropic.messages.create({
      model: DEFAULT_INTAKE_MODEL,
      max_tokens: 1500,
      system: prompts.finalize_system,
      tool_choice: { type: "tool", name: FINALIZE_TOOL.name },
      tools: [FINALIZE_TOOL],
      messages: [{ role: "user", content: userBlock }],
    });
  } catch (err) {
    return {
      optimized_prompt: `Mood board for ${userInput.trim() || "your wedding"} — fallback prompt (Claude error: ${(err as Error).message}).`,
      cost_usd: 0,
    };
  }

  const toolBlock = resp.content.find((c) => c.type === "tool_use");
  const raw =
    toolBlock && toolBlock.type === "tool_use"
      ? (toolBlock.input as Record<string, unknown>)
      : null;

  const optimized =
    raw && typeof raw.optimized_prompt === "string"
      ? raw.optimized_prompt
      : `Mood board for ${userInput.trim() || "your wedding"}.`;
  const cost = estimateCost(resp.usage.input_tokens, resp.usage.output_tokens);

  return {
    optimized_prompt: optimized,
    cost_usd: cost,
  };
}
