// Server-only Google Places (Text Search v1) wrapper.
// Used by VENDOR-SEARCH agent.
//
// Pricing reference: Text Search Pro = $0.032 per request after $200/mo
// free credit. We cap aggressively at the API layer + cache results in
// vendor_search_cache so the same lookup doesn't re-bill.

import "server-only";
import type { VendorSearchResult } from "./autopilot-types";

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export const googlePlacesReady = Boolean(PLACES_API_KEY);

const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

interface PlacesPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  editorialSummary?: { text?: string };
  photos?: Array<{ name?: string }>;
}

interface PlacesResponse {
  places?: PlacesPlace[];
}

/** Search for vendors by free-text query like "wedding florist Newport, RI". */
export async function searchPlaces(
  query: string,
  opts?: { maxResults?: number },
): Promise<VendorSearchResult[]> {
  if (!googlePlacesReady) {
    throw new Error("GOOGLE_PLACES_API_KEY not configured");
  }
  const maxResults = Math.min(opts?.maxResults ?? 10, 20);
  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.internationalPhoneNumber",
    "places.websiteUri",
    "places.rating",
    "places.userRatingCount",
    "places.googleMapsUri",
    "places.editorialSummary",
    "places.photos",
  ].join(",");

  const res = await fetch(TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": PLACES_API_KEY!,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: maxResults,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Places API ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = (await res.json()) as PlacesResponse;
  const places = json.places ?? [];
  return places.map((p) => ({
    name: p.displayName?.text ?? "",
    phone: p.internationalPhoneNumber ?? undefined,
    website: p.websiteUri ?? undefined,
    address: p.formattedAddress ?? undefined,
    rating: p.rating,
    rating_count: p.userRatingCount,
    place_id: p.id,
    url: p.googleMapsUri,
    description: p.editorialSummary?.text,
    photos: p.photos
      ?.map((ph) =>
        ph.name
          ? `https://places.googleapis.com/v1/${ph.name}/media?key=${PLACES_API_KEY}&maxWidthPx=400`
          : undefined,
      )
      .filter((u): u is string => !!u)
      .slice(0, 4),
  }));
}

/** Cost of a single Text Search call (rough). */
export const PLACES_COST_PER_SEARCH_USD = 0.032;
