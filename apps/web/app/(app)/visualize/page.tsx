// Move 2 — Photo → Pricing. The magical multimodal AI feature.
//
// Couple drops an inspiration photo (floral arch, lounge setup, cake)
// → Sonnet vision identifies the elements + estimates a local price
// range in workspace currency → links to /vendors/find pre-filtered
// by the suggested category. Stateless — no DB writes.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeCurrency } from "@/lib/utils";
import { VisualizeStudio } from "@/components/visualize/visualize-studio";

export const dynamic = "force-dynamic";

export default async function VisualizePage() {
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
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          AI vision · price estimator
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Visualize
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Drop a photo of any wedding setup — flowers, cake, lounge, table
          setting, dress. We&apos;ll identify the elements and estimate
          local pricing for your wedding.
        </p>
      </header>

      <VisualizeStudio
        baseCurrency={baseCurrency}
        weddingRegion={weddingRegion}
      />
    </div>
  );
}
