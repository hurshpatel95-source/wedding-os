// Shared types for the admin onboarding + push-to-workspace flows owned by Agent E.
//
// These are the wire shapes for the request/response bodies of:
//   POST /api/admin/clients/new
//   POST /api/admin/push/library-venue
//   POST /api/admin/push/library-vendor
//   POST /api/admin/push/playbook
//
// Also a couple of small utility shapes used by the UI components.

export interface NewClientRequest {
  couple_email: string;
  workspace_name: string;
  wedding_date?: string | null;
  apply_playbook?: boolean;
}

export interface NewClientResponse {
  workspace_id: string;
  user_id: string | null;
  // Magic link to share with the couple. May be null when generation failed
  // (the workspace is still created — planner can invite manually).
  magic_link: string | null;
  // Set when the optional `apply_playbook` step ran, succeeded or not.
  playbook_applied: boolean;
  // Non-fatal warnings (e.g. playbook route 404'd because Agent C hasn't merged).
  warnings: string[];
}

export interface PushLibraryVenueRequest {
  library_venue_id: string;
  workspace_id: string;
}

export interface PushLibraryVenueResponse {
  venue_id: string;
  photo_count: number;
  hero_photo_url: string | null;
}

export interface PushLibraryVendorRequest {
  library_vendor_id: string;
  workspace_id: string;
}

export interface PushLibraryVendorResponse {
  vendor_id: string;
}

export interface PushPlaybookRequest {
  workspace_id: string;
  // Optional — when omitted, push the entire playbook for the org.
  playbook_phase_ids?: string[];
}

export interface PushPlaybookResponse {
  phases_pushed: number;
  tasks_pushed: number;
}

export interface PushApiError {
  error: string;
}

// Small workspace summary used by the dropdown inside the push buttons.
export interface WorkspaceOption {
  id: string;
  name: string;
}
