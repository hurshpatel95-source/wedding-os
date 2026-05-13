// AI Studio — tool registry.
//
// Single source of truth for metadata about every Studio tool. Used by
// the /studio hub to render the grid, by the per-tool API routes to
// validate slugs + lookup cost, and by the smoke tests.
//
// Status:
//   - "live"        → fully wired, has clarification template + system
//                     prompts under `tools/<slug>.ts`, route page exists.
//   - "coming_soon" → metadata only; card is rendered dimmed on the hub
//                     and the per-tool route isn't built yet.
//
// As tools graduate, flip status to "live" and ship the supporting
// modules in the same commit.

import type { StudioTool, StudioToolSlug } from "./types";

export const STUDIO_TOOLS: Record<StudioToolSlug, StudioTool> = {
  "mood-board": {
    slug: "mood-board",
    label: "Mood board",
    description:
      "Skip the Pinterest scroll. Describe your vibe — we'll generate a curated visual board tuned to your wedding.",
    cost_credits: 3,
    input_kind: "text",
    output_kind: "image_grid",
    default_variant_count: 12,
    status: "live",
    icon: "Palette",
  },
  "dress-on-me": {
    slug: "dress-on-me",
    label: "Dress on me",
    description:
      "See a dress (or any look) on you — upload your photo + a reference, get four 'you wearing it' variants.",
    cost_credits: 8,
    input_kind: "image+text",
    output_kind: "image_grid",
    default_variant_count: 4,
    status: "coming_soon",
    icon: "Shirt",
  },
  "venue-mockup": {
    slug: "venue-mockup",
    label: "Venue mockup",
    description:
      "Send a photo of the empty venue, tell us your styling — we'll render four decorated possibilities.",
    cost_credits: 6,
    input_kind: "image+text",
    output_kind: "image_grid",
    default_variant_count: 4,
    status: "coming_soon",
    icon: "Building2",
  },
  florals: {
    slug: "florals",
    label: "Florals at venue",
    description:
      "Arches, aisles, centerpieces — render your floral install before you commit to a florist quote.",
    cost_credits: 5,
    input_kind: "text",
    output_kind: "image_grid",
    default_variant_count: 4,
    status: "coming_soon",
    icon: "Flower2",
  },
  cake: {
    slug: "cake",
    label: "Cake design",
    description:
      "Flavors, tiers, theme. Four cake variants you can show your baker.",
    cost_credits: 4,
    input_kind: "text",
    output_kind: "image_grid",
    default_variant_count: 4,
    status: "coming_soon",
    icon: "Cake",
  },
  "hair-makeup": {
    slug: "hair-makeup",
    label: "Hair / makeup try-on",
    description:
      "Try on day-of looks before your trial. Upload your photo + a reference, get four previews.",
    cost_credits: 6,
    input_kind: "image+text",
    output_kind: "image_grid",
    default_variant_count: 4,
    status: "coming_soon",
    icon: "Sparkles",
  },
  "invitation-mockup": {
    slug: "invitation-mockup",
    label: "Invitation mockup",
    description:
      "Save-the-dates, invites, programs — four layout variants tuned to your palette and vibe.",
    cost_credits: 5,
    input_kind: "image+text",
    output_kind: "image_grid",
    default_variant_count: 4,
    status: "coming_soon",
    icon: "Mail",
  },
  "color-palette": {
    slug: "color-palette",
    label: "Color palette",
    description:
      "Drop an inspo photo OR describe it — we'll extract the palette and match six real vendor-friendly swatches.",
    cost_credits: 2,
    input_kind: "image+text",
    output_kind: "image",
    default_variant_count: 1,
    status: "coming_soon",
    icon: "Swatch",
  },
  "day-of-viz": {
    slug: "day-of-viz",
    label: "Day-of visualizer",
    description:
      "Turn your run sheet into a visual hour-by-hour storyboard — moments your vendors can see, not just read.",
    cost_credits: 3,
    input_kind: "text",
    output_kind: "image_grid",
    default_variant_count: 6,
    status: "coming_soon",
    icon: "Clock",
  },
  "pricing-analyzer": {
    slug: "pricing-analyzer",
    label: "Photo → pricing",
    description:
      "Drop a Pinterest photo. We identify the vendors involved and estimate local pricing in your currency.",
    cost_credits: 2,
    input_kind: "image+text",
    output_kind: "image",
    default_variant_count: 1,
    // Lives at /visualize today — migrating to /studio/pricing-analyzer
    // in Day 3. Marked "live" so the card is clickable; the link target
    // resolves to /visualize for now (handled in the hub page).
    status: "live",
    icon: "Camera",
  },
};

/** Type-safe lookup helper. */
export function getStudioTool(slug: string): StudioTool | null {
  if (Object.prototype.hasOwnProperty.call(STUDIO_TOOLS, slug)) {
    return STUDIO_TOOLS[slug as StudioToolSlug];
  }
  return null;
}

/** Ordered list of tools for the hub grid — same order as the spec doc. */
export const STUDIO_TOOL_ORDER: StudioToolSlug[] = [
  "mood-board",
  "dress-on-me",
  "venue-mockup",
  "florals",
  "cake",
  "hair-makeup",
  "invitation-mockup",
  "color-palette",
  "day-of-viz",
  "pricing-analyzer",
];
