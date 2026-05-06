// Seating organizer — workspace-scoped floor plans + per-plan assignments.

import type { Database } from "@wedding-os/db";

type EventRole = Database["public"]["Enums"]["event_role"];

export interface FloorPlanRow {
  id: string;
  workspace_id: string;
  org_id: string;
  name: string;
  venue_id: string | null;
  event_role: EventRole | null;
  table_count: number;
  seats_per_table: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeatingAssignmentRow {
  id: string;
  floor_plan_id: string;
  guest_id: string;
  table_number: number;
  seat_number: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FloorPlanSummary {
  plan: FloorPlanRow;
  assignedCount: number;
  totalCapacity: number;
}

export function planCapacity(plan: Pick<FloorPlanRow, "table_count" | "seats_per_table">): number {
  return plan.table_count * plan.seats_per_table;
}
