// PATCH  /api/admin/team/[user_id] — change team_role
// DELETE /api/admin/team/[user_id] — remove from the planner team
//                                    (demotes org_role to 'member' and
//                                    nulls team_role; auth user is left alone)
//
// Both routes require the caller to be an org_admin with team_role='owner'
// and refuse self-edits + would-be removals of the only owner.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TeamRole } from "@/lib/wave2-types";
import { dbUpdate, dbWriteErrorResponse } from "@/lib/db-write-guard";

export const runtime = "nodejs";

interface CallerProfile {
  org_id: string;
  team_role: string | null;
}

interface TargetProfile {
  id: string;
  org_id: string;
  team_role: string | null;
  org_role: string | null;
}

async function requireOwner(): Promise<
  | { error: string; status: 401 | 403 }
  | { caller: CallerProfile; userId: string; supabase: ReturnType<typeof createClient> }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized", status: 401 };

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: {
              org_role?: string | null;
              org_id?: string | null;
              team_role?: string | null;
            } | null;
          }>;
        };
      };
    };
  };

  const { data: profile } = await sb
    .from("users")
    .select("org_role, org_id, team_role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.org_id || profile.org_role !== "org_admin") {
    return { error: "org admin only", status: 403 };
  }
  if (profile.team_role !== "owner") {
    return { error: "only the studio owner can manage team members", status: 403 };
  }
  return {
    caller: { org_id: profile.org_id, team_role: profile.team_role ?? null },
    userId: user.id,
    supabase,
  };
}

async function loadTarget(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<TargetProfile | null> {
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: {
              id?: string;
              org_id?: string;
              team_role?: string | null;
              org_role?: string | null;
            } | null;
          }>;
        };
      };
    };
  };
  const { data } = await sb
    .from("users")
    .select("id, org_id, team_role, org_role")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.id || !data.org_id) return null;
  return {
    id: data.id,
    org_id: data.org_id,
    team_role: data.team_role ?? null,
    org_role: data.org_role ?? null,
  };
}

async function ownerCount(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
): Promise<number> {
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => Promise<{
            data: Array<{ id: string }> | null;
          }>;
        };
      };
    };
  };
  const { data } = await sb
    .from("users")
    .select("id")
    .eq("org_id", orgId)
    .eq("team_role", "owner");
  return (data ?? []).length;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { user_id: string } },
) {
  const auth = await requireOwner();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { caller, userId: callerId, supabase } = auth;

  if (params.user_id === callerId) {
    return NextResponse.json(
      { error: "you cannot change your own role" },
      { status: 400 },
    );
  }

  let body: { team_role?: string };
  try {
    body = (await request.json()) as { team_role?: string };
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const nextRole = body.team_role as TeamRole | undefined;
  if (!nextRole || !["owner", "planner", "assistant"].includes(nextRole)) {
    return NextResponse.json({ error: "invalid team_role" }, { status: 400 });
  }

  const target = await loadTarget(supabase, params.user_id);
  if (!target) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }
  if (target.org_id !== caller.org_id) {
    return NextResponse.json({ error: "wrong org" }, { status: 403 });
  }

  // Don't allow demoting the only owner. (Not strictly possible via this
  // route since callers can't change their own role, but a second owner
  // demoting their co-owner would orphan the team — block that too.)
  if (target.team_role === "owner" && nextRole !== "owner") {
    const owners = await ownerCount(supabase, caller.org_id);
    if (owners <= 1) {
      return NextResponse.json(
        { error: "cannot demote the only owner" },
        { status: 400 },
      );
    }
  }

  // team_role isn't yet in the generated Database types — cast through
  // unknown so the Supabase client accepts the column.
  const updSb = supabase as unknown as {
    from: (t: string) => {
      update: (row: unknown) => {
        eq: (col: string, val: string) => {
          select: (cols: string) => PromiseLike<{
            data: { id: string }[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  try {
    await dbUpdate(
      "update user team_role",
      updSb
        .from("users")
        .update({ team_role: nextRole })
        .eq("id", params.user_id)
        .select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { user_id: string } },
) {
  const auth = await requireOwner();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { caller, userId: callerId, supabase } = auth;

  if (params.user_id === callerId) {
    return NextResponse.json(
      { error: "you cannot remove yourself" },
      { status: 400 },
    );
  }

  const target = await loadTarget(supabase, params.user_id);
  if (!target) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }
  if (target.org_id !== caller.org_id) {
    return NextResponse.json({ error: "wrong org" }, { status: 403 });
  }

  if (target.team_role === "owner") {
    const owners = await ownerCount(supabase, caller.org_id);
    if (owners <= 1) {
      return NextResponse.json(
        { error: "cannot remove the only owner" },
        { status: 400 },
      );
    }
  }

  // Demote: org_role='member', team_role=null. The auth.users row is left
  // alone so the user can still sign in but loses planner-side access.
  const updSb = supabase as unknown as {
    from: (t: string) => {
      update: (row: unknown) => {
        eq: (col: string, val: string) => {
          select: (cols: string) => PromiseLike<{
            data: { id: string }[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  try {
    await dbUpdate(
      "demote user (org_role=member, team_role=null)",
      updSb
        .from("users")
        .update({ org_role: "member", team_role: null })
        .eq("id", params.user_id)
        .select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
