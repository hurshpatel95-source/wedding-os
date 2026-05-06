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

// Cheaper model used for the couple-side chat co-pilot. Plenty smart,
// 3× cheaper than Sonnet, fast.
export const DEFAULT_CHAT_MODEL = "claude-haiku-4-5-20251001";

// Anthropic pricing in USD per million tokens (as of Jan 2026)
const SONNET_INPUT_PER_MTOK = 3.0;
const SONNET_OUTPUT_PER_MTOK = 15.0;
const HAIKU_INPUT_PER_MTOK = 1.0;
const HAIKU_OUTPUT_PER_MTOK = 5.0;
// Prompt caching: reads are 10% of fresh input cost; cache writes are 1.25×.
const CACHE_READ_DISCOUNT = 0.1;
const CACHE_WRITE_PREMIUM = 1.25;

export function estimateCost(input_tokens: number, output_tokens: number): number {
  return (
    (input_tokens / 1_000_000) * SONNET_INPUT_PER_MTOK +
    (output_tokens / 1_000_000) * SONNET_OUTPUT_PER_MTOK
  );
}

export function estimateChatCost(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}): number {
  // Haiku-priced. The SDK's input_tokens already excludes cache_read +
  // cache_creation, so each bucket is summed at its own rate.
  const fresh = (usage.input_tokens ?? 0) / 1_000_000;
  const cached = (usage.cache_read_input_tokens ?? 0) / 1_000_000;
  const cacheWrite = (usage.cache_creation_input_tokens ?? 0) / 1_000_000;
  const out = (usage.output_tokens ?? 0) / 1_000_000;
  return (
    fresh * HAIKU_INPUT_PER_MTOK +
    cached * HAIKU_INPUT_PER_MTOK * CACHE_READ_DISCOUNT +
    cacheWrite * HAIKU_INPUT_PER_MTOK * CACHE_WRITE_PREMIUM +
    out * HAIKU_OUTPUT_PER_MTOK
  );
}
