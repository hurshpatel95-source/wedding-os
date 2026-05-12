import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  dbUpdate,
  dbWriteErrorResponse,
  DbWriteError,
} from "@/lib/db-write-guard";
import { SITE_THEMES } from "@/lib/tier1-types";

export const runtime = "nodejs";

interface PatchBody {
  public_slug?: string | null;
  story_html?: string | null;
  registry_url?: string | null;
  registry_label?: string | null;
  travel_md?: string | null;
  hotel_block_md?: string | null;
  dress_code_md?: string | null;
  faq?: Array<{ q: string; a: string }>;
  schedule?: Array<{ time?: string; date?: string; label: string; location?: string }>;
  publish?: boolean;
  public_theme_slug?: string;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?$/;
const THEME_SLUGS = new Set<string>(SITE_THEMES.map((t) => t.slug));

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id) {
    return NextResponse.json({ error: "no workspace" }, { status: 400 });
  }

  const body = (await request.json()) as PatchBody;
  const patch: Record<string, unknown> = {};

  if (body.public_slug !== undefined) {
    const s = body.public_slug?.trim().toLowerCase() || null;
    if (s && !SLUG_RE.test(s)) {
      return NextResponse.json(
        {
          error:
            "Slug must be lowercase letters, numbers, and dashes (3-62 chars). e.g. nisha-and-hursh",
        },
        { status: 400 },
      );
    }
    patch.public_slug = s;
  }

  if (body.story_html !== undefined) patch.story_html = body.story_html;
  if (body.registry_url !== undefined) patch.registry_url = body.registry_url;
  if (body.registry_label !== undefined)
    patch.registry_label = body.registry_label;
  if (body.travel_md !== undefined) patch.travel_md = body.travel_md;
  if (body.hotel_block_md !== undefined)
    patch.hotel_block_md = body.hotel_block_md;
  if (body.dress_code_md !== undefined)
    patch.dress_code_md = body.dress_code_md;
  if (body.faq !== undefined) patch.faq = body.faq;
  if (body.schedule !== undefined) patch.schedule = body.schedule;
  if (body.publish === true) {
    patch.public_published_at = new Date().toISOString();
  } else if (body.publish === false) {
    patch.public_published_at = null;
  }
  if (body.public_theme_slug !== undefined) {
    if (!THEME_SLUGS.has(body.public_theme_slug)) {
      return NextResponse.json(
        { error: "Unknown theme. Pick one of: " + Array.from(THEME_SLUGS).join(", ") },
        { status: 400 },
      );
    }
    patch.public_theme_slug = body.public_theme_slug;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  try {
    await dbUpdate(
      "update public_site (slug/story/theme/publish)",
      supabase
        .from("workspaces")
        .update(patch as never)
        .eq("id", profile.workspace_id)
        .select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Preserve the slug-conflict UX. Unique-constraint hits arrive as a
    // DbWriteError wrapping the underlying pg error.
    if (
      err instanceof DbWriteError &&
      err.reason.includes("workspaces_public_slug_key")
    ) {
      return NextResponse.json(
        { error: "That slug is already taken — pick another." },
        { status: 409 },
      );
    }
    const { status, body: errBody } = dbWriteErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
