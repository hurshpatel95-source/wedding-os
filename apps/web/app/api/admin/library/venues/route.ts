import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { LibraryVenueFormPayload } from "@/lib/library-venue-types";

export const runtime = "nodejs";

async function requireOrgAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized", status: 401 as const };

  const { data: profile } = await supabase
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.org_role !== "org_admin") {
    return { error: "forbidden", status: 403 as const };
  }
  return { supabase, user, profile };
}

export async function POST(request: NextRequest) {
  const ctx = await requireOrgAdmin();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { supabase, profile, user } = ctx;

  const body = (await request.json()) as Partial<LibraryVenueFormPayload>;
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("library_venues")
    .insert({
      org_id: profile.org_id,
      created_by: user.id,
      name: body.name.trim(),
      address: body.address ?? null,
      city: body.city ?? null,
      region: body.region ?? null,
      country: body.country ?? null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      capacity_seated: body.capacity_seated ?? null,
      capacity_standing: body.capacity_standing ?? null,
      hire_fee_eur: body.hire_fee_eur ?? null,
      hire_fee_notes: body.hire_fee_notes ?? null,
      event_roles: body.event_roles ?? [],
      pros: body.pros ?? [],
      cons: body.cons ?? [],
      description: body.description ?? null,
      internal_notes: body.internal_notes ?? null,
    })
    .select("id")
    .single();

  if (error || !row) {
    return NextResponse.json(
      { error: error?.message ?? "insert failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: row.id });
}
