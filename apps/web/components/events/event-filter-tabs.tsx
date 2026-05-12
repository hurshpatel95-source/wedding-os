"use client";

// Move 5 — Day 2. Shared event-filter tab strip used by /guests and
// /timeline. Picks up the current `?event=<role>` from the URL and
// renders an "All events" + per-event tab row. Clicking a tab patches
// the search params so the surrounding server component re-reads.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  EVENT_ROLE_LABEL,
  type EventRole,
} from "@/lib/event-types";

export interface EventFilterTab {
  role: EventRole;
  /** Optional count badge — used by /guests when we have per-event RSVPs. */
  count?: number | null;
  /** Optional sub-text under the label — e.g., "65 yes" on /guests. */
  sub?: string | null;
}

export function EventFilterTabs({
  tabs,
  ariaLabel = "Filter by event",
}: {
  tabs: EventFilterTab[];
  ariaLabel?: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const currentEvent = params.get("event");

  // Build href that preserves all other search params.
  const buildHref = (role: string | null): string => {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (role) {
      next.set("event", role);
    } else {
      next.delete("event");
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  if (tabs.length === 0) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className="flex items-center gap-1 overflow-x-auto rounded-full border border-stone-200 bg-white/60 p-1 backdrop-blur"
    >
      <TabLink
        href={buildHref(null)}
        active={!currentEvent}
        label="All events"
      />
      {tabs.map((t) => {
        const active = currentEvent === t.role;
        const main = EVENT_ROLE_LABEL[t.role];
        const subtext =
          t.sub ?? (typeof t.count === "number" ? String(t.count) : null);
        return (
          <TabLink
            key={t.role}
            href={buildHref(t.role)}
            active={active}
            label={main}
            sub={subtext}
          />
        );
      })}
    </nav>
  );
}

function TabLink({
  href,
  active,
  label,
  sub,
}: {
  href: string;
  active: boolean;
  label: string;
  sub?: string | null;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-stone-900 text-white shadow-sm"
          : "text-stone-600 hover:text-stone-900",
      )}
    >
      <span>{label}</span>
      {sub && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
            active
              ? "bg-white/15 text-white"
              : "bg-stone-100 text-stone-600",
          )}
        >
          {sub}
        </span>
      )}
    </Link>
  );
}
