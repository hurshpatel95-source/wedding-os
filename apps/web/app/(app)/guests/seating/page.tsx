import Link from "next/link";
import { ArrowRight, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateFloorPlanForm } from "@/components/seating/create-floor-plan-form";
import type { FloorPlanRow } from "@/lib/seating-types";
import { planCapacity } from "@/lib/seating-types";

export const dynamic = "force-dynamic";

interface VenueOpt {
  id: string;
  name: string;
}
interface PlanWithCounts extends FloorPlanRow {
  assigned_count: number;
}

export default async function SeatingListPage() {
  const supabase = createClient();

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        order: (col: string, opts: { ascending: boolean }) => Promise<{
          data: FloorPlanRow[] | null;
        }>;
        in?: (col: string, vals: string[]) => Promise<{
          data: { floor_plan_id: string }[] | null;
        }>;
      };
    };
  };

  const { data: plansRaw } = await sb
    .from("floor_plans")
    .select("*")
    .order("created_at", { ascending: false });
  const plans = plansRaw ?? [];

  // Fetch assignment counts in one shot — cast around the DB types.
  const planIds = plans.map((p) => p.id);
  const counts = new Map<string, number>();
  if (planIds.length > 0) {
    const sbAssign = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          in: (col: string, vals: string[]) => Promise<{
            data: { floor_plan_id: string }[] | null;
          }>;
        };
      };
    };
    const { data: assignmentsRaw } = await sbAssign
      .from("seating_assignments")
      .select("floor_plan_id")
      .in("floor_plan_id", planIds);
    for (const row of assignmentsRaw ?? []) {
      counts.set(row.floor_plan_id, (counts.get(row.floor_plan_id) ?? 0) + 1);
    }
  }

  const { data: venues } = await supabase
    .from("venues")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Seating organizer
          </div>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Tables & seating
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Build a floor plan per event. Pick a venue, set the table count
            and seats per table, then drop guests into tables. One guest
            can sit at different tables across different events.
          </p>
        </div>
      </header>

      {plans.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const cap = planCapacity(plan);
            const assigned = counts.get(plan.id) ?? 0;
            const venue = venues?.find((v) => v.id === plan.venue_id);
            return (
              <Link
                key={plan.id}
                href={`/guests/seating/${plan.id}`}
                className="group block"
              >
                <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="space-y-3 py-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-serif text-2xl">{plan.name}</h3>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {[venue?.name, plan.event_role?.replace(/_/g, " ")]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 shrink-0 text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-stone-700" />
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="muted">
                        {plan.table_count} tables × {plan.seats_per_table} seats
                      </Badge>
                      <Badge variant="muted">capacity {cap}</Badge>
                      <Badge
                        variant={
                          assigned === 0
                            ? "muted"
                            : assigned >= cap
                            ? "warning"
                            : "success"
                        }
                      >
                        <Users className="mr-1 h-3 w-3" />
                        {assigned} seated
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No seating plans yet. Create your first one below.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-5">
          <h3 className="mb-3 inline-flex items-center gap-2 font-serif text-xl">
            <Plus className="h-4 w-4" />
            New floor plan
          </h3>
          <CreateFloorPlanForm venues={(venues ?? []) as VenueOpt[]} />
        </CardContent>
      </Card>
    </div>
  );
}
