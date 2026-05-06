// Pricing-intake shared types — used by API + review UI.

export type IntakeSourceKind = "image" | "pdf" | "text" | "whatsapp_export";
export type IntakeStatus =
  | "uploaded"
  | "extracting"
  | "extracted"
  | "partial"
  | "failed"
  | "applied"
  | "archived";
export type IntakeProposalKind = "default_price" | "override" | "new_line_item";
export type ProposalDecision = "pending" | "accepted" | "edited" | "rejected" | "needs_info";

export interface ProposalDTO {
  id?: string;
  kind: IntakeProposalKind;
  matched_line_item_id?: string | null;
  proposed_category?: string | null;
  proposed_label?: string | null;
  proposed_description?: string | null;
  proposed_unit?: "per_guest" | "per_event" | "flat" | "per_hour" | "per_day" | null;
  proposed_tier?: "basic" | "standard" | "premium" | null;
  proposed_unit_price?: number | null;
  proposed_currency?: string | null;
  proposed_included?: boolean | null;
  proposed_notes?: string | null;
  confidence: number;
  rationale: string;
  evidence: { quote: string; page?: number; bbox?: number[]; message_idx?: number };
  needs_info?: string | null;
  decision?: ProposalDecision;
}

export interface IntakePreview {
  source_id: string;
  source_label: string | null;
  status: IntakeStatus;
  proposals: ProposalDTO[];
  cost_usd: number;
  claude_used: boolean;
  warning?: string;
}

// Auto-apply gate — proposals over this confidence with a single clear match
// can be applied without UI review (just show in a "Auto-applied" section).
export const AUTO_APPLY_THRESHOLD = 0.92;
