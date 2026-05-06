"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/venues/tabs/overview-tab";
import { PhotosTab } from "@/components/venues/tabs/photos-tab";
import { VisitsTab } from "@/components/venues/tabs/visits-tab";
import { NotesTab } from "@/components/venues/tabs/notes-tab";
import type { Database } from "@wedding-os/db";

type Venue = Database["public"]["Tables"]["venues"]["Row"];
type Visit = Database["public"]["Tables"]["venue_visits"]["Row"];
type Photo = Database["public"]["Tables"]["venue_photos"]["Row"];
type Note = Database["public"]["Tables"]["venue_notes"]["Row"] & {
  author: { email: string } | null;
};

export function VenueDetailTabs({
  venue,
  userId,
  role,
  visits,
  photos,
  notes,
}: {
  venue: Venue;
  userId: string;
  role: "admin" | "couple" | null;
  visits: Visit[];
  photos: Photo[];
  notes: Note[];
}) {
  return (
    <Tabs defaultValue="overview">
      <TabsList className="flex-wrap">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="photos">Photos ({photos.length})</TabsTrigger>
        <TabsTrigger value="visits">Visits ({visits.length})</TabsTrigger>
        <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
        <TabsTrigger value="pricing" disabled>
          Pricing
        </TabsTrigger>
        <TabsTrigger value="decision" disabled>
          Decision
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewTab venue={venue} />
      </TabsContent>
      <TabsContent value="photos">
        <PhotosTab venue={venue} userId={userId} role={role} initialPhotos={photos} visits={visits} />
      </TabsContent>
      <TabsContent value="visits">
        <VisitsTab venueId={venue.id} initialVisits={visits} />
      </TabsContent>
      <TabsContent value="notes">
        <NotesTab venueId={venue.id} userId={userId} role={role} initialNotes={notes} />
      </TabsContent>
    </Tabs>
  );
}
