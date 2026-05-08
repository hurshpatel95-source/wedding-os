// POST /api/admin/email-templates/:id/use
//
// Records that a saved template was just dropped into the composer:
//   - increments use_count by 1
//   - sets last_used_at = now()
//
// This powers the "most-used templates first" sort in the dropdown and
// the "Last used" column on the settings list page. Failure here is
// non-critical — the composer should never block a send because the
// usage stat couldn't be bumped.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

  // Read current row first — RLS lets any org member SELECT.
  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: { use_count?: number | null } | null;
          }>;
        };
      };
      update: (row: unknown) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };

  const { data: existing } = await sb
    .from("email_templates")
    .select("use_count")
    .eq("id", params.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const next = (existing.use_count ?? 0) + 1;

  // RLS write policy is org_admin-only. If the caller isn't an admin the
  // update silently no-ops at the DB level — we still return 200 so the
  // composer flow doesn't break for non-admin callers.
  await sb
    .from("email_templates")
    .update({ use_count: next, last_used_at: new Date().toISOString() })
    .eq("id", params.id);

  return NextResponse.json({ ok: true, use_count: next });
}
