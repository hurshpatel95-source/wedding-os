// Shared types for the marketing/lead-gen surface — kept thin so server
// handlers + UI components agree on shape without pulling Database into
// every file.

export type LeadSource =
  | "booking_page"
  | "public_wedding_site"
  | "manual"
  | "referral";

export type LeadStatus =
  | "new"
  | "contacted"
  | "booked_call"
  | "qualified"
  | "converted"
  | "lost";

export interface LeadRow {
  id: string;
  org_id: string;
  referring_workspace_id: string | null;
  source: LeadSource;
  status: LeadStatus;
  couple_names: string | null;
  partner_a_name: string | null;
  partner_b_name: string | null;
  email: string | null;
  phone: string | null;
  wedding_date: string | null;
  guest_count: number | null;
  budget_band: string | null;
  city_or_region: string | null;
  notes: string | null;
  scheduled_call_at: string | null;
  scheduled_call_duration_minutes: number | null;
  converted_workspace_id: string | null;
  converted_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BookingWindowRow {
  id: string;
  org_id: string;
  day_of_week: number;
  start_minute: number;
  end_minute: number;
  timezone: string;
  label: string | null;
  created_at: string;
}

export interface OrgPublicRow {
  id: string;
  name: string;
  public_slug: string | null;
  public_tagline: string | null;
  public_brand_md: string | null;
  public_hero_storage_path: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  booking_buffer_minutes: number;
  booking_slot_minutes: number;
  public_published_at: string | null;
}

export interface MarketingScorecardRow {
  id: string;
  org_id: string;
  url: string;
  title_text: string | null;
  meta_description: string | null;
  h1_count: number | null;
  word_count: number | null;
  has_call_to_action: boolean | null;
  has_contact_info: boolean | null;
  has_schema_org: boolean | null;
  page_speed_seconds: number | null;
  scorecard_md: string | null;
  recommendations: Array<{ title: string; detail: string; effort: "low" | "medium" | "high" }>;
  raw_excerpt: string | null;
  fetched_at: string;
  created_at: string;
}

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  booked_call: "Call booked",
  qualified: "Qualified",
  converted: "Converted",
  lost: "Lost",
};

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  booking_page: "Booking page",
  public_wedding_site: "Couple referral",
  manual: "Manual entry",
  referral: "Referral",
};

export const BUDGET_BANDS = [
  "Under €20k",
  "€20–40k",
  "€40–80k",
  "€80–150k",
  "€150k+",
  "Not sure yet",
] as const;

export const DAY_OF_WEEK_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

// Convert "minutes from midnight" to "HH:MM" for display
export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Parse "HH:MM" back to minutes
export function hhmmToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return 0;
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const mm = Math.min(59, Math.max(0, Number(m[2])));
  return h * 60 + mm;
}

// Sanitize free-form text input — strip null bytes, cap length, trim.
export function sanitizeText(s: unknown, max = 2000): string | null {
  if (typeof s !== "string") return null;
  const trimmed = s.replace(/\u0000/g, "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

// Email shape check — server-side, complementary to HTML5 input type=email
export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}
