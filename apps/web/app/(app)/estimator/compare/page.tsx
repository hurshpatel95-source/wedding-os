import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CompareSelector } from "@/components/estimator/compare-selector";
import {
  documentTotal,
  effectiveLineTotal,
  formatEUR,
  sectionTotal,
  type BudgetEstimateRow,
  type EstimateDocument,
  type EstimateLine,
  type EstimateSection,
} from "@/lib/estimator-types";

export const dynamic = "force-dynamic";

type CompareRow = Pick<
  BudgetEstimateRow,
  | "id"
  | "name"
  | "scenario_summary"
  | "cover_emoji"
  | "guest_count"
  | "sections"
  | "baseline_total_eur"
>;

function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface ColumnSection {
  source: EstimateSection | null;
  total: number;
  linesByLabel: Map<string, EstimateLine>;
}

interface SectionRow {
  /** Section label drawn from whichever scenario has it (first wins). */
  label: string;
  subtitle: string | null;
  /** One total per scenario column. */
  totals: number[];
  /** All unique line labels present across the columns, in stable order. */
  lineLabels: string[];
  /** lines[lineIdx][colIdx] = the line in that column or null if absent. */
  linesByCol: (EstimateLine | null)[][];
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { ids?: string };
}) {
  const supabase = createClient();

  const { data: allEstimates } = await supabase
    .from("budget_estimates")
    .select(
      "id, name, scenario_summary, cover_emoji, guest_count, sections, baseline_total_eur, sort_order, is_active",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const all = ((allEstimates as (CompareRow & { sort_order: number })[] | null) ?? []).sort(
    (a, b) => (a as unknown as { sort_order: number }).sort_order - (b as unknown as { sort_order: number }).sort_order,
  );

  if (all.length < 2) {
    return (
      <div className="space-y-6">
        <Link
          href="/estimator"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to estimator
        </Link>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Need at least 2 estimates to compare.{" "}
            <Link
              href="/estimator/new"
              className="underline underline-offset-2 hover:text-stone-900"
            >
              Build a second one
            </Link>
            .
          </CardContent>
        </Card>
      </div>
    );
  }

  const requestedIds = (searchParams?.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Pick selected estimates (default: first 2). Cap at 3.
  const idToRow = new Map(all.map((r) => [r.id, r]));
  let selected: CompareRow[] =
    requestedIds.length > 0
      ? (requestedIds.map((id) => idToRow.get(id)).filter(Boolean) as CompareRow[])
      : all.slice(0, 2);
  if (selected.length === 0) selected = all.slice(0, 2);
  selected = selected.slice(0, 3);

  // Build per-column section info
  const docs = selected.map(
    (s) => (s.sections ?? { version: 1, sections: [] }) as EstimateDocument,
  );
  const colTotals = docs.map((d) => documentTotal(d));

  const maxSections = Math.max(...docs.map((d) => d.sections.length));
  const sectionRows: SectionRow[] = [];

  for (let sIdx = 0; sIdx < maxSections; sIdx += 1) {
    const cols: ColumnSection[] = docs.map((d) => {
      const s = d.sections[sIdx] ?? null;
      const linesByLabel = new Map<string, EstimateLine>();
      if (s) {
        for (const l of s.lines) linesByLabel.set(normalizeLabel(l.label), l);
      }
      return {
        source: s,
        total: s ? sectionTotal(s) : 0,
        linesByLabel,
      };
    });

    // First scenario with this section sets the label; collect line labels across all
    const labelSeen = new Set<string>();
    const lineLabels: string[] = [];
    let label = "—";
    let subtitle: string | null = null;
    for (const col of cols) {
      if (!col.source) continue;
      if (label === "—") {
        label = col.source.label;
        subtitle = col.source.subtitle ?? null;
      }
      for (const l of col.source.lines) {
        const key = normalizeLabel(l.label);
        if (labelSeen.has(key)) continue;
        labelSeen.add(key);
        lineLabels.push(l.label);
      }
    }

    const linesByCol: (EstimateLine | null)[][] = lineLabels.map((labelStr) => {
      const key = normalizeLabel(labelStr);
      return cols.map((col) => col.linesByLabel.get(key) ?? null);
    });

    sectionRows.push({
      label,
      subtitle,
      totals: cols.map((c) => c.total),
      lineLabels,
      linesByCol,
    });
  }

  // Find cheapest column for the summary callout
  const cheapestIdx = colTotals.indexOf(Math.min(...colTotals));

  return (
    <div className="space-y-6">
      <Link
        href="/estimator"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to estimator
      </Link>

      <header>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Side-by-side · {selected.length} scenario{selected.length === 1 ? "" : "s"}
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
          Compare scenarios
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Pick which estimates to compare (up to 3). Lines are matched by
          name across scenarios; same-label rows show side-by-side prices.
        </p>
      </header>

      <CompareSelector all={all} selectedIds={selected.map((s) => s.id)} />

      {/* Sticky summary bar */}
      <div className="sticky top-16 z-30 -mx-4 border-y border-stone-200 bg-stone-50/90 px-4 py-3 backdrop-blur md:rounded-xl md:border md:bg-white">
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${selected.length}, minmax(0, 1fr))`,
          }}
        >
          {selected.map((s, i) => (
            <Link
              key={s.id}
              href={`/estimator/${s.id}`}
              className={cn(
                "block rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm",
                i === cheapestIdx
                  ? "border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-amber-50/30"
                  : "border-stone-200 bg-white",
              )}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-xl">{s.cover_emoji ?? "💍"}</span>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                    {i === cheapestIdx ? "Cheapest" : `Scenario ${i + 1}`}
                  </div>
                  <div className="line-clamp-1 font-serif text-base">{s.name}</div>
                </div>
              </div>
              <div className="mt-2 font-serif text-2xl font-medium tabular-nums">
                {formatEUR(colTotals[i])}
              </div>
              <div className="line-clamp-1 text-[10px] text-muted-foreground">
                {s.scenario_summary}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto py-4">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-[10px] uppercase tracking-[0.15em] text-stone-500">
              <tr>
                <th className="px-3 py-2 text-left">Line</th>
                {selected.map((s) => (
                  <th key={s.id} className="px-3 py-2 text-right">
                    {s.cover_emoji} {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectionRows.map((sr, sIdx) => (
                <SectionRows
                  key={sIdx}
                  row={sr}
                  cheapestIdx={cheapestIdx}
                />
              ))}
              <tr className="border-t-2 border-stone-300 bg-stone-50 font-medium">
                <td className="px-3 py-3 font-serif text-lg">Total</td>
                {colTotals.map((t, i) => (
                  <td
                    key={i}
                    className={cn(
                      "px-3 py-3 text-right font-serif text-lg tabular-nums",
                      i === cheapestIdx && "text-emerald-800",
                    )}
                  >
                    {formatEUR(t)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        {selected.map((s) => (
          <Link
            key={s.id}
            href={`/estimator/${s.id}`}
            className="inline-flex items-center gap-1 text-sm text-stone-700 hover:text-stone-900"
          >
            {s.cover_emoji} Edit {s.name}
            <ArrowRight className="h-3 w-3" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function SectionRows({
  row,
  cheapestIdx,
}: {
  row: SectionRow;
  cheapestIdx: number;
}) {
  const N = row.totals.length;
  return (
    <>
      <tr className="border-t-2 border-stone-300 bg-stone-50">
        <td className="px-3 py-2.5">
          <div className="font-serif text-base">{row.label}</div>
          {row.subtitle && (
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {row.subtitle}
            </div>
          )}
        </td>
        {row.totals.map((t, i) => (
          <td
            key={i}
            className={cn(
              "px-3 py-2.5 text-right font-medium tabular-nums",
              i === cheapestIdx && "text-emerald-800",
            )}
          >
            {formatEUR(t)}
          </td>
        ))}
      </tr>
      {row.lineLabels.map((lbl, lIdx) => {
        const lines = row.linesByCol[lIdx];
        const effectives = lines.map((l) => (l ? effectiveLineTotal(l) : 0));
        const tbcCols = lines.map((l) => Boolean(l?.tbc));
        const offCols = lines.map((l) => l != null && !l.included && !l.tbc);
        const minVal = Math.min(...effectives.filter((v, i) => lines[i]));
        return (
          <tr key={lIdx} className="border-t border-stone-100">
            <td className="px-3 py-1.5 pl-7">
              <div className="text-stone-700">{lbl}</div>
            </td>
            {lines.map((l, i) => (
              <td
                key={i}
                className={cn(
                  "px-3 py-1.5 text-right tabular-nums",
                  l == null && "text-stone-300",
                  l && effectives[i] === minVal && N > 1 && !tbcCols[i] && !offCols[i] && "text-emerald-700",
                )}
              >
                {l == null
                  ? "—"
                  : tbcCols[i]
                  ? "TBC"
                  : offCols[i]
                  ? "off"
                  : formatEUR(effectives[i])}
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}
