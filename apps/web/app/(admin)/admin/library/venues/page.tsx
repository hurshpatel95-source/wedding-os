import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { LIBRARY_MEDIA_BUCKET } from "@/lib/library-venue-types";
import { LibraryVenueGrid } from "@/components/admin-library/venues/library-venue-grid";

export const dynamic = "force-dynamic";

interface VenueRow {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  country: string | null;
  capacity_seated: number | null;
  capacity_standing: number | null;
  hire_fee_eur: number | null;
  event_roles: string[];
  created_at: string;
  hero_url: string | null;
}

export default async function AdminLibraryVenuesPage() {
  const supabase = createClient();

  // Org-scoped read via RLS — `auth_org_role()` already restricts to org_admin.
  const { data: venues } = await supabase
    .from("library_venues")
    .select(
      "id, name, city, region, country, capacity_seated, capacity_standing, hire_fee_eur, event_roles, created_at",
    )
    .order("name", { ascending: true });

  // Fetch first photo for each venue (hero). One round trip.
  const ids = (venues ?? []).map((v) => v.id);
  const heroById = new Map<string, string>();
  if (ids.length > 0) {
    const { data: media } = await supabase
      .from("library_venue_media")
      .select("library_venue_id, storage_path, sort_order, kind")
      .in("library_venue_id", ids)
      .eq("kind", "photo")
      .order("sort_order", { ascending: true });

    // Pick the first storage_path per venue.
    const seen = new Set<string>();
    for (const m of media ?? []) {
      if (!m.storage_path) continue;
      if (seen.has(m.library_venue_id)) continue;
      seen.add(m.library_venue_id);
      const { data: signed } = await supabase.storage
        .from(LIBRARY_MEDIA_BUCKET)
        .createSignedUrl(m.storage_path, 60 * 60);
      if (signed?.signedUrl) heroById.set(m.library_venue_id, signed.signedUrl);
    }
  }

  const rows: VenueRow[] = (venues ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    city: v.city,
    region: v.region,
    country: v.country,
    capacity_seated: v.capacity_seated,
    capacity_standing: v.capacity_standing,
    hire_fee_eur: v.hire_fee_eur,
    event_roles: v.event_roles ?? [],
    created_at: v.created_at,
    hero_url: heroById.get(v.id) ?? null,
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/library"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-stone-500 transition hover:text-stone-900"
        >
          <ChevronLeft className="h-3 w-3" />
          Library
        </Link>
      </div>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl font-light leading-tight tracking-tight">
            Venues
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            {rows.length} venue{rows.length === 1 ? "" : "s"} in your studio
            library.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/library/venues/new">
            <Plus className="h-4 w-4" />
            New venue
          </Link>
        </Button>
      </header>

      <LibraryVenueGrid venues={rows} />
    </div>
  );
}
