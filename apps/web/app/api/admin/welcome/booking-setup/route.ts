// POST /api/admin/welcome/booking-setup
//
// One-shot booking-page setup for the onboarding wizard. Sets the org's
// public listing fields (slug, tagline, contact details, optional brand
// markdown), replaces the recurring booking_windows, and publishes the
// booking page in a single atomic-ish call.
//
// Body:
//   {
//     public_slug: string,
//     public_tagline: string,
//     public_brand_md?: string,
//     contact_email?: string,
//     contact_phone?: string,
//     day_of_week_slots: { day_of_week: 0..6, start_minute, end_minute, label? }[]
//   }
//
// On success the wizard moves to step 5; the org is published immediately.
//
// This is a thinner cousin of /api/admin/booking/settings + /windows that's
// optimized for the welcome flow — single round-trip from the UI.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;

interface SlotIn {
  day_of_week: number;
  start_minute: number;
  end_minute: number;
  label?: string | null;
}

interface BookingSetupBody {
  public_slug?: string;
  public_tagline?: string;
  public_brand_md?: string;
  contact_email?: string;
  contact_phone?: string;
  day_of_week_slots?: SlotIn[];
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profileSb = supabase as unknown as {
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
  const { data: profile } = await profileSb
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.org_id || profile.org_role !== "org_admin") {
    return NextResponse.json({ error: "org admin only" }, { status: 403 });
  }
  const orgId = profile.org_id;

  let body: BookingSetupBody;
  try {
    body = (await request.json()) as BookingSetupBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const slug = (body.public_slug ?? "").trim();
  if (!slug || !SLUG_RE.test(slug)) {
    return NextResponse.json(
      { error: "valid slug required (lowercase letters, numbers, hyphens)" },
      { status: 400 },
    );
  }
  const tagline = (body.public_tagline ?? "").trim();
  if (!tagline) {
    return NextResponse.json(
      { error: "public_tagline required to publish" },
      { status: 400 },
    );
  }

  const slots = Array.isArray(body.day_of_week_slots)
    ? body.day_of_week_slots
    : [];
  for (const s of slots) {
    if (
      typeof s.day_of_week !== "number" ||
      s.day_of_week < 0 ||
      s.day_of_week > 6 ||
      typeof s.start_minute !== "number" ||
      typeof s.end_minute !== "number" ||
      s.start_minute < 0 ||
      s.end_minute > 1440 ||
      s.end_minute <= s.start_minute
    ) {
      return NextResponse.json(
        { error: "invalid availability slot" },
        { status: 400 },
      );
    }
  }

  // Slug uniqueness check
  {
    const { data: existing } = await profileSb
      .from("organizations")
      .select("id")
      .eq("public_slug", slug)
      .maybeSingle();
    if (existing && (existing as { id?: string }).id !== orgId) {
      return NextResponse.json(
        { error: "slug already taken" },
        { status: 409 },
      );
    }
  }

  // 1. Update organizations row
  const orgPatch: Record<string, unknown> = {
    public_slug: slug,
    public_tagline: tagline.slice(0, 240),
    public_published_at: new Date().toISOString(),
  };
  if (typeof body.public_brand_md === "string") {
    orgPatch.public_brand_md = body.public_brand_md.slice(0, 10_000);
  }
  if (typeof body.contact_email === "string") {
    orgPatch.contact_email = body.contact_email.slice(0, 254);
  }
  if (typeof body.contact_phone === "string") {
    orgPatch.contact_phone = body.contact_phone.slice(0, 60);
  }

  const { error: orgErr } = await (
    supabase as unknown as {
      from: (t: string) => {
        update: (row: unknown) => {
          eq: (col: string, val: string) => Promise<{
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .from("organizations")
    .update(orgPatch)
    .eq("id", orgId);
  if (orgErr) {
    return NextResponse.json({ error: orgErr.message }, { status: 500 });
  }

  // 2. Replace booking_windows
  const sb = supabase as unknown as {
    from: (t: string) => {
      delete: () => {
        eq: (col: string, val: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
      insert: (rows: unknown) => Promise<{
        error: { message: string } | null;
      }>;
    };
  };
  const { error: delErr } = await sb
    .from("booking_windows")
    .delete()
    .eq("org_id", orgId);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  if (slots.length > 0) {
    const rows = slots.map((s) => ({
      org_id: orgId,
      day_of_week: s.day_of_week,
      start_minute: s.start_minute,
      end_minute: s.end_minute,
      label: s.label?.trim() || null,
    }));
    const { error: insErr } = await sb.from("booking_windows").insert(rows);
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    public_slug: slug,
    windows_count: slots.length,
  });
}
