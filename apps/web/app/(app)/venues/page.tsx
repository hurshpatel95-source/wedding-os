import Link from "next/link";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { VenueGrid } from "@/components/venues/venue-grid";
import { VenueCreateButton } from "@/components/venues/venue-create-button";

export const dynamic = "force-dynamic";

export default async function VenuesPage() {
  const supabase = createClient();

  const { data: venues } = await supabase
    .from("venues")
    .select(
      "id, name, address, hero_photo_url, status, capacity_min, capacity_max, indoor_outdoor, in_house_catering, has_accommodation, event_roles, created_at",
    )
    .order("created_at", { ascending: true });

  const list = venues ?? [];
  const count = list.length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Where it could happen
          </div>
          <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
            Venues
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {count === 0
              ? "Add the places you're considering — we'll auto-look-up addresses, photos, and capacities from Google Places."
              : `${count} venue${count === 1 ? "" : "s"} on the shortlist. Add more, mark your favourite, or open one to track quotes.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/map">
              <MapPin className="h-4 w-4" />
              View on map
            </Link>
          </Button>
          <VenueCreateButton />
        </div>
      </header>

      {count === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Nothing on your venue list yet"
          description="Add the places you're considering and we'll auto-fetch addresses, photos, and capacities. Compare them side-by-side once you have two."
          action={<VenueCreateButton />}
          secondary={{ label: "Tell us in onboarding", href: "/onboarding" }}
        />
      ) : (
        <VenueGrid venues={list} />
      )}
    </div>
  );
}
