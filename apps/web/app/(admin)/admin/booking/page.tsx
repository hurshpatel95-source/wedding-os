import { createClient } from "@/lib/supabase/server";
import { BookingSettingsForm } from "@/components/admin-booking/booking-settings-form";
import { BookingWindowsEditor } from "@/components/admin-booking/booking-windows-editor";
import type { BookingWindowRow, OrgPublicRow } from "@/lib/lead-types";

export const dynamic = "force-dynamic";

export default async function BookingPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profileSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { org_id?: string | null } | null;
          }>;
        };
      };
    };
  };
  const { data: profile } = await profileSb
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();
  const orgId = profile?.org_id ?? null;
  if (!orgId) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-8 py-16 text-center">
        <p className="text-sm text-stone-500">No org yet — finish setup first.</p>
      </div>
    );
  }

  const { data: orgRaw } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{ data: OrgPublicRow | null }>;
          };
        };
      };
    }
  )
    .from("organizations")
    .select(
      "id, name, public_slug, public_tagline, public_brand_md, public_hero_storage_path, contact_phone, contact_email, booking_buffer_minutes, booking_slot_minutes, public_published_at",
    )
    .eq("id", orgId)
    .maybeSingle();

  const org = orgRaw;

  const { data: windowsRaw } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{ data: BookingWindowRow[] | null }>;
          };
        };
      };
    }
  )
    .from("booking_windows")
    .select("id, org_id, day_of_week, start_minute, end_minute, timezone, label, created_at")
    .eq("org_id", orgId)
    .order("day_of_week", { ascending: true });

  const windows = (windowsRaw ?? []) as BookingWindowRow[];

  return (
    <div className="space-y-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Lead generation
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
          Booking page
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Your public consult-booking page. Pick a slug, write a short pitch,
          add the days + hours you can take calls, and share the link
          everywhere — Instagram bio, contact form, vendor referrals.
        </p>
      </header>

      {org && (
        <BookingSettingsForm
          org={org}
        />
      )}
      {org && (
        <BookingWindowsEditor
          windows={windows}
          published={!!org.public_published_at}
          publicSlug={org.public_slug}
        />
      )}
    </div>
  );
}
