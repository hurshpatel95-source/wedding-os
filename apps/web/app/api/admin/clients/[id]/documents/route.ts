import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_UPLOAD_BYTES } from "@/lib/ai-quota";
import type { DocumentKind, DocumentRow } from "@/lib/wave2-types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 50MB cap per request (multiple files combined). */
const MAX_REQUEST_BYTES = 50 * 1024 * 1024;
const DOCUMENTS_BUCKET = "documents";

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
  if (!profile || profile.org_role !== "org_admin" || !profile.org_id) {
    return { error: "forbidden", status: 403 as const };
  }
  return { supabase, user, profile };
}

function pickKind(name: string, mime: string): DocumentKind {
  const lname = name.toLowerCase();
  const lmime = mime.toLowerCase();
  if (lmime.startsWith("image/")) return "photo";
  if (lmime === "application/pdf" || lname.endsWith(".pdf")) {
    if (lname.includes("contract")) return "contract";
    if (lname.includes("invoice") || lname.includes("receipt"))
      return "invoice_received";
    if (lname.includes("proposal") || lname.includes("quote"))
      return "vendor_proposal";
    if (lname.includes("venue") || lname.includes("agreement"))
      return "venue_agreement";
    if (lname.includes("permit") || lname.includes("license"))
      return "permit";
  }
  return "misc";
}

/** Generate a short collision-resistant id without an extra dependency. */
function shortId(): string {
  // 12 hex chars from crypto random
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
}

// Loose-typed view of supabase for tables not in types.gen.ts.
type LooseSb = {
  from: (t: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{ data: DocumentRow[] | null; error: { message: string } | null }>;
      };
    };
    insert: (
      rows: Record<string, unknown>[],
    ) => {
      select: (cols: string) => Promise<{
        data: DocumentRow[] | null;
        error: { message: string } | null;
      }>;
    };
  };
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireOrgAdmin();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { supabase, profile } = ctx;

  // Verify the workspace belongs to this org.
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, org_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!workspace) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (workspace.org_id !== profile.org_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sb = supabase as unknown as LooseSb;
  const { data, error } = await sb
    .from("documents")
    .select(
      "id, org_id, workspace_id, name, storage_path, file_size_bytes, mime_type, kind, uploaded_by, notes, created_at, updated_at",
    )
    .eq("workspace_id", params.id)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      { error: `list failed: ${error.message}` },
      { status: 500 },
    );
  }
  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireOrgAdmin();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { supabase, user, profile } = ctx;

  // Verify the workspace belongs to this org.
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, org_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!workspace) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (workspace.org_id !== profile.org_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "expected multipart/form-data" },
      { status: 400 },
    );
  }

  const fd = await request.formData();
  // Accept multiple files keyed as "file" or "files".
  const raw = [
    ...fd.getAll("file"),
    ...fd.getAll("files"),
    ...fd.getAll("file[]"),
  ].filter((v): v is File => v instanceof File);
  const files = raw.filter((f) => f.size > 0);
  if (files.length === 0) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  // Size guards.
  let totalBytes = 0;
  for (const f of files) {
    if (f.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `"${f.name}" exceeds the ${Math.round(
            MAX_UPLOAD_BYTES / 1024 / 1024,
          )}MB per-file limit`,
        },
        { status: 413 },
      );
    }
    totalBytes += f.size;
  }
  if (totalBytes > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      {
        error: `Total upload exceeds ${Math.round(
          MAX_REQUEST_BYTES / 1024 / 1024,
        )}MB`,
      },
      { status: 413 },
    );
  }

  const sb = supabase as unknown as LooseSb;
  const uploaded: { storagePath: string }[] = [];
  const inserts: Record<string, unknown>[] = [];

  try {
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
      const id = shortId();
      const storagePath = `${profile.org_id}/${params.id}/${id}/${safeName}`;
      const buf = Buffer.from(await file.arrayBuffer());

      const { error: upErr } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(storagePath, buf, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) {
        // Rollback any prior uploads.
        if (uploaded.length > 0) {
          await supabase.storage
            .from(DOCUMENTS_BUCKET)
            .remove(uploaded.map((u) => u.storagePath));
        }
        return NextResponse.json(
          { error: `upload failed: ${upErr.message}` },
          { status: 500 },
        );
      }
      uploaded.push({ storagePath });

      inserts.push({
        org_id: profile.org_id,
        workspace_id: params.id,
        name: file.name,
        storage_path: storagePath,
        file_size_bytes: file.size,
        mime_type: file.type || null,
        kind: pickKind(file.name, file.type || ""),
        uploaded_by: user.id,
      });
    }

    const { data: rows, error: insErr } = await sb
      .from("documents")
      .insert(inserts)
      .select(
        "id, org_id, workspace_id, name, storage_path, file_size_bytes, mime_type, kind, uploaded_by, notes, created_at, updated_at",
      );
    if (insErr || !rows) {
      // Rollback storage objects.
      await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .remove(uploaded.map((u) => u.storagePath));
      return NextResponse.json(
        { error: insErr?.message ?? "documents insert failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ documents: rows });
  } catch (e) {
    if (uploaded.length > 0) {
      await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .remove(uploaded.map((u) => u.storagePath));
    }
    const msg = e instanceof Error ? e.message : "upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
