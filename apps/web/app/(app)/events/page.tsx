// Move 5 — multi-event orchestration. Day 1 server component.
//
// Three render states:
//   (a) Migration not applied yet (event_details table missing) →
//       calm "rolling out" empty state. Tolerated, no crash.
//   (b) Migration live, workspace has zero detail rows →
//       auto-seed ceremony + reception (Hursh's pick), then render.
//       Seed is best-effort; if it fails (RLS, race), we still
//       render the empty card grid + add-event affordance.
//   (c) Workspace has event_details → render the card grid.
//
// For B2B planner-served couples: render a calm "your planner is
// building this" splash, mirroring /autopilot. Couples see the
// finished structure once their planner sets it up — they don't
// drive event creation themselves on planner-served workspaces.

import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  Calendar,
  CalendarDays,
  MapPin,
  PlusCircle,
  Sparkles,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  fetchEventDetails,
  fetchEventSummaries,
  probeEventDetailsTable,
} from "@/lib/data/events";
import {
  DEFAULT_AUTO_ENABLED_EVENTS,
  EVENT_ROLE_LABEL,
  EVENT_ROLE_ORDER,
  type EventRole,
  type EventSummary,
} from "@/lib/event-types";
import { normalizeSkin } from "@/lib/workspace-skin";
import { isB2B, resolveWorkspaceMode } from "@/lib/workspace-mode";
import { currencySymbol } from "@/lib/utils";
import {
  AddEventChip,
  EditEventButton,
} from "@/components/events/event-edit-buttons";
import type { VenueOption } from "@/components/events/event-edit-drawer";

export const dynamic = "force-dynamic";

interface VenueLite {
  id: string;
  name: string;
  address: string | null;
}

export default async function EventsPage() {
  const supabase = createClient();

  // ── Workspace identity + skin / mode ────────────────────────────────
  const { data: workspaceRow } = await supabase
    .from("workspaces")
    .select("id, org_id, base_currency")
    .limit(1)
    .maybeSingle();
  const workspaceId = workspaceRow?.id ?? null;
  const orgId = workspaceRow?.org_id ?? null;
  const baseCurrency = workspaceRow?.base_currency ?? "USD";
  const currencySym = currencySymbol(baseCurrency);

  // T1.5 — workspace-mode-aware fork. Same defensive cast as /payments
  // and /autopilot (skin column may not be in generated types yet).
  let workspaceSkin: string | null = null;
  try {
    const sbSkin = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          limit: (n: number) => {
            maybeSingle: () => Promise<{
              data: { skin?: string | null } | null;
            }>;
          };
        };
      };
    };
    const { data: skinRow } = await sbSkin
      .from("workspaces")
      .select("skin")
      .limit(1)
      .maybeSingle();
    workspaceSkin = skinRow?.skin ?? null;
  } catch {
    // pre-migration tolerant
  }
  const mode = resolveWorkspaceMode(normalizeSkin(workspaceSkin));
  const isPlannerServed = isB2B(mode);

  // ── B2B planner-served splash ───────────────────────────────────────
  // Couples on co_branded / white_label skins don't drive event
  // creation — their planner builds the multi-event structure
  // off-platform. Show a calm placeholder mirroring /autopilot.
  if (isPlannerServed) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Your wedding · every event in one place
          </div>
          <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
            Events
          </h1>
        </header>
        <Card className="border-stone-200 bg-stone-50/60">
          <CardContent className="space-y-3 py-8 text-center">
            <p className="font-serif text-2xl text-stone-800">
              Your planner is building your event structure.
            </p>
            <p className="mx-auto max-w-md text-sm text-stone-600">
              You&rsquo;ll see each event here — with its date, venue,
              guest list, run of show, and budget allocation — once
              your planner has set it up. They&rsquo;ll let you know
              when there&rsquo;s something to review.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Probe event_details table existence ─────────────────────────────
  const probe = await probeEventDetailsTable(supabase);

  // ── (a) Migration pending — calm empty state ────────────────────────
  if (probe === "missing") {
    return <MigrationPendingState />;
  }

  // ── Auto-seed (ceremony + reception) on first load ──────────────────
  // Best-effort: if the seed insert fails (RLS, race, missing org_id),
  // we silently fall through and render the empty grid + add affordance.
  if (workspaceId && orgId) {
    const existing = await fetchEventDetails(supabase, workspaceId);
    if (existing.length === 0) {
      try {
        const sbIns = supabase as unknown as {
          from: (t: string) => {
            insert: (
              rows: Array<Record<string, unknown>>,
            ) => Promise<{ error: unknown }>;
          };
        };
        await sbIns.from("event_details").insert(
          DEFAULT_AUTO_ENABLED_EVENTS.map((role, idx) => ({
            workspace_id: workspaceId,
            org_id: orgId,
            event_role: role,
            is_active: true,
            sort_order: idx,
          })),
        );
      } catch {
        // Tolerate — render what we have.
      }
    }
  }

  // ── Read summaries + venues for display ─────────────────────────────
  const summaries = workspaceId
    ? await fetchEventSummaries(supabase, workspaceId)
    : [];

  // Lookup map for venue names referenced by detail rows + full list
  // for the edit-drawer dropdown. One query covers both: read every
  // venue for the workspace (RLS scopes by workspace_id), then derive
  // the map (used by the card render) and the option list (passed to
  // the drawer client component).
  let venueMap = new Map<string, VenueLite>();
  let venueOptions: VenueOption[] = [];
  try {
    const { data: venueRows } = await supabase
      .from("venues")
      .select("id, name, address")
      .order("name", { ascending: true });
    const rows = (venueRows ?? []) as VenueLite[];
    venueMap = new Map(rows.map((v) => [v.id, v]));
    venueOptions = rows.map((v) => ({ id: v.id, name: v.name }));
  } catch {
    venueMap = new Map();
    venueOptions = [];
  }

  // Which event roles are still toggle-able (not yet active)?
  const activeRoles = new Set(summaries.map((s) => s.event_role));
  const inactiveRoles = EVENT_ROLE_ORDER.filter((r) => !activeRoles.has(r));

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Multi-event planning · every event in one place
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Events
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Each event has its own date, venue, guest list, timeline, and
          budget allocation. Most weddings have 1&ndash;4 events.
        </p>
      </header>

      {summaries.length === 0 ? (
        <EmptyEventsState
          inactiveRoles={inactiveRoles}
          venueOptions={venueOptions}
        />
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            {summaries.map((s) => (
              <EventCard
                key={s.event_role}
                summary={s}
                venue={
                  s.detail?.venue_id
                    ? venueMap.get(s.detail.venue_id) ?? null
                    : null
                }
                currencySym={currencySym}
                venueOptions={venueOptions}
              />
            ))}
          </div>
          {inactiveRoles.length > 0 && (
            <AddEventAffordance
              inactiveRoles={inactiveRoles}
              venueOptions={venueOptions}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function MigrationPendingState() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Multi-event planning · every event in one place
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Events
        </h1>
      </header>
      <Card className="border-stone-200 bg-stone-50/60">
        <CardContent className="space-y-3 py-8 text-center">
          <Sparkles className="mx-auto h-7 w-7 text-stone-400" />
          <p className="font-serif text-2xl text-stone-800">
            Multi-event support is rolling out.
          </p>
          <p className="mx-auto max-w-md text-sm text-stone-600">
            Your workspace will get this soon. You&rsquo;ll be able to
            plan a sangeet, ceremony, reception, brunch &mdash; each with
            its own date, venue, guest list, timeline, and budget.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyEventsState({
  inactiveRoles,
  venueOptions,
}: {
  inactiveRoles: EventRole[];
  venueOptions: VenueOption[];
}) {
  return (
    <Card className="border-dashed border-stone-300 bg-white/50">
      <CardContent className="space-y-4 py-10 text-center">
        <CalendarDays className="mx-auto h-8 w-8 text-stone-300" />
        <p className="font-serif text-xl text-stone-700">
          No events activated yet
        </p>
        <p className="mx-auto max-w-md text-sm text-stone-500">
          Turn on the events that apply to your wedding. We&rsquo;ll
          auto-create ceremony + reception by default; add a sangeet,
          welcome dinner, brunch, etc. as needed.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {inactiveRoles.slice(0, 6).map((r) => (
            <AddEventChip
              key={r}
              eventRole={r}
              venues={venueOptions}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EventCard({
  summary,
  venue,
  currencySym,
  venueOptions,
}: {
  summary: EventSummary;
  venue: VenueLite | null;
  currencySym: string;
  venueOptions: VenueOption[];
}) {
  const { event_role, detail } = summary;
  const displayName = detail?.display_name || EVENT_ROLE_LABEL[event_role];

  const dateLine = (() => {
    if (!detail?.start_at) return "Date TBD";
    try {
      const dt = parseISO(detail.start_at);
      return format(dt, "EEEE, MMMM d, yyyy · h:mm a");
    } catch {
      return "Date TBD";
    }
  })();

  const venueLine = venue ? venue.name : "Venue TBD";

  const guestLine = `${summary.guests_invited} invited · ${summary.guests_yes} yes`;
  const timelineLine = `${summary.timeline_items} timeline item${
    summary.timeline_items === 1 ? "" : "s"
  }`;
  const budgetLine =
    summary.budget_allocated_eur > 0
      ? `${currencySym}${Math.round(summary.budget_allocated_eur).toLocaleString()} allocated`
      : "No budget allocated";

  return (
    <Card className="border-stone-200 bg-white shadow-sm transition hover:border-stone-300 hover:shadow-md">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-rose-700">
              <Sparkles className="h-3 w-3" />
              {EVENT_ROLE_LABEL[event_role]}
            </div>
            <h3 className="font-serif text-2xl font-medium leading-tight tracking-tight">
              {displayName}
            </h3>
          </div>
        </div>

        <div className="space-y-1.5 text-sm text-stone-700">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-stone-400" />
            <span>{dateLine}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-stone-400" />
            <span>{venueLine}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-stone-400" />
            <span>{guestLine}</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-stone-100 pt-3 text-xs text-stone-500">
          <span>{timelineLine}</span>
          <span>{budgetLine}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <EditEventButton
            eventRole={event_role}
            existing={detail}
            venues={venueOptions}
          />
          <Button asChild variant="ghost" size="sm">
            <Link href={`/guests?event=${event_role}`}>View guests</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/timeline?event=${event_role}`}>View timeline</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddEventAffordance({
  inactiveRoles,
  venueOptions,
}: {
  inactiveRoles: EventRole[];
  venueOptions: VenueOption[];
}) {
  return (
    <Card className="border-dashed border-stone-300 bg-stone-50/40">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-stone-500">
          <PlusCircle className="h-3.5 w-3.5" />
          Add another event
        </div>
        <p className="text-sm text-stone-600">
          Toggle on any of the events below to add them to your wedding.
        </p>
        <div className="flex flex-wrap gap-2">
          {inactiveRoles.map((r) => (
            <AddEventChip key={r} eventRole={r} venues={venueOptions} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
