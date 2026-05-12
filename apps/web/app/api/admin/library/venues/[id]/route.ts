import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  LIBRARY_MEDIA_BUCKET,
  type LibraryVenueFormPayload,
  type LibraryVenueUpdate,
} from "@/lib/library-venue-types";
import {
  dbUpdate,
  dbDelete,
  dbWriteErrorResponse,
} from "@/lib/db-write-guard";

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireOrgAdmin();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { supabase } = ctx;

  const body = (await request.json()) as Partial<LibraryVenueFormPayload>;

  // Build the update payload with only the fields that were provided.
  const update: LibraryVenueUpdate = {};
  if (body.name !== undefined) {
    if (!body.name.trim()) {
      return NextResponse.json(
        { error: "name cannot be empty" },
        { status: 400 },
      );
    }
    update.name = body.name.trim();
  }
  if (body.address !== undefined) update.address = body.address;
  if (body.city !== undefined) update.city = body.city;
  if (body.region !== undefined) update.region = body.region;
  if (body.country !== undefined) update.country = body.country;
  if (body.lat !== undefined) update.lat = body.lat;
  if (body.lng !== undefined) update.lng = body.lng;
  if (body.capacity_seated !== undefined)
    update.capacity_seated = body.capacity_seated;
  if (body.capacity_standing !== undefined)
    update.capacity_standing = body.capacity_standing;
  if (body.hire_fee_eur !== undefined) update.hire_fee_eur = body.hire_fee_eur;
  if (body.hire_fee_notes !== undefined)
    update.hire_fee_notes = body.hire_fee_notes;
  if (body.event_roles !== undefined) update.event_roles = body.event_roles;
  if (body.pros !== undefined) update.pros = body.pros;
  if (body.cons !== undefined) update.cons = body.cons;
  if (body.description !== undefined) update.description = body.description;
  if (body.internal_notes !== undefined)
    update.internal_notes = body.internal_notes;

  try {
    await dbUpdate(
      "update library_venue",
      supabase
        .from("library_venues")
        .update(update as never)
        .eq("id", params.id)
        .select("id"),
    );
    return NextResponse.json({ id: params.id });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireOrgAdmin();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { supabase } = ctx;

  // Pull every media row so we can clean up storage objects too. Cascade
  // deletes the media rows but NOT the storage objects.
  const { data: media } = await supabase
    .from("library_venue_media")
    .select("storage_path")
    .eq("library_venue_id", params.id);

  const paths = (media ?? [])
    .map((m) => m.storage_path)
    .filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    await supabase.storage.from(LIBRARY_MEDIA_BUCKET).remove(paths);
  }

  try {
    await dbDelete(
      "delete library_venue",
      supabase.from("library_venues").delete().eq("id", params.id).select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
