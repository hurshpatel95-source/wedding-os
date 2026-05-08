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

const links: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: Sparkles },
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
  { href: "/spend", label: "Spend", icon: PieChart },
  { href: "/compare", label: "Compare", icon: Users },
  { href: "/timeline", label: "Timeline", icon: Clock },
  { href: "/settings/public-site", label: "Public site", icon: Globe },
  { href: "/settings/pricing", label: "Pricing template", icon: Settings },
];

export function Nav({
  userEmail,
  role: _role,
  workspaceName,
  weddingDate,
  plannerDisplayName,
  plannerLogoUrl,
  accentHex,
}: {
  userEmail: string | null;
  role: "admin" | "couple" | null;
  workspaceName?: string | null;
  weddingDate?: string | null;
  plannerDisplayName?: string | null;
  plannerLogoUrl?: string | null;
  accentHex?: string | null;
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
                background: accentHex
                  ? `linear-gradient(135deg, ${accentHex}, #d97706)`
                  : "linear-gradient(135deg, #fb7185, #d97706)",
              }}
            >
              <Heart className="h-4 w-4 text-white" fill="white" />
            </div>
          )}
          <div className="leading-none">
            <div className="font-serif text-lg font-medium tracking-tight">
              {workspaceName ?? "Hursh & Co."}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {[plannerDisplayName, ...subtitleParts].filter(Boolean).join(" · ") || "Wedding portal"}
            </div>
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
                    ? { background: accentHex ?? "#1c1917" }
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
              Days to wedding
            </div>
            <div className="mt-1 font-serif text-2xl font-medium leading-none">
              {daysUntil !== null && daysUntil >= 0 ? daysUntil : "TBD"}
            </div>
          </div>
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
                  ? { background: accentHex ?? "#1c1917" }
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
