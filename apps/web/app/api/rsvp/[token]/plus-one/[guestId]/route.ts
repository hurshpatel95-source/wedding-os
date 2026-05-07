import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";

export const runtime = "nodejs";

// SECURITY: Service-role + token gate, same as parent. We only allow
// removal of plus-ones whose primary matches the token AND who are still
// in `pending` RSVP. Once a +1 has confirmed (yes/no/maybe), removing
// silently would lose host-relevant info — host has to do that.
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { token: string; guestId: string } },
) {
  const { token, guestId } = params;
  if (!isUuid(token) || !isUuid(guestId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const sb = adminClient();

  // Resolve primary from token.
  const { data: primaryRaw } = await sb
    .from("guests")
    .select("id")
    .eq("rsvp_token", token)
    .maybeSingle();

  if (!primaryRaw) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const primary = primaryRaw as unknown as { id: string };

  // Verify the target is actually a plus-one of this primary, and that
  // they haven't already RSVPed.
  const { data: targetRaw } = await sb
    .from("guests")
    .select("id, overall_rsvp, plus_one_of_guest_id, is_plus_one")
    .eq("id", guestId)
    .maybeSingle();

  if (!targetRaw) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const target = targetRaw as unknown as {
    id: string;
    overall_rsvp: "pending" | "yes" | "no" | "maybe";
    plus_one_of_guest_id: string | null;
    is_plus_one: boolean;
  };

  if (
    !target.is_plus_one ||
    target.plus_one_of_guest_id !== primary.id
  ) {
    return NextResponse.json(
      { error: "Not your plus-one to remove." },
      { status: 403 },
    );
  }

  if (target.overall_rsvp !== "pending") {
    return NextResponse.json(
      {
        error:
          "This plus-one has already RSVPed — message the couple to remove them.",
      },
      { status: 409 },
    );
  }

  // Hard delete — the row is fully owned by the primary's invitation,
  // never has descendants of its own, and we already gated on `pending`.
  const { error: delErr } = await sb
    .from("guests")
    .delete()
    .eq("id", guestId);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
