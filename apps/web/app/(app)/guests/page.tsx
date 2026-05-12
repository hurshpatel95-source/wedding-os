import Link from "next/link";
import { BarChart3, Send, Upload, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { GuestList } from "@/components/guests/guest-list";
import { GuestCreateButton } from "@/components/guests/guest-create-button";
import { GuestComposeButton } from "@/components/email/guest-compose-button";
import {
  EventFilterTabs,
  type EventFilterTab,
} from "@/components/events/event-filter-tabs";
import {
  EVENT_ROLE_LABEL,
  EVENT_ROLE_ORDER,
  isEventRole,
  type EventRole,
} from "@/lib/event-types";
import { fetchEventDetails } from "@/lib/data/events";
import type { Database } from "@wedding-os/db";

export const dynamic = "force-dynamic";

export default async function GuestsPage({
  searchParams,
}: {
  searchParams?: { event?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: "admin" | "couple" | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = (profile?.role ?? null) as typeof role;
  }

  // plus_one_max is post-0025; types haven't regenerated. We select it
  // anyway and merge through a cast.
  const { data: guests } = await supabase
    .from("guests")
    .select(
      "id, full_name, email, phone, side, relationship, dietary, allergies, overall_rsvp, address, city, region, postal_code, country, notes, created_at, updated_at, plus_one_max",
    )
    .order("full_name", { ascending: true });

  // Per-event invitation rows for the per-event badge column. RLS scopes to
  // the current workspace; bucket client-side by guest_id.
  const { data: invitationsRaw } = await supabase
    .from("guest_event_invitations")
    .select("guest_id, event_role, rsvp, is_invited");
  const invitationsByGuest = new Map<
    string,
    Array<{ event_role: string; rsvp: string }>
  >();
  // Track which event_roles have any invitation rows (for the tab strip
  // fallback when event_details isn't seeded yet).
  const rolesWithInvitations = new Set<EventRole>();
  // Per-event guest counts ("X yes" sub-badge on each tab). Counts the
  // number of invited guests per role and how many said yes.
  const guestCountsByRole = new Map<
    EventRole,
    { invited: number; yes: number }
  >();
  for (const row of invitationsRaw ?? []) {
    const r = row as {
      guest_id: string;
      event_role: string;
      rsvp: string;
      is_invited: boolean;
    };
    if (!r.is_invited) continue;
    const existing = invitationsByGuest.get(r.guest_id) ?? [];
    existing.push({ event_role: r.event_role, rsvp: r.rsvp });
    invitationsByGuest.set(r.guest_id, existing);
    if (isEventRole(r.event_role)) {
      rolesWithInvitations.add(r.event_role);
      const bucket = guestCountsByRole.get(r.event_role) ?? {
        invited: 0,
        yes: 0,
      };
      bucket.invited += 1;
      if (r.rsvp === "yes") bucket.yes += 1;
      guestCountsByRole.set(r.event_role, bucket);
    }
  }

  // ── Per-event filter (Move 5 Day 2) ────────────────────────────────
  // Validate the ?event= query param. Anything else collapses to null.
  const rawEvent = searchParams?.event;
  const eventFilter: EventRole | null =
    rawEvent && isEventRole(rawEvent) ? rawEvent : null;

  // Build the tab strip's role list. Prefer the active event_details
  // rows if the table exists; fall back to roles derived from existing
  // invitations so the page degrades gracefully pre-migration.
  let tabRoles: EventRole[] = [];
  try {
    const { data: { user: tabUser } } = await supabase.auth.getUser();
    if (tabUser) {
      const { data: tabProfile } = await supabase
        .from("users")
        .select("workspace_id")
        .eq("id", tabUser.id)
        .maybeSingle();
      const wsId = (tabProfile as { workspace_id?: string } | null)
        ?.workspace_id;
      if (wsId) {
        const details = await fetchEventDetails(supabase, wsId);
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
    }
  } catch {
    tabRoles = [];
  }
  if (tabRoles.length === 0) {
    // Fallback: any role with at least one invitation row.
    tabRoles = EVENT_ROLE_ORDER.filter((r) => rolesWithInvitations.has(r));
  }

  const eventTabs: EventFilterTab[] = tabRoles.map((role) => {
    const c = guestCountsByRole.get(role);
    return {
      role,
      sub: c && c.invited > 0 ? `${c.yes} yes` : null,
    };
  });

  type GuestRow = Database["public"]["Tables"]["guests"]["Row"];
  const baseList = (guests ?? []) as unknown as Array<
    Pick<
      GuestRow,
      | "id"
      | "full_name"
      | "email"
      | "phone"
      | "side"
      | "relationship"
      | "dietary"
      | "allergies"
      | "overall_rsvp"
      | "address"
      | "city"
      | "region"
      | "postal_code"
      | "country"
      | "notes"
      | "created_at"
      | "updated_at"
    > & { plus_one_max: number | null }
  >;
  const unfilteredList = baseList.map((g) => ({
    ...g,
    event_invitations: invitationsByGuest.get(g.id) ?? [],
  }));

  // Apply the per-event filter (server-side). When a tab is active, we
  // only show guests with an is_invited=true row for that event_role.
  const list = eventFilter
    ? unfilteredList.filter((g) =>
        g.event_invitations.some(
          (inv) => inv.event_role === eventFilter,
        ),
      )
    : unfilteredList;

  const total = list.length;
  const yes = list.filter((g) => g.overall_rsvp === "yes").length;
  const no = list.filter((g) => g.overall_rsvp === "no").length;
  const maybe = list.filter((g) => g.overall_rsvp === "maybe").length;
  const pending = list.filter((g) => g.overall_rsvp === "pending").length;

  const isAdmin = role === "admin";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Who's coming
          </div>
          <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
            Guest list
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Track invites, addresses, dietary needs, and RSVPs across every
            event. Import directly from your spreadsheet — we map the columns
            for you.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/guests/dashboard">
            <Button>
              <BarChart3 className="h-4 w-4" />
              Live dashboard
            </Button>
          </Link>
          <Link href="/guests/seating">
            <Button variant="outline">Seating organizer</Button>
          </Link>
          <Link href="/guests/message">
            <Button variant="outline">
              <Send className="h-4 w-4" /> Message guests
            </Button>
          </Link>
          <Link href="/guests/import">
            <Button variant="outline">
              <Upload className="h-4 w-4" /> Import from Excel
            </Button>
          </Link>
          <GuestCreateButton />
          {isAdmin && (
            <>
              <GuestComposeButton
                defaultKind="guest_save_the_date"
                label="Save-the-date"
                variant="outline"
              />
              {pending > 0 && (
                <GuestComposeButton
                  defaultKind="guest_rsvp_nudge"
                  defaultFilter={{ rsvp: "pending" }}
                  label={`Nudge ${pending} pending`}
                  variant="outline"
                />
              )}
            </>
          )}
        </div>
      </header>

      {eventTabs.length > 0 && (
        <EventFilterTabs tabs={eventTabs} ariaLabel="Filter guests by event" />
      )}

      {unfilteredList.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No guests on your list yet"
          description="Drop in your existing spreadsheet — we map the columns for you. Or add guests one at a time. Every name flows into RSVP tracking, seating, and dietary lists automatically."
          action={
            <>
              <Button asChild>
                <Link href="/guests/import">
                  <Upload className="h-4 w-4" />
                  Import from Excel
                </Link>
              </Button>
              <GuestCreateButton />
            </>
          }
        />
      ) : total === 0 ? (
        <section className="rounded-2xl border border-dashed border-stone-300 bg-white/50 px-6 py-12 text-center">
          <p className="font-serif text-xl text-stone-700">
            No one invited to {eventFilter ? EVENT_ROLE_LABEL[eventFilter] : "this event"} yet
          </p>
          <p className="mt-2 text-sm text-stone-500">
            Pick another event tab, or invite guests to this one from
            their detail row.
          </p>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Total" value={total} />
            <Stat label="Yes" value={yes} tone="emerald" />
            <Stat label="Maybe" value={maybe} tone="amber" />
            <Stat label="No" value={no} tone="rose" />
            <Stat label="Pending" value={pending} tone="muted" />
          </section>

          <GuestList guests={list} role={role} />
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "muted" | "emerald" | "amber" | "rose";
}) {
  const dot =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
      ? "bg-amber-500"
      : tone === "rose"
      ? "bg-rose-500"
      : "bg-stone-400";
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-stone-500">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-2 font-serif text-2xl font-light leading-none md:text-3xl">{value}</div>
    </div>
  );
}
