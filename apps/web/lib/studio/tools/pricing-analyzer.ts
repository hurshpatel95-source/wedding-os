// Photo → pricing — migrated from /visualize into the Studio framework.
//
// Special case: this tool DOES NOT use the generic studio
// clarify/generate routes. It calls the existing
// /api/visualize/photo-to-pricing endpoint directly (multimodal Claude
// vision). The clarification template + system prompts here exist for
// registry uniformity, but the route handlers continue to skip this
// slug per their existing pricing-analyzer guard.
//
// Day 3.5 cleanup (deferred): fold the photo-to-pricing endpoint into
// the generic studio generate path. For now the standalone endpoint
// stays — less to change, smoke tests stay aligned.

import type { ClarificationTemplate } from "../types";

export const PRICING_ANALYZER_CLARIFICATION_FALLBACK: ClarificationTemplate = {
  questions: [
    {
      id: "region_context",
      label: "Confirm your region for accurate pricing?",
      kind: "single_choice",
      options: [
        { value: "use_workspace", label: "Use my workspace region" },
        { value: "us_national", label: "US national averages" },
        { value: "other", label: "Other — specify below" },
      ],
      allow_other: true,
      hint: "Pricing is dialed in by region. If yours isn't set, US averages are returned.",
      default: "use_workspace",
    },
  ],
};

// Minimal system prompts. The actual vision call lives in
// /api/visualize/photo-to-pricing/route.ts (kept as-is for the migration).
export const PRICING_ANALYZER_CLARIFY_SYSTEM = `You are the wedding-photo-pricing-analyzer clarification step. The user uploads an inspiration photo; this tool returns ONE structured analysis (no image generation). Confirm region context and pass through to the vision analyzer.

OUTPUT — call emit_clarification_questions with the region_context single-question template. No prose.`;

export const PRICING_ANALYZER_FINALIZE_SYSTEM = `You are the wedding-photo-pricing-analyzer finalize step. This tool routes to the dedicated /api/visualize/photo-to-pricing endpoint — the FINALIZE pass is bypassed in the client. Return a passthrough prompt string.

OUTPUT — call emit_optimized_prompt with a single passthrough string. No prose.`;
