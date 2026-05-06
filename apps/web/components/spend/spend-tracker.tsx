"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/utils";
import { VENDOR_CATEGORY_LABEL, VENDOR_STATUS_LABEL, VENDOR_STATUS_VARIANT } from "@/lib/vendor-categories";
import type { VendorRow } from "@/lib/vendor-types";
import type { ScenarioInputs } from "@/lib/scenario-types";

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

interface ScenarioLite {
  id: string;
  name: string;
  calculated_total: number;
  inputs: ScenarioInputs;
}

const num = (v: number | null | undefined): number =>
  v == null ? 0 : Number(v);

export function SpendTracker({
  vendors,
  scenarios,
}: {
  vendors: VendorSlim[];
  scenarios: ScenarioLite[];
}) {
  const [scenarioId, setScenarioId] = useState<string>(scenarios[0]?.id ?? "none");

  const activeScenario = scenarios.find((s) => s.id === scenarioId);

  const totals = useMemo(() => {
    let quoted_total = 0; // sum of all vendor quotes (the planned vendor stack)
    let deposits_committed = 0;
    let deposits_paid = 0;
    let final_committed = 0;
    let final_paid = 0;
    const byCategory: Record<string, { quoted: number; paid: number }> = {};

    for (const v of vendors) {
      const q = num(v.quoted_price_eur);
      const da = num(v.deposit_amount_eur);
      const fa = num(v.final_balance_eur);
      const dp = v.deposit_paid_at ? da : 0;
      const fp = v.final_paid_at ? fa : 0;
      // include_in_pricing controls whether they roll into headline number
      if (v.include_in_pricing) {
        quoted_total += q;
      }
      deposits_committed += da;
      deposits_paid += dp;
      final_committed += fa;
      final_paid += fp;

      const cat = String(v.category);
      if (!byCategory[cat]) byCategory[cat] = { quoted: 0, paid: 0 };
      byCategory[cat].quoted += q;
      byCategory[cat].paid += dp + fp;
    }

    const total_paid = deposits_paid + final_paid;
    const total_committed = deposits_committed + final_committed;
    const remaining = total_committed - total_paid;

    return {
      quoted_total,
      deposits_committed,
      deposits_paid,
      final_committed,
      final_paid,
      total_paid,
      total_committed,
      remaining,
      byCategory,
    };
  }, [vendors]);

  // Forecast (active scenario hosts grand) vs actual + vendor commitments
  const scenarioForecast = activeScenario?.calculated_total ?? 0;
  const grandForecast = scenarioForecast + totals.quoted_total * 1.21; // include 21% VAT on vendors
  const paidPct =
    grandForecast > 0
      ? Math.min(100, Math.round((totals.total_paid / grandForecast) * 100))
      : 0;
  const committedPct =
    grandForecast > 0
      ? Math.min(100, Math.round((totals.total_committed / grandForecast) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* Top stats */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Total forecast"
          value={formatMoney(grandForecast, "EUR")}
          sub="Active scenario + vendor stack incl. VAT"
        />
        <Stat
          label="Total committed"
          value={formatMoney(totals.total_committed, "EUR")}
          sub="Deposits + final balances signed for"
          tone="amber"
        />
        <Stat
          label="Paid to date"
          value={formatMoney(totals.total_paid, "EUR")}
          sub={`${paidPct}% of total forecast`}
          tone="emerald"
        />
        <Stat
          label="Remaining to pay"
          value={formatMoney(totals.remaining, "EUR")}
          sub="Committed but not yet paid"
          tone="rose"
        />
      </section>

      {/* Scenario picker */}
      {scenarios.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <span className="text-sm font-medium">Forecast vs scenario:</span>
            <Select value={scenarioId} onValueChange={setScenarioId}>
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scenarios.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {formatMoney(s.calculated_total, "EUR")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeScenario && (
              <span className="text-xs text-muted-foreground">
                Scenario hosts'-cost: {formatMoney(scenarioForecast, "EUR")} · vendor stack:
                {" "}{formatMoney(totals.quoted_total * 1.21, "EUR")} (incl. 21% VAT)
              </span>
            )}
          </CardContent>
        </Card>
      )}

      {/* Progress bars */}
      <Card>
        <CardContent className="space-y-4 py-5">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-xs">
              <span className="text-stone-700">Committed (signed contracts)</span>
              <span className="text-stone-500">
                {formatMoney(totals.total_committed, "EUR")} / {formatMoney(grandForecast, "EUR")}
              </span>
            </div>
            <Bar pct={committedPct} tone="amber" />
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-xs">
              <span className="text-stone-700">Paid to date</span>
              <span className="text-stone-500">
                {formatMoney(totals.total_paid, "EUR")} / {formatMoney(grandForecast, "EUR")}
              </span>
            </div>
            <Bar pct={paidPct} tone="emerald" />
          </div>
        </CardContent>
      </Card>

      {/* Per-category breakdown */}
      {Object.keys(totals.byCategory).length > 0 && (
        <Card>
          <CardContent className="py-5">
            <h3 className="mb-3 font-serif text-xl">By vendor category</h3>
            <div className="overflow-x-auto rounded-lg border border-stone-200">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-[10px] uppercase tracking-[0.15em] text-stone-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-right">Quoted</th>
                    <th className="px-3 py-2 text-right">Paid</th>
                    <th className="px-3 py-2 text-right">% Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(totals.byCategory)
                    .sort((a, b) => b[1].quoted - a[1].quoted)
                    .map(([cat, t]) => {
                      const pct = t.quoted > 0 ? Math.round((t.paid / t.quoted) * 100) : 0;
                      return (
                        <tr key={cat} className="border-t border-stone-100">
                          <td className="px-3 py-2">
                            {VENDOR_CATEGORY_LABEL[cat as keyof typeof VENDOR_CATEGORY_LABEL] ?? cat}
                          </td>
                          <td className="px-3 py-2 text-right">{formatMoney(t.quoted, "EUR")}</td>
                          <td className="px-3 py-2 text-right">{formatMoney(t.paid, "EUR")}</td>
                          <td className="px-3 py-2 text-right">
                            <Badge variant={pct >= 100 ? "success" : pct > 0 ? "warning" : "muted"} className="text-[10px]">
                              {pct}%
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-vendor table */}
      <Card>
        <CardContent className="py-5">
          <h3 className="mb-3 font-serif text-xl">Every vendor</h3>
          {vendors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No vendors yet. Add some at <Link href="/vendors" className="underline">/vendors</Link>.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-stone-200">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-[10px] uppercase tracking-[0.15em] text-stone-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Vendor</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Quoted</th>
                    <th className="px-3 py-2 text-right">Deposit</th>
                    <th className="px-3 py-2 text-right">Final</th>
                    <th className="px-3 py-2 text-right">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((v) => {
                      const da = num(v.deposit_amount_eur);
                      const fa = num(v.final_balance_eur);
                      const dp = v.deposit_paid_at ? da : 0;
                      const fp = v.final_paid_at ? fa : 0;
                      const paid = dp + fp;
                      const total = da + fa;
                      return (
                        <tr key={v.id} className="border-t border-stone-100">
                          <td className="px-3 py-2">
                            <Link
                              href={`/vendors/${v.id}`}
                              className="font-medium hover:underline"
                            >
                              {v.name}
                            </Link>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {VENDOR_CATEGORY_LABEL[v.category]}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={VENDOR_STATUS_VARIANT[v.status]} className="text-[10px]">
                              {VENDOR_STATUS_LABEL[v.status]}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {v.quoted_price_eur != null
                              ? formatMoney(num(v.quoted_price_eur), "EUR")
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {da > 0 ? (
                              <div>
                                <div>{formatMoney(da, "EUR")}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {v.deposit_paid_at
                                    ? `paid ${format(parseISO(v.deposit_paid_at), "MMM d")}`
                                    : v.deposit_due_at
                                    ? `due ${format(parseISO(v.deposit_due_at), "MMM d")}`
                                    : "no due date"}
                                </div>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {fa > 0 ? (
                              <div>
                                <div>{formatMoney(fa, "EUR")}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {v.final_paid_at
                                    ? `paid ${format(parseISO(v.final_paid_at), "MMM d")}`
                                    : v.final_due_at
                                    ? `due ${format(parseISO(v.final_due_at), "MMM d")}`
                                    : "no due date"}
                                </div>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {total > 0 ? (
                              <span
                                className={
                                  paid === total
                                    ? "font-medium text-emerald-700"
                                    : paid > 0
                                    ? "font-medium text-amber-700"
                                    : "text-stone-500"
                                }
                              >
                                {formatMoney(paid, "EUR")} / {formatMoney(total, "EUR")}
                              </span>
                            ) : (
                              <span className="text-stone-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "muted",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "muted" | "emerald" | "amber" | "rose";
}) {
  const dot =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
      ? "bg-amber-500"
      : tone === "rose"
      ? "bg-rose-500"
      : "bg-stone-400";
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-stone-500">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-2 font-serif text-2xl font-light leading-none">{value}</div>
      {sub && <div className="mt-1 text-xs text-stone-500">{sub}</div>}
    </div>
  );
}

function Bar({ pct, tone }: { pct: number; tone: "amber" | "emerald" }) {
  const fill = tone === "emerald" ? "bg-emerald-500" : "bg-amber-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
      <div className={`h-full ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
