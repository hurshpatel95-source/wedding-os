"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/venues/tabs/overview-tab";
import { PhotosTab } from "@/components/venues/tabs/photos-tab";
import { VisitsTab } from "@/components/venues/tabs/visits-tab";
import { NotesTab } from "@/components/venues/tabs/notes-tab";
import { PricingTab } from "@/components/venues/tabs/pricing-tab";
import { DecisionTab } from "@/components/venues/tabs/decision-tab";
import { QATab } from "@/components/venues/tabs/qa-tab";
import type { Database } from "@wedding-os/db";

type Venue = Database["public"]["Tables"]["venues"]["Row"];
type Visit = Database["public"]["Tables"]["venue_visits"]["Row"];
type Photo = Database["public"]["Tables"]["venue_photos"]["Row"];
type Note = Database["public"]["Tables"]["venue_notes"]["Row"] & {
  author: { email: string } | null;
};
type Decision = Database["public"]["Tables"]["venue_decisions"]["Row"] & {
  decided_by_user?: { email: string } | null;
};
type Question = Database["public"]["Tables"]["venue_questions"]["Row"] & {
  asked_by_user?: { email: string } | null;
  answered_by_user?: { email: string } | null;
};

export function VenueDetailTabs({
  venue,
  userId,
  role,
  visits,
  photos,
  notes,
  decisions,
  questions,
}: {
  venue: Venue;
  userId: string;
  role: "admin" | "couple" | null;
  visits: Visit[];
  photos: Photo[];
  notes: Note[];
  decisions: Decision[];
  questions: Question[];
}) {
  const openQuestions = questions.filter((q) => q.status === "open").length;

  return (
    <Tabs defaultValue="overview">
      <TabsList className="flex-wrap">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="photos">Photos ({photos.length})</TabsTrigger>
        <TabsTrigger value="visits">Visits ({visits.length})</TabsTrigger>
        <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
        <TabsTrigger value="qa">
          Q&amp;A {openQuestions > 0 ? `(${openQuestions} open)` : `(${questions.length})`}
        </TabsTrigger>
        <TabsTrigger value="pricing">Pricing</TabsTrigger>
        <TabsTrigger value="decision">Decision ({decisions.length})</TabsTrigger>
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
      <TabsContent value="qa">
        <QATab venueId={venue.id} userId={userId} role={role} initialQuestions={questions} />
      </TabsContent>
      <TabsContent value="pricing">
        <PricingTab venue={venue} role={role} />
      </TabsContent>
      <TabsContent value="decision">
        <DecisionTab
          venueId={venue.id}
          userId={userId}
          role={role}
          initialDecisions={decisions}
          currentStatus={venue.status}
        />
      </TabsContent>
    </Tabs>
  );
}
