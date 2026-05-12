import Link from "next/link";
import { ArrowLeft, ArrowRight, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { VendorSearchForm } from "@/components/vendor-search/vendor-search-form";
import { isFeatureReady } from "@/lib/feature-flags";
import { Card, CardContent } from "@/components/ui/card";
import { normalizeSkin } from "@/lib/workspace-skin";
import { resolveWorkspaceMode, isPlannerServed } from "@/lib/workspace-mode";

export const dynamic = "force-dynamic";

interface WorkspaceWaveRow {
  id: string;
  wedding_region: string | null;
  guest_count_estimate: number | null;
}

export default async function VendorFindPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let defaultRegion: string | null = null;
  let plannerServed = false;

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("workspace_id")
      .eq("id", user.id)
      .maybeSingle();
    const workspaceId = (profile as { workspace_id?: string | null } | null)
      ?.workspace_id;
    if (workspaceId) {
      // Cast — wedding_region + guest_count_estimate were added in the
      // wave3 migration and may not be in generated types yet.
      const sb = supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (col: string, val: string) => {
              maybeSingle: () => Promise<{
                data: WorkspaceWaveRow | null;
              }>;
            };
          };
        };
      };
      const { data: ws } = await sb
        .from("workspaces")
        .select("id, wedding_region, guest_count_estimate")
        .eq("id", workspaceId)
        .maybeSingle();
      defaultRegion = ws?.wedding_region ?? null;

      // Also read the skin to fork the gated fallback CTA — planner-served
      // couples should be pointed at their planner, B2C couples at the
      // manual-add page on /vendors.
      const sbSkin = supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (col: string, val: string) => {
              maybeSingle: () => Promise<{
                data: { skin: string | null } | null;
              }>;
            };
          };
        };
      };
      const { data: skinRow } = await sbSkin
        .from("workspaces")
        .select("skin")
        .eq("id", workspaceId)
        .maybeSingle();
      const mode = resolveWorkspaceMode(normalizeSkin(skinRow?.skin ?? null));
      plannerServed = isPlannerServed(mode);
    }
  }

  const searchReady =
    isFeatureReady("google_places") || isFeatureReady("brave_search");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/vendors"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-stone-900"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to vendors
        </Link>
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Discover
          </div>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Find vendors
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Pick a category and a region. We&apos;ll search the web, show
            you the top matches with ratings and photos, and add the ones you
            check to your vendor list — autopilot will start researching them
            for you.
          </p>
        </div>
      </header>

      {searchReady ? (
        <VendorSearchForm defaultRegion={defaultRegion} />
      ) : (
        <Card className="border-stone-200 bg-stone-50/60">
          <CardContent className="space-y-4 py-6">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                <Search className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-lg font-medium tracking-tight text-stone-900">
                  Vendor search isn&rsquo;t turned on yet
                </h3>
                <p className="mt-1 text-sm text-stone-700">
                  Vendor search uses web search APIs which aren&rsquo;t
                  enabled in this environment yet. You can still add vendors
                  by hand — autopilot will research each one you add.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-12">
              <Link
                href="/vendors"
                className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add a vendor manually
              </Link>
              {plannerServed && (
                <Link
                  href="/assistant"
                  className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition hover:border-stone-900"
                >
                  Ask your planner
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
