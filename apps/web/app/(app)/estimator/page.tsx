// /estimator — couple-side total forecast + scenario builder.
//
// Drill into any category to see the leaf lines beneath it, swap vendors,
// and adjust per-line estimates — totals recalc live. This is the
// "play with combinations" view; /budget remains the full editor.

import Link from "next/link";
import { ArrowRight, Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { type BudgetLineRow } from "@/lib/autopilot-types";
import { EstimatorDrillDown } from "@/components/estimator/estimator-drill-down";

export const dynamic = "force-dynamic";

export default async function EstimatorPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id) return null;

  // Workspace context for currency + budget target
  const sbWs = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: {
              name: string;
              base_currency: string;
              budget_target_eur: number | null;
              guest_count_estimate: number | null;
            } | null;
          }>;
        };
      };
    };
  };
  const { data: workspace } = await sbWs
    .from("workspaces")
    .select("name, base_currency, budget_target_eur, guest_count_estimate")
    .eq("id", profile.workspace_id)
    .maybeSingle();

  const currency = workspace?.base_currency ?? "USD";
  const target = workspace?.budget_target_eur ?? null;
  const guestCount = workspace?.guest_count_estimate ?? null;

  // Pull budget_lines (couples can read their own; org_admins read all)
  const sbLines = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => Promise<{ data: BudgetLineRow[] | null }>;
      };
    };
  };
  const { data: linesRaw } = await sbLines
    .from("budget_lines")
    .select(
      "id, workspace_id, org_id, parent_line_id, category, label, qty, unit_price_eur, total_eur, amount_estimated, amount_committed, amount_paid, vendor_id, status, source, notes, sort_order, metadata, created_at, updated_at",
    )
    .eq("workspace_id", profile.workspace_id);
  const lines = (linesRaw ?? []) as BudgetLineRow[];

  // Vendors for the per-line vendor swap dropdown.
  const sbVendors = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => Promise<{
          data: Array<{
            id: string;
            name: string;
            category: string | null;
            quoted_price_eur: number | null;
          }> | null;
        }>;
      };
    };
  };
  let vendors: Array<{
    id: string;
    name: string;
    category: string | null;
    quoted_price_eur: number | null;
  }> = [];
  try {
    const { data } = await sbVendors
      .from("vendors")
      .select("id, name, category, quoted_price_eur")
      .eq("workspace_id", profile.workspace_id);
    vendors = (data ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      category: v.category ?? null,
      quoted_price_eur: v.quoted_price_eur ?? null,
    }));
  } catch {
    vendors = [];
  }

  // Empty state — point them to /budget
  if (lines.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Forecast
          </div>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Estimator
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Where your wedding lands today: AI-estimated lines + locked-in
            vendor quotes + paid amounts. All in one summary view.
          </p>
        </header>
        <Card>
          <CardContent className="py-12 text-center">
            <Coins className="mx-auto mb-3 h-8 w-8 text-stone-300" />
            <h3 className="font-serif text-xl font-light text-stone-800">
              No budget yet
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500">
              Build your starter budget at <Link href="/budget" className="font-medium text-rose-700 underline">/budget</Link> first. AI generates a personalized 70+ line tree based on your guest count + region in seconds.
            </p>
            <Link
              href="/budget"
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-stone-800"
            >
              Build my budget <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Forecast · scenario builder
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
          Estimator
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Click a category to drill in, swap vendors, and edit estimates —
          totals recalc live. Try different combinations to see how each
          impacts your bottom line.
        </p>
      </header>

      <EstimatorDrillDown
        initialLines={lines}
        vendors={vendors}
        baseCurrency={currency}
        target={target}
        guestCount={guestCount}
      />
    </div>
  );
}
