import Link from "next/link";
import { ArrowRight, Columns, FileText, Plus, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  documentBaseline,
  documentOverrideDelta,
  documentTotal,
  formatEUR,
  type EstimateDocument,
  type BudgetEstimateRow,
} from "@/lib/estimator-types";

export const dynamic = "force-dynamic";

type EstimateRow = Pick<
  BudgetEstimateRow,
  | "id"
  | "name"
  | "source_label"
  | "scenario_summary"
  | "cover_emoji"
  | "guest_count"
  | "start_date"
  | "end_date"
  | "sections"
  | "baseline_total_eur"
  | "sort_order"
>;

export default async function EstimatorPage() {
  const supabase = createClient();

  const { data: estimates } = await supabase
    .from("budget_estimates")
    .select(
      "id, name, source_label, scenario_summary, cover_emoji, guest_count, start_date, end_date, sections, baseline_total_eur, sort_order",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const list: EstimateRow[] = (estimates as EstimateRow[] | null) ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Honest budget · planner-seeded · couple-edited
          </div>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Estimator
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Estimated initial budgets for your scenarios. Toggle anything off,
            override any number — your edits stay here, they don&apos;t touch
            the master pricing template.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {list.length >= 2 && (
            <Link
              href="/estimator/compare"
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition hover:border-stone-900 hover:shadow-sm"
            >
              <Columns className="h-4 w-4" />
              Compare
            </Link>
          )}
          <Link
            href="/estimator/new"
            className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
          >
            <Plus className="h-4 w-4" />
            New estimate
          </Link>
        </div>
      </header>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <p>No estimates yet.</p>
            <p className="mt-2 text-xs">
              Try{" "}
              <Link
                href="/budget"
                className="font-medium text-stone-700 underline"
              >
                /budget
              </Link>{" "}
              for a personalized AI-generated budget tree, or hit{" "}
              <Link
                href="/estimator/new"
                className="font-medium text-stone-700 underline"
              >
                + New estimate
              </Link>{" "}
              above to start a scenario.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((est) => {
            const doc = (est.sections ?? { version: 1, sections: [] }) as EstimateDocument;
            const total = documentTotal(doc);
            const baseline = documentBaseline(doc);
            const delta = documentOverrideDelta(doc);
            const printedBaseline = est.baseline_total_eur ?? baseline;

            return (
              <Link
                key={est.id}
                href={`/estimator/${est.id}`}
                className="group block"
              >
                <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="space-y-4 py-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-50 via-white to-amber-50 text-2xl">
                          {est.cover_emoji ?? "💍"}
                        </div>
                        <div>
                          <h3 className="font-serif text-2xl">{est.name}</h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {est.scenario_summary}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 shrink-0 text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-stone-700" />
                    </div>

                    <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
                      <div className="flex items-baseline justify-between">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                          Effective total
                        </div>
                        <div className="font-serif text-3xl font-medium tracking-tight">
                          {formatEUR(total)}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                        <span className="text-muted-foreground">
                          baseline {formatEUR(printedBaseline)}
                        </span>
                        {Math.abs(delta) > 0.5 && (
                          <Badge
                            variant={delta < 0 ? "success" : "warning"}
                            className="text-[10px]"
                          >
                            {delta < 0 ? "−" : "+"}
                            {formatEUR(Math.abs(delta))} your edits
                          </Badge>
                        )}
                        {est.guest_count && (
                          <span className="text-muted-foreground">
                            ·{" "}
                            {Math.round(total / est.guest_count).toLocaleString()}{" "}
                            <span className="text-[10px] uppercase">€/guest</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                      <FileText className="h-3 w-3" />
                      <span>{est.source_label}</span>
                      <span>·</span>
                      <span>
                        {doc.sections.length} sections,{" "}
                        {doc.sections.reduce((a, s) => a + s.lines.length, 0)} lines
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Card className="border-rose-200 bg-gradient-to-br from-rose-50 via-white to-amber-50">
        <CardContent className="flex flex-wrap items-start gap-4 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-serif text-lg">How the Estimator works</h3>
              <Badge variant="muted" className="text-[10px]">
                Local-only
              </Badge>
            </div>
            <ul className="mt-1 space-y-1 text-sm text-stone-700">
              <li>
                <span className="font-medium">Baseline</span>: the original
                quoted price stays locked + visible as a reference.
              </li>
              <li>
                <span className="font-medium">Override</span>: click any number
                to edit. Your edit stacks on top of the baseline.
              </li>
              <li>
                <span className="font-medium">Toggle</span>: uncheck a line to
                exclude it from your total without losing the data.
              </li>
              <li>
                <span className="font-medium">Local-only</span>: changes here
                don&apos;t touch the master pricing template or your /pricing
                scenarios.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
