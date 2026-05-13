// AI Studio — hub page.
//
// Renders the 10-tool grid + credits balance pill. Tools with status
// "live" are clickable Link cards; "coming_soon" tools are dimmed
// preview cards with a small badge.
//
// Pricing-analyzer is a special case: it's "live" in the registry but
// the actual tool still lives at /visualize until Day 3. We link the
// card there for now and leave a small TODO note in the page comment.

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  Cake,
  Camera,
  Clock,
  Flower2,
  Mail,
  Palette,
  Shirt,
  Sparkles,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  STUDIO_TOOL_ORDER,
  STUDIO_TOOLS,
} from "@/lib/studio/tool-registry";
import { getBalance } from "@/lib/studio/credits";
import { resolveWorkspaceMode, isB2B } from "@/lib/workspace-mode";
import { normalizeSkin } from "@/lib/workspace-skin";
import type { StudioTool } from "@/lib/studio/types";

export const dynamic = "force-dynamic";

// Lucide icon name → component. Kept narrow so we don't accidentally
// pull every icon. Adding a new tool? Add the icon mapping here.
const ICONS: Record<string, LucideIcon> = {
  Palette,
  Shirt,
  Building2,
  Flower2,
  Cake,
  Sparkles,
  Mail,
  // "Swatch" doesn't exist in lucide; use Palette as a fallback for
  // the color-palette tool. We surface "Wand2" for any unknown name.
  Swatch: Palette,
  Clock,
  Camera,
  Wand2,
};

function toolHref(tool: StudioTool): string {
  // Special case: pricing-analyzer lives at /visualize today.
  // Day 3 migrates it to /studio/pricing-analyzer.
  if (tool.slug === "pricing-analyzer") return "/visualize";
  return `/studio/${tool.slug}`;
}

export default async function StudioHubPage() {
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

  if (!workspaceId) {
    redirect("/onboarding");
  }

  // Workspace mode — drives the credits pill copy (B2C top-up vs B2B
  // tier label).
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

  const tools = STUDIO_TOOL_ORDER.map((slug) => STUDIO_TOOLS[slug]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            AI Studio · beta
          </div>
          <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
            Studio
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Skip the Pinterest rabbit hole. Tell us what you want to see —
            we&apos;ll ask the right wedding-planner questions and generate it
            tuned to your venue, season, and palette.
          </p>
        </div>

        {/* Credits pill */}
        <div className="shrink-0">
          {isB2B(mode) ? (
            <div className="rounded-full border border-stone-200 bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.18em] text-stone-700">
              Planner tier · unlimited preview
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-full border border-stone-200 bg-white/80 px-4 py-2">
              <span className="text-sm font-medium text-stone-900">
                {balance} credits
              </span>
              <span className="text-stone-300">·</span>
              <Link
                href="/studio#topup"
                className="text-xs uppercase tracking-[0.18em] text-stone-500 hover:text-stone-900"
              >
                Top up
              </Link>
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => {
          const Icon = ICONS[tool.icon] ?? Wand2;
          const isLive = tool.status === "live";
          const href = toolHref(tool);

          const card = (
            <div
              className={`group flex h-full flex-col gap-3 rounded-3xl border bg-white/70 p-5 transition-all ${
                isLive
                  ? "border-stone-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md"
                  : "border-stone-200/60 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 to-amber-100 text-stone-800">
                  <Icon className="h-5 w-5" />
                </div>
                {isLive ? (
                  <span className="rounded-full bg-stone-900 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white">
                    {tool.cost_credits} cr
                  </span>
                ) : (
                  <span className="rounded-full border border-stone-300 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-stone-500">
                    Coming soon
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <h3 className="font-serif text-lg font-medium tracking-tight text-stone-900">
                  {tool.label}
                </h3>
                <p className="text-sm text-stone-600">{tool.description}</p>
              </div>
            </div>
          );

          if (isLive) {
            return (
              <Link key={tool.slug} href={href} className="block">
                {card}
              </Link>
            );
          }
          return (
            <div
              key={tool.slug}
              aria-disabled="true"
              className="cursor-not-allowed"
            >
              {card}
            </div>
          );
        })}
      </div>

      <footer className="border-t border-stone-200 pt-6 text-xs text-stone-500">
        Gallery of past generations coming soon. Until then, save the
        downloads from each tool yourself.
      </footer>
    </div>
  );
}
