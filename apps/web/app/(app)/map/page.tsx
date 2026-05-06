import { createClient } from "@/lib/supabase/server";
import { VenueMap } from "@/components/map/venue-map";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const supabase = createClient();

  const { data: venues } = await supabase
    .from("venues")
    .select(
      "id, name, address, status, capacity_min, capacity_max, geo_lat, geo_lng, event_roles, hero_photo_url, is_lead_pick",
    )
    .order("name", { ascending: true });

  const points = (venues ?? []).filter(
    (v): v is typeof v & { geo_lat: number; geo_lng: number } =>
      v.geo_lat !== null && v.geo_lng !== null,
  );

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          All venues, one screen
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Venue map
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Sitges-area venues clustered south, Barcelona venues to the north. Click a marker for
          quick facts; the lead-pick badges show which 3 are top of the shortlist.
        </p>
      </header>

      <VenueMap venues={points} />
    </div>
  );
}
