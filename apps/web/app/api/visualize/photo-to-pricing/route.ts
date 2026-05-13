// Move 2 — Photo → Pricing (multimodal Claude vision endpoint).
//
// POST /api/visualize/photo-to-pricing
// Accepts multipart/form-data with:
//   - image (File): the uploaded image, ≤ 5 MB, jpeg/png/webp/gif
//   - notes (string, optional): free-text the user typed alongside the upload
//
// Server:
//   1. Auth (user + workspace).
//   2. Read image into memory, validate mime + size.
//   3. Pull workspace context (base_currency, wedding_region, guest_count_estimate).
//   4. Call Claude Sonnet (multimodal) with a tool-use spec for structured output.
//   5. Return PricingAnalysis JSON. STATELESS — no DB writes, no storage.
//
// Cost: ~$0.02-$0.05 per analysis at current Sonnet 4.6 rates.
// Per-workspace defense-in-depth cap: MAX_DAILY_ANALYSES per 24h
// (counted via the in-memory rate-limit map — best-effort, resets on
// deploy. Persistence-backed cap is a follow-up).
//
// Hard rule: image bytes are NEVER persisted. Processed in memory.

import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import {
  anthropicReady,
  getAnthropic,
  DEFAULT_INTAKE_MODEL,
  estimateCost,
} from "@/lib/anthropic";
import { normalizeCurrency } from "@/lib/utils";
import type { VendorCategory } from "@/lib/vendor-types";

export const runtime = "nodejs";
export const maxDuration = 60;

// 5 MB cap (spec). Smaller than the generic 15 MB intake cap because
// vision images don't need to be huge to be analyzable.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Cost cap: ~$0.05/call. Defense-in-depth — daily per-workspace cap to
// prevent a leaky client from running up the bill. Best-effort: in-memory
// counter, resets on server restart. Persistence-backed cap is a follow-up.
const MAX_DAILY_ANALYSES_PER_WORKSPACE = 50;
const dailyHits = new Map<string, { day: string; count: number }>();

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

const SYSTEM_PROMPT = `You are a wedding-vendor pricing analyst. Given an image and the couple's workspace context (region, base currency, guest count), identify the wedding-relevant elements in the image and estimate a realistic local price range.

Rules:
- Be honest. If the image isn't wedding-relevant (a cat, a screenshot, a random object), set wedding_relevant=false, leave identified_items empty, and use the image_summary field to say what you saw.
- Identify SPECIFIC visual elements — "Large floral arch with white and blush roses" not "Some flowers." Each item maps to one vendor category from the enum.
- Price ranges should reflect the workspace's region (city/state) and guest count. If region is missing, give a US national average and say so in the notes field. NEVER invent prices for regions you don't know — use the notes field to acknowledge uncertainty.
- All prices are in the workspace's base currency (USD/EUR/etc.) — the field is named *_usd for compatibility but you must use the workspace currency.
- Inspiration terms are Pinterest-search-style phrases (3-6 words each) for finding similar examples — "blush garden roses ceremony arch", "moody candlelit lounge tablescape", etc.
- Suggest the 1-3 vendor categories that could actually deliver what's in the image.
- Confidence: high = clear single subject, medium = blurry or partial, low = ambiguous or you're guessing.

You MUST emit the report via the report_pricing_analysis tool. Don't write prose.`;

const TOOL: Anthropic.Tool = {
  name: "report_pricing_analysis",
  description:
    "Emit the structured photo-to-pricing analysis for the uploaded image.",
  input_schema: {
    type: "object",
    required: [
      "image_summary",
      "wedding_relevant",
      "identified_items",
      "suggested_vendor_categories",
      "typical_price_range",
      "similar_inspiration_terms",
    ],
    properties: {
      image_summary: {
        type: "string",
        description:
          "One or two sentences describing what was identified in the image.",
      },
      wedding_relevant: {
        type: "boolean",
        description:
          "False when the image clearly isn't a wedding-relevant subject. When false, identified_items + suggested_vendor_categories should be empty and price_range should be zero.",
      },
      identified_items: {
        type: "array",
        items: {
          type: "object",
          required: ["category", "description", "confidence"],
          properties: {
            category: {
              type: "string",
              description:
                "One of the VendorCategory enum values: florist, decor, transport, guest_shuttle, bridal_car, photographer, videographer, photo_booth, dj, live_band, dhol, sound_av, lighting, mua_hair, mehndi, baraat_horse, pandit, priest_officiant, stationery, signage, rentals_furniture, lounge_furniture, cake_dessert, bar_mixology, late_night_food, permits_legal, translator_emcee, other.",
            },
            description: { type: "string" },
            confidence: { enum: ["high", "medium", "low"] },
          },
        },
      },
      suggested_vendor_categories: {
        type: "array",
        items: { type: "string" },
        description:
          "Vendor categories that could deliver what's in the image. Same enum as identified_items.category.",
      },
      typical_price_range: {
        type: "object",
        required: ["low_usd", "mid_usd", "high_usd", "notes"],
        properties: {
          low_usd: {
            type: "number",
            description:
              "Lower end of typical local pricing in the workspace's base currency. 0 when wedding_relevant=false.",
          },
          mid_usd: { type: "number" },
          high_usd: { type: "number" },
          notes: {
            type: "string",
            description:
              "Short caveat — region assumption, guest-count basis, what could move the price.",
          },
        },
      },
      similar_inspiration_terms: {
        type: "array",
        items: { type: "string" },
        description: "Pinterest-search-style phrases for finding similar.",
      },
    },
  },
};

const VENDOR_CATEGORY_SET: ReadonlySet<string> = new Set<VendorCategory>([
  "florist",
  "decor",
  "transport",
  "guest_shuttle",
  "bridal_car",
  "photographer",
  "videographer",
  "photo_booth",
  "dj",
  "live_band",
  "dhol",
  "sound_av",
  "lighting",
  "mua_hair",
  "mehndi",
  "baraat_horse",
  "pandit",
  "priest_officiant",
  "stationery",
  "signage",
  "rentals_furniture",
  "lounge_furniture",
  "cake_dessert",
  "bar_mixology",
  "late_night_food",
  "permits_legal",
  "translator_emcee",
  "other",
]);

function sanitizeCategory(raw: unknown): VendorCategory {
  return typeof raw === "string" && VENDOR_CATEGORY_SET.has(raw)
    ? (raw as VendorCategory)
    : "other";
}

interface PricingAnalysisItem {
  category: VendorCategory;
  description: string;
  confidence: "high" | "medium" | "low";
}

interface PricingAnalysisResponse {
  image_summary: string;
  wedding_relevant: boolean;
  identified_items: PricingAnalysisItem[];
  suggested_vendor_categories: VendorCategory[];
  typical_price_range: {
    low_usd: number;
    mid_usd: number;
    high_usd: number;
    notes: string;
  };
  similar_inspiration_terms: string[];
}

// Best-effort in-memory per-workspace daily cap. Resets on deploy.
function checkAndBumpDailyCap(workspaceId: string): {
  ok: boolean;
  used: number;
  cap: number;
} {
  const today = new Date().toISOString().slice(0, 10);
  const cur = dailyHits.get(workspaceId);
  const count = !cur || cur.day !== today ? 0 : cur.count;
  if (count >= MAX_DAILY_ANALYSES_PER_WORKSPACE) {
    return {
      ok: false,
      used: count,
      cap: MAX_DAILY_ANALYSES_PER_WORKSPACE,
    };
  }
  dailyHits.set(workspaceId, { day: today, count: count + 1 });
  return {
    ok: true,
    used: count + 1,
    cap: MAX_DAILY_ANALYSES_PER_WORKSPACE,
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
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id) {
    return NextResponse.json({ error: "no workspace" }, { status: 403 });
  }
  const workspaceId = profile.workspace_id;

  // Defense-in-depth daily cap. ~$0.05 × 50 = $2.50/day per workspace
  // ceiling — generous for real use, blocks a runaway loop.
  const capCheck = checkAndBumpDailyCap(workspaceId);
  if (!capCheck.ok) {
    return NextResponse.json(
      {
        error: `Daily visualize cap reached (${capCheck.cap}). Resets tomorrow.`,
      },
      { status: 429 },
    );
  }

  // ── Parse multipart body ───────────────────────────────────────────
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "expected multipart/form-data" },
      { status: 400 },
    );
  }
  const fd = await request.formData();
  const file = fd.get("image") as File | null;
  const notesRaw = (fd.get("notes") as string | null) ?? null;
  const notes = notesRaw ? notesRaw.trim().slice(0, 600) : null;

  if (!file) {
    return NextResponse.json({ error: "missing image" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty image" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      {
        error: `Image too large (${Math.round(
          file.size / 1024 / 1024,
        )} MB). Max is ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB.`,
      },
      { status: 413 },
    );
  }
  const mime = file.type;
  if (!ALLOWED_MIME_TYPES.includes(mime as AllowedMime)) {
    return NextResponse.json(
      {
        error: `Unsupported image type "${mime}". Use JPEG, PNG, WEBP, or GIF.`,
      },
      { status: 415 },
    );
  }

  // Read into memory. Image bytes are NEVER written to disk or DB.
  const ab = await file.arrayBuffer();
  const buf = Buffer.from(ab);
  const base64 = buf.toString("base64");

  // ── Workspace context (region / currency / guest count) ────────────
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: {
              base_currency: string | null;
              wedding_region: string | null;
              guest_count_estimate: number | null;
            } | null;
          }>;
        };
      };
    };
  };
  const { data: ws } = await sb
    .from("workspaces")
    .select("base_currency, wedding_region, guest_count_estimate")
    .eq("id", workspaceId)
    .maybeSingle();

  const baseCurrency = normalizeCurrency(ws?.base_currency ?? null);
  const weddingRegion = ws?.wedding_region ?? null;
  const guestCount = ws?.guest_count_estimate ?? null;

  // ── Build the multimodal message ──────────────────────────────────
  const contextLines = [
    `Workspace base currency: ${baseCurrency} (all prices below should be in this currency, despite field names ending in _usd).`,
    weddingRegion
      ? `Wedding region (city/state): ${weddingRegion}`
      : `Wedding region: not set — fall back to US national averages and note that in typical_price_range.notes.`,
    guestCount
      ? `Guest count estimate: ~${guestCount} guests`
      : `Guest count: not set — assume ~100 guests for ranges and note that.`,
  ];
  if (notes) contextLines.push(`User notes about the image: "${notes}"`);

  const claudeContent: Anthropic.ContentBlockParam[] = [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: mime as AllowedMime,
        data: base64,
      },
    },
    {
      type: "text",
      text: contextLines.join("\n"),
    },
  ];

  // ── Call Claude ────────────────────────────────────────────────────
  const anthropic = getAnthropic();
  let resp;
  try {
    resp = await anthropic.messages.create({
      model: DEFAULT_INTAKE_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tool_choice: { type: "tool", name: TOOL.name },
      tools: [TOOL],
      messages: [{ role: "user", content: claudeContent }],
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Vision analysis failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const toolBlock = resp.content.find((c) => c.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    return NextResponse.json(
      { error: "Analysis returned no structured output." },
      { status: 502 },
    );
  }

  const raw = toolBlock.input as Record<string, unknown>;

  // ── Sanitize + coerce into the public DTO ─────────────────────────
  const identifiedItems: PricingAnalysisItem[] = Array.isArray(
    raw.identified_items,
  )
    ? (raw.identified_items as Array<Record<string, unknown>>).map((it) => ({
        category: sanitizeCategory(it.category),
        description:
          typeof it.description === "string" ? it.description : "",
        confidence:
          it.confidence === "high" ||
          it.confidence === "medium" ||
          it.confidence === "low"
            ? it.confidence
            : "low",
      }))
    : [];

  const suggestedCats: VendorCategory[] = Array.isArray(
    raw.suggested_vendor_categories,
  )
    ? Array.from(
        new Set(
          (raw.suggested_vendor_categories as unknown[]).map((v) =>
            sanitizeCategory(v),
          ),
        ),
      )
    : [];

  const priceRangeIn =
    (raw.typical_price_range as Record<string, unknown> | undefined) ?? {};
  const num = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0;
  const priceRange = {
    low_usd: num(priceRangeIn.low_usd),
    mid_usd: num(priceRangeIn.mid_usd),
    high_usd: num(priceRangeIn.high_usd),
    notes:
      typeof priceRangeIn.notes === "string" ? priceRangeIn.notes : "",
  };

  const inspirationTerms: string[] = Array.isArray(
    raw.similar_inspiration_terms,
  )
    ? (raw.similar_inspiration_terms as unknown[])
        .filter((t): t is string => typeof t === "string")
        .slice(0, 8)
    : [];

  const analysis: PricingAnalysisResponse = {
    image_summary:
      typeof raw.image_summary === "string" ? raw.image_summary : "",
    wedding_relevant: Boolean(raw.wedding_relevant),
    identified_items: identifiedItems,
    suggested_vendor_categories: suggestedCats,
    typical_price_range: priceRange,
    similar_inspiration_terms: inspirationTerms,
  };

  // Log cost server-side for ops visibility. Per audit #56 — do NOT
  // surface "Claude cost" to the user. Only the analysis payload below.
  const cost = estimateCost(resp.usage.input_tokens, resp.usage.output_tokens);
  // eslint-disable-next-line no-console
  console.log(
    `[visualize] workspace=${workspaceId} cost_usd=${cost.toFixed(
      4,
    )} in=${resp.usage.input_tokens} out=${resp.usage.output_tokens}`,
  );

  return NextResponse.json({
    analysis,
    workspace: {
      base_currency: baseCurrency,
      wedding_region: weddingRegion,
      guest_count_estimate: guestCount,
    },
  });
}
