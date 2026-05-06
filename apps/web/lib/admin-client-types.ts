// Shapes used by /admin/clients (planner-side roster) and the per-workspace
// drill-in / branding editor. Kept narrow on purpose — the gen.types Workspace
// row is wider than what the roster needs.

export type ClientStatus = "planning" | "booked" | "done";

export interface ClientRosterRow {
  id: string;
  name: string;
  wedding_date: string | null;
  base_currency: string;
  created_at: string;
  status: ClientStatus;
  venues_of_interest: number;
  vendors_active: number;
  last_activity_at: string | null;
}

export interface WorkspaceBrandingRow {
  workspace_id: string;
  accent_hex: string;
  logo_storage_path: string | null;
  planner_display_name: string | null;
  updated_at: string;
}

export interface BrandingPatchPayload {
  accent_hex?: string;
  planner_display_name?: string | null;
}

/**
 * Derive the simple roster status from a workspace's wedding_date alone.
 *  - no wedding_date  → "planning"
 *  - wedding_date >= today → "booked"
 *  - wedding_date <  today → "done"
 *
 * Today's-date is passed in to keep this pure & testable. Callers should pass
 * `new Date()` (or a fixed date for tests).
 */
export function deriveClientStatus(
  weddingDate: string | null,
  today: Date,
): ClientStatus {
  if (!weddingDate) return "planning";
  const w = new Date(weddingDate);
  // Compare on YMD only — strip time-of-day from `today`.
  const todayYmd = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  if (w.getTime() < todayYmd.getTime()) return "done";
  return "booked";
}
