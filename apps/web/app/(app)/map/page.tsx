import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { VenueMap } from "@/components/map/venue-map";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const supabase = createClient();

  const { data: venues } = await supabase
    .from("venues")
    .select(
      "id, name, address, status, capacity_min, capacity_max, geo_lat, geo_lng, event_roles, hero_photo_url, is_lead_pick",
    )
    .order("name", { ascending: true });

  const allVenues = venues ?? [];
  const points = allVenues.filter(
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
          {points.length === 0
            ? "We pin every venue with an address on a single map so you can see how they cluster — beach, city, countryside — at a glance."
            : "Click a marker for quick facts. Lead-pick badges flag the venues at the top of your shortlist."}
        </p>
      </header>

      {allVenues.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No venues to map yet"
          description="Add a few venues to your shortlist and they'll all appear here on one map — clustered by location with capacity, status, and lead-pick info on hover."
          primary={{ label: "Go to Venues", href: "/venues" }}
        />
      ) : points.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Your venues need addresses"
          description="You have venues on your list, but none have addresses yet. Open any venue and add its address — we'll auto-geocode it from Google Places."
          primary={{ label: "Open Venues", href: "/venues" }}
        />
      ) : (
        <VenueMap venues={points} />
      )}
    </div>
  );
}
