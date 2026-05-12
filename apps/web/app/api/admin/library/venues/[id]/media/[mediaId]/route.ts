import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LIBRARY_MEDIA_BUCKET } from "@/lib/library-venue-types";
import type { Database } from "@wedding-os/db";
import {
  dbUpdate,
  dbDelete,
  dbWriteErrorResponse,
} from "@/lib/db-write-guard";

type LibraryVenueMediaUpdate =
  Database["public"]["Tables"]["library_venue_media"]["Update"];

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
  { params }: { params: { id: string; mediaId: string } },
) {
  const ctx = await requireOrgAdmin();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { supabase } = ctx;

  const body = (await request.json()) as {
    sort_order?: number;
    alt?: string | null;
  };

  const update: LibraryVenueMediaUpdate = {};
  if (typeof body.sort_order === "number") update.sort_order = body.sort_order;
  if (body.alt !== undefined) update.alt = body.alt;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }

  try {
    await dbUpdate(
      "update library_venue_media",
      supabase
        .from("library_venue_media")
        .update(update as never)
        .eq("id", params.mediaId)
        .eq("library_venue_id", params.id)
        .select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; mediaId: string } },
) {
  const ctx = await requireOrgAdmin();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { supabase } = ctx;

  // Look up storage_path so we can also remove the underlying object.
  const { data: row } = await supabase
    .from("library_venue_media")
    .select("storage_path")
    .eq("id", params.mediaId)
    .eq("library_venue_id", params.id)
    .maybeSingle();

  if (row?.storage_path) {
    await supabase.storage
      .from(LIBRARY_MEDIA_BUCKET)
      .remove([row.storage_path]);
  }

  try {
    await dbDelete(
      "delete library_venue_media",
      supabase
        .from("library_venue_media")
        .delete()
        .eq("id", params.mediaId)
        .eq("library_venue_id", params.id)
        .select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
