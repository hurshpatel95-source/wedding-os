// POST /api/testimonial/[token]/photo
//
// Public couple-side photo upload for an active testimonial request. The
// 122-bit public_token is the auth — service-role keyed so the upload
// can land in the (private) library-media bucket without anon storage
// policy headaches. Returns the storage_path for the form to save into
// /api/testimonial/[token].

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";
import type { TestimonialRow } from "@/lib/wave2-types";

export const runtime = "nodejs";
export const maxDuration = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "library-media";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPTED_PREFIX = "image/";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Service role key not configured" },
      { status: 503 },
    );
  }
  if (!UUID_RE.test(params.token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "expected multipart/form-data" },
      { status: 400 },
    );
  }

  const sb = adminClient();
  const lookup = sb as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: TestimonialRow | null }>;
        };
      };
    };
  };
  const { data: testimonial } = await lookup
    .from("testimonials")
    .select(
      "id, org_id, workspace_id, couple_names, contact_email, quote, rating, photo_storage_path, status, public_token, requested_at, submitted_at, published_at, created_by, created_at, updated_at",
    )
    .eq("public_token", params.token)
    .maybeSingle();

  if (!testimonial) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (testimonial.status === "declined" || testimonial.status === "published") {
    return NextResponse.json(
      { error: "This testimonial is closed for edits." },
      { status: 409 },
    );
  }

  const fd = await request.formData();
  const file = fd.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  if (!file.type.startsWith(ACCEPTED_PREFIX)) {
    return NextResponse.json(
      { error: "Photo must be an image (jpg/png/webp)." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES / 1024 / 1024}MB).` },
      { status: 413 },
    );
  }

  const ab = await file.arrayBuffer();
  const buf = Buffer.from(ab);

  const ext = (() => {
    const m = file.type.split("/")[1] ?? "jpg";
    if (m === "jpeg") return "jpg";
    return m.replace(/[^a-z0-9]/gi, "") || "jpg";
  })();

  const newPath = `${testimonial.org_id}/testimonials/${testimonial.id}.${ext}`;

  // Clean up the previous photo if its extension differed.
  if (
    testimonial.photo_storage_path &&
    testimonial.photo_storage_path !== newPath
  ) {
    await sb.storage.from(BUCKET).remove([testimonial.photo_storage_path]);
  }

  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(newPath, buf, {
      contentType: file.type,
      upsert: true,
    });
  if (upErr) {
    return NextResponse.json(
      { error: `upload failed: ${upErr.message}` },
      { status: 500 },
    );
  }

  // Persist the path on the testimonial row.
  const upd = sb as unknown as {
    from: (t: string) => {
      update: (row: unknown) => {
        eq: (col: string, val: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
  };
  const { error: updErr } = await upd
    .from("testimonials")
    .update({ photo_storage_path: newPath })
    .eq("public_token", params.token);
  if (updErr) {
    return NextResponse.json(
      { error: `save failed: ${updErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, storage_path: newPath });
}
