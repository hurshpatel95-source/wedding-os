import type { Database } from "@wedding-os/db";

export type PlaybookPhase = Database["public"]["Tables"]["playbook_phases"]["Row"];
export type PlaybookPhaseInsert = Database["public"]["Tables"]["playbook_phases"]["Insert"];
export type PlaybookPhaseUpdate = Database["public"]["Tables"]["playbook_phases"]["Update"];

export type PlaybookTask = Database["public"]["Tables"]["playbook_tasks"]["Row"];
export type PlaybookTaskInsert = Database["public"]["Tables"]["playbook_tasks"]["Insert"];
export type PlaybookTaskUpdate = Database["public"]["Tables"]["playbook_tasks"]["Update"];

export const ANCHOR_KINDS = [
  "months_before_wedding",
  "weeks_before_wedding",
  "days_before_wedding",
  "absolute",
] as const;

export type AnchorKind = (typeof ANCHOR_KINDS)[number];

export const ANCHOR_LABEL: Record<AnchorKind, string> = {
  months_before_wedding: "Months before",
  weeks_before_wedding: "Weeks before",
  days_before_wedding: "Days before",
  absolute: "Absolute",
};

// owner_default + category on playbook_tasks are stored as free-form text on
// the playbook side (the schema is text, not enums) so the planner can sketch
// rough categories without being constrained. The /plan side enforces enum
// values on planning_tasks; the apply-step coerces to a safe default when the
// playbook value doesn't match.

export const PLAYBOOK_OWNER_OPTIONS = [
  "couple",
  "planner",
  "groom",
  "bride",
  "family",
  "vendor",
] as const;

export const PLAYBOOK_CATEGORY_OPTIONS = [
  "venue",
  "vendor",
  "attire",
  "paperwork",
  "guest",
  "logistics",
  "design",
  "ritual",
  "finance",
  "honeymoon",
  "other",
] as const;

// Maps a playbook phase's anchor (months/weeks/days before) to the closest
// `task_phase` enum bucket so /plan sections still sort correctly even when
// rendering a freshly-applied playbook.
export function anchorToPhaseEnum(
  anchor_kind: string | null,
  anchor_value_int: number | null,
): "pre_12_months" | "months_9_12" | "months_6_9" | "months_3_6" | "months_1_3" | "final_month" | "final_week" | "day_of" | "post_wedding" {
  if (!anchor_kind || anchor_value_int == null) return "pre_12_months";

  let monthsBefore: number;
  if (anchor_kind === "months_before_wedding") {
    monthsBefore = anchor_value_int;
  } else if (anchor_kind === "weeks_before_wedding") {
    monthsBefore = anchor_value_int / 4.33;
  } else if (anchor_kind === "days_before_wedding") {
    monthsBefore = anchor_value_int / 30;
  } else {
    return "pre_12_months";
  }

  if (monthsBefore < 0) return "post_wedding";
  if (monthsBefore < 0.05) return "day_of";
  if (monthsBefore < 0.25) return "final_week";
  if (monthsBefore < 1) return "final_month";
  if (monthsBefore < 3) return "months_1_3";
  if (monthsBefore < 6) return "months_3_6";
  if (monthsBefore < 9) return "months_6_9";
  if (monthsBefore < 12) return "months_9_12";
  return "pre_12_months";
}

// Same logic but returns the integer months_before that planning_tasks stores
// so the /plan due-date math (`addMonths(weddingDate, -months_before)`)
// continues to work.
export function anchorToMonthsBefore(
  anchor_kind: string | null,
  anchor_value_int: number | null,
): number | null {
  if (!anchor_kind || anchor_value_int == null) return null;
  if (anchor_kind === "months_before_wedding") return anchor_value_int;
  if (anchor_kind === "weeks_before_wedding")
    return Math.round((anchor_value_int / 4.33) * 100) / 100;
  if (anchor_kind === "days_before_wedding")
    return Math.round((anchor_value_int / 30) * 100) / 100;
  return null;
}
