import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";

export const runtime = "nodejs";

// SECURITY: Same model as the parent token route — service role on the
// server, gated entirely by token-match. The token IS the auth.
function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/rsvp/[token]/plus-one — primary guest adds a +1 to their party.
// Body: { full_name, email? }
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  const token = params.token;
  if (!isUuid(token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    full_name?: string;
    email?: string | null;
  } | null;

  const fullName = body?.full_name?.trim();
  if (!fullName) {
    return NextResponse.json(
      { error: "full_name is required" },
      { status: 400 },
    );
  }
  if (fullName.length > 200) {
    return NextResponse.json({ error: "full_name too long" }, { status: 400 });
  }

  const email = body?.email?.trim() || null;
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  const sb = adminClient();

  // Resolve the primary guest from the token. Plus-ones can't add their own
  // plus-ones — only original invitees with plus_one_max > 0.
  const { data: primaryRaw } = await sb
    .from("guests")
    .select(
      "id, workspace_id, org_id, is_plus_one, plus_one_of_guest_id, plus_one_max",
    )
    .eq("rsvp_token", token)
    .maybeSingle();

  if (!primaryRaw) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const primary = primaryRaw as unknown as {
    id: string;
    workspace_id: string;
    org_id: string;
    is_plus_one: boolean;
    plus_one_of_guest_id: string | null;
    plus_one_max: number;
  };

  if (primary.is_plus_one) {
    return NextResponse.json(
      { error: "Plus-ones cannot add additional plus-ones." },
      { status: 403 },
    );
  }
  if ((primary.plus_one_max ?? 0) <= 0) {
    return NextResponse.json(
      { error: "Plus-ones aren't enabled on this invitation." },
      { status: 403 },
    );
  }

  // Count existing plus-ones for this primary.
  const { count: existingCount } = await (sb as unknown as {
    from: (t: string) => {
      select: (
        cols: string,
        opts: { count: "exact"; head: true },
      ) => {
        eq: (col: string, val: string) => Promise<{ count: number | null }>;
      };
    };
  })
    .from("guests")
    .select("id", { count: "exact", head: true })
    .eq("plus_one_of_guest_id", primary.id);

  if ((existingCount ?? 0) >= primary.plus_one_max) {
    return NextResponse.json(
      { error: "You've already added the maximum number of plus-ones." },
      { status: 409 },
    );
  }

  // Insert the new plus-one. Defaults: pending RSVP, fresh rsvp_token (DB
  // default), is_plus_one=true, linked to the primary.
  const insertPayload = {
    workspace_id: primary.workspace_id,
    org_id: primary.org_id,
    full_name: fullName,
    email,
    overall_rsvp: "pending",
    is_plus_one: true,
    plus_one_of_guest_id: primary.id,
    plus_one_max: 0,
    imported_from: null,
  };

  const { data: insertedRaw, error: insErr } = await sb
    .from("guests")
    .insert(insertPayload as never)
    .select(
      "id, full_name, overall_rsvp, email, rsvp_token",
    )
    .maybeSingle();

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }
  if (!insertedRaw) {
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  const inserted = insertedRaw as unknown as {
    id: string;
    full_name: string;
    overall_rsvp: "pending" | "yes" | "no" | "maybe";
    email: string | null;
    rsvp_token: string;
  };

  return NextResponse.json({
    ok: true,
    plus_one: {
      id: inserted.id,
      full_name: inserted.full_name,
      overall_rsvp: inserted.overall_rsvp,
      email: inserted.email,
    },
    rsvp_url: `/rsvp/${inserted.rsvp_token}`,
  });
}
