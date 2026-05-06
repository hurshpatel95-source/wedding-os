import { createClient } from "@/lib/supabase/server";
import { SpendTracker } from "@/components/spend/spend-tracker";
import type { VendorRow } from "@/lib/vendor-types";
import type { ScenarioInputs } from "@/lib/scenario-types";

export const dynamic = "force-dynamic";

type VendorSlim = Pick<
  VendorRow,
  | "id"
  | "name"
  | "category"
  | "status"
  | "include_in_pricing"
  | "quoted_price_eur"
  | "deposit_amount_eur"
  | "deposit_due_at"
  | "deposit_paid_at"
  | "final_balance_eur"
  | "final_due_at"
  | "final_paid_at"
>;

export default async function SpendPage() {
  const supabase = createClient();

  // vendors not in generated Database types — minimal cast
  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => Promise<{ data: VendorSlim[] | null }>;
    };
  };

  const [{ data: vendors }, { data: scenarios }] = await Promise.all([
    sb
      .from("vendors")
      .select(
        "id, name, category, status, include_in_pricing, quoted_price_eur, deposit_amount_eur, deposit_due_at, deposit_paid_at, final_balance_eur, final_due_at, final_paid_at",
      ),
    supabase
      .from("pricing_scenarios")
      .select("id, name, calculated_total, inputs")
      .order("created_at", { ascending: true }),
  ]);

  const vendorList = (vendors ?? []) as VendorSlim[];
  const scenarioList = (scenarios ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    calculated_total: Number(s.calculated_total ?? 0),
    inputs: s.inputs as unknown as ScenarioInputs,
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Forecast vs actual
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Spend tracker
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          What's been spent vs what's still committed. Pulls from every vendor's quoted +
          deposit + final balance fields, plus the saved scenarios for context.
        </p>
      </header>

      <SpendTracker vendors={vendorList} scenarios={scenarioList} />
    </div>
  );
}
