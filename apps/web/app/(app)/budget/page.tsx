import { createClient } from "@/lib/supabase/server";
import { BudgetTree } from "@/components/budget/budget-tree";
import { EmptyBudgetTree } from "@/components/budget/empty-budget-tree";
import type { BudgetLineRow } from "@/lib/autopilot-types";

export const dynamic = "force-dynamic";

interface VendorOption {
  id: string;
  name: string;
  category: string | null;
}

interface WorkspaceSlim {
  id: string;
  name: string | null;
  base_currency: string;
  guest_count_estimate: number | null;
  budget_target_eur: number | null;
  wedding_region: string | null;
}

export default async function BudgetPage() {
  const supabase = createClient();

  // workspaces row — using cast for the autopilot fields not in generated types
  const { data: rawWorkspace } = await supabase
    .from("workspaces")
    .select("id, name, base_currency")
    .limit(1)
    .maybeSingle();

  let workspace: WorkspaceSlim | null = null;
  if (rawWorkspace) {
    // Pull the autopilot-extension columns separately via raw cast
    const sb = supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            maybeSingle: () => Promise<{
              data: {
                guest_count_estimate?: number | null;
                budget_target_eur?: number | null;
                wedding_region?: string | null;
              } | null;
            }>;
          };
        };
      };
    };
    let extras: {
      guest_count_estimate?: number | null;
      budget_target_eur?: number | null;
      wedding_region?: string | null;
    } | null = null;
    try {
      const { data } = await sb
        .from("workspaces")
        .select("guest_count_estimate, budget_target_eur, wedding_region")
        .eq("id", rawWorkspace.id)
        .maybeSingle();
      extras = data;
    } catch {
      // pre-migration tolerance
    }
    workspace = {
      id: rawWorkspace.id,
      name: rawWorkspace.name ?? null,
      base_currency: rawWorkspace.base_currency ?? "EUR",
      guest_count_estimate: extras?.guest_count_estimate ?? null,
      budget_target_eur: extras?.budget_target_eur ?? null,
      wedding_region: extras?.wedding_region ?? null,
    };
  }

  // budget_lines — table not in generated types; cast it.
  const sbBudget = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        order: (
          col: string,
          opts?: { ascending?: boolean },
        ) => Promise<{ data: BudgetLineRow[] | null }>;
      };
    };
  };

  let lines: BudgetLineRow[] = [];
  try {
    const { data } = await sbBudget
      .from("budget_lines")
      .select(
        "id, workspace_id, org_id, parent_line_id, category, label, qty, unit_price_eur, total_eur, amount_estimated, amount_committed, amount_paid, vendor_id, status, source, notes, sort_order, metadata, created_at, updated_at",
      )
      .order("sort_order", { ascending: true });
    lines = (data ?? []).map((r) => ({
      ...r,
      qty: r.qty == null ? null : Number(r.qty),
      unit_price_eur: r.unit_price_eur == null ? null : Number(r.unit_price_eur),
      total_eur: r.total_eur == null ? null : Number(r.total_eur),
      amount_estimated:
        r.amount_estimated == null ? null : Number(r.amount_estimated),
      amount_committed:
        r.amount_committed == null ? null : Number(r.amount_committed),
      amount_paid: r.amount_paid == null ? null : Number(r.amount_paid),
    }));
  } catch {
    // pre-migration tolerant
    lines = [];
  }

  // Vendors — for the "connect vendor" dropdown. Cast pattern.
  const sbVendors = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        order: (
          col: string,
          opts?: { ascending?: boolean },
        ) => Promise<{ data: VendorOption[] | null }>;
      };
    };
  };
  let vendorOptions: VendorOption[] = [];
  try {
    const { data } = await sbVendors
      .from("vendors")
      .select("id, name, category")
      .order("name", { ascending: true });
    vendorOptions = (data ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      category: v.category ?? null,
    }));
  } catch {
    vendorOptions = [];
  }

  if (!workspace) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Budget tree
          </div>
          <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
            Budget
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Couldn&apos;t find your workspace. Try refreshing.
          </p>
        </header>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Budget tree · personalized
          </div>
          <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
            Budget
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            A personalized starting baseline, generated by AI from your guest
            count + total target. Drag any line to re-balance — vendor quotes
            roll in automatically as they land.
          </p>
        </header>
        <EmptyBudgetTree workspace={workspace} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Budget tree · personalized
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Budget
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          <span className="font-medium text-stone-700">Your plan</span> —
          the numbers you decide. Drag any line to re-balance. As vendors
          send quotes, the &quot;committed&quot; bar fills automatically.
          For live forecasting as quotes land, see <a className="underline" href="/estimator">/estimator</a>.
        </p>
      </header>
      <BudgetTree
        lines={lines}
        workspace={workspace}
        vendorOptions={vendorOptions}
      />
    </div>
  );
}
