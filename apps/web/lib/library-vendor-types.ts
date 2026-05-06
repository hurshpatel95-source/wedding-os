// Library-vendor types — mirror migration 20260506000012_planner_os.sql.
// Shared `vendor_category` enum is reused from `lib/vendor-types.ts` so the
// 28 categories stay in lock-step with the workspace-level vendors table.

import type { VendorCategory } from "./vendor-types";

export type PriceBand = "budget" | "mid" | "premium" | "luxe" | "unset";

export interface LibraryVendorRow {
  id: string;
  org_id: string;
  name: string;
  category: VendorCategory;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  default_quoted_price_eur: number | null;
  notes: string | null;
  website: string | null;
  instagram: string | null;
  planner_rating: number | null;
  default_contract_path: string | null;
  tags: string[];
  lead_time_days: number | null;
  price_band: PriceBand | null;
  created_at: string;
  updated_at: string;
}

export type LibraryVendorListItem = Pick<
  LibraryVendorRow,
  | "id"
  | "name"
  | "category"
  | "contact_name"
  | "contact_email"
  | "contact_phone"
  | "default_quoted_price_eur"
  | "notes"
  | "created_at"
>;

export type LibraryVendorInsert = Partial<
  Omit<LibraryVendorRow, "id" | "org_id" | "created_at" | "updated_at">
> & {
  id?: string;
  org_id: string;
  name: string;
  category: VendorCategory;
  created_at?: string;
  updated_at?: string;
};

export type LibraryVendorUpdate = Partial<
  Omit<LibraryVendorRow, "id" | "org_id" | "created_at" | "updated_at">
>;
