import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LIBRARY_MEDIA_BUCKET } from "@/lib/library-venue-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const VIDEO_MIME_PREFIX = "video/";
const VIDEO_EXT = /\.(mov|mp4|m4v|webm)$/i;

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireOrgAdmin();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { supabase, profile } = ctx;

  // Verify the venue exists and is in this org (RLS enforces this too).
  const { data: venue } = await supabase
    .from("library_venues")
    .select("id, org_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!venue) {
    return NextResponse.json({ error: "venue not found" }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "expected multipart/form-data" },
      { status: 400 },
    );
  }

  const fd = await request.formData();
  const file = fd.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  const isVideo =
    file.type.startsWith(VIDEO_MIME_PREFIX) || VIDEO_EXT.test(file.name);
  const kind: "photo" | "video" = isVideo ? "video" : "photo";

  const ab = await file.arrayBuffer();
  const buf = Buffer.from(ab);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${profile.org_id}/${params.id}/${Date.now()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from(LIBRARY_MEDIA_BUCKET)
    .upload(storagePath, buf, {
      contentType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
      upsert: false,
    });
  if (upErr) {
    return NextResponse.json(
      { error: `upload failed: ${upErr.message}` },
      { status: 500 },
    );
  }

  // Append at the end of the existing list.
  const { data: existing } = await supabase
    .from("library_venue_media")
    .select("sort_order")
    .eq("library_venue_id", params.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (existing?.sort_order ?? -1) + 1;

  const { data: row, error: insErr } = await supabase
    .from("library_venue_media")
    .insert({
      library_venue_id: params.id,
      kind,
      storage_path: storagePath,
      sort_order: nextSort,
      alt: null,
    })
    .select("id, kind, storage_path, sort_order, alt")
    .single();

  if (insErr || !row) {
    // Try to roll back the storage object so we don't orphan it.
    await supabase.storage.from(LIBRARY_MEDIA_BUCKET).remove([storagePath]);
    return NextResponse.json(
      { error: insErr?.message ?? "media insert failed" },
      { status: 500 },
    );
  }

  // Return a signed URL so the client can render immediately.
  const { data: signed } = await supabase.storage
    .from(LIBRARY_MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  return NextResponse.json({
    item: {
      id: row.id,
      kind: row.kind,
      storage_path: row.storage_path,
      sort_order: row.sort_order,
      alt: row.alt,
      signed_url: signed?.signedUrl ?? null,
    },
  });
}
