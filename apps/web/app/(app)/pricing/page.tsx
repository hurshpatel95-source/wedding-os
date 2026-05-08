import { createClient } from "@/lib/supabase/server";
import { ScenarioStudio } from "@/components/pricing/scenario-studio";
import type { ScenarioInputs } from "@/lib/scenario-types";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const supabase = createClient();

  const [{ data: scenarios }, { data: venues }, { data: vendors }] = await Promise.all([
    supabase
      .from("pricing_scenarios")
      .select("id, name, inputs, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("venues")
      .select(
        "id, name, address, capacity_min, capacity_max, indoor_outdoor, event_roles, planner_notes, hero_photo_url, hire_fee_weekend_eur, hire_fee_weekday_eur, hire_fee_sunday_eur, minimum_pax_weekend, minimum_pax_sunday, minimum_pax_weekday, shortfall_per_pax_eur, extra_hour_eur, spaces, hire_fee_notes",
      )
      .order("name", { ascending: true }),
    supabase
      // @ts-expect-error vendors not in generated Database type yet — RLS still enforced
      .from("vendors")
      .select(
        "id, name, category, status, quoted_price_eur, include_in_pricing, deposit_amount_eur, deposit_due_at, deposit_paid_at",
      ),
  ]);

  const { data: { user } } = await supabase.auth.getUser();
  let role: "admin" | "couple" | null = null;
  if (user) {
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
    role = (profile?.role ?? null) as typeof role;
  }

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
          Three scenarios, every line item. Pick a venue per event, set guest count, drop in
          custom line items (bus transport, decor, photo, anything your planner quotes), and watch the
          total update live.
        </p>
      </header>

      <ScenarioStudio
        scenarios={list}
        venues={venues ?? []}
        vendors={(vendors ?? []) as never}
        role={role}
      />
    </div>
  );
}
