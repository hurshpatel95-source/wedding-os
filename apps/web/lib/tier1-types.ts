// Shared types for Tier 1 features. Each feature owns a chunk; this
// module is the single source of truth so cross-feature imports don't
// disagree on shape.

export type ContractStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "declined"
  | "voided";

export interface ContractRow {
  id: string;
  org_id: string;
  workspace_id: string | null;
  lead_id: string | null;
  title: string;
  body_md: string;
  terms_summary: string | null;
  total_eur: number | null;
  retainer_eur: number | null;
  retainer_due_date: string | null;
  status: ContractStatus;
  public_token: string;
  signer_name: string | null;
  signer_email: string | null;
  signed_full_name: string | null;
  signed_at: string | null;
  signed_ip: string | null;
  signed_user_agent: string | null;
  declined_at: string | null;
  declined_reason: string | null;
  voided_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  pdf_storage_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ProposalStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "expired";

export interface ProposalSectionItem {
  label: string;
  qty?: number;
  unit_price_eur?: number;
  total_eur?: number;
  optional?: boolean;
  note?: string;
}

export interface ProposalSection {
  title: string;
  body_md?: string;
  items?: ProposalSectionItem[];
}

export interface ProposalRow {
  id: string;
  org_id: string;
  workspace_id: string | null;
  lead_id: string | null;
  title: string;
  intro_md: string | null;
  sections: ProposalSection[];
  total_eur: number | null;
  status: ProposalStatus;
  public_token: string;
  valid_until: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailMessageRow {
  id: string;
  org_id: string;
  workspace_id: string | null;
  direction: "outbound" | "inbound";
  kind: string | null;
  thread_key: string | null;
  in_reply_to_message_id: string | null;
  provider: string;
  provider_message_id: string | null;
  to_email: string;
  to_name: string | null;
  from_email: string | null;
  from_name: string | null;
  cc: string[] | null;
  bcc: string[] | null;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  related_lead_id: string | null;
  related_vendor_id: string | null;
  related_guest_id: string | null;
  related_contract_id: string | null;
  status: string;
  status_detail: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentLinkRow {
  id: string;
  org_id: string;
  planner_invoice_id: string;
  stripe_payment_link_id: string;
  stripe_payment_link_url: string;
  amount_eur: number;
  status: "open" | "paid" | "void" | "expired" | "failed";
  paid_at: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  receipt_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuestMessageRow {
  id: string;
  org_id: string;
  workspace_id: string;
  channel: "email" | "sms";
  kind: string;
  subject: string | null;
  body: string;
  segment_filter: Record<string, unknown>;
  recipient_count: number;
  delivered_count: number;
  bounced_count: number;
  status: "pending" | "sending" | "sent" | "failed";
  scheduled_for: string | null;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  declined: "Declined",
  voided: "Voided",
};

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
};

// Public-site themes catalog. Shared by /settings/public-site picker
// and /w/[slug] renderer.
export const SITE_THEMES = [
  { slug: "classic", label: "Classic", description: "Cream + rose, serif headings, the default." },
  { slug: "modern", label: "Modern minimal", description: "Black + white, sans-serif, gallery-led." },
  { slug: "garden", label: "Garden", description: "Soft greens, botanical accents, ivory cards." },
  { slug: "beach", label: "Coastal", description: "Sand + sky, watercolor accents, breezy spacing." },
  { slug: "bollywood", label: "Bollywood", description: "Marigold + magenta, ornamental borders." },
] as const;

export type SiteThemeSlug = (typeof SITE_THEMES)[number]["slug"];
