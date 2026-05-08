// Server-only Brave Search API wrapper.
// Used as a fallback when Google Places doesn't have what we want
// (e.g. couple wants a niche category Places doesn't index well).

import "server-only";
import type { VendorSearchResult } from "./autopilot-types";

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;

export const braveSearchReady = Boolean(BRAVE_API_KEY);

const BRAVE_URL = "https://api.search.brave.com/res/v1/web/search";

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
}

interface BraveResponse {
  web?: { results?: BraveWebResult[] };
}

export async function braveWebSearch(
  query: string,
  opts?: { count?: number },
): Promise<VendorSearchResult[]> {
  if (!braveSearchReady) {
    throw new Error("BRAVE_SEARCH_API_KEY not configured");
  }
  const count = Math.min(opts?.count ?? 10, 20);
  const url = `${BRAVE_URL}?q=${encodeURIComponent(query)}&count=${count}`;
  const res = await fetch(url, {
    headers: {
      "X-Subscription-Token": BRAVE_API_KEY!,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Brave API ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = (await res.json()) as BraveResponse;
  const items = json.web?.results ?? [];
  return items.map((r) => ({
    name: r.title ?? "",
    website: r.url,
    url: r.url,
    description: r.description,
  }));
}

export const BRAVE_FREE_TIER_QUERIES_PER_MONTH = 2000;
