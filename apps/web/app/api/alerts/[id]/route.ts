import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbUpdate, dbWriteErrorResponse } from "@/lib/db-write-guard";

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
      "update alert (read/dismissed flags)",
      sb.from("alerts").update(patch).eq("id", params.id).select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
