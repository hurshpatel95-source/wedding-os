"use client";

import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";

// Leaflet pulls window.* on import — must be client-only and ssr-disabled.
const MapInner = dynamic(() => import("./venue-map-inner").then((m) => m.VenueMapInner), {
  ssr: false,
  loading: () => (
    <Card>
      <CardContent className="flex h-[600px] items-center justify-center text-sm text-muted-foreground">
        Loading map…
      </CardContent>
    </Card>
  ),
});

export interface VenuePoint {
  id: string;
  name: string;
  address: string | null;
  status: "shortlisted" | "visited" | "quoted" | "decided" | "passed";
  capacity_min: number | null;
  capacity_max: number | null;
  geo_lat: number;
  geo_lng: number;
  event_roles: string[] | null;
  hero_photo_url: string | null;
  is_lead_pick: boolean;
}

export function VenueMap({ venues }: { venues: VenuePoint[] }) {
  if (venues.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No venues with coordinates yet. Open a venue → Edit → fill in the address (or run{" "}
          <code className="rounded bg-stone-100 px-1.5 py-0.5">pnpm tsx
          supabase/seed/geocode_venues.ts</code>).
        </CardContent>
      </Card>
    );
  }
  return <MapInner venues={venues} />;
}
