// White-label "skin" helpers for couple-side workspaces.
//
// Every couple workspace has a `skin` enum (see migration 20260508000003).
// The skin selects a `BrandPreset` — the displayName, tagline, accent
// color and whether to render the "Powered by Acquired Planner"
// attribution. `co_branded` and `white_label` defer their brand identity
// to the planner's `workspace_branding` row at runtime; the helper
// `getSkinFor` merges that planner brand into the preset.

export type WorkspaceSkin =
  | "acquired_planner"
  | "co_branded"
  | "white_label"
  | "acquired_style_collab";

export interface BrandPreset {
  /** Title shown in the nav header (left of the pill tabs). */
  displayName: string;
  /** Eyebrow line under the title. `null` collapses the eyebrow. */
  tagline: string | null;
  /** Hex color used for the active nav pill, logo gradient seed, etc. */
  accentHex: string;
  /** When true, the nav renders a tiny "Powered by Acquired Planner" pill. */
  showPoweredBy: boolean;
}

/** Default accent for Acquired Planner — rose, slightly muted. */
export const ACQUIRED_PLANNER_ACCENT = "#a8324a";

/** Static defaults per skin. `co_branded` / `white_label` overlay the
 *  planner's workspace_branding row at runtime via `getSkinFor`. */
export const BRAND_PRESETS: Record<WorkspaceSkin, BrandPreset> = {
  acquired_planner: {
    displayName: "Acquired Planner",
    tagline: "Your wedding, acquired.",
    accentHex: ACQUIRED_PLANNER_ACCENT,
    showPoweredBy: false,
  },
  co_branded: {
    // Replaced at runtime with the planner's display name.
    displayName: "Your planner",
    tagline: null,
    accentHex: ACQUIRED_PLANNER_ACCENT,
    showPoweredBy: true,
  },
  white_label: {
    // Replaced at runtime with the planner's display name. No attribution.
    displayName: "Your planner",
    tagline: null,
    accentHex: ACQUIRED_PLANNER_ACCENT,
    showPoweredBy: false,
  },
  acquired_style_collab: {
    displayName: "Acquired Planner × Acquired Style",
    tagline: "Built for the bride.",
    accentHex: "#c08855",
    showPoweredBy: false,
  },
};

/** Narrow an unknown DB value to a valid `WorkspaceSkin`. Defaults to
 *  `acquired_planner` for any nullish or unrecognized value — that's the
 *  intended fallback for pre-migration rows. */
export function normalizeSkin(input: unknown): WorkspaceSkin {
  if (
    input === "acquired_planner" ||
    input === "co_branded" ||
    input === "white_label" ||
    input === "acquired_style_collab"
  ) {
    return input;
  }
  return "acquired_planner";
}

/** Resolve the brand preset for a given skin, merging in the planner's
 *  branding row when the skin defers to the planner (co_branded /
 *  white_label).
 *
 *  The fallback chain for displayName on co_branded / white_label is:
 *    planner.displayName  →  "Your planner"
 *  and for accentHex:
 *    planner.accentHex    →  ACQUIRED_PLANNER_ACCENT
 *
 *  acquired_planner and acquired_style_collab ignore the planner brand
 *  entirely — they're founder-owned skins. */
export function getSkinFor(
  skin: WorkspaceSkin,
  plannerBrand?: {
    displayName?: string | null;
    accentHex?: string | null;
  },
): BrandPreset {
  const base = BRAND_PRESETS[skin];

  if (skin === "co_branded" || skin === "white_label") {
    return {
      ...base,
      displayName: plannerBrand?.displayName?.trim() || base.displayName,
      accentHex: plannerBrand?.accentHex?.trim() || base.accentHex,
    };
  }

  return base;
}
