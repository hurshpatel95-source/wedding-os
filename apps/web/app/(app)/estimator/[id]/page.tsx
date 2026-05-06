import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EstimateBuilder } from "@/components/estimator/estimate-builder";
import type { BudgetEstimateRow, EstimateDocument } from "@/lib/estimator-types";

export const dynamic = "force-dynamic";

export default async function EstimateDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: est } = await supabase
    .from("budget_estimates")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!est) notFound();

  const row = est as unknown as BudgetEstimateRow;
  const doc =
    (row.sections as unknown as EstimateDocument | null) ?? {
      version: 1,
      sections: [],
    };

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
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-50 via-white to-amber-50 text-2xl">
            {row.cover_emoji ?? "💍"}
          </div>
          <div>
            <h1 className="font-serif text-3xl font-light tracking-tight md:text-4xl">
              {row.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {row.scenario_summary}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-stone-500">
              Source · {row.source_label}
            </p>
          </div>
        </div>
      </header>

      <EstimateBuilder
        id={row.id}
        initialDoc={doc}
        baselineTotal={row.baseline_total_eur ?? null}
        guestCount={row.guest_count ?? null}
      />
    </div>
  );
}
