import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// POST /api/alerts/[id]/dismiss
//
// Convenience passthrough to /api/alerts/[id] with { dismissed: true }.
// AlertsFeed (from ALERTS-DIGEST) calls this endpoint; the canonical
// PATCH endpoint lives at /api/alerts/[id]. We mirror the auth rules.
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = supabase as unknown as {
    from: (t: string) => {
      update: (row: unknown) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const { error } = await sb
    .from("alerts")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
