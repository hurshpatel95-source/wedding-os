"use client";

// MoneyTabs — shared tab strip mounted at the top of /budget, /estimator,
// and /spend. The three pages have distinct routes + distinct data
// fetches, but the user reads them as one surface with three lenses on
// the same wedding money. Shipped as Phase 1.1 (collapse money pages) —
// keeps the existing routes intact, so smoke tests and bookmarks stay
// stable, but unifies the visual + navigational story.
//
// /payments is NOT in this strip — it's a calendar (different job, a
// different "when" question rather than the "how much" question the
// three lenses answer).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, LineChart, Receipt } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MoneyTab = {
  href: string;
  label: string;
  icon: LucideIcon;
  blurb: string;
};

// Tab order = mental order: decide → forecast → reconcile.
const tabs: MoneyTab[] = [
  {
    href: "/budget",
    label: "Plan",
    icon: Coins,
    blurb: "Your plan — the numbers you decide",
  },
  {
    href: "/estimator",
    label: "Forecast",
    icon: LineChart,
    blurb: "Live forecast — what it might cost as vendors land",
  },
  {
    href: "/spend",
    label: "Actuals",
    icon: Receipt,
    blurb: "What's been spent vs your plan",
  },
];

export function MoneyTabs() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="space-y-2">
      <nav
        aria-label="Money views"
        className="flex items-center gap-1 overflow-x-auto rounded-full border border-stone-200 bg-white/60 p-1 backdrop-blur"
      >
        {tabs.map((t) => {
          const active = isActive(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-stone-900 text-white shadow-sm"
                  : "text-stone-600 hover:text-stone-900",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </Link>
          );
        })}
      </nav>
      <p className="px-1 text-[11px] text-stone-500">
        These three views are different lenses on the same money — pick the
        one that matches your question.
      </p>
    </div>
  );
}
