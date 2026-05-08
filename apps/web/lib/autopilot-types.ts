// Shared types for Wave 3 autopilot. Each agent owns its own slice; this
// module is the single source of truth so cross-agent imports agree.

export type IntakeStatus = "active" | "completed" | "abandoned";

export interface IntakeChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  ts: string; // ISO
}

export interface IntakeExtractedData {
  // Fields the AI fills in over the course of the conversation.
  // All optional — accumulates partially as the user answers.
  partner_a_name?: string;
  partner_b_name?: string;
  wedding_date?: string;
  wedding_season?: string;
  wedding_region?: string;
  venue_name?: string;
  venue_locked?: boolean;
  style_tags?: string[];
  guest_count_estimate?: number;
  budget_target_eur?: number;
  // What's already been done — checklist of completed playbook tasks
  completed_tasks?: string[];
  // What stresses them most — used to prioritize the dashboard
  top_concerns?: string[];
  // What they want help with first — used to seed first vendor search
  first_priority_category?: string;
}

export interface IntakeSessionRow {
  id: string;
  workspace_id: string;
  org_id: string;
  status: IntakeStatus;
  started_at: string;
  completed_at: string | null;
  chat_messages: IntakeChatMessage[];
  extracted_data: IntakeExtractedData;
  total_cost_usd: number;
  created_at: string;
  updated_at: string;
}

// ─── Budget tree ─────────────────────────────────────────────────────

export type BudgetLineStatus =
  | "placeholder"
  | "researching"
  | "quoted"
  | "booked"
  | "paid";

export type BudgetLineSource =
  | "ai_baseline"
  | "industry_avg"
  | "vendor_quote"
  | "manual"
  | "imported";

export const BUDGET_CATEGORIES = [
  "venue",
  "catering",
  "bar",
  "photo_video",
  "flowers_decor",
  "music",
  "attire",
  "stationery",
  "transportation",
  "hair_makeup",
  "officiant",
  "rehearsal_dinner",
  "welcome_bags",
  "favors",
  "rentals",
  "lighting",
  "tipping",
  "contingency",
  "misc",
] as const;

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export const BUDGET_CATEGORY_LABEL: Record<BudgetCategory, string> = {
  venue: "Venue & space",
  catering: "Catering",
  bar: "Bar & beverages",
  photo_video: "Photo & video",
  flowers_decor: "Flowers & décor",
  music: "Music & entertainment",
  attire: "Attire",
  stationery: "Stationery",
  transportation: "Transportation",
  hair_makeup: "Hair & makeup",
  officiant: "Officiant",
  rehearsal_dinner: "Rehearsal dinner",
  welcome_bags: "Welcome bags",
  favors: "Favors",
  rentals: "Rentals",
  lighting: "Lighting",
  tipping: "Tips & gratuity",
  contingency: "Contingency",
  misc: "Other",
};

export interface BudgetLineRow {
  id: string;
  workspace_id: string;
  org_id: string;
  parent_line_id: string | null;
  category: BudgetCategory;
  label: string;
  qty: number | null;
  unit_price_eur: number | null;
  total_eur: number | null;
  amount_estimated: number | null;
  amount_committed: number | null;
  amount_paid: number | null;
  vendor_id: string | null;
  status: BudgetLineStatus;
  source: BudgetLineSource;
  notes: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Gmail ───────────────────────────────────────────────────────────

export interface GmailConnectionRow {
  id: string;
  org_id: string;
  workspace_id: string;
  user_id: string;
  email: string;
  refresh_token: string | null;
  access_token: string | null;
  access_token_expires_at: string | null;
  scopes: string[];
  status: "active" | "expired" | "revoked" | "error";
  last_history_id: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Vendor search ───────────────────────────────────────────────────

export interface VendorSearchResult {
  // Cross-provider normalized shape
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  region?: string;
  rating?: number;
  rating_count?: number;
  photos?: string[];
  // Provider-specific identifiers for re-fetch
  place_id?: string;
  url?: string;
  // Free-form description if the provider returned one
  description?: string;
}

export interface VendorSearchCacheRow {
  id: string;
  workspace_id: string;
  org_id: string;
  category: string;
  region: string;
  query: string;
  provider: "google_places" | "brave" | "manual";
  results: VendorSearchResult[];
  result_count: number;
  cost_usd: number;
  fetched_at: string;
  created_by: string | null;
  created_at: string;
}

// ─── Alerts ──────────────────────────────────────────────────────────

export type AlertSeverity = "info" | "success" | "warn" | "urgent";
export type AlertAudience = "couple" | "planner" | "both";

export interface AlertRow {
  id: string;
  workspace_id: string;
  org_id: string;
  audience: AlertAudience;
  kind: string;
  severity: AlertSeverity;
  title: string;
  body: string | null;
  action_url: string | null;
  payload: Record<string, unknown>;
  related_vendor_id: string | null;
  related_lead_id: string | null;
  related_budget_line_id: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  included_in_digest_at: string | null;
  created_at: string;
}

// ─── Vendor extensions (autopilot fields) ────────────────────────────

export type VendorAutopilotStatus =
  | "none"
  | "researching"
  | "contacted"
  | "quoted"
  | "booked"
  | "declined"
  | "unavailable";

export const VENDOR_AUTOPILOT_LABEL: Record<VendorAutopilotStatus, string> = {
  none: "Not started",
  researching: "Researching",
  contacted: "Contacted",
  quoted: "Quoted",
  booked: "Booked",
  declined: "Declined",
  unavailable: "Unavailable",
};

// ─── Autopilot run trace ─────────────────────────────────────────────

export interface AutopilotRunRow {
  id: string;
  workspace_id: string;
  org_id: string;
  kind: string;
  input_ref: Record<string, unknown>;
  output: Record<string, unknown>;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number;
  status: "success" | "failed" | "queued" | "running";
  error_message: string | null;
  duration_ms: number | null;
  triggered_by: string | null;
  created_at: string;
}
