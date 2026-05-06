import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const BUCKET = "library-media";
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB hard cap on logos.
const ACCEPTED_PREFIX = "image/";

async function authedAdminContext(workspaceId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" as const, status: 401 };

  const { data: profile } = await supabase
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();
  const orgRole = (profile?.org_role ?? null) as
    | "org_admin"
    | "member"
    | null;
  if (orgRole !== "org_admin")
    return { error: "forbidden" as const, status: 403 };

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, org_id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!workspace)
    return { error: "not found" as const, status: 404 };
  if (workspace.org_id !== profile?.org_id)
    return { error: "forbidden" as const, status: 403 };

  return {
    supabase,
    orgId: workspace.org_id as string,
    workspaceId: workspace.id as string,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await authedAdminContext(params.id);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { supabase, orgId, workspaceId } = ctx;

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
  if (!file.type.startsWith(ACCEPTED_PREFIX)) {
    return NextResponse.json(
      { error: "logo must be an image" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `file too large (max ${MAX_BYTES / 1024 / 1024}MB)` },
      { status: 413 },
    );
  }

  const ab = await file.arrayBuffer();
  const buf = Buffer.from(ab);

  // Pick extension from MIME — keeps the storage path tidy.
  const ext = (() => {
    const m = file.type.split("/")[1] ?? "png";
    if (m === "jpeg") return "jpg";
    if (m === "svg+xml") return "svg";
    return m.replace(/[^a-z0-9]/gi, "") || "png";
  })();

  // Spec says path should be {org_id}/branding/{workspace_id}.{ext}.
  // We delete any prior file at a different extension before writing the new one.
  const newPath = `${orgId}/branding/${workspaceId}.${ext}`;

  // Look up the previous logo path so we can clean it up if the extension changed.
  const { data: existing } = await supabase
    .from("workspace_branding")
    .select("logo_storage_path")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const previousPath = existing?.logo_storage_path ?? null;

  // Upsert (overwrite) the new file at newPath.
  const { error: upErr } = await supabase.storage
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

  // If the prior path existed and points at a *different* file, delete it.
  if (previousPath && previousPath !== newPath) {
    await supabase.storage.from(BUCKET).remove([previousPath]);
  }

  // Persist the new path on workspace_branding (UPSERT).
  if (!existing) {
    const { error: insErr } = await supabase.from("workspace_branding").insert({
      workspace_id: workspaceId,
      logo_storage_path: newPath,
    });
    if (insErr) {
      return NextResponse.json(
        { error: `branding insert failed: ${insErr.message}` },
        { status: 500 },
      );
    }
  } else {
    const { error: updErr } = await supabase
      .from("workspace_branding")
      .update({ logo_storage_path: newPath })
      .eq("workspace_id", workspaceId);
    if (updErr) {
      return NextResponse.json(
        { error: `branding update failed: ${updErr.message}` },
        { status: 500 },
      );
    }
  }

  // Hand back a fresh signed URL so the client can swap the preview.
  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(newPath, 60 * 60);

  return NextResponse.json({
    logo_storage_path: newPath,
    signed_url: signed?.signedUrl ?? null,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await authedAdminContext(params.id);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { supabase, workspaceId } = ctx;

  const { data: existing } = await supabase
    .from("workspace_branding")
    .select("logo_storage_path")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (existing?.logo_storage_path) {
    await supabase.storage
      .from(BUCKET)
      .remove([existing.logo_storage_path]);
  }

  const { error: updErr } = await supabase
    .from("workspace_branding")
    .update({ logo_storage_path: null })
    .eq("workspace_id", workspaceId);
  if (updErr) {
    return NextResponse.json(
      { error: `update failed: ${updErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
