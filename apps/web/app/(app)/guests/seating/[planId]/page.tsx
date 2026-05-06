import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SeatingBoard } from "@/components/seating/seating-board";
import type { FloorPlanRow, SeatingAssignmentRow } from "@/lib/seating-types";

export const dynamic = "force-dynamic";

interface GuestRow {
  id: string;
  full_name: string;
  side: string | null;
  household_id: string | null;
  is_household_head: boolean;
  overall_rsvp: string;
  dietary: string | null;
  notes: string | null;
}

export default async function SeatingDetailPage({
  params,
}: {
  params: { planId: string };
}) {
  const supabase = createClient();

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          maybeSingle?: () => Promise<{ data: FloorPlanRow | null }>;
          // overload for assignments list
        } & Promise<{ data: SeatingAssignmentRow[] | null }>;
      };
    };
  };

  const { data: plan } = await sb
    .from("floor_plans")
    .select("*")
    .eq("id", params.planId)
    .maybeSingle!();
  if (!plan) notFound();

  const { data: assignmentsRaw } = await sb
    .from("seating_assignments")
    .select("*")
    .eq("floor_plan_id", params.planId);
  const assignments = (assignmentsRaw as unknown as SeatingAssignmentRow[] | null) ?? [];

  const { data: guestsRaw } = (await supabase
    .from("guests")
    .select(
      "id, full_name, side, household_id, is_household_head, overall_rsvp, dietary, notes",
    )
    .order("full_name", { ascending: true })) as unknown as {
    data: GuestRow[] | null;
  };
  const guests = guestsRaw ?? [];

  const { data: venue } = plan.venue_id
    ? await supabase
        .from("venues")
        .select("name")
        .eq("id", plan.venue_id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="space-y-6">
      <Link
        href="/guests/seating"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to plans
      </Link>

      <header>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          {[venue?.name, plan.event_role?.replace(/_/g, " ")]
            .filter(Boolean)
            .join(" · ") || "Seating plan"}
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
          {plan.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {plan.table_count} tables × {plan.seats_per_table} seats =
          <span className="ml-1 font-medium text-stone-900">
            {plan.table_count * plan.seats_per_table}
          </span>{" "}
          capacity · {assignments.length} guests seated
        </p>
      </header>

      <SeatingBoard plan={plan} guests={guests} initialAssignments={assignments} />
    </div>
  );
}
