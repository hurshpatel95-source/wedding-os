import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";

export const runtime = "nodejs";

// SECURITY: We use the SERVICE ROLE key here, NOT the anon key. The anon key
// would let any visitor hit Supabase REST directly and exfiltrate or rewrite
// the guests table. With service role, all access is gated by THIS route's
// token-match logic. The service role key never ships to the client — it's
// read on the server only.
function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

  const sb = adminClient();
  const { data: guestRow, error } = await sb
    .from("guests")
    .select(
      // is_plus_one / plus_one_of_guest_id / plus_one_max are added in
      // migration 0025. Generated types lag; we re-shape via cast below.
      "id, full_name, overall_rsvp, dietary, allergies, notes, workspace_id, is_plus_one, plus_one_of_guest_id, plus_one_max",
    )
    .eq("rsvp_token", token)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!guestRow) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const guest = guestRow as unknown as {
    id: string;
    full_name: string;
    overall_rsvp: "pending" | "yes" | "no" | "maybe";
    dietary: string | null;
    allergies: string | null;
    notes: string | null;
    workspace_id: string;
    is_plus_one: boolean;
    plus_one_of_guest_id: string | null;
    plus_one_max: number;
  };

  // Surface only the workspace's public-presentation fields for context.
  const { data: workspace } = await sb
    .from("workspaces")
    .select("name, wedding_date, public_slug")
    .eq("id", guest.workspace_id)
    .maybeSingle();

  // Fetch any plus-ones linked to this primary guest. We never expose plus-
  // one rsvp_tokens here — those are private to the +1 themselves.
  const { data: plusOnesRaw } = await (sb as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => Promise<{
          data: Array<{
            id: string;
            full_name: string;
            overall_rsvp: "pending" | "yes" | "no" | "maybe";
            email: string | null;
          }> | null;
        }>;
      };
    };
  })
    .from("guests")
    .select("id, full_name, overall_rsvp, email")
    .eq("plus_one_of_guest_id", guest.id);

  const plusOnes = plusOnesRaw ?? [];

  return NextResponse.json({
    guest: {
      id: guest.id,
      full_name: guest.full_name,
      overall_rsvp: guest.overall_rsvp,
      dietary: guest.dietary,
      allergies: guest.allergies,
      notes: guest.notes,
      workspace_id: guest.workspace_id,
      is_plus_one: guest.is_plus_one,
      plus_one_of_guest_id: guest.plus_one_of_guest_id,
      plus_one_max: guest.plus_one_max,
    },
    workspace: workspace ?? null,
    plus_ones: plusOnes,
  });
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

  // Filter the update by exact token. The token IS the auth here — a
  // 122-bit UUID is unguessable in practice. We never let an anon caller
  // change rsvp_token, workspace_id, org_id, or full_name (planner-managed).
  const sb = adminClient();
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
