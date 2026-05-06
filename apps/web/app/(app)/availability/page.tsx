import { createClient } from "@/lib/supabase/server";
import { AvailabilityCalendar } from "@/components/availability/availability-calendar";
import type { VenueDateStatus, VenueLite, VenueDateMark } from "@/lib/availability-types";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const supabase = createClient();

  const [
    { data: venues },
    { data: marks },
    { data: workspace },
    {
      data: { user },
    },
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
    supabase.auth.getUser(),
  ]);

  let role: "admin" | "couple" | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = (profile?.role ?? null) as typeof role;
  }

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
      <header>
        <h1 className="font-serif text-4xl md:text-5xl">Venue availability</h1>
        <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          September 2027 · all {venuesLite.length} venues at a glance
        </p>
      </header>

      <AvailabilityCalendar
        venues={venuesLite}
        marks={marksLite}
        role={role}
        initialMonth={initialMonth}
      />
    </div>
  );
}
