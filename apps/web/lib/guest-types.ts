// Shared guest types — used by index page, form, and import wizard.

export type RsvpStatus = "pending" | "yes" | "no" | "maybe";
export type GuestSide = "groom" | "bride" | "both";

export const RSVP_STATUSES: RsvpStatus[] = ["pending", "yes", "no", "maybe"];
export const RSVP_LABEL: Record<RsvpStatus, string> = {
  pending: "Pending",
  yes: "Yes",
  no: "No",
  maybe: "Maybe",
};
export const RSVP_VARIANT: Record<
  RsvpStatus,
  "muted" | "success" | "destructive" | "warning"
> = {
  pending: "muted",
  yes: "success",
  no: "destructive",
  maybe: "warning",
};

export const GUEST_SIDES: GuestSide[] = ["groom", "bride", "both"];
export const SIDE_LABEL: Record<GuestSide, string> = {
  groom: "Groom",
  bride: "Bride",
  both: "Both",
};

// The shape Claude must return for column-mapping intake.
export type GuestImportField =
  | "full_name"
  | "email"
  | "phone"
  | "side"
  | "relationship"
  | "address"
  | "city"
  | "region"
  | "postal_code"
  | "country"
  | "dietary"
  | "allergies"
  | "notes";

export const IMPORT_FIELD_LABEL: Record<GuestImportField, string> = {
  full_name: "Full name",
  email: "Email",
  phone: "Phone",
  side: "Side (groom/bride)",
  relationship: "Relationship",
  address: "Address line",
  city: "City",
  region: "State / region",
  postal_code: "Postal / ZIP",
  country: "Country",
  dietary: "Dietary",
  allergies: "Allergies",
  notes: "Notes",
};

export const REQUIRED_FIELDS: GuestImportField[] = ["full_name"];

export interface NormalizedRow {
  // sparse — only the fields the source provides will be populated
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  side?: GuestSide | null;
  relationship?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country?: string | null;
  dietary?: string | null;
  allergies?: string | null;
  notes?: string | null;
  // diagnostic — Claude's per-row confidence + warnings
  confidence?: number;
  warnings?: string[];
}

export interface ImportPreview {
  import_id: string;
  source_filename: string;
  source_kind: "excel" | "csv" | "paste";
  rows_total: number;
  header_row: string[];
  column_mapping: Partial<Record<GuestImportField, string>>;
  rows: NormalizedRow[];
  // First N rows of the original file (for the user-side preview/diff)
  raw_sample: Record<string, unknown>[];
  claude_used: boolean;
  claude_confidence?: number;
  cost_usd?: number;
}
