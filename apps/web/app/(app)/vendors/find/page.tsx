import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { VendorSearchForm } from "@/components/vendor-search/vendor-search-form";
import { isFeatureReady } from "@/lib/feature-flags";
import { FeaturePreviewCard } from "@/components/feature-status/feature-preview-card";

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
    }
  }

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

      {isFeatureReady("google_places") || isFeatureReady("brave_search") ? (
        <VendorSearchForm defaultRegion={defaultRegion} />
      ) : (
        <FeaturePreviewCard feature="google_places" />
      )}
    </div>
  );
}
