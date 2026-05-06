// Server-only Anthropic client with graceful fallback when ANTHROPIC_API_KEY isn't set.
// Used for guest-list column mapping (and later: pricing intake).

import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

export const anthropicReady = Boolean(apiKey);

export function getAnthropic(): Anthropic {
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it in Railway → Variables (or apps/web/.env.local) to enable AI Excel ingest.",
    );
  }
  return new Anthropic({ apiKey });
}

// Default model used by intake features. Claude Sonnet 4.6 — cost/latency right
// for OCR + structured extraction.
export const DEFAULT_INTAKE_MODEL = "claude-sonnet-4-6";

// Anthropic pricing in USD per million tokens (Sonnet 4.6, as of Jan 2026)
const SONNET_INPUT_PER_MTOK = 3.0;
const SONNET_OUTPUT_PER_MTOK = 15.0;

export function estimateCost(input_tokens: number, output_tokens: number): number {
  return (
    (input_tokens / 1_000_000) * SONNET_INPUT_PER_MTOK +
    (output_tokens / 1_000_000) * SONNET_OUTPUT_PER_MTOK
  );
}
