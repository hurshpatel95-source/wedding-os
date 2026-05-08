// Pure helper for evaluating lead-routing rules. Used by the public lead-
// capture API to auto-assign new leads, and reusable for an admin-side
// preview / tests. Keep this file dependency-free (no Supabase, no Next).
//
// Rule semantics:
//   - All conditions present in match_conditions must pass for the rule to
//     fire (logical AND across keys). Within a single condition that takes
//     an array, ANY match passes (logical OR within the array).
//   - Missing condition keys mean "don't filter on this".
//   - Lower priority number = higher precedence; first match wins.
//
// The match_conditions JSONB is the source of truth in the DB; this helper
// reads its declared shape from LeadRoutingRuleRow.
import type { LeadRoutingRuleRow } from "./wave2-types";
import type { LeadRow } from "./lead-types";

type LeadShape = Partial<
  Pick<
    LeadRow,
    "source" | "budget_band" | "city_or_region" | "guest_count"
  >
>;

export function evaluateRule(
  lead: LeadShape,
  rule: LeadRoutingRuleRow,
): boolean {
  if (!rule.enabled) return false;
  const c = rule.match_conditions ?? {};

  // Source — array IN match
  if (Array.isArray(c.source) && c.source.length > 0) {
    if (!lead.source || !c.source.includes(lead.source)) return false;
  }

  // Budget band — array IN match
  if (Array.isArray(c.budget_band) && c.budget_band.length > 0) {
    if (!lead.budget_band || !c.budget_band.includes(lead.budget_band)) {
      return false;
    }
  }

  // City / region — case-insensitive substring; ANY needle matches
  if (
    Array.isArray(c.city_or_region_contains) &&
    c.city_or_region_contains.length > 0
  ) {
    const haystack = (lead.city_or_region ?? "").toLowerCase();
    if (!haystack) return false;
    const hit = c.city_or_region_contains.some(
      (needle) =>
        typeof needle === "string" &&
        needle.length > 0 &&
        haystack.includes(needle.toLowerCase()),
    );
    if (!hit) return false;
  }

  // Guest count bounds
  if (typeof c.guest_count_min === "number") {
    if (typeof lead.guest_count !== "number") return false;
    if (lead.guest_count < c.guest_count_min) return false;
  }
  if (typeof c.guest_count_max === "number") {
    if (typeof lead.guest_count !== "number") return false;
    if (lead.guest_count > c.guest_count_max) return false;
  }

  return true;
}

/** Find the first rule that matches, given rules already ordered by
 *  priority ascending. Returns null if nothing matches. */
export function pickMatchingRule(
  lead: LeadShape,
  rules: LeadRoutingRuleRow[],
): LeadRoutingRuleRow | null {
  for (const rule of rules) {
    if (evaluateRule(lead, rule)) return rule;
  }
  return null;
}

// ─── Validation helpers used by the API + form ─────────────────────────

export interface RoutingRuleInput {
  name?: string;
  priority?: number;
  match_conditions?: {
    source?: unknown;
    budget_band?: unknown;
    city_or_region_contains?: unknown;
    guest_count_min?: unknown;
    guest_count_max?: unknown;
  };
  assignee_user_id?: string;
  enabled?: boolean;
}

export interface RoutingRuleClean {
  name: string;
  priority: number;
  match_conditions: LeadRoutingRuleRow["match_conditions"];
  assignee_user_id: string;
  enabled: boolean;
}

const ALLOWED_SOURCES = new Set([
  "booking_page",
  "public_wedding_site",
  "manual",
  "referral",
]);

function cleanStringArray(v: unknown, allowed?: Set<string>): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (!t) continue;
    if (allowed && !allowed.has(t)) continue;
    out.push(t.slice(0, 120));
  }
  return out.length > 0 ? out : undefined;
}

function cleanNumber(v: unknown, lo: number, hi: number): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}

/** Normalise raw input from the form / JSON body into the shape we store.
 *  Returns either { ok: true, value } or { ok: false, error }. */
export function validateRoutingInput(
  body: RoutingRuleInput,
): { ok: true; value: RoutingRuleClean } | { ok: false; error: string } {
  const name =
    typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return { ok: false, error: "name required" };

  const assignee_user_id =
    typeof body.assignee_user_id === "string"
      ? body.assignee_user_id.trim()
      : "";
  if (!assignee_user_id) {
    return { ok: false, error: "assignee_user_id required" };
  }

  const priority =
    typeof body.priority === "number" && Number.isFinite(body.priority)
      ? Math.max(0, Math.min(10000, Math.floor(body.priority)))
      : 100;

  const enabled = body.enabled === false ? false : true;

  const raw = body.match_conditions ?? {};
  const match_conditions: LeadRoutingRuleRow["match_conditions"] = {};

  const sources = cleanStringArray(raw.source, ALLOWED_SOURCES);
  if (sources) match_conditions.source = sources;

  const bands = cleanStringArray(raw.budget_band);
  if (bands) match_conditions.budget_band = bands;

  const cities = cleanStringArray(raw.city_or_region_contains);
  if (cities) match_conditions.city_or_region_contains = cities;

  const gMin = cleanNumber(raw.guest_count_min, 0, 5000);
  if (gMin !== undefined) match_conditions.guest_count_min = gMin;
  const gMax = cleanNumber(raw.guest_count_max, 0, 5000);
  if (gMax !== undefined) match_conditions.guest_count_max = gMax;

  if (
    match_conditions.guest_count_min !== undefined &&
    match_conditions.guest_count_max !== undefined &&
    match_conditions.guest_count_min > match_conditions.guest_count_max
  ) {
    return { ok: false, error: "guest_count_min cannot exceed guest_count_max" };
  }

  return {
    ok: true,
    value: { name, priority, match_conditions, assignee_user_id, enabled },
  };
}

/** Human-readable summary of a rule's conditions. */
export function describeConditions(
  conds: LeadRoutingRuleRow["match_conditions"],
): string {
  const parts: string[] = [];
  if (conds.source && conds.source.length > 0) {
    parts.push(`Source: ${conds.source.join(" / ")}`);
  }
  if (conds.budget_band && conds.budget_band.length > 0) {
    parts.push(`Budget: ${conds.budget_band.join(" / ")}`);
  }
  if (
    conds.city_or_region_contains &&
    conds.city_or_region_contains.length > 0
  ) {
    parts.push(`City: ${conds.city_or_region_contains.join(" / ")}`);
  }
  if (
    typeof conds.guest_count_min === "number" ||
    typeof conds.guest_count_max === "number"
  ) {
    const lo = conds.guest_count_min ?? "0";
    const hi = conds.guest_count_max ?? "∞";
    parts.push(`Guests: ${lo}–${hi}`);
  }
  return parts.length === 0 ? "Matches all leads" : parts.join(" · ");
}
