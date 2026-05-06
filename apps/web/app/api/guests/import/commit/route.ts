import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NormalizedRow, GuestSide } from "@/lib/guest-types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface CommitBody {
  import_id: string;
  rows: NormalizedRow[];
  default_side?: GuestSide | null; // optional: apply to rows missing a side
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("role, workspace_id, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const body = (await request.json()) as CommitBody;
  if (!body?.rows || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "missing rows" }, { status: 400 });
  }

  const inserts = body.rows
    .filter((r) => r.full_name && r.full_name.trim().length > 0)
    .map((r) => ({
      workspace_id: profile.workspace_id,
      org_id: profile.org_id,
      full_name: r.full_name!.trim(),
      email: r.email ?? null,
      phone: r.phone ?? null,
      side: (r.side ?? body.default_side ?? null) as GuestSide | null,
      relationship: r.relationship ?? null,
      address: r.address ?? null,
      city: r.city ?? null,
      region: r.region ?? null,
      postal_code: r.postal_code ?? null,
      country: r.country ?? null,
      dietary: r.dietary ?? null,
      allergies: r.allergies ?? null,
      notes: r.notes ?? null,
      added_by: user.id,
      imported_from: body.import_id,
    }));

  if (inserts.length === 0) {
    return NextResponse.json({ error: "no valid rows to import" }, { status: 400 });
  }

  const { data: created, error } = await supabase.from("guests").insert(inserts).select("id");
  if (error) {
    await supabase
      .from("guest_imports")
      .update({ status: "failed", error: error.message })
      .eq("id", body.import_id);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase
    .from("guest_imports")
    .update({
      status: "committed",
      rows_imported: created?.length ?? 0,
      rows_skipped: body.rows.length - (created?.length ?? 0),
    })
    .eq("id", body.import_id);

  return NextResponse.json({
    imported: created?.length ?? 0,
    skipped: body.rows.length - (created?.length ?? 0),
  });
}
