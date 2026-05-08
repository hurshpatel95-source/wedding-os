import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AvailabilityCalendar } from "@/components/availability/availability-calendar";
import { EmptyState } from "@/components/ui/empty-state";
import type { VenueDateStatus, VenueLite, VenueDateMark } from "@/lib/availability-types";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const supabase = createClient();

  const [
    { data: venues },
    { data: marks },
    { data: workspace },
  ] = await Promise.all([
    supabase
      .from("venues")
      .select("id, name, status, is_lead_pick")
      .order("is_lead_pick", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("venue_date_marks")
      .select("id, venue_id, date, status, notes, source")
      .order("date", { ascending: true }),
    supabase.from("workspaces").select("wedding_date").limit(1).maybeSingle(),
  ]);

  // Default month = wedding_date's month if set, else September 2027 (the active planning window).
  const initialMonth = workspace?.wedding_date
    ? workspace.wedding_date.slice(0, 7)
    : "2027-09";

  const venuesLite: VenueLite[] = (venues ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    status: v.status,
    is_lead_pick: v.is_lead_pick,
  }));

  const marksLite: VenueDateMark[] = (marks ?? []).map((m) => ({
    id: m.id,
    venue_id: m.venue_id,
    date: m.date,
    status: m.status as VenueDateStatus,
    notes: m.notes,
    source: m.source,
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Which dates are open
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Venue availability
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {venuesLite.length === 0
            ? "Once you add venues, you'll be able to track which dates are available, tentative, or already booked across every option side-by-side."
            : `${venuesLite.length} venue${venuesLite.length === 1 ? "" : "s"} × candidate dates. Click any cell to set its status — couples can edit too, your changes stay scoped to your workspace.`}
        </p>
      </header>

      {venuesLite.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Add a venue to start tracking dates"
          description="The availability matrix shows your venues across candidate dates. Add at least one venue, then come back here to mark each date as available, tentative, or booked."
          primary={{ label: "Go to Venues", href: "/venues" }}
          secondary={{ label: "Tell us in onboarding", href: "/onboarding" }}
        />
      ) : (
        <AvailabilityCalendar
          venues={venuesLite}
          marks={marksLite}
          initialMonth={initialMonth}
        />
      )}
    </div>
  );
}
