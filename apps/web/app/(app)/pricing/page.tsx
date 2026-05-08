// /pricing — Full Pricing Planner (B2B planner-served couple) OR
//            ScenarioStudio (admin) OR redirect to /budget (B2C couple).
//
// Three-branch fork:
//   1. Workspace has venues with event_roles set → planner-served couple
//      (Hursh & Nisha, Astia clients) → render <FullPricingPlanner>.
//   2. Workspace has no event_roles AND user role === 'couple' → B2C
//      self-serve couple → redirect to /budget where the AI baseline
//      generator lives.
//   3. Workspace has no event_roles AND user role === 'admin' → planner
//      reviewing scenarios → render <ScenarioStudio> (the legacy view).

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScenarioStudio } from "@/components/pricing/scenario-studio";
import { FullPricingPlanner } from "@/components/pricing/full-pricing-planner";
import type { ScenarioInputs } from "@/lib/scenario-types";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: "admin" | "couple" | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = (profile?.role ?? null) as typeof role;
  }

  // Pull venues + scenarios + vendors in parallel — both branches need at
  // least the venues list.
  const [{ data: scenarios }, { data: venues }, { data: vendors }] =
    await Promise.all([
      supabase
        .from("pricing_scenarios")
        .select("id, name, inputs, created_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("venues")
        .select(
          "id, name, address, capacity_min, capacity_max, indoor_outdoor, in_house_catering, has_accommodation, event_roles, planner_notes, hero_photo_url, status, hire_fee_weekend_eur, hire_fee_weekday_eur, hire_fee_sunday_eur, minimum_pax_weekend, minimum_pax_sunday, minimum_pax_weekday, shortfall_per_pax_eur, extra_hour_eur, spaces, hire_fee_notes",
        )
        .order("name", { ascending: true }),
      supabase
        // @ts-expect-error vendors not in generated Database type yet — RLS still enforced
        .from("vendors")
        .select(
          "id, name, category, status, quoted_price_eur, include_in_pricing, deposit_amount_eur, deposit_due_at, deposit_paid_at",
        ),
    ]);

  // Detect "planner-served" workspace by whether any venue has event_roles.
  // The planner sets these via the venue create/edit dialog. Self-serve B2C
  // couples never touch this column.
  const venueList = venues ?? [];
  const hasEventRoles = venueList.some(
    (v) =>
      Array.isArray(
        (v as { event_roles?: unknown }).event_roles,
      ) && ((v as { event_roles?: string[] }).event_roles ?? []).length > 0,
  );

  // ─── Branch 1: planner-served couple → Full Pricing Planner ────────
  if (hasEventRoles) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Side-by-side, every event · venue + line items
          </div>
          <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
            Full pricing
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Pick a venue for each event, set guest count, override any line
            (venue hire, per-guest catering, custom line items) and watch the
            combined total update live. Astha&apos;s seeded quotes prefill —
            edit anything if a date or price shifts.
          </p>
        </header>
        <FullPricingPlanner venues={venueList} />
      </div>
    );
  }

  // ─── Branch 2: B2C couple with no planner-tagged venues → /budget ──
  if (role === "couple") {
    redirect("/budget");
  }

  // ─── Branch 3: admin / planner side → ScenarioStudio ───────────────
  const list = (scenarios ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    inputs: s.inputs as unknown as ScenarioInputs,
    created_at: s.created_at,
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Side-by-side, every event
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Full pricing
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Three scenarios, every line item. Pick a venue per event, set guest
          count, drop in custom line items (bus transport, decor, photo,
          anything your planner quotes), and watch the total update live.
        </p>
      </header>

      <ScenarioStudio
        scenarios={list}
        venues={venueList}
        vendors={(vendors ?? []) as never}
        role={role}
      />
    </div>
  );
}
