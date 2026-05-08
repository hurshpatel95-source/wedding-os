import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// PATCH /api/alerts/[id]   body: { read?: boolean, dismissed?: boolean }
//
// Sets read_at = now() or dismissed_at = now() (or unsets — pass false).
// RLS in the migration restricts updates to workspace members for
// audience IN ('couple', 'both'). org_admin can update anything.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { read?: boolean; dismissed?: boolean } = {};
  try {
    body = (await request.json()) as { read?: boolean; dismissed?: boolean };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (body.read === undefined && body.dismissed === undefined) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const patch: Record<string, string | null> = {};
  if (body.read !== undefined) {
    patch.read_at = body.read ? new Date().toISOString() : null;
  }
  if (body.dismissed !== undefined) {
    patch.dismissed_at = body.dismissed ? new Date().toISOString() : null;
  }

  // alerts table isn't in generated Database types yet — cast through.
  const sb = supabase as unknown as {
    from: (t: string) => {
      update: (vals: Record<string, unknown>) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };

  const { error } = await sb.from("alerts").update(patch).eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
