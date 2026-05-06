import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Shared gate for /api/admin/playbook/* — every route is org_admin-only.
//
// On success returns { user, profile } so the route handler can scope writes
// to the caller's org without re-fetching. RLS on the underlying tables also
// enforces the same constraint, but checking it here gives us nicer errors.

export interface GuardSuccess {
  ok: true;
  userId: string;
  orgId: string;
}

export type GuardResult =
  | GuardSuccess
  | { ok: false; response: NextResponse };

export async function requireOrgAdmin(): Promise<GuardResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  // org_role / org_id live on the user row added by the planner-OS slab.
  // Read defensively in case anything is mid-migration.
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: { org_role?: string | null; org_id?: string | null } | null;
          }>;
        };
      };
    };
  };

  const { data: profile } = await sb
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.org_role !== "org_admin" || !profile.org_id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "org_admin only" }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id, orgId: profile.org_id };
}
