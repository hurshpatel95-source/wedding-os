// Estimator — couple-side honest-budget tool seeded from planner PDFs.
// Local-only overrides; nothing pushes to the master pricing template.

export type EstimateLineUnit =
  | "flat"
  | "per_guest"
  | "per_hour"
  | "per_person"
  | "per_night"
  | "per_look";

export interface EstimateLine {
  id: string;
  label: string;
  /** Human-readable like "1 × flat" or "€180 × 220 guests" or "€110/hr × 6h". */
  unit_label?: string;
  /** Loose unit hint, optional. */
  unit?: EstimateLineUnit;
  qty?: number | null;
  unit_price_eur?: number | null;
  /** Astha's quoted total for this line (the baseline). */
  astha_eur: number;
  /** User's override, applied if non-null AND included. */
  override_eur: number | null;
  /** When false, line contributes 0 to section total. */
  included: boolean;
  /** Quote pulled directly from the planner PDF. */
  evidence?: {
    quote: string;
    page?: number;
  };
  /** TBC marker — Astha said "subject to final requirements"; not yet priced. */
  tbc?: boolean;
  /** Couple-added note. */
  notes?: string;
  /** True for lines the user added themselves (no Astha baseline). */
  user_added?: boolean;
}

export interface EstimateSection {
  id: string;
  label: string;
  subtitle?: string;
  /** Optional venue tag for hint rendering. */
  venue_id?: string | null;
  /** Pure metadata used for diffs against existing /pricing scenarios. */
  guest_count?: number;
  date_label?: string;
  lines: EstimateLine[];
  /** Section-level note shown above the line table. */
  notes?: string;
}

export interface EstimateDocument {
  /** Schema version so future changes can migrate forward. */
  version: 1;
  sections: EstimateSection[];
}

/** What lives in the budget_estimates table. */
export interface BudgetEstimateRow {
  id: string;
  org_id: string;
  workspace_id: string;
  name: string;
  source_label: string | null;
  scenario_summary: string | null;
  cover_emoji: string | null;
  guest_count: number | null;
  start_date: string | null;
  end_date: string | null;
  sections: EstimateDocument;
  baseline_total_eur: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ─── pure totals helpers ────────────────────────────────────────────────

export function effectiveLineTotal(line: EstimateLine): number {
  if (!line.included) return 0;
  if (line.tbc) return 0;
  const v = line.override_eur != null ? line.override_eur : line.astha_eur;
  return Number.isFinite(v) ? Number(v) : 0;
}

export function lineDelta(line: EstimateLine): number {
  if (!line.included) return -Number(line.astha_eur || 0);
  if (line.override_eur == null) return 0;
  return Number(line.override_eur) - Number(line.astha_eur || 0);
}

export function sectionTotal(section: EstimateSection): number {
  return section.lines.reduce((acc, l) => acc + effectiveLineTotal(l), 0);
}

export function sectionBaseline(section: EstimateSection): number {
  return section.lines.reduce(
    (acc, l) => acc + (l.tbc ? 0 : Number(l.astha_eur || 0)),
    0,
  );
}

export function documentTotal(doc: EstimateDocument): number {
  return doc.sections.reduce((acc, s) => acc + sectionTotal(s), 0);
}

export function documentBaseline(doc: EstimateDocument): number {
  return doc.sections.reduce((acc, s) => acc + sectionBaseline(s), 0);
}

export function documentOverrideDelta(doc: EstimateDocument): number {
  return documentTotal(doc) - documentBaseline(doc);
}

export function formatEUR(n: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact && Math.abs(n) >= 10_000) {
    return `€${(n / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`;
  }
  return `€${Math.round(n).toLocaleString()}`;
}
