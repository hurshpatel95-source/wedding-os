import { createClient } from "@/lib/supabase/server";
import { CompareView } from "@/components/compare/compare-view";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const supabase = createClient();

  const { data: venues } = await supabase
    .from("venues")
    .select(
      "id, name, address, hero_photo_url, status, capacity_min, capacity_max, indoor_outdoor, in_house_catering, has_accommodation, event_roles, planner_notes, contact_name, contact_email",
    )
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Up to three at a time
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Compare venues
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Pick two or three venues to see facts, capacity, hire fees, and event-role fit
          side-by-side.
        </p>
      </header>
      <CompareView venues={venues ?? []} />
    </div>
  );
}
