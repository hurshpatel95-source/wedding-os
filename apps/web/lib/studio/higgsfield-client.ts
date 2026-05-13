// Higgsfield image-gen client.
//
// Two paths:
//   1. STUB mode (HIGGSFIELD_API_KEY missing) — returns N themed
//      placeholder image URLs. UX walks end-to-end. Flag is_placeholder
//      so the UI can render a small "preview render" label.
//   2. REAL mode (HIGGSFIELD_API_KEY set) — calls the Higgsfield API
//      via fetch and returns the URLs.
//
// TODO(hursh): the REAL-mode endpoint URL + request shape is a guess.
// Once you provide working API docs (or the env var lands and we can
// hit the endpoint), update buildRealRequest() to match. Until then
// the stub path runs because HIGGSFIELD_API_KEY isn't set in any env.
//
// Hard rules:
//   - Never crash. If REAL mode fails for any reason (network, 5xx,
//     auth) we log the error and fall back to placeholders so the UX
//     stays usable. The route handler still deducts credits — that
//     refund is handled at the planner level for now (manual review).

import "server-only";

const HIGGSFIELD_API_KEY = process.env.HIGGSFIELD_API_KEY;
export const HIGGSFIELD_READY = Boolean(HIGGSFIELD_API_KEY);

// TODO(hursh): replace with the real Higgsfield endpoint once provided.
// Their docs reference image generation but the exact path is unconfirmed.
const HIGGSFIELD_ENDPOINT = "https://api.higgsfield.ai/v1/generate";

export interface GenerateImageArgs {
  prompt: string;
  variant_count: number;
  dimensions?: "16:9" | "1:1" | "9:16";
  negative_prompt?: string;
}

export interface GenerateImageResult {
  image_urls: string[];
  cost_usd: number;
  was_stub: boolean;
}

// ─── Stub placeholder palettes — themed by aspect ratio ───────────────
// We rotate through a few warm wedding-y placeholders so the grid
// doesn't look like one image repeated 12 times. Couples should feel
// "this is a preview" not "this is broken."

const PLACEHOLDER_PALETTES = [
  { bg: "EFE8DE", fg: "8B6F47", caption: "Mood+Board+Preview" },
  { bg: "F4E3D7", fg: "8E5C42", caption: "Garden+Detail" },
  { bg: "E8DDD3", fg: "705243", caption: "Tablescape" },
  { bg: "EBE0D5", fg: "7C5E47", caption: "Ceremony+Arch" },
  { bg: "F2E6D9", fg: "8A6B4F", caption: "Aisle+Wide" },
  { bg: "E5D7C7", fg: "664A36", caption: "Place+Setting" },
  { bg: "EFDFCB", fg: "835838", caption: "Florals+Close-up" },
  { bg: "E3D2BD", fg: "5C402B", caption: "Bar+Lounge" },
  { bg: "F1E2D0", fg: "8C6745", caption: "Signage+Detail" },
  { bg: "ECDBC8", fg: "765238", caption: "Bridal+Portrait" },
  { bg: "EBDBCA", fg: "85603E", caption: "Candlelit+Evening" },
  { bg: "E9D8C4", fg: "6E4F36", caption: "Editorial+Wide" },
];

function placeholderUrl(
  index: number,
  dims: "16:9" | "1:1" | "9:16",
): string {
  const { bg, fg, caption } =
    PLACEHOLDER_PALETTES[index % PLACEHOLDER_PALETTES.length];
  // placehold.co is free, no-auth, returns a real image — perfect for
  // preview. Sized to match the requested aspect ratio.
  const size =
    dims === "16:9" ? "1200x675" : dims === "9:16" ? "675x1200" : "900x900";
  return `https://placehold.co/${size}/${bg}/${fg}?text=${caption}`;
}

function stubGenerate(args: GenerateImageArgs): GenerateImageResult {
  const dims = args.dimensions ?? "16:9";
  const count = Math.max(1, Math.min(24, args.variant_count));
  const urls = Array.from({ length: count }, (_, i) =>
    placeholderUrl(i, dims),
  );
  return {
    image_urls: urls,
    cost_usd: 0,
    was_stub: true,
  };
}

// ─── Real Higgsfield call — currently dead code; runs when key arrives ─

interface HiggsfieldResponse {
  // Shape is a GUESS. Update once we have real API docs.
  // Common patterns: { images: [{ url }] } OR { data: [{ b64_json }] }.
  images?: Array<{ url: string }>;
  data?: Array<{ url?: string; b64_json?: string }>;
}

async function realGenerate(
  args: GenerateImageArgs,
): Promise<GenerateImageResult> {
  // TODO(hursh): adjust request body shape to match the real API once
  // docs are available. The fetch call itself is correct; only the
  // body keys + response parsing need to be confirmed.
  const body = {
    prompt: args.prompt,
    n: args.variant_count,
    aspect_ratio: args.dimensions ?? "16:9",
    negative_prompt: args.negative_prompt,
  };

  const r = await fetch(HIGGSFIELD_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HIGGSFIELD_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    throw new Error(`Higgsfield ${r.status}: ${await r.text()}`);
  }

  const data = (await r.json()) as HiggsfieldResponse;
  const urls: string[] = [];
  if (Array.isArray(data.images)) {
    for (const im of data.images) {
      if (im?.url) urls.push(im.url);
    }
  } else if (Array.isArray(data.data)) {
    for (const im of data.data) {
      if (im?.url) urls.push(im.url);
    }
  }

  if (urls.length === 0) {
    throw new Error("Higgsfield returned no usable images.");
  }

  // Cost guess: ~$0.02-0.04 per image. Replace with real billing
  // signal once Higgsfield exposes one.
  const estCost = urls.length * 0.03;

  return { image_urls: urls, cost_usd: estCost, was_stub: false };
}

// ─── Public ────────────────────────────────────────────────────────────

export async function generateImage(
  args: GenerateImageArgs,
): Promise<GenerateImageResult> {
  if (!HIGGSFIELD_READY) {
    return stubGenerate(args);
  }
  try {
    return await realGenerate(args);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[studio.higgsfield] real call failed, falling back to stub: ${(err as Error).message}`,
    );
    const stub = stubGenerate(args);
    return { ...stub, was_stub: true };
  }
}
