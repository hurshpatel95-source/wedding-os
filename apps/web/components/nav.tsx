"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  Briefcase,
  Calculator,
  Calendar,
  CheckSquare,
  Clock,
  Coins,
  Compass,
  ListChecks,
  Globe,
  Heart,
  LogOut,
  MapPin,
  PieChart,
  Plane,
  Receipt,
  Settings,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { AlertsBell } from "@/components/alerts/alerts-bell";
import type { BrandPreset } from "@/lib/workspace-skin";

const links: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: Sparkles },
  { href: "/onboarding", label: "Setup chat", icon: ListChecks },
  { href: "/autopilot", label: "Autopilot", icon: Plane },
  { href: "/assistant", label: "Co-pilot", icon: Bot },
  { href: "/plan", label: "Plan", icon: CheckSquare },
  { href: "/venues", label: "Venues", icon: MapPin },
  { href: "/map", label: "Map", icon: Globe },
  { href: "/availability", label: "Availability", icon: Calendar },
  { href: "/vendors", label: "Vendors", icon: Briefcase },
  { href: "/guests", label: "Guests", icon: UserCheck },
  { href: "/budget", label: "Budget", icon: Coins },
  { href: "/estimator", label: "Estimator", icon: Receipt },
  { href: "/pricing", label: "Full pricing", icon: Calculator },
  { href: "/payments", label: "Payments", icon: Wallet },
  { href: "/compare", label: "Compare venues", icon: Users },
  { href: "/timeline", label: "Timeline", icon: Clock },
  { href: "/settings/public-site", label: "Public site", icon: Globe },
  { href: "/settings/preferences", label: "Settings", icon: Settings },
  { href: "/feature-status", label: "Tour", icon: Compass },
];

export function Nav({
  userEmail,
  role: _role,
  workspaceName,
  weddingDate,
  plannerDisplayName,
  plannerLogoUrl,
  accentHex,
  brand,
  brandSubtitleFallback,
}: {
  userEmail: string | null;
  role: "admin" | "couple" | null;
  workspaceName?: string | null;
  weddingDate?: string | null;
  plannerDisplayName?: string | null;
  plannerLogoUrl?: string | null;
  accentHex?: string | null;
  brand?: BrandPreset;
  /** Fallback subtitle when skin is co_branded/white_label but the
   *  planner's display name hasn't been set yet — usually the workspace
   *  name so the eyebrow line doesn't look empty. */
  brandSubtitleFallback?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const daysUntil = weddingDate
    ? differenceInCalendarDays(parseISO(weddingDate), new Date())
    : null;

  const subtitleParts: string[] = [];
  if (weddingDate) {
    try {
      const d = parseISO(weddingDate);
      subtitleParts.push(
        d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      );
    } catch {
      // ignore
    }
  }

  // Title shown in the nav header. When a brand preset is supplied (post-
  // skin migration), the brand's displayName wins over the legacy
  // workspaceName fallback. workspaceName ("Kyle & Michelle — Newport") is
  // still useful as a sub-line, but the brand identity should lead.
  const headerTitle =
    brand?.displayName ?? workspaceName ?? "Your wedding";

  // Eyebrow line under the header title. Priority order:
  //   1. brandSubtitleFallback (set when co_branded but no planner name yet)
  //   2. brand.tagline (e.g. "Your wedding, acquired.")
  //   3. legacy planner-name + wedding-date join
  //   4. literal "Wedding portal"
  let headerSubtitle: string;
  if (brandSubtitleFallback) {
    headerSubtitle = brandSubtitleFallback;
  } else if (brand?.tagline) {
    headerSubtitle = brand.tagline;
  } else {
    headerSubtitle =
      [plannerDisplayName, ...subtitleParts].filter(Boolean).join(" · ") ||
      "Wedding portal";
  }

  // Active-pill background. Prefer the CSS variable so the layout's
  // wrapper can theme everything from one place; fall back to the
  // accentHex prop for backward compat with code paths that haven't been
  // updated yet.
  const accentBg = "var(--brand-accent)";

  return (
    <header className="sticky top-0 z-40 border-b border-stone-300/40 bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-6">
        {/* Left: logo + workspace title */}
        <Link href="/" className="flex items-center gap-3">
          {plannerLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={plannerLogoUrl}
              alt={plannerDisplayName ?? "Planner logo"}
              className="h-9 w-9 rounded-full object-cover shadow-sm"
            />
          ) : (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full shadow-sm"
              style={{
                // Use the resolved brand accent first; fall back to the
                // legacy accentHex prop, then a hardcoded rose so we
                // never render a transparent circle.
                background: `linear-gradient(135deg, ${
                  brand?.accentHex ?? accentHex ?? "#fb7185"
                }, #d97706)`,
              }}
            >
              <Heart className="h-4 w-4 text-white" fill="white" />
            </div>
          )}
          <div className="leading-none">
            <div className="font-serif text-lg font-medium tracking-tight">
              {headerTitle}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {headerSubtitle}
            </div>
            {brand?.showPoweredBy && (
              <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-stone-500">
                Powered by Acquired Planner
              </div>
            )}
          </div>
        </Link>

        {/* Center: pill tabs */}
        <nav className="hidden items-center gap-1 rounded-full border border-stone-200 bg-white/60 p-1 backdrop-blur md:flex">
          {links.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "text-white shadow-sm"
                    : "text-stone-600 hover:text-stone-900",
                )}
                style={
                  active
                    ? { background: accentBg }
                    : undefined
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: countdown + sign out */}
        <div className="flex items-center gap-4">
          <div className="text-right leading-none">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {daysUntil === 0
                ? "Today's the day"
                : daysUntil !== null && daysUntil < 0
                  ? "Days since wedding"
                  : "Days to wedding"}
            </div>
            <div className="mt-1 font-serif text-2xl font-medium leading-none">
              {daysUntil === null
                ? "TBD"
                : daysUntil === 0
                  ? "♡"
                  : daysUntil > 0
                    ? daysUntil
                    : Math.abs(daysUntil)}
            </div>
          </div>
          <AlertsBell />
          {userEmail && (
            <button
              type="button"
              onClick={handleSignOut}
              title={`Sign out ${userEmail}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white/60 text-stone-500 transition hover:bg-white hover:text-stone-900"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sign out</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile pill row */}
      <nav className="container flex items-center gap-1 overflow-x-auto pb-3 md:hidden">
        {links.map((l) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "text-white"
                  : "border border-stone-200 bg-white/60 text-stone-600",
              )}
              style={
                active
                  ? { background: accentBg }
                  : undefined
              }
            >
              <Icon className="h-3 w-3" />
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
