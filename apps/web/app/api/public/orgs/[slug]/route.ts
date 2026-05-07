import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";

export const runtime = "nodejs";

// Public-readable slice of an org by slug. Returns brand fields + booking
// config + the booking_windows so the /book/<slug> page can compute slots
// client-side without an extra round-trip.
function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug;
  if (!slug || !/^[a-z0-9][a-z0-9-]{0,80}$/i.test(slug)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  const sb = adminClient();
  const { data: org, error } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: Record<string, unknown> | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("organizations")
    .select(
      "id, name, public_slug, public_tagline, public_brand_md, public_hero_storage_path, contact_phone, contact_email, booking_buffer_minutes, booking_slot_minutes, public_published_at",
    )
    .eq("public_slug", slug)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!org) return NextResponse.json({ error: "not found" }, { status: 404 });

  const orgId = org.id as string;

  const { data: windows } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{ data: unknown[] | null }>;
          };
        };
      };
    }
  )
    .from("booking_windows")
    .select("id, day_of_week, start_minute, end_minute, timezone, label")
    .eq("org_id", orgId)
    .order("day_of_week", { ascending: true });

  return NextResponse.json({ org, windows: windows ?? [] });
}
