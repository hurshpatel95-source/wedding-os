// Shared types for Wave 2 features. Each feature owns a chunk; this is
// the single source of truth so cross-feature imports agree on shape.

export type TeamRole = "owner" | "planner" | "assistant";

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Owner",
  planner: "Planner",
  assistant: "Assistant",
};

export interface EmailTemplateRow {
  id: string;
  org_id: string;
  name: string;
  kind: string | null;
  subject: string;
  body: string;
  is_shared: boolean;
  use_count: number;
  last_used_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type DocumentKind =
  | "contract"
  | "invoice_received"
  | "vendor_proposal"
  | "venue_agreement"
  | "permit"
  | "photo"
  | "misc";

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  contract: "Contract",
  invoice_received: "Invoice received",
  vendor_proposal: "Vendor proposal",
  venue_agreement: "Venue agreement",
  permit: "Permit",
  photo: "Photo",
  misc: "Other",
};

export interface DocumentRow {
  id: string;
  org_id: string;
  workspace_id: string | null;
  name: string;
  storage_path: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  kind: DocumentKind;
  uploaded_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ExpenseCategory =
  | "vendor_payment"
  | "software"
  | "travel"
  | "marketing"
  | "office"
  | "taxes"
  | "misc";

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  vendor_payment: "Vendor payment",
  software: "Software",
  travel: "Travel",
  marketing: "Marketing",
  office: "Office",
  taxes: "Taxes",
  misc: "Other",
};

export interface PlannerExpenseRow {
  id: string;
  org_id: string;
  workspace_id: string | null;
  vendor_id: string | null;
  label: string;
  amount_eur: number;
  category: ExpenseCategory;
  paid_at: string | null;
  due_at: string | null;
  notes: string | null;
  external_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeEntryRow {
  id: string;
  org_id: string;
  workspace_id: string;
  user_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  label: string | null;
  billable: boolean;
  hourly_rate_eur: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadRoutingRuleRow {
  id: string;
  org_id: string;
  name: string;
  priority: number;
  match_conditions: {
    source?: string[];
    budget_band?: string[];
    city_or_region_contains?: string[];
    guest_count_min?: number;
    guest_count_max?: number;
  };
  assignee_user_id: string;
  enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type TestimonialStatus =
  | "requested"
  | "submitted"
  | "published"
  | "declined";

export const TESTIMONIAL_STATUS_LABEL: Record<TestimonialStatus, string> = {
  requested: "Requested",
  submitted: "Submitted",
  published: "Published",
  declined: "Declined",
};

export interface TestimonialRow {
  id: string;
  org_id: string;
  workspace_id: string | null;
  couple_names: string | null;
  contact_email: string | null;
  quote: string | null;
  rating: number | null;
  photo_storage_path: string | null;
  status: TestimonialStatus;
  public_token: string;
  requested_at: string | null;
  submitted_at: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarConnectionRow {
  id: string;
  org_id: string;
  user_id: string;
  provider: "google" | "apple" | "ical";
  label: string | null;
  refresh_token: string | null;
  access_token: string | null;
  access_token_expires_at: string | null;
  ical_url: string | null;
  external_calendar_id: string | null;
  status: "active" | "expired" | "revoked" | "error";
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

// ─── WhatsApp deep-link helper ───────────────────────────────────────
// Used by WhatsApp deep-link buttons across leads / vendors / guests.
// Strip everything except + and digits, then build wa.me URL.
export function buildWhatsAppLink(
  phone: string | null | undefined,
  text?: string,
): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^+\d]/g, "");
  if (!cleaned) return null;
  const num = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  if (!num || num.length < 7) return null;
  const url = `https://wa.me/${num}`;
  if (text) {
    return `${url}?text=${encodeURIComponent(text)}`;
  }
  return url;
}

// ─── Recurrence expansion ────────────────────────────────────────────
// Simple rule strings → list of dates. Anchor + rule → due dates.

export type RecurrenceAnchor = "wedding_date" | "phase_start" | "created_at";

const SIMPLE_RULES = new Set([
  "weekly",
  "biweekly",
  "monthly",
  "every_friday",
  "every_monday",
  "every_tuesday",
  "every_wednesday",
  "every_thursday",
  "every_saturday",
  "every_sunday",
  "first_of_month",
]);

export function isValidRecurrenceRule(rule: string): boolean {
  return SIMPLE_RULES.has(rule);
}

/** Expand a recurrence rule from anchor → end into a list of YYYY-MM-DD dates. */
export function expandRecurrence(
  rule: string,
  anchorIso: string,
  endIso: string,
  maxOccurrences = 60,
): string[] {
  if (!isValidRecurrenceRule(rule)) return [];
  const start = new Date(anchorIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (end < start) return [];

  const out: string[] = [];
  const cur = new Date(start);

  // Snap to first matching weekday for "every_*"
  const weekdayMap: Record<string, number> = {
    every_sunday: 0,
    every_monday: 1,
    every_tuesday: 2,
    every_wednesday: 3,
    every_thursday: 4,
    every_friday: 5,
    every_saturday: 6,
  };
  if (rule in weekdayMap) {
    while (cur.getDay() !== weekdayMap[rule]) {
      cur.setDate(cur.getDate() + 1);
    }
  }
  if (rule === "first_of_month") {
    cur.setDate(1);
    if (cur < start) cur.setMonth(cur.getMonth() + 1);
  }

  while (cur <= end && out.length < maxOccurrences) {
    out.push(cur.toISOString().slice(0, 10));
    if (rule === "weekly" || rule in weekdayMap) {
      cur.setDate(cur.getDate() + 7);
    } else if (rule === "biweekly") {
      cur.setDate(cur.getDate() + 14);
    } else if (rule === "monthly" || rule === "first_of_month") {
      cur.setMonth(cur.getMonth() + 1);
    } else {
      break;
    }
  }
  return out;
}
