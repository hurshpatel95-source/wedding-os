"use client";

// Move 5 — Day 2. /budget grouping toggle.
//
// Switches the budget tree's top-level grouping between BudgetCategory
// (the existing tree shape) and EventRole (event-anchored groups).
// Pure URL state — clicking a tab navigates to ?group=category or
// ?group=event so the server component re-reads and re-sorts the data.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function BudgetGroupToggle({ active }: { active: "category" | "event" }) {
  const pathname = usePathname();
  const params = useSearchParams();

  const buildHref = (mode: "category" | "event"): string => {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (mode === "category") {
      next.delete("group");
    } else {
      next.set("group", mode);
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div className="flex items-center gap-2 text-xs text-stone-600">
      <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
        Group by
      </span>
      <nav className="flex items-center gap-1 rounded-full border border-stone-200 bg-white/60 p-1 backdrop-blur">
        <TabLink
          href={buildHref("category")}
          active={active === "category"}
          label="Category"
        />
        <TabLink
          href={buildHref("event")}
          active={active === "event"}
          label="Event"
        />
      </nav>
    </div>
  );
}

function TabLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-stone-900 text-white shadow-sm"
          : "text-stone-600 hover:text-stone-900",
      )}
    >
      {label}
    </Link>
  );
}
