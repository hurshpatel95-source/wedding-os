// PATCH /api/workspace/preferences
//
// Couple-side knobs that don't deserve their own endpoints — currency is the
// big one. We accept a small allowlist of fields and refuse anything else so
// this can't accidentally become a way to flip planner-only flags from the
// couple shell.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_CURRENCIES = ["USD", "EUR"] as const;
type Currency = (typeof ALLOWED_CURRENCIES)[number];

interface PatchBody {
  base_currency?: string;
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id) {
    return NextResponse.json({ error: "no workspace" }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const patch: { base_currency?: string } = {};
  if (body.base_currency != null) {
    const c = String(body.base_currency).toUpperCase().trim() as Currency;
    if (!(ALLOWED_CURRENCIES as readonly string[]).includes(c)) {
      return NextResponse.json(
        {
          error: `base_currency must be one of: ${ALLOWED_CURRENCIES.join(", ")}`,
        },
        { status: 400 },
      );
    }
    patch.base_currency = c;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const { error: updErr } = await supabase
    .from("workspaces")
    .update(patch)
    .eq("id", profile.workspace_id);
  if (updErr) {
    return NextResponse.json(
      { error: `Couldn't update: ${updErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, ...patch });
}
