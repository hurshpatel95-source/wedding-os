// Vendor types — mirror migration 20260506000001_vendors.sql.
// Hand-rolled until we run `supabase gen types typescript` against the live schema.

export type VendorCategory =
  | "florist"
  | "decor"
  | "transport"
  | "guest_shuttle"
  | "bridal_car"
  | "photographer"
  | "videographer"
  | "photo_booth"
  | "dj"
  | "live_band"
  | "dhol"
  | "sound_av"
  | "lighting"
  | "mua_hair"
  | "mehndi"
  | "baraat_horse"
  | "pandit"
  | "priest_officiant"
  | "stationery"
  | "signage"
  | "rentals_furniture"
  | "lounge_furniture"
  | "cake_dessert"
  | "bar_mixology"
  | "late_night_food"
  | "permits_legal"
  | "translator_emcee"
  | "other";

export type VendorStatus =
  | "researching"
  | "rfp_sent"
  | "quoted"
  | "shortlisted"
  | "booked"
  | "completed"
  | "declined";

export interface VendorRow {
  id: string;
  workspace_id: string;
  org_id: string;
  category: VendorCategory;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  instagram: string | null;
  status: VendorStatus;
  planner_rating: number | null;
  quoted_price_eur: number | null;
  quoted_currency: string | null;
  deposit_amount_eur: number | null;
  deposit_due_at: string | null;
  deposit_paid_at: string | null;
  final_balance_eur: number | null;
  final_due_at: string | null;
  final_paid_at: string | null;
  include_in_pricing: boolean;
  notes: string | null;
  is_couple_visible: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorTaskRow {
  id: string;
  vendor_id: string;
  label: string;
  done: boolean;
  due_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  notes: string | null;
  done_at: string | null;
  created_at: string;
}

export interface VendorAttachmentRow {
  id: string;
  vendor_id: string;
  kind: "contract" | "invoice" | "quote" | "moodboard" | "photo" | "other";
  url: string;
  label: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export type VendorInsert = Omit<
  VendorRow,
  "id" | "created_at" | "updated_at" | "created_by"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
};

export type VendorTaskInsert = Omit<VendorTaskRow, "id" | "created_at" | "done_at"> & {
  id?: string;
  created_at?: string;
  done_at?: string | null;
};

export type VendorAttachmentInsert = Omit<VendorAttachmentRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};
