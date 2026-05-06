import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NewEstimateForm } from "@/components/estimator/new-estimate-form";

export const dynamic = "force-dynamic";

interface VenueOption {
  id: string;
  name: string;
  is_lead_pick: boolean;
}

interface TemplateOption {
  id: string;
  name: string;
  scenario_summary: string | null;
  cover_emoji: string | null;
  baseline_total_eur: number | null;
}

export default async function NewEstimatePage() {
  const supabase = createClient();

  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, is_lead_pick")
    .order("is_lead_pick", { ascending: false })
    .order("name", { ascending: true });

  const { data: templates } = (await supabase
    .from("budget_estimates")
    .select("id, name, scenario_summary, cover_emoji, baseline_total_eur")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })) as unknown as {
    data: TemplateOption[] | null;
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
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          New scenario
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
          Build a custom estimate
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Pick dates, venues, and a baseline template. We&rsquo;ll auto-fill
          the line items from Astia&rsquo;s pricing PDFs (with the venue&rsquo;s
          actual day-of-week hire fee where we have it). You can edit any line
          afterward.
        </p>
      </header>

      <NewEstimateForm
        venues={(venues ?? []) as VenueOption[]}
        templates={templates ?? []}
      />
    </div>
  );
}
