"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Briefcase,
  Calculator,
  Calendar,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Clock,
  Coins,
  Globe,
  Heart,
  LogOut,
  MapPin,
  Plane,
  Receipt,
  Settings,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
  Wand2,
} from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { AlertsBell } from "@/components/alerts/alerts-bell";
import type { BrandPreset } from "@/lib/workspace-skin";

type NavLink = { href: string; label: string; icon: LucideIcon };

// Phase 1.2 — primary nav is trimmed to 8 items. Secondary items live
// behind the "More" dropdown so the strip is usable on mobile and the
// shell feels focused on couple workflows that matter day-to-day.
const primaryLinks: NavLink[] = [
  { href: "/", label: "Dashboard", icon: Sparkles },
  { href: "/plan", label: "Plan", icon: CheckSquare },
  { href: "/venues", label: "Venues", icon: MapPin },
  { href: "/vendors", label: "Vendors", icon: Briefcase },
  { href: "/guests", label: "Guests", icon: UserCheck },
  { href: "/budget", label: "Budget", icon: Coins },
  { href: "/payments", label: "Payments", icon: Wallet },
  { href: "/settings/public-site", label: "Public site", icon: Globe },
];

// Secondary items — accessible via the "More" dropdown. /feature-status
// is intentionally omitted; the page still exists at the URL but is
// admin-only.
//
// Move 5 — /events added at the top as the new multi-event entry point.
// /timeline remains directly reachable (per-event drill-down via
// /timeline?event=<role>) so existing bookmarks + the per-event "View
// timeline" buttons on /events keep working.
const moreLinks: NavLink[] = [
  // AI Studio — the wedding-domain prompt-optimizer hub (mood board,
  // venue mockup, dress-on-me, etc.). Replaces /visualize in the nav;
  // /visualize remains reachable until Day 3 migration folds the
  // pricing-analyzer card into the studio.
  { href: "/studio", label: "Studio", icon: Wand2 },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/map", label: "Map", icon: Globe },
  { href: "/availability", label: "Availability", icon: Calendar },
  { href: "/compare", label: "Compare", icon: Users },
  { href: "/estimator", label: "Estimator", icon: Receipt },
  { href: "/pricing", label: "Pricing", icon: Calculator },
  { href: "/timeline", label: "Timeline", icon: Clock },
  { href: "/assistant", label: "Co-pilot", icon: Bot },
  { href: "/autopilot", label: "Autopilot", icon: Plane },
  { href: "/settings", label: "Settings", icon: Settings },
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
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  // Close the More dropdown on outside click or Escape. Keeps the
  // overlay from getting stuck open when the user clicks somewhere
  // else in the shell.
  useEffect(() => {
    if (!moreOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!moreRef.current) return;
      if (!moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  // Close the dropdown whenever the route actually changes — covers
  // clicks on items inside the panel.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

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

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // The More pill should show as active whenever any secondary route is
  // mounted, so the user has a hint about where they are.
  const moreActive = moreLinks.some((l) => isActive(l.href));

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

        {/* Center: pill tabs (desktop) */}
        <nav className="hidden items-center gap-1 rounded-full border border-stone-200 bg-white/60 p-1 backdrop-blur md:flex">
          {primaryLinks.map((l) => {
            const active = isActive(l.href);
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
                style={active ? { background: accentBg } : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                {l.label}
              </Link>
            );
          })}

          {/* More dropdown */}
          <div ref={moreRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                moreActive
                  ? "text-white shadow-sm"
                  : "text-stone-600 hover:text-stone-900",
              )}
              style={moreActive ? { background: accentBg } : undefined}
            >
              More
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  moreOpen && "rotate-180",
                )}
              />
            </button>
            {moreOpen && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white py-1 shadow-lg"
              >
                {moreLinks.map((l) => {
                  const active = isActive(l.href);
                  const Icon = l.icon;
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      role="menuitem"
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-stone-100 font-medium text-stone-900"
                          : "text-stone-700 hover:bg-stone-50 hover:text-stone-900",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 text-stone-500" />
                      {l.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
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

      {/* Mobile pill row — 8 primaries + More. We keep overflow-x-auto as
          a fallback for very narrow viewports; with 8 + 1 pills most
          phones (375px+) won't need it. */}
      <nav className="container flex items-center gap-1 overflow-x-auto pb-3 md:hidden">
        {primaryLinks.map((l) => {
          const active = isActive(l.href);
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
              style={active ? { background: accentBg } : undefined}
            >
              <Icon className="h-3 w-3" />
              {l.label}
            </Link>
          );
        })}

        {/* Mobile "More" pill — opens the same dropdown panel anchored
            beneath the strip. */}
        <div className="relative shrink-0">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              moreActive
                ? "text-white"
                : "border border-stone-200 bg-white/60 text-stone-600",
            )}
            style={moreActive ? { background: accentBg } : undefined}
          >
            More
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                moreOpen && "rotate-180",
              )}
            />
          </button>
          {moreOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-52 overflow-hidden rounded-2xl border border-stone-200 bg-white py-1 shadow-lg"
            >
              {moreLinks.map((l) => {
                const active = isActive(l.href);
                const Icon = l.icon;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-3.5 py-2 text-xs transition-colors",
                      active
                        ? "bg-stone-100 font-medium text-stone-900"
                        : "text-stone-700 hover:bg-stone-50 hover:text-stone-900",
                    )}
                  >
                    <Icon className="h-3 w-3 text-stone-500" />
                    {l.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
