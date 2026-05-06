import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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

interface LinePair {
  label: string;
  unitLabelLeft?: string;
  unitLabelRight?: string;
  leftLine: EstimateLine | null;
  rightLine: EstimateLine | null;
  leftEur: number;
  rightEur: number;
  delta: number;
}

interface SectionPair {
  label: string;
  subtitleLeft?: string;
  subtitleRight?: string;
  leftTotal: number;
  rightTotal: number;
  delta: number;
  pairs: LinePair[];
  leftOnly: EstimateLine[];
  rightOnly: EstimateLine[];
}

function buildSectionPair(
  left: EstimateSection | null,
  right: EstimateSection | null,
): SectionPair {
  const leftLines = left?.lines ?? [];
  const rightLines = right?.lines ?? [];

  const rightByLabel = new Map<string, EstimateLine>();
  for (const r of rightLines) rightByLabel.set(normalizeLabel(r.label), r);

  const pairs: LinePair[] = [];
  const matchedRightIds = new Set<string>();

  for (const l of leftLines) {
    const r = rightByLabel.get(normalizeLabel(l.label));
    if (r) {
      matchedRightIds.add(r.id);
      const leftEur = effectiveLineTotal(l);
      const rightEur = effectiveLineTotal(r);
      pairs.push({
        label: l.label,
        unitLabelLeft: l.unit_label,
        unitLabelRight: r.unit_label,
        leftLine: l,
        rightLine: r,
        leftEur,
        rightEur,
        delta: rightEur - leftEur,
      });
    } else {
      const leftEur = effectiveLineTotal(l);
      pairs.push({
        label: l.label,
        unitLabelLeft: l.unit_label,
        leftLine: l,
        rightLine: null,
        leftEur,
        rightEur: 0,
        delta: -leftEur,
      });
    }
  }

  const rightOnly = rightLines.filter((r) => !matchedRightIds.has(r.id));
  // Append right-only at the end as one-sided rows
  for (const r of rightOnly) {
    const rightEur = effectiveLineTotal(r);
    pairs.push({
      label: r.label,
      unitLabelRight: r.unit_label,
      leftLine: null,
      rightLine: r,
      leftEur: 0,
      rightEur,
      delta: rightEur,
    });
  }

  const leftTotal = left ? sectionTotal(left) : 0;
  const rightTotal = right ? sectionTotal(right) : 0;

  return {
    label: left?.label ?? right?.label ?? "—",
    subtitleLeft: left?.subtitle,
    subtitleRight: right?.subtitle,
    leftTotal,
    rightTotal,
    delta: rightTotal - leftTotal,
    pairs,
    leftOnly: [],
    rightOnly: [],
  };
}

function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function ComparePage() {
  const supabase = createClient();

  const { data: estimates } = await supabase
    .from("budget_estimates")
    .select(
      "id, name, scenario_summary, cover_emoji, guest_count, sections, baseline_total_eur",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(2);

  const list: CompareRow[] = (estimates as CompareRow[] | null) ?? [];

  if (list.length < 2) {
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
            Need at least 2 estimates to compare. Run{" "}
            <code className="rounded bg-stone-100 px-1.5 py-0.5">
              pnpm db:seed-estimates
            </code>
            .
          </CardContent>
        </Card>
      </div>
    );
  }

  const [left, right] = list;
  const leftDoc = (left.sections ?? { version: 1, sections: [] }) as EstimateDocument;
  const rightDoc = (right.sections ?? { version: 1, sections: [] }) as EstimateDocument;

  // Pair sections by index — they should align across both seeded scenarios.
  const maxLen = Math.max(leftDoc.sections.length, rightDoc.sections.length);
  const sectionPairs: SectionPair[] = [];
  for (let i = 0; i < maxLen; i++) {
    sectionPairs.push(
      buildSectionPair(
        leftDoc.sections[i] ?? null,
        rightDoc.sections[i] ?? null,
      ),
    );
  }

  const leftTotal = documentTotal(leftDoc);
  const rightTotal = documentTotal(rightDoc);
  const grandDelta = rightTotal - leftTotal;
  const cheaper = grandDelta === 0 ? null : grandDelta < 0 ? right : left;

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
          Side-by-side · Astia&apos;s two scenarios
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
          Compare scenarios
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Reflects your live overrides — toggle a line off in the builder and
          this view recalculates. Lines are matched by name; same-label rows
          show side-by-side prices and the running delta.
        </p>
      </header>

      {/* Sticky summary bar */}
      <div className="sticky top-16 z-30 -mx-4 border-y border-stone-200 bg-stone-50/90 px-4 py-3 backdrop-blur md:rounded-xl md:border md:bg-white">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ScenarioSummary scenario={left} total={leftTotal} side="left" />
          <ScenarioSummary scenario={right} total={rightTotal} side="right" />
          <div className="rounded-xl bg-gradient-to-br from-stone-900 to-stone-700 p-4 text-white">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-400">
              Difference
            </div>
            <div className="mt-1 font-serif text-3xl font-medium tracking-tight">
              {formatEUR(Math.abs(grandDelta))}
            </div>
            <div className="mt-1 text-xs text-stone-300">
              {cheaper ? `${cheaper.cover_emoji ?? "·"} ${cheaper.name} is cheaper` : "tied"}
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="py-4">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-[10px] uppercase tracking-[0.15em] text-stone-500">
              <tr>
                <th className="px-3 py-2 text-left">Line</th>
                <th className="px-3 py-2 text-right">
                  {left.cover_emoji} {left.name}
                </th>
                <th className="px-3 py-2 text-right">
                  {right.cover_emoji} {right.name}
                </th>
                <th className="px-3 py-2 text-right">Δ</th>
              </tr>
            </thead>
            <tbody>
              {sectionPairs.map((sp) => (
                <SectionRows key={sp.label} pair={sp} />
              ))}
              <tr className="border-t-2 border-stone-300 bg-stone-50 font-medium">
                <td className="px-3 py-3 font-serif text-lg">Total</td>
                <td className="px-3 py-3 text-right font-serif text-lg tabular-nums">
                  {formatEUR(leftTotal)}
                </td>
                <td className="px-3 py-3 text-right font-serif text-lg tabular-nums">
                  {formatEUR(rightTotal)}
                </td>
                <td className="px-3 py-3 text-right">
                  <DeltaBadge value={grandDelta} large />
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/estimator/${left.id}`}
          className="inline-flex items-center gap-1 text-sm text-stone-700 hover:text-stone-900"
        >
          {left.cover_emoji} Edit {left.name}
          <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          href={`/estimator/${right.id}`}
          className="inline-flex items-center gap-1 text-sm text-stone-700 hover:text-stone-900"
        >
          {right.cover_emoji} Edit {right.name}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function ScenarioSummary({
  scenario,
  total,
  side,
}: {
  scenario: CompareRow;
  total: number;
  side: "left" | "right";
}) {
  return (
    <Link
      href={`/estimator/${scenario.id}`}
      className={cn(
        "block rounded-xl border border-stone-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-sm",
        side === "left" ? "md:rounded-r-md" : "md:rounded-l-md",
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-xl">{scenario.cover_emoji ?? "💍"}</span>
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
            {side === "left" ? "Scenario A" : "Scenario B"}
          </div>
          <div className="font-serif text-base">{scenario.name}</div>
        </div>
      </div>
      <div className="mt-2 font-serif text-2xl font-medium tabular-nums">
        {formatEUR(total)}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {scenario.scenario_summary}
      </div>
    </Link>
  );
}

function SectionRows({ pair }: { pair: SectionPair }) {
  return (
    <>
      <tr className="border-t-2 border-stone-300 bg-stone-50">
        <td className="px-3 py-2.5">
          <div className="font-serif text-base">{pair.label}</div>
          {(pair.subtitleLeft || pair.subtitleRight) && (
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {pair.subtitleLeft === pair.subtitleRight
                ? pair.subtitleLeft
                : `${pair.subtitleLeft ?? "—"}  ·  ${pair.subtitleRight ?? "—"}`}
            </div>
          )}
        </td>
        <td className="px-3 py-2.5 text-right font-medium tabular-nums">
          {formatEUR(pair.leftTotal)}
        </td>
        <td className="px-3 py-2.5 text-right font-medium tabular-nums">
          {formatEUR(pair.rightTotal)}
        </td>
        <td className="px-3 py-2.5 text-right">
          <DeltaBadge value={pair.delta} />
        </td>
      </tr>
      {pair.pairs.map((lp, i) => (
        <tr key={`${pair.label}-${i}`} className="border-t border-stone-100">
          <td className="px-3 py-1.5 pl-7">
            <div className="text-stone-700">{lp.label}</div>
            <div className="text-[10px] text-muted-foreground">
              {lp.unitLabelLeft && lp.unitLabelRight && lp.unitLabelLeft !== lp.unitLabelRight
                ? `${lp.unitLabelLeft} → ${lp.unitLabelRight}`
                : lp.unitLabelLeft ?? lp.unitLabelRight ?? ""}
            </div>
          </td>
          <td
            className={cn(
              "px-3 py-1.5 text-right tabular-nums",
              lp.leftLine == null && "text-stone-300",
            )}
          >
            {lp.leftLine == null
              ? "—"
              : lp.leftLine.tbc
              ? "TBC"
              : !lp.leftLine.included
              ? "off"
              : formatEUR(lp.leftEur)}
          </td>
          <td
            className={cn(
              "px-3 py-1.5 text-right tabular-nums",
              lp.rightLine == null && "text-stone-300",
            )}
          >
            {lp.rightLine == null
              ? "—"
              : lp.rightLine.tbc
              ? "TBC"
              : !lp.rightLine.included
              ? "off"
              : formatEUR(lp.rightEur)}
          </td>
          <td className="px-3 py-1.5 text-right">
            <DeltaBadge value={lp.delta} small />
          </td>
        </tr>
      ))}
    </>
  );
}

function DeltaBadge({
  value,
  small,
  large,
}: {
  value: number;
  small?: boolean;
  large?: boolean;
}) {
  if (Math.abs(value) < 0.5) {
    return <span className="text-stone-300">—</span>;
  }
  const sign = value < 0 ? "−" : "+";
  return (
    <Badge
      variant={value < 0 ? "success" : "warning"}
      className={cn(
        "tabular-nums",
        small && "text-[9px] px-1.5 py-0",
        large && "text-sm",
      )}
    >
      {sign}
      {formatEUR(Math.abs(value))}
    </Badge>
  );
}
