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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: vendors }, { data: scenarios }, profileRes] = await Promise.all([
    sb
      .from("vendors")
      .select(
        "id, name, category, status, include_in_pricing, quoted_price_eur, deposit_amount_eur, deposit_due_at, deposit_paid_at, final_balance_eur, final_due_at, final_paid_at",
      ),
    supabase
      .from("pricing_scenarios")
      .select("id, name, calculated_total, inputs")
      .order("created_at", { ascending: true }),
    user
      ? supabase
          .from("users")
          .select("workspace_id")
          .eq("id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const workspaceId = (profileRes?.data as { workspace_id?: string | null } | null)
    ?.workspace_id ?? null;
  const { data: workspaceRow } = workspaceId
    ? await supabase
        .from("workspaces")
        .select("base_currency")
        .eq("id", workspaceId)
        .maybeSingle()
    : { data: null };
  const baseCurrency =
    (workspaceRow as { base_currency?: string | null } | null)?.base_currency ??
    "USD";

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
          <span className="font-medium text-stone-700">Actuals</span> —
          what's been spent vs what's still committed. Pulls from every
          vendor's quoted + deposit + final balance fields. For your plan
          see <a className="underline" href="/budget">/budget</a>; for the
          payment calendar see <a className="underline" href="/payments">/payments</a>.
        </p>
      </header>

      <SpendTracker
        vendors={vendorList}
        scenarios={scenarioList}
        baseCurrency={baseCurrency}
      />
    </div>
  );
}
