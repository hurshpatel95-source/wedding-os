import Link from "next/link";
import { CalendarClock, Printer, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TimelineEditor } from "@/components/timeline/timeline-editor";
import {
  EventFilterTabs,
  type EventFilterTab,
} from "@/components/events/event-filter-tabs";
import { fetchEventDetails } from "@/lib/data/events";
import {
  EVENT_ROLE_LABEL,
  EVENT_ROLE_ORDER,
  isEventRole,
  type EventRole,
} from "@/lib/event-types";
import type { Database } from "@wedding-os/db";

export const dynamic = "force-dynamic";

type TimelineItem = Database["public"]["Tables"]["timeline_items"]["Row"];

export default async function TimelinePage({
  searchParams,
}: {
  searchParams?: { event?: string };
}) {
  const supabase = createClient();

  const [{ data: items }, { data: { user } }, { data: workspace }] = await Promise.all([
    supabase
      .from("timeline_items")
      .select(
        "id, workspace_id, org_id, event_role, occurs_at, duration_minutes, what, who_responsible, location, vendor_id, notes, sort_order, created_by, created_at, updated_at",
      )
      .order("event_role", { ascending: true })
      .order("occurs_at", { ascending: true, nullsFirst: false })
      .order("sort_order", { ascending: true }),
    supabase.auth.getUser(),
    supabase
      .from("workspaces")
      .select("id, org_id, name, wedding_date")
      .limit(1)
      .maybeSingle(),
  ]);

  let role: "admin" | "couple" | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = (profile?.role ?? null) as typeof role;
  }

  const itemsListAll = (items ?? []) as TimelineItem[];
  const hasWeddingDate = !!workspace?.wedding_date;

  // ── Per-event filter (Move 5 Day 2) ────────────────────────────────
  const rawEvent = searchParams?.event;
  const eventFilter: EventRole | null =
    rawEvent && isEventRole(rawEvent) ? rawEvent : null;
  const itemsList = eventFilter
    ? itemsListAll.filter((it) => it.event_role === eventFilter)
    : itemsListAll;

  // Build tab roles: prefer active event_details when the table exists;
  // otherwise derive from roles already present on timeline_items.
  const rolesInTimeline = new Set<EventRole>();
  const itemCountByRole = new Map<EventRole, number>();
  for (const it of itemsListAll) {
    if (isEventRole(it.event_role)) {
      rolesInTimeline.add(it.event_role);
      itemCountByRole.set(
        it.event_role,
        (itemCountByRole.get(it.event_role) ?? 0) + 1,
      );
    }
  }

  let tabRoles: EventRole[] = [];
  try {
    if (workspace?.id) {
      const details = await fetchEventDetails(supabase, workspace.id);
      if (details.length > 0) {
        tabRoles = details
          .filter((d) => d.is_active)
          .sort((a, b) => {
            if (a.sort_order !== b.sort_order) {
              return a.sort_order - b.sort_order;
            }
            return (
              EVENT_ROLE_ORDER.indexOf(a.event_role) -
              EVENT_ROLE_ORDER.indexOf(b.event_role)
            );
          })
          .map((d) => d.event_role);
      }
    }
  } catch {
    tabRoles = [];
  }
  if (tabRoles.length === 0) {
    tabRoles = EVENT_ROLE_ORDER.filter((r) => rolesInTimeline.has(r));
  }

  const eventTabs: EventFilterTab[] = tabRoles.map((role) => ({
    role,
    sub:
      itemCountByRole.get(role) && itemCountByRole.get(role)! > 0
        ? `${itemCountByRole.get(role)}`
        : null,
  }));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Day-of timeline · per event · printable for vendors
          </div>
          <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
            Run of show
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {itemsListAll.length === 0
              ? "Build your minute-by-minute day-of schedule. Group items by ceremony, cocktails, reception, and after-party so vendors know exactly when they're up."
              : `${itemsListAll.length} item${itemsListAll.length === 1 ? "" : "s"} on the run-of-show. Add more, reorder, and print a copy for every vendor.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/timeline/day-of">
              <Smartphone className="h-4 w-4" />
              Day-of view
            </Link>
          </Button>
          {role === "admin" && (
            <Button asChild variant="outline">
              <Link href="/timeline/print" target="_blank" rel="noopener noreferrer">
                <Printer className="h-4 w-4" />
                Print PDF
              </Link>
            </Button>
          )}
        </div>
      </header>

      {eventTabs.length > 0 && (
        <EventFilterTabs
          tabs={eventTabs}
          ariaLabel="Filter run of show by event"
        />
      )}

      {/*
        Audit #32: previously the EmptyState + TimelineEditor both rendered when
        the timeline was empty AND no wedding date was set. Now we render one or
        the other so the "Set your wedding date first" CTA stands alone.
      */}
      {itemsListAll.length === 0 && !hasWeddingDate ? (
        <EmptyState
          icon={CalendarClock}
          title="Set your wedding date first"
          description="The run-of-show is anchored to your wedding date. Add it in onboarding (or settings) and we'll suggest a starter timeline you can edit minute-by-minute."
          primary={{ label: "Open onboarding", href: "/onboarding" }}
          secondary={{ label: "Workspace settings", href: "/settings/preferences" }}
        />
      ) : eventFilter && itemsList.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-stone-300 bg-white/50 px-6 py-12 text-center">
          <p className="font-serif text-xl text-stone-700">
            No timeline items for {EVENT_ROLE_LABEL[eventFilter]} yet
          </p>
          <p className="mt-2 text-sm text-stone-500">
            Pick another event tab, or add an item below tagged with this event.
          </p>
          <div className="mt-6">
            <TimelineEditor
              items={itemsList}
              role={role}
              workspaceId={workspace?.id ?? null}
              orgId={workspace?.org_id ?? null}
            />
          </div>
        </section>
      ) : (
        <TimelineEditor
          items={itemsList}
          role={role}
          workspaceId={workspace?.id ?? null}
          orgId={workspace?.org_id ?? null}
        />
      )}
    </div>
  );
}
