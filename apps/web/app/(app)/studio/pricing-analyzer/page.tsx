// Studio — Photo → pricing tool page.
//
// Migrated from /visualize as part of Day 3. The legacy /visualize
// route now redirects here so old links still resolve.
//
// This tool calls the existing /api/visualize/photo-to-pricing
// multimodal Claude vision endpoint directly. Day 3.5 will fold that
// endpoint into the generic studio generate path.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { normalizeCurrency } from "@/lib/utils";
import { PricingAnalyzerStudio } from "@/components/studio/pricing-analyzer-studio";

export const dynamic = "force-dynamic";

export default async function PricingAnalyzerPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  const workspaceId = (profile as { workspace_id?: string | null } | null)
    ?.workspace_id;

  let baseCurrency: "USD" | "EUR" = "USD";
  let weddingRegion: string | null = null;
  if (workspaceId) {
    const sb = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: {
                base_currency: string | null;
                wedding_region: string | null;
              } | null;
            }>;
          };
        };
      };
    };
    const { data: ws } = await sb
      .from("workspaces")
      .select("base_currency, wedding_region")
      .eq("id", workspaceId)
      .maybeSingle();
    baseCurrency = normalizeCurrency(ws?.base_currency ?? null);
    weddingRegion = ws?.wedding_region ?? null;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/studio"
        className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-stone-500 hover:text-stone-900"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Studio
      </Link>

      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          AI Studio · Photo → pricing
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Photo → pricing
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Drop a photo of any wedding setup — flowers, cake, lounge, table
          setting, dress. We&apos;ll identify the elements and estimate
          local pricing for your wedding.
        </p>
      </header>

      <PricingAnalyzerStudio
        baseCurrency={baseCurrency}
        weddingRegion={weddingRegion}
      />
    </div>
  );
}
