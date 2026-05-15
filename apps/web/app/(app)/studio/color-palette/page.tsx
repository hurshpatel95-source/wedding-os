// Studio — Color palette explorer tool page.
//
// Special tool: returns ONE composite image (palette swatches + applied-
// use thumbnails) instead of 4 variants. Default variant count: 1.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getBalance } from "@/lib/studio/credits";
import { STUDIO_TOOLS } from "@/lib/studio/tool-registry";
import { resolveWorkspaceMode, isB2B } from "@/lib/workspace-mode";
import { normalizeSkin } from "@/lib/workspace-skin";
import { ColorPaletteStudio } from "@/components/studio/color-palette-studio";

export const dynamic = "force-dynamic";

export default async function ColorPalettePage() {
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
  if (!workspaceId) redirect("/onboarding");

  let mode: ReturnType<typeof resolveWorkspaceMode> = "b2c";
  try {
    const sb = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: { skin?: string | null } | null;
            }>;
          };
        };
      };
    };
    const { data: ws } = await sb
      .from("workspaces")
      .select("skin")
      .eq("id", workspaceId)
      .maybeSingle();
    mode = resolveWorkspaceMode(normalizeSkin(ws?.skin ?? null));
  } catch {
    mode = "b2c";
  }

  const balance = await getBalance(workspaceId);
  const tool = STUDIO_TOOLS["color-palette"];

  return (
    <div className="space-y-6">
      <Link
        href="/studio"
        className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-stone-500 hover:text-stone-900"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Studio
      </Link>

      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            AI Studio · Color palette
          </div>
          <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
            Color palette
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Drop an inspiration photo or describe a vibe — get a refined
            wedding palette plus how to use it across florals, attire,
            paper, and decor.
          </p>
        </div>

        <div className="shrink-0">
          {isB2B(mode) ? (
            <div className="rounded-full border border-stone-200 bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.18em] text-stone-700">
              Planner tier · unlimited preview
            </div>
          ) : (
            <div className="rounded-full border border-stone-200 bg-white/80 px-4 py-2 text-sm font-medium text-stone-900">
              {balance} credits
            </div>
          )}
        </div>
      </header>

      <ColorPaletteStudio
        initialBalance={balance}
        costCredits={tool.cost_credits}
        isB2B={isB2B(mode)}
      />
    </div>
  );
}
