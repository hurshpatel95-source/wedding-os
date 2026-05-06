import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LibraryVenueForm } from "@/components/admin-library/venues/library-venue-form";
import {
  LibraryVenueMediaManager,
  type MediaItem,
} from "@/components/admin-library/venues/library-venue-media-manager";
import { LibraryVenueDeleteButton } from "@/components/admin-library/venues/library-venue-delete-button";
import { LIBRARY_MEDIA_BUCKET } from "@/lib/library-venue-types";
import type { Database } from "@wedding-os/db";

type EventRole = Database["public"]["Enums"]["event_role"];

export const dynamic = "force-dynamic";

export default async function AdminLibraryVenueDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: venue } = await supabase
    .from("library_venues")
    .select(
      "id, name, address, city, region, country, lat, lng, capacity_seated, capacity_standing, hire_fee_eur, hire_fee_notes, event_roles, pros, cons, description, internal_notes",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!venue) notFound();

  const { data: mediaRows } = await supabase
    .from("library_venue_media")
    .select("id, kind, storage_path, sort_order, alt")
    .eq("library_venue_id", params.id)
    .order("sort_order", { ascending: true });

  const items: MediaItem[] = await Promise.all(
    (mediaRows ?? []).map(async (m) => {
      let signedUrl: string | null = null;
      if (m.storage_path) {
        const { data: s } = await supabase.storage
          .from(LIBRARY_MEDIA_BUCKET)
          .createSignedUrl(m.storage_path, 60 * 60);
        signedUrl = s?.signedUrl ?? null;
      }
      return {
        id: m.id,
        kind: m.kind,
        storage_path: m.storage_path,
        sort_order: m.sort_order,
        alt: m.alt,
        signed_url: signedUrl,
      };
    }),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/library/venues"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-stone-500 transition hover:text-stone-900"
        >
          <ChevronLeft className="h-3 w-3" />
          Venues
        </Link>
        <LibraryVenueDeleteButton
          venueId={venue.id}
          venueName={venue.name}
        />
      </div>

      <header>
        <div className="mb-2 text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Library venue
        </div>
        <h1 className="font-serif text-4xl font-light leading-tight tracking-tight">
          {venue.name}
        </h1>
        {(venue.city || venue.region || venue.country) && (
          <p className="mt-2 text-sm text-stone-500">
            {[venue.city, venue.region, venue.country]
              .filter(Boolean)
              .join(", ")}
          </p>
        )}
      </header>

      <section>
        <LibraryVenueMediaManager venueId={venue.id} initialMedia={items} />
      </section>

      <section>
        <LibraryVenueForm
          mode="edit"
          venueId={venue.id}
          initial={{
            name: venue.name,
            address: venue.address,
            city: venue.city,
            region: venue.region,
            country: venue.country,
            lat: venue.lat,
            lng: venue.lng,
            capacity_seated: venue.capacity_seated,
            capacity_standing: venue.capacity_standing,
            hire_fee_eur: venue.hire_fee_eur,
            hire_fee_notes: venue.hire_fee_notes,
            event_roles: (venue.event_roles ?? []) as EventRole[],
            pros: venue.pros ?? [],
            cons: venue.cons ?? [],
            description: venue.description,
            internal_notes: venue.internal_notes,
          }}
        />
      </section>
    </div>
  );
}
