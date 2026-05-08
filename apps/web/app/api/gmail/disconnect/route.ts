import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/gmail/disconnect
// Workspace member only. Marks the workspace's Gmail connection revoked
// and clears the tokens (keeps email + last_synced_at for audit).
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const profileSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { workspace_id?: string | null } | null;
          }>;
        };
      };
    };
  };
  const { data: profile } = await profileSb
    .from("users")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id) {
    return NextResponse.json({ ok: false, error: "no_workspace" }, { status: 400 });
  }

  const updSb = supabase as unknown as {
    from: (t: string) => {
      update: (vals: unknown) => {
        eq: (col: string, val: string) => {
          eq: (
            col: string,
            val: string,
          ) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
  };
  const { error } = await updSb
    .from("gmail_connections")
    .update({
      status: "revoked",
      refresh_token: null,
      access_token: null,
      access_token_expires_at: null,
    })
    .eq("workspace_id", profile.workspace_id)
    .eq("status", "active");

  if (error) {
    return NextResponse.json(
      { ok: false, error: "update_failed", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
