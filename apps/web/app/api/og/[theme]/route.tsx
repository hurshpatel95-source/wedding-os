// Open Graph image template — one per public-site theme.
//
// GET /api/og/<theme-slug> → 1200x630 PNG rendered via next/og's
// ImageResponse. Used by /w/[slug]'s generateMetadata so iMessage,
// WhatsApp, Slack, Facebook etc. unfurl couple-shared links with a
// themed wedding-invitation card instead of a blank/default preview.
//
// Why "one per theme" (Option B) instead of one per slug (Option A):
// the image is template-level, so we don't have to render couple-
// specific data into a PNG (font availability + Supabase fetch from
// an edge function = pain). Themes cover the visual variety; the
// title / description on the unfurl already carry the couple-specific
// payload via Open Graph metadata.
//
// Theme palette mapping below mirrors the Tailwind classes in
// /w/[slug]/page.tsx's THEMES map, translated to hex so they render
// inside ImageResponse (which uses inline CSS, not Tailwind).

import { ImageResponse } from "next/og";
import { SITE_THEMES, type SiteThemeSlug } from "@/lib/tier1-types";

// Edge runtime — ImageResponse is built for it (smaller cold start,
// satellite-deployable). No DB calls here, just theme lookup.
export const runtime = "edge";

interface ThemePalette {
  // CSS gradient string for the card background.
  background: string;
  // Headline color (the "& couple" text).
  headlineColor: string;
  // Subtle text (eyebrow + footer).
  subtleColor: string;
  // Accent decorative line / dot.
  accentColor: string;
  // Headline font family — these are web-safe / system fallbacks
  // because we don't ship custom font files to the edge.
  fontFamily: string;
  // Eyebrow text style.
  fontStyle?: "italic" | "normal";
  // Eyebrow + headline transform (uppercase for modern, default
  // otherwise).
  textTransform?: "uppercase" | "none";
  // Optional flourish character to flank the couple line.
  flourish?: string;
  // Letter spacing on the headline.
  letterSpacing?: string;
}

const THEME_PALETTES: Record<SiteThemeSlug, ThemePalette> = {
  classic: {
    background:
      "linear-gradient(160deg, #fffbeb 0%, #ffffff 50%, #fff1f2 100%)",
    headlineColor: "#1c1917",
    subtleColor: "#78716c",
    accentColor: "#be123c",
    fontFamily: "'Georgia', 'Times New Roman', serif",
    letterSpacing: "-0.02em",
  },
  modern: {
    background: "#ffffff",
    headlineColor: "#1c1917",
    subtleColor: "#57534e",
    accentColor: "#1c1917",
    fontFamily:
      "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
    textTransform: "uppercase",
    letterSpacing: "-0.04em",
  },
  garden: {
    background:
      "linear-gradient(160deg, #ecfdf5 0%, #ffffff 50%, #ecfdf5 100%)",
    headlineColor: "#1c1917",
    subtleColor: "#047857",
    accentColor: "#065f46",
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontStyle: "italic",
    flourish: "✿",
    letterSpacing: "-0.01em",
  },
  beach: {
    background:
      "linear-gradient(160deg, #e0f2fe 0%, #ffffff 55%, #fffbeb 100%)",
    headlineColor: "#0c4a6e",
    subtleColor: "#0369a1",
    accentColor: "#0369a1",
    fontFamily: "'Georgia', 'Times New Roman', serif",
    flourish: "～",
    letterSpacing: "0.02em",
  },
  bollywood: {
    background:
      "linear-gradient(160deg, #fef3c7 0%, #ffffff 50%, #fce7f3 100%)",
    headlineColor: "#1c1917",
    subtleColor: "#be185d",
    accentColor: "#f59e0b",
    fontFamily: "'Georgia', 'Times New Roman', serif",
    flourish: "❀",
    letterSpacing: "-0.01em",
  },
};

const VALID_THEME_SLUGS = new Set<string>(SITE_THEMES.map((t) => t.slug));

export async function GET(
  _req: Request,
  { params }: { params: { theme: string } },
) {
  const raw = params.theme;
  // Validate against the theme registry — anything else is 404. This
  // also guards against people probing /api/og/<anything> hoping to
  // see how it renders.
  if (!VALID_THEME_SLUGS.has(raw)) {
    return new Response("Not found", { status: 404 });
  }
  const themeSlug = raw as SiteThemeSlug;
  const palette = THEME_PALETTES[themeSlug];

  const flourishLeft = palette.flourish ?? "·";
  const flourishRight = palette.flourish ?? "·";
  const headlineTransform = palette.textTransform ?? "none";
  const fontStyle = palette.fontStyle ?? "normal";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: palette.background,
          fontFamily: palette.fontFamily,
          padding: "80px",
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            color: palette.subtleColor,
            fontSize: 24,
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            fontFamily:
              "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
            display: "flex",
          }}
        >
          We&rsquo;re getting married
        </div>

        {/* Accent rule */}
        <div
          style={{
            width: 80,
            height: 2,
            background: palette.accentColor,
            marginTop: 40,
            marginBottom: 40,
            display: "flex",
          }}
        />

        {/* Headline — generic placeholder since this is a per-theme
            template (Option B). The couple's actual name is carried
            by the Open Graph title text, not baked into the image. */}
        <div
          style={{
            color: palette.headlineColor,
            fontSize: 120,
            fontStyle,
            letterSpacing: palette.letterSpacing ?? "-0.02em",
            textTransform: headlineTransform,
            textAlign: "center",
            lineHeight: 1.05,
            display: "flex",
            alignItems: "center",
            gap: 32,
          }}
        >
          <span style={{ color: palette.accentColor, fontSize: 72 }}>
            {flourishLeft}
          </span>
          <span style={{ display: "flex" }}>Our Wedding</span>
          <span style={{ color: palette.accentColor, fontSize: 72 }}>
            {flourishRight}
          </span>
        </div>

        {/* Subhead — date placeholder. Couple-specific date appears
            in the og:title text, not in the image itself. */}
        <div
          style={{
            color: palette.subtleColor,
            fontSize: 32,
            marginTop: 32,
            fontStyle,
            letterSpacing: "0.05em",
            display: "flex",
          }}
        >
          Save the date
        </div>

        {/* Footer brand mark */}
        <div
          style={{
            position: "absolute",
            bottom: 48,
            color: palette.subtleColor,
            fontSize: 18,
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            fontFamily:
              "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
            display: "flex",
          }}
        >
          Acquired Planner
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      // Cache aggressively at the CDN: the image is purely a function
      // of the theme slug, so we can let downstream caches hold it
      // for a long time. immutable lets Cloudflare / Vercel skip
      // revalidation entirely until we ship a new template.
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
