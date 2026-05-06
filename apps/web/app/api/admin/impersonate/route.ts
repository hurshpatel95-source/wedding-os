import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// POST { workspace_id } — start impersonating a workspace as org_admin.
// DELETE                 — clear impersonation, fall back to your own.
//
// RLS on active_workspace_overrides limits the row to user_id = auth.uid().
// auth_workspace_id() only honors the override when org_role='org_admin'
// AND the impersonated workspace belongs to the user's org.

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json()) as { workspace_id?: string };
  if (!body.workspace_id) {
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
  }

  // Verify the user is org_admin and the target workspace is in their org.
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { org_role?: string | null; org_id?: string } | null;
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
  if (profile?.org_role !== "org_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: target } = await supabase
    .from("workspaces")
    .select("id, org_id")
    .eq("id", body.workspace_id)
    .maybeSingle();
  if (!target || target.org_id !== profile.org_id) {
    return NextResponse.json(
      { error: "workspace not in your org" },
      { status: 403 },
    );
  }

  const sbUpsert = supabase as unknown as {
    from: (t: string) => {
      upsert: (
        p: Record<string, unknown>,
        opts: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await sbUpsert
    .from("active_workspace_overrides")
    .upsert(
      { user_id: user.id, workspace_id: body.workspace_id },
      { onConflict: "user_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabase as unknown as {
    from: (t: string) => {
      delete: () => {
        eq: (col: string, val: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
  };
  const { error } = await sb
    .from("active_workspace_overrides")
    .delete()
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
