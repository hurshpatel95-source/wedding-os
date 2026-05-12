// Move 5 — multi-event orchestration. Day 1 types.
//
// This file declares the EventRole union as a local string literal
// (NOT imported from @wedding-os/db) because the generated DB types
// don't yet include the rehearsal / after_party / brunch values that
// migration 20260508000001_event_roles_extension.sql added. Until
// types regenerate, we maintain the union here.
//
// The lib/event-roles.ts file pre-dates this work and uses the
// (stale) DB-types EventRole. Both files coexist; new code should
// prefer the union exported from THIS file (lib/event-types.ts).

export type EventRole =
  | "mehndi"
  | "sangeet"
  | "welcome"
  | "haldi"
  | "ceremony"
  | "reception"
  | "wedding"
  | "stay"
  | "rehearsal"
  | "after_party"
  | "brunch";

/** Human-readable label for the events nav + cards. */
export const EVENT_ROLE_LABEL: Record<EventRole, string> = {
  mehndi: "Mehndi",
  sangeet: "Sangeet",
  welcome: "Welcome dinner",
  haldi: "Haldi",
  ceremony: "Ceremony",
  reception: "Reception",
  wedding: "Wedding (ceremony + reception)",
  stay: "Hotel block / stay",
  rehearsal: "Rehearsal dinner",
  after_party: "After-party",
  brunch: "Day-after brunch",
};

/**
 * Default events auto-enabled on first /events page load for a fresh
 * workspace (Hursh's pick: ceremony + reception). The page server
 * component seeds event_details rows with these roles when the
 * workspace has zero event_details rows AND the table exists.
 */
export const DEFAULT_AUTO_ENABLED_EVENTS: EventRole[] = [
  "ceremony",
  "reception",
];

/** Stable order for rendering the "add event" picker. */
export const EVENT_ROLE_ORDER: EventRole[] = [
  "rehearsal",
  "mehndi",
  "welcome",
  "haldi",
  "sangeet",
  "ceremony",
  "reception",
  "wedding",
  "after_party",
  "brunch",
  "stay",
];

/** Row shape for the event_details table. Hand-written (table is not
 *  in the generated Database types yet — same pattern as other
 *  freshly-added tables across the codebase). */
export interface EventDetailRow {
  id: string;
  workspace_id: string;
  org_id: string;
  event_role: EventRole;
  display_name: string | null;
  start_at: string | null;
  end_at: string | null;
  venue_id: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Per-event summary built by fetchEventSummaries — joins the detail
 *  row with derived counts from guest_event_invitations,
 *  timeline_items, and budget_lines. */
export interface EventSummary {
  event_role: EventRole;
  detail: EventDetailRow | null;
  guests_invited: number;
  guests_responded: number;
  guests_yes: number;
  timeline_items: number;
  budget_allocated_eur: number;
}

/** Predicate used by helpers: is this value a valid EventRole? */
export function isEventRole(value: unknown): value is EventRole {
  return (
    typeof value === "string" &&
    value in EVENT_ROLE_LABEL
  );
}
