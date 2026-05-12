// Move 5 — multi-event orchestration. Day 1 server-side read helpers.
//
// Both helpers are tolerant of the event_details table not existing
// (pre-migration state — see migration 20260512100000_event_details.sql).
// In that case they return [] or fall back to deriving the event_role
// list from existing per-event tables so /events still renders.
//
// supabase-js casts are used because event_details + budget_lines
// (with the new event_role column) aren't in the generated Database
// types yet. Same pattern used by app/(app)/page.tsx for workspace_skin,
// budget_lines, etc.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EVENT_ROLE_ORDER,
  isEventRole,
  type EventDetailRow,
  type EventRole,
  type EventSummary,
} from "@/lib/event-types";

/**
 * Read all event_details rows for a workspace, sorted by sort_order
 * then start_at. Tolerant of the table not existing.
 *
 * @param sb        Supabase server client
 * @param workspaceId Workspace UUID to scope the read
 * @returns         Array of EventDetailRow (empty if table missing or empty)
 */
export async function fetchEventDetails(
  sb: SupabaseClient,
  workspaceId: string,
): Promise<EventDetailRow[]> {
  try {
    const sbCast = sb as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              order: (
                col: string,
                opts: { ascending: boolean; nullsFirst?: boolean },
              ) => Promise<{ data: EventDetailRow[] | null; error: unknown }>;
            };
          };
        };
      };
    };

    const { data, error } = await sbCast
      .from("event_details")
      .select(
        "id, workspace_id, org_id, event_role, display_name, start_at, end_at, venue_id, description, is_active, sort_order, created_at, updated_at",
      )
      .eq("workspace_id", workspaceId)
      .order("sort_order", { ascending: true })
      .order("start_at", { ascending: true, nullsFirst: false });

    if (error) {
      // Pre-migration: table doesn't exist → relation error. Tolerate.
      return [];
    }
    return (data ?? []).filter((r) => isEventRole(r.event_role));
  } catch {
    return [];
  }
}

/**
 * Build per-event summaries: detail row + guest counts + timeline
 * counts + budget allocation. If event_details doesn't exist yet,
 * derive the event_role list from existing tables (guest_event_invitations,
 * timeline_items) so the page still renders something useful.
 *
 * @param sb          Supabase server client
 * @param workspaceId Workspace UUID
 * @returns           Array of EventSummary, one per active event role
 */
export async function fetchEventSummaries(
  sb: SupabaseClient,
  workspaceId: string,
): Promise<EventSummary[]> {
  const details = await fetchEventDetails(sb, workspaceId);

  // Determine which event roles to summarize. If we have detail rows,
  // only show those that are active. Otherwise fall back to the set of
  // event_roles that already have data (guest invitations / timeline).
  const activeRoles = new Set<EventRole>();
  const detailByRole = new Map<EventRole, EventDetailRow>();

  if (details.length > 0) {
    for (const d of details) {
      if (d.is_active) {
        activeRoles.add(d.event_role);
        detailByRole.set(d.event_role, d);
      }
    }
  } else {
    // Derive from existing per-event data so the page isn't blank when
    // event_details isn't seeded yet (pre-migration OR migration just
    // landed but nothing's been written yet).
    try {
      const sbGuests = sb as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              col: string,
              val: string,
            ) => Promise<{
              data: Array<{
                event_role: string;
                guests?: { workspace_id: string } | null;
              }> | null;
            }>;
          };
        };
      };
      const { data: invRows } = await sbGuests
        .from("guest_event_invitations")
        .select("event_role, guests!inner(workspace_id)")
        .eq("guests.workspace_id", workspaceId);
      for (const r of invRows ?? []) {
        if (isEventRole(r.event_role)) activeRoles.add(r.event_role);
      }
    } catch {
      // Tolerate; we'll fall through to defaults below.
    }

    try {
      const sbTimeline = sb as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              col: string,
              val: string,
            ) => Promise<{ data: Array<{ event_role: string }> | null }>;
          };
        };
      };
      const { data: tRows } = await sbTimeline
        .from("timeline_items")
        .select("event_role")
        .eq("workspace_id", workspaceId);
      for (const r of tRows ?? []) {
        if (isEventRole(r.event_role)) activeRoles.add(r.event_role);
      }
    } catch {
      // Tolerate.
    }
  }

  // Pull aggregate data sources. Each is wrapped in try/catch so a
  // missing table or RLS edge case doesn't crash the whole page.
  let invitationRows: Array<{
    event_role: string;
    is_invited: boolean;
    rsvp: string;
  }> = [];
  try {
    const sbInv = sb as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            col: string,
            val: string,
          ) => Promise<{
            data: Array<{
              event_role: string;
              is_invited: boolean;
              rsvp: string;
              guests?: { workspace_id: string } | null;
            }> | null;
          }>;
        };
      };
    };
    const { data } = await sbInv
      .from("guest_event_invitations")
      .select("event_role, is_invited, rsvp, guests!inner(workspace_id)")
      .eq("guests.workspace_id", workspaceId);
    invitationRows = data ?? [];
  } catch {
    invitationRows = [];
  }

  let timelineRows: Array<{ event_role: string }> = [];
  try {
    const sbT = sb as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            col: string,
            val: string,
          ) => Promise<{ data: Array<{ event_role: string }> | null }>;
        };
      };
    };
    const { data } = await sbT
      .from("timeline_items")
      .select("event_role")
      .eq("workspace_id", workspaceId);
    timelineRows = data ?? [];
  } catch {
    timelineRows = [];
  }

  let budgetRows: Array<{
    event_role: string | null;
    total_eur: number | string | null;
  }> = [];
  try {
    const sbB = sb as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            col: string,
            val: string,
          ) => Promise<{
            data: Array<{
              event_role: string | null;
              total_eur: number | string | null;
            }> | null;
          }>;
        };
      };
    };
    const { data } = await sbB
      .from("budget_lines")
      .select("event_role, total_eur")
      .eq("workspace_id", workspaceId);
    budgetRows = data ?? [];
  } catch {
    budgetRows = [];
  }

  // Aggregate per-role counts.
  const guestsByRole = new Map<
    EventRole,
    { invited: number; responded: number; yes: number }
  >();
  for (const r of invitationRows) {
    if (!isEventRole(r.event_role)) continue;
    const bucket = guestsByRole.get(r.event_role) ?? {
      invited: 0,
      responded: 0,
      yes: 0,
    };
    if (r.is_invited) bucket.invited += 1;
    if (r.rsvp === "yes") {
      bucket.responded += 1;
      bucket.yes += 1;
    } else if (r.rsvp === "no" || r.rsvp === "maybe") {
      bucket.responded += 1;
    }
    guestsByRole.set(r.event_role, bucket);
  }

  const timelineByRole = new Map<EventRole, number>();
  for (const r of timelineRows) {
    if (!isEventRole(r.event_role)) continue;
    timelineByRole.set(r.event_role, (timelineByRole.get(r.event_role) ?? 0) + 1);
  }

  const budgetByRole = new Map<EventRole, number>();
  for (const r of budgetRows) {
    if (!r.event_role || !isEventRole(r.event_role)) continue;
    const amount = Number(r.total_eur ?? 0);
    if (!Number.isFinite(amount)) continue;
    budgetByRole.set(
      r.event_role,
      (budgetByRole.get(r.event_role) ?? 0) + amount,
    );
  }

  // Union the role sets: anything with a detail row, anything with
  // invitations, anything with timeline items, anything with budget.
  for (const r of guestsByRole.keys()) activeRoles.add(r);
  for (const r of timelineByRole.keys()) activeRoles.add(r);
  for (const r of budgetByRole.keys()) activeRoles.add(r);

  // Stable ordering: by sort_order from detail (if present), then by
  // start_at (if present), then by canonical EVENT_ROLE_ORDER.
  const ordered = [...activeRoles].sort((a, b) => {
    const da = detailByRole.get(a);
    const db = detailByRole.get(b);
    if (da && db) {
      if (da.sort_order !== db.sort_order) return da.sort_order - db.sort_order;
      const ta = da.start_at ? new Date(da.start_at).getTime() : Infinity;
      const tb = db.start_at ? new Date(db.start_at).getTime() : Infinity;
      if (ta !== tb) return ta - tb;
    }
    return EVENT_ROLE_ORDER.indexOf(a) - EVENT_ROLE_ORDER.indexOf(b);
  });

  return ordered.map((role): EventSummary => {
    const g = guestsByRole.get(role) ?? { invited: 0, responded: 0, yes: 0 };
    return {
      event_role: role,
      detail: detailByRole.get(role) ?? null,
      guests_invited: g.invited,
      guests_responded: g.responded,
      guests_yes: g.yes,
      timeline_items: timelineByRole.get(role) ?? 0,
      budget_allocated_eur: budgetByRole.get(role) ?? 0,
    };
  });
}

/**
 * Sentinel returned by fetchEventDetails callers can use to know
 * whether the event_details table existed at read time. We expose
 * a separate probe to avoid making fetchEventDetails too clever.
 *
 * Returns "exists" / "missing" / "unknown" — pages branch on this
 * to decide whether to render the migration-pending state.
 */
export async function probeEventDetailsTable(
  sb: SupabaseClient,
): Promise<"exists" | "missing" | "unknown"> {
  try {
    const sbCast = sb as unknown as {
      from: (t: string) => {
        select: (
          c: string,
          opts: { count: "exact"; head: true },
        ) => {
          limit: (
            n: number,
          ) => Promise<{ error: { message?: string; code?: string } | null }>;
        };
      };
    };
    const { error } = await sbCast
      .from("event_details")
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (!error) return "exists";
    // PostgREST returns a 4xx with a code like "42P01" / message
    // including "relation" / "does not exist" when the table is
    // absent. Be lenient — we only care that something failed.
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("does not exist") || error.code === "42P01") {
      return "missing";
    }
    return "unknown";
  } catch {
    return "missing";
  }
}
