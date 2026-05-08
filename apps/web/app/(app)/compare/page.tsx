import { Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CompareView } from "@/components/compare/compare-view";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const supabase = createClient();

  const { data: venues } = await supabase
    .from("venues")
    .select(
      "id, name, address, hero_photo_url, status, capacity_min, capacity_max, indoor_outdoor, in_house_catering, has_accommodation, event_roles, planner_notes, contact_name, contact_email",
    )
    .order("name", { ascending: true });

  const list = venues ?? [];

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
          {list.length < 2
            ? "Pick at least two venues to compare facts, capacity, hire fees, and event-role fit side-by-side."
            : "Pick two or three venues to see facts, capacity, hire fees, and event-role fit side-by-side."}
        </p>
      </header>

      {list.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Add venues to start comparing"
          description="Once you have two or more venues on your list, you can pick any pair to see capacity, hire fees, catering, and notes side-by-side."
          primary={{ label: "Go to Venues", href: "/venues" }}
        />
      ) : list.length === 1 ? (
        <EmptyState
          icon={Scale}
          title="Add one more venue to compare"
          description="You only have one venue so far. Add another and we'll lay them out side-by-side — capacity, hire fees, catering, indoor/outdoor, the works."
          primary={{ label: "Go to Venues", href: "/venues" }}
        />
      ) : (
        <CompareView venues={list} />
      )}
    </div>
  );
}
