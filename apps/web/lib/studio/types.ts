// AI Studio — core types.
//
// The Studio is the wedding-domain prompt-optimizer surface. Each tool
// turns a couple's casual text intent + workspace context into a dense,
// generation-ready prompt via a two-stage flow:
//
//   1. clarify  → Claude returns 3-5 wedding-aware clarification questions
//                 with smart workspace-aware defaults pre-selected.
//   2. generate → Claude finalizes the prompt + Higgsfield renders N
//                 variants. Credits are deducted atomically server-side.
//
// See docs/AI_STUDIO_2026-05-13.md for the full spec.

/**
 * Stable slug for every studio tool. Used in API routes
 * (`/api/studio/<slug>/...`), the tool-registry map, and the tool page
 * routes. Adding a new tool? Add a new slug here AND a registry entry,
 * AND a tool module under `lib/studio/tools/<slug>.ts`.
 */
export type StudioToolSlug =
  | "mood-board"
  | "dress-on-me"
  | "venue-mockup"
  | "florals"
  | "cake"
  | "hair-makeup"
  | "invitation-mockup"
  | "color-palette"
  | "day-of-viz"
  | "pricing-analyzer";

/** Kind of answer the clarification UI collects from the user. */
export type ClarificationQuestionKind =
  | "single_choice"
  | "multi_choice"
  | "text";

/** One pre-set option in a single/multi-choice clarification question. */
export interface ClarificationOption {
  value: string;
  label: string;
}

/**
 * One clarification question rendered to the user as chips + a free-text
 * "Other" fallback when `allow_other` is true.
 *
 * The `default` field is the value (or comma-separated values for
 * multi_choice) that should be pre-selected when the user lands on the
 * question. Smart defaults flow from the workspace context (region,
 * season, palette, style_tags) — Claude does the inference inside the
 * `clarify()` system prompt.
 */
export interface ClarificationQuestion {
  id: string;
  label: string;
  kind: ClarificationQuestionKind;
  options: ClarificationOption[];
  allow_other: boolean;
  /** Optional helper text shown under the question label. */
  hint?: string;
  /** Pre-selected value(s). Comma-separated for multi_choice. */
  default?: string;
}

export interface ClarificationTemplate {
  questions: ClarificationQuestion[];
}

/** Higgsfield aspect-ratio choice. */
export type StudioAspect = "16:9" | "1:1" | "9:16";

/** Metadata for a single tool — drives the hub grid + per-tool routes. */
export interface StudioTool {
  slug: StudioToolSlug;
  label: string;
  description: string;
  cost_credits: number;
  input_kind: "text" | "image" | "image+text";
  output_kind: "image" | "image_grid";
  default_variant_count: number;
  status: "live" | "coming_soon";
  /** Lucide-react icon name (e.g., "Palette", "Shirt"). */
  icon: string;
  /**
   * Aspect ratio passed to Higgsfield. Tool-specific because a mood
   * board wants 16:9 collage but a cake render wants square; an
   * invitation wants portrait. Defaults to "1:1" when unset.
   */
  default_aspect?: StudioAspect;
}

/** Shape returned by the generate endpoint after a successful render. */
export interface StudioGenerationResult {
  variants: Array<{ image_url: string; is_placeholder?: boolean }>;
  optimized_prompt: string;
  cost_usd: number;
  credits_spent: number;
  /** UUID, in-memory for now. Will be backed by `generations` table later. */
  generation_id: string;
}

/**
 * Subset of workspace state surfaced to the prompt-optimizer. Kept narrow
 * deliberately — the more data we shove into the system prompt, the
 * fuzzier the inference. These are the fields that meaningfully steer
 * defaults: region (drives season + native flora), wedding_date (drives
 * season), style_tags (drives vibe), guest_count (drives scale),
 * base_currency (used in some tools' price-aware prompts).
 */
export interface WorkspaceContext {
  workspace_id: string;
  workspace_name: string | null;
  wedding_region: string | null;
  wedding_date: string | null;
  guest_count_estimate: number | null;
  style_tags: string[];
  base_currency: string;
}

/** Returned by clarify(). */
export interface ClarifyResult {
  questions: ClarificationQuestion[];
  preview_prompt: string;
  cost_usd: number;
}

/** Returned by finalizePrompt(). */
export interface FinalizeResult {
  optimized_prompt: string;
  cost_usd: number;
}
