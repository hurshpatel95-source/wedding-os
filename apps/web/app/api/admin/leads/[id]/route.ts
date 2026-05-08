import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_STATUSES = new Set([
  "new",
  "contacted",
  "booked_call",
  "qualified",
  "converted",
  "lost",
]);

async function requireOrgAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized", status: 401 as const };

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
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

  if (!profile?.org_id || profile.org_role !== "org_admin") {
    return { error: "org admin only", status: 403 as const };
  }
  return { supabase, user, profile };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireOrgAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, profile } = auth;

  let body: {
    status?: string;
    notes?: string;
    assigned_to_user_id?: string | null;
  };
  try {
    body = (await request.json()) as {
      status?: string;
      notes?: string;
      assigned_to_user_id?: string | null;
    };
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!ALLOWED_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (typeof body.notes === "string") {
    patch.notes = body.notes.slice(0, 4000);
  }
  if (body.assigned_to_user_id !== undefined) {
    if (body.assigned_to_user_id === null || body.assigned_to_user_id === "") {
      patch.assigned_to_user_id = null;
    } else {
      // Validate target user is in the same org and has org_admin access.
      const sb = supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              maybeSingle: () => Promise<{
                data: {
                  id?: string;
                  org_id?: string | null;
                  org_role?: string | null;
                } | null;
              }>;
            };
          };
        };
      };
      const { data: target } = await sb
        .from("users")
        .select("id, org_id, org_role")
        .eq("id", body.assigned_to_user_id)
        .maybeSingle();
      if (
        !target?.id ||
        target.org_id !== profile.org_id ||
        target.org_role !== "org_admin"
      ) {
        return NextResponse.json(
          { error: "assignee must be a teammate in your studio" },
          { status: 400 },
        );
      }
      patch.assigned_to_user_id = body.assigned_to_user_id;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { error } = await (
    supabase as unknown as {
      from: (t: string) => {
        update: (row: unknown) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .from("leads")
    .update(patch)
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
