// POST /api/vendor-search
// Workspace member only. Searches Google Places (or Brave fallback) for
// wedding vendors matching { category, region, query? }. Caches results in
// vendor_search_cache for 7 days so we don't re-bill the same lookup.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  searchPlaces,
  googlePlacesReady,
  PLACES_COST_PER_SEARCH_USD,
} from "@/lib/google-places";
import { braveWebSearch, braveSearchReady } from "@/lib/brave-search";
import { VENDOR_CATEGORIES } from "@/lib/vendor-categories";
import type {
  VendorSearchResult,
  VendorSearchCacheRow,
} from "@/lib/autopilot-types";
import { assertNonChatAiQuota, recordNonChatAiCall } from "@/lib/ai-quota";

export const runtime = "nodejs";
export const maxDuration = 30;

const CACHE_FRESH_DAYS = 7;

interface SearchBody {
  category?: string;
  region?: string;
  query?: string;
}

export async function POST(request: NextRequest) {
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
  if (!profile?.workspace_id || !profile?.org_id) {
    return NextResponse.json({ error: "no workspace" }, { status: 400 });
  }
  const workspaceId = profile.workspace_id as string;
  const orgId = profile.org_id as string;

  const body = (await request.json().catch(() => ({}))) as SearchBody;
  const category = (body.category ?? "").trim();
  const region = (body.region ?? "").trim();
  const customQuery = (body.query ?? "").trim();

  if (!category || !region) {
    return NextResponse.json(
      { error: "category and region are required" },
      { status: 400 },
    );
  }
  if (!(VENDOR_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json(
      { error: `unknown category "${category}"` },
      { status: 400 },
    );
  }

  // Build the actual search string. Prefer the user's custom query if given.
  const query =
    customQuery.length > 0
      ? customQuery
      : `wedding ${category.replace(/_/g, " ")} in ${region}`;

  // Quota check up-front (Places isn't AI but it costs us money — share the
  // budget so a runaway loop can't pin spend).
  const quotaError = await assertNonChatAiQuota(supabase, orgId);
  if (quotaError) {
    return NextResponse.json({ error: quotaError }, { status: 429 });
  }

  // ─── Cache lookup ────────────────────────────────────────────────────
  const sbCache = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            eq: (col: string, val: string) => {
              gte: (col: string, val: string) => {
                order: (
                  col: string,
                  opts: { ascending: boolean },
                ) => {
                  limit: (n: number) => Promise<{
                    data: VendorSearchCacheRow[] | null;
                  }>;
                };
              };
            };
          };
        };
      };
    };
  };

  const freshCutoff = new Date(
    Date.now() - CACHE_FRESH_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: cached } = await sbCache
    .from("vendor_search_cache")
    .select(
      "id, results, result_count, fetched_at, provider, category, region",
    )
    .eq("workspace_id", workspaceId)
    .eq("category", category)
    .eq("region", region)
    .gte("fetched_at", freshCutoff)
    .order("fetched_at", { ascending: false })
    .limit(1);

  const cachedHit = (cached ?? [])[0];
  if (cachedHit) {
    return NextResponse.json({
      ok: true,
      cached: true,
      cached_at: cachedHit.fetched_at,
      provider: cachedHit.provider,
      results: cachedHit.results ?? [],
      cost_usd: 0,
    });
  }

  // ─── Live search ─────────────────────────────────────────────────────
  if (!googlePlacesReady && !braveSearchReady) {
    return NextResponse.json(
      {
        error:
          "Vendor search isn't configured yet — your studio admin needs to add a GOOGLE_PLACES_API_KEY (or BRAVE_SEARCH_API_KEY) to enable web discovery.",
      },
      { status: 503 },
    );
  }

  let results: VendorSearchResult[] = [];
  let provider: "google_places" | "brave" = "google_places";
  let costUsd = 0;
  let triedFallback = false;

  if (googlePlacesReady) {
    try {
      results = await searchPlaces(query, { maxResults: 10 });
      provider = "google_places";
      costUsd = PLACES_COST_PER_SEARCH_USD;
    } catch (err) {
      // Swallow + try Brave fallback if available.
      console.warn("[vendor-search] places error:", err);
      results = [];
    }
  }

  if (results.length === 0 && braveSearchReady) {
    try {
      results = await braveWebSearch(query, { count: 10 });
      provider = "brave";
      costUsd = 0; // Brave free tier
      triedFallback = true;
    } catch (err) {
      console.warn("[vendor-search] brave error:", err);
    }
  }

  if (results.length === 0) {
    return NextResponse.json(
      {
        error:
          triedFallback || !googlePlacesReady
            ? "No results from web search. Try a broader region or different wording."
            : "Search provider returned no results.",
      },
      { status: 502 },
    );
  }

  // ─── Persist cache row ───────────────────────────────────────────────
  const sbInsert = supabase as unknown as {
    from: (t: string) => {
      insert: (p: Record<string, unknown>) => Promise<{
        error: { message: string } | null;
      }>;
    };
  };

  await sbInsert.from("vendor_search_cache").insert({
    workspace_id: workspaceId,
    org_id: orgId,
    category,
    region,
    query,
    provider,
    results,
    result_count: results.length,
    cost_usd: costUsd,
    created_by: user.id,
  });

  // Best-effort quota increment.
  try {
    await recordNonChatAiCall(supabase, orgId, workspaceId, costUsd);
  } catch {
    // ignore — quota check is the primary guard
  }

  return NextResponse.json({
    ok: true,
    cached: false,
    provider,
    results,
    cost_usd: costUsd,
  });
}
