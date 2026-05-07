import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { org_role?: string | null; org_id?: string | null } | null;
          }>;
        };
      };
    };
  };
  const { data: profile } = await sb
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.org_id || profile.org_role !== "org_admin") {
    return NextResponse.json({ error: "org admin only" }, { status: 403 });
  }

  let body: {
    public_slug?: string | null;
    public_tagline?: string;
    public_brand_md?: string;
    contact_phone?: string;
    contact_email?: string;
    booking_slot_minutes?: number;
    booking_buffer_minutes?: number;
    publish?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.public_slug !== undefined) {
    const slug = body.public_slug;
    if (slug && (typeof slug !== "string" || !SLUG_RE.test(slug))) {
      return NextResponse.json({ error: "invalid slug" }, { status: 400 });
    }
    patch.public_slug = slug || null;
  }
  if (typeof body.public_tagline === "string") {
    patch.public_tagline = body.public_tagline.slice(0, 240);
  }
  if (typeof body.public_brand_md === "string") {
    patch.public_brand_md = body.public_brand_md.slice(0, 10_000);
  }
  if (typeof body.contact_phone === "string") {
    patch.contact_phone = body.contact_phone.slice(0, 60);
  }
  if (typeof body.contact_email === "string") {
    patch.contact_email = body.contact_email.slice(0, 254);
  }
  if (typeof body.booking_slot_minutes === "number") {
    patch.booking_slot_minutes = Math.max(15, Math.min(180, body.booking_slot_minutes));
  }
  if (typeof body.booking_buffer_minutes === "number") {
    patch.booking_buffer_minutes = Math.max(0, Math.min(120, body.booking_buffer_minutes));
  }
  if (body.publish === true) {
    patch.public_published_at = new Date().toISOString();
  } else if (body.publish === false) {
    patch.public_published_at = null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  // Slug uniqueness — surface a friendly error if collision
  if (typeof patch.public_slug === "string") {
    const { data: existing } = await sb
      .from("organizations")
      .select("id")
      .eq("public_slug", patch.public_slug)
      .maybeSingle();
    if (existing && (existing as { id?: string }).id !== profile.org_id) {
      return NextResponse.json(
        { error: "slug already taken" },
        { status: 409 },
      );
    }
  }

  const { error } = await (
    supabase as unknown as {
      from: (t: string) => {
        update: (row: unknown) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .from("organizations")
    .update(patch)
    .eq("id", profile.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    published:
      body.publish === true ||
      (body.publish !== false && patch.public_published_at !== null),
  });
}
