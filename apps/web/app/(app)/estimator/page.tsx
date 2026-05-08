// /estimator — couple-side total forecast view.
//
// Pulls from budget_lines (which already aggregates AI-estimated +
// vendor-committed + paid amounts per line) and shows the bird's-eye
// view: where the wedding lands today vs the target, what's locked vs
// still hypothetical, what categories haven't been priced yet.
//
// This is NOT the old Astia-PDF Estimator. That code path is gone.

import Link from "next/link";
import { ArrowRight, Coins, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import {
  BUDGET_CATEGORY_LABEL,
  type BudgetCategory,
  type BudgetLineRow,
} from "@/lib/autopilot-types";

export const dynamic = "force-dynamic";

function formatMoney(n: number, currency: string): string {
  const symbol = currency === "USD" ? "$" : "€";
  return `${symbol}${Math.round(n).toLocaleString()}`;
}

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

  // Roll up totals
  let totalEstimated = 0;
  let totalCommitted = 0;
  let totalPaid = 0;
  let unpricedLines = 0;
  const byCategory = new Map<string, { estimated: number; committed: number; paid: number; lineCount: number }>();
  const leafLines = lines.filter((l) => !lines.some((other) => other.parent_line_id === l.id));

  for (const l of leafLines) {
    const est = Number(l.amount_estimated ?? l.total_eur ?? 0);
    const com = Number(l.amount_committed ?? 0);
    const paid = Number(l.amount_paid ?? 0);
    totalEstimated += est;
    totalCommitted += com;
    totalPaid += paid;
    if (est === 0 && com === 0 && paid === 0) unpricedLines++;
    const cat = l.category ?? "misc";
    const bucket = byCategory.get(cat) ?? { estimated: 0, committed: 0, paid: 0, lineCount: 0 };
    bucket.estimated += est;
    bucket.committed += com;
    bucket.paid += paid;
    bucket.lineCount += 1;
    byCategory.set(cat, bucket);
  }

  const targetUsd = target ?? 0;
  const overUnder = targetUsd > 0 ? totalEstimated - targetUsd : null;
  const perGuest = guestCount && guestCount > 0 ? totalEstimated / guestCount : null;

  // Sort categories by estimated DESC
  const sortedCats = Array.from(byCategory.entries()).sort(
    (a, b) => b[1].estimated - a[1].estimated,
  );

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
          Where your wedding lands today across {leafLines.length} budget lines.
          Estimated = AI baseline. Committed = signed quotes from vendors.
          Paid = actually paid.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BigStat
          label="Estimated total"
          value={formatMoney(totalEstimated, currency)}
          sub={perGuest ? `~${formatMoney(perGuest, currency)} per guest` : `${leafLines.length} lines`}
          tone="stone"
        />
        <BigStat
          label="Committed"
          value={formatMoney(totalCommitted, currency)}
          sub={
            totalEstimated > 0
              ? `${Math.round((totalCommitted / totalEstimated) * 100)}% locked`
              : "—"
          }
          tone="amber"
        />
        <BigStat
          label="Paid"
          value={formatMoney(totalPaid, currency)}
          sub={
            totalEstimated > 0
              ? `${Math.round((totalPaid / totalEstimated) * 100)}% paid`
              : "—"
          }
          tone="emerald"
        />
        {target ? (
          <BigStat
            label="Vs target"
            value={`${(overUnder ?? 0) >= 0 ? "+" : "−"}${formatMoney(Math.abs(overUnder ?? 0), currency)}`}
            sub={`Target: ${formatMoney(target, currency)}`}
            tone={(overUnder ?? 0) > 0 ? "rose" : "emerald"}
          />
        ) : (
          <BigStat
            label="Target"
            value="—"
            sub="Set a target on /budget"
            tone="stone"
          />
        )}
      </section>

      {unpricedLines > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="text-sm text-amber-900">
            {unpricedLines} line{unpricedLines === 1 ? "" : "s"} still has no
            estimate. Hop into{" "}
            <Link href="/budget" className="font-medium underline">
              /budget
            </Link>{" "}
            to fill them in or generate AI baselines.
          </div>
        </div>
      )}

      <Card>
        <CardContent className="py-5">
          <h2 className="font-serif text-xl">By category</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-[10px] uppercase tracking-[0.15em] text-stone-500">
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-right">Lines</th>
                  <th className="px-3 py-2 text-right">Estimated</th>
                  <th className="px-3 py-2 text-right">Committed</th>
                  <th className="px-3 py-2 text-right">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sortedCats.map(([cat, b]) => (
                  <tr key={cat} className="hover:bg-stone-50/50">
                    <td className="px-3 py-2 font-medium text-stone-900">
                      {BUDGET_CATEGORY_LABEL[cat as BudgetCategory] ?? cat}
                    </td>
                    <td className="px-3 py-2 text-right text-stone-600">{b.lineCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(b.estimated, currency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-800">
                      {b.committed > 0 ? formatMoney(b.committed, currency) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-800">
                      {b.paid > 0 ? formatMoney(b.paid, currency) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <Link
              href="/budget"
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-medium text-stone-800 transition hover:border-stone-500"
            >
              Edit lines on /budget <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BigStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "amber" | "rose" | "emerald" | "stone";
}) {
  const cls =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "rose"
        ? "border-rose-200 bg-rose-50 text-rose-900"
        : tone === "emerald"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-stone-200 bg-white";
  return (
    <div className={`rounded-2xl border ${cls} p-4`}>
      <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">
        {label}
      </div>
      <div className="mt-1 font-serif text-2xl font-medium tabular-nums leading-tight md:text-3xl">
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[10px] uppercase tracking-[0.15em] opacity-70">
          {sub}
        </div>
      )}
    </div>
  );
}
