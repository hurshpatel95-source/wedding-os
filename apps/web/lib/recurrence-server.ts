// Server-side helpers for recurrence expansion when applying playbook tasks
// to a workspace. Wraps the pure expansion logic in lib/wave2-types.ts with
// date-parsing convenience: turn (workspace.wedding_date, phase offset, anchor
// kind) → a concrete Date, then expand into N child due dates.
//
// Used by /api/admin/playbook/apply to materialize recurring playbook_tasks
// into N planning_tasks rows tied back to a single parent.

import "server-only";
import { addMonths, parseISO } from "date-fns";
import {
  expandRecurrence,
  isValidRecurrenceRule,
  type RecurrenceAnchor,
} from "@/lib/wave2-types";

/**
 * Compute the anchor Date for recurrence expansion based on the chosen anchor
 * kind. Returns null when the anchor cannot be resolved (e.g. wedding_date
 * isn't set yet) — callers should skip expansion in that case and just create
 * the parent task with the rule attached.
 *
 * - "wedding_date": the workspace's wedding date. Null if not set.
 * - "phase_start": wedding_date minus the phase's months-before-wedding
 *   offset. Falls back to wedding_date if the offset is missing. Null if no
 *   wedding_date.
 * - "created_at": now. Always resolvable.
 */
export function computeAnchorDate(
  workspaceWeddingDate: string | null,
  phaseMonthsBefore: number | null,
  recurrenceAnchor: string,
): Date | null {
  const anchor = recurrenceAnchor as RecurrenceAnchor;
  if (anchor === "created_at") return new Date();
  if (!workspaceWeddingDate) return null;

  const wedding = parseISO(workspaceWeddingDate);
  if (Number.isNaN(wedding.getTime())) return null;

  if (anchor === "wedding_date") return wedding;
  if (anchor === "phase_start") {
    if (phaseMonthsBefore == null) return wedding;
    return addMonths(wedding, -phaseMonthsBefore);
  }
  return null;
}

/**
 * Expand a recurrence rule into N child due dates between anchor and end.
 * Returns an empty array if the rule is invalid or the range is empty.
 *
 * `endDate` is typically the workspace's wedding date so recurrence stops at
 * the wedding; for "created_at" anchor when no wedding is set, callers pass
 * anchor + 1 year as a sane horizon.
 */
export function expandRecurrenceForApply(
  ruleStr: string,
  anchorDate: Date,
  endDate: Date,
  maxOccurrences = 60,
): Array<{ due_date: string }> {
  if (!isValidRecurrenceRule(ruleStr)) return [];
  const dates = expandRecurrence(
    ruleStr,
    anchorDate.toISOString(),
    endDate.toISOString(),
    maxOccurrences,
  );
  return dates.map((d) => ({ due_date: d }));
}
