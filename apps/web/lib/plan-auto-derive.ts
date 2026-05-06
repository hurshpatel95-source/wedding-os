// Server-side helper: overlay live data onto auto-derivable tasks.
// Tasks with `auto_derive_kind` set get their `status` field re-computed
// from the current state of venues / vendors / guests, etc.
//
// Supported kinds:
//   venue_status:decided                 — done if any venue has the status
//   guests_count_above:50                — done if guests row count exceeds N
//   guests_rsvp_response_rate:0.5        — done if non-pending fraction ≥ N
//   vendor_booked:photographer           — done if a vendor of category=X is status=booked
//   vendor_booked_any:florist,decor      — done if ANY of the listed categories has a booked vendor
//   deposits_paid_count:>=5              — done if the # vendors with deposit_paid_at IS NOT NULL passes the threshold
//
// Tasks the user manually marked done (status='done', done_at set) are
// always left alone — manual override wins.

import "server-only";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Database } from "@wedding-os/db";

export type LiveTask = Database["public"]["Tables"]["planning_tasks"]["Row"] & {
  derived_done?: boolean;
  derived_progress?: number; // 0-1, optional
};

interface Counts {
  venues_decided: boolean;
  guests_total: number;
  guests_rsvp_responses: number;
  guests_responded_fraction: number;
  vendors_booked_by_category: Record<string, number>;
  vendors_with_deposit_paid: number;
}

async function fetchCounts(workspaceId: string): Promise<Counts> {
  const supabase = createServerClient();
  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string, opts?: { count?: "exact"; head?: boolean }) => {
        eq: (col: string, val: string) => Promise<{ count: number | null; data: unknown }> & {
          eq: (col: string, val: string) => Promise<{ count: number | null; data: unknown }>;
          neq: (col: string, val: string) => Promise<{ count: number | null; data: unknown }>;
          not: (col: string, op: string, val: unknown) => Promise<{ count: number | null; data: unknown }>;
        };
      };
    };
  };

  const [venues, guestsTotal, guestsResp, vendors, depositsPaid] = await Promise.all([
    supabase.from("venues").select("status").eq("workspace_id", workspaceId),
    supabase
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    supabase
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .neq("overall_rsvp", "pending"),
    sb
      .from("vendors")
      .select("category, status")
      .eq("workspace_id", workspaceId),
    sb
      .from("vendors")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .not("deposit_paid_at", "is", null),
  ]);

  const venuesDecided = (venues.data ?? []).some(
    (v: { status: string }) => v.status === "decided",
  );

  const vendorsByCategory: Record<string, number> = {};
  for (const v of (vendors as unknown as { data: { category: string; status: string }[] }).data ?? []) {
    if (v.status === "booked") {
      vendorsByCategory[v.category] = (vendorsByCategory[v.category] ?? 0) + 1;
    }
  }

  const total = guestsTotal.count ?? 0;
  const resp = guestsResp.count ?? 0;

  return {
    venues_decided: venuesDecided,
    guests_total: total,
    guests_rsvp_responses: resp,
    guests_responded_fraction: total > 0 ? resp / total : 0,
    vendors_booked_by_category: vendorsByCategory,
    vendors_with_deposit_paid: (depositsPaid as unknown as { count: number | null }).count ?? 0,
  };
}

export async function applyAutoDerive(
  tasks: Database["public"]["Tables"]["planning_tasks"]["Row"][],
  workspaceId: string,
): Promise<LiveTask[]> {
  const needsDerive = tasks.some((t) => t.auto_derive_kind);
  if (!needsDerive) return tasks;

  const counts = await fetchCounts(workspaceId);

  return tasks.map((t) => {
    if (!t.auto_derive_kind) return t;
    // Manual override wins — never demote a manually-done task
    if (t.status === "done" && t.done_at) return t;

    const derivedDone = evaluateRule(t.auto_derive_kind, counts);
    if (derivedDone) {
      return {
        ...t,
        status: "done" as const,
        derived_done: true,
      };
    }
    return { ...t, derived_done: false };
  });
}

function evaluateRule(rule: string, c: Counts): boolean {
  // venue_status:decided
  if (rule.startsWith("venue_status:")) {
    const want = rule.slice("venue_status:".length);
    if (want === "decided") return c.venues_decided;
  }

  // guests_count_above:50
  if (rule.startsWith("guests_count_above:")) {
    const n = Number(rule.slice("guests_count_above:".length));
    return c.guests_total > n;
  }

  // guests_rsvp_response_rate:0.5
  if (rule.startsWith("guests_rsvp_response_rate:")) {
    const f = Number(rule.slice("guests_rsvp_response_rate:".length));
    return c.guests_responded_fraction >= f;
  }

  // vendor_booked:photographer
  if (rule.startsWith("vendor_booked:")) {
    const cat = rule.slice("vendor_booked:".length);
    return (c.vendors_booked_by_category[cat] ?? 0) > 0;
  }

  // vendor_booked_any:florist,decor
  if (rule.startsWith("vendor_booked_any:")) {
    const list = rule.slice("vendor_booked_any:".length).split(",").map((s) => s.trim());
    return list.some((cat) => (c.vendors_booked_by_category[cat] ?? 0) > 0);
  }

  // deposits_paid_count:>=5
  if (rule.startsWith("deposits_paid_count:>=")) {
    const n = Number(rule.slice("deposits_paid_count:>=".length));
    return c.vendors_with_deposit_paid >= n;
  }

  return false;
}
