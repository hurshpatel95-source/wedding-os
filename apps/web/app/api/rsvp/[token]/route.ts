import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";

export const runtime = "nodejs";

// Public anon client. RLS allows SELECT/UPDATE on guests for anon, but the
// API layer is the actual gate — every operation here filters by exact
// rsvp_token match.
function publicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const ALLOWED_RSVP = new Set(["pending", "yes", "no", "maybe"]);

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } },
) {
  const token = params.token;
  if (!isUuid(token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  const sb = publicClient();
  const { data: guest, error } = await sb
    .from("guests")
    .select(
      "id, full_name, overall_rsvp, dietary, allergies, notes, workspace_id",
    )
    .eq("rsvp_token", token)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!guest) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { data: workspace } = await sb
    .from("workspaces")
    .select("name, wedding_date, public_slug")
    .eq("id", guest.workspace_id)
    .maybeSingle();

  return NextResponse.json({ guest, workspace: workspace ?? null });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  const token = params.token;
  if (!isUuid(token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  const body = (await request.json()) as {
    overall_rsvp?: string;
    dietary?: string;
    allergies?: string;
    notes?: string;
  };

  const patch: Record<string, unknown> = {};
  if (body.overall_rsvp != null) {
    if (!ALLOWED_RSVP.has(body.overall_rsvp)) {
      return NextResponse.json(
        { error: "overall_rsvp must be one of pending|yes|no|maybe" },
        { status: 400 },
      );
    }
    patch.overall_rsvp = body.overall_rsvp;
  }
  if (body.dietary !== undefined) patch.dietary = body.dietary || null;
  if (body.allergies !== undefined) patch.allergies = body.allergies || null;
  if (body.notes !== undefined) patch.notes = body.notes || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  // CRITICAL: filter the update by exact token. RLS WITH CHECK is permissive
  // (anon role) — the WHERE clause is the actual gate.
  const sb = publicClient();
  const { data: updated, error } = await sb
    .from("guests")
    .update(patch as never)
    .eq("rsvp_token", token)
    .select("id, full_name, overall_rsvp, dietary, allergies, notes")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, guest: updated });
}
