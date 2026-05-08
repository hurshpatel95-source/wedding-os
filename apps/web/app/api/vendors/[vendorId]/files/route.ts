// Per-vendor file folder API.
//
// The `documents` table has no vendor_id column and we cannot add a
// migration here. We associate documents with a vendor purely by storage
// path prefix: `vendor/${vendorId}/${shortId}/${filename}`. Filtering and
// authorization is layered:
//   1. workspace member auth via Supabase session
//   2. vendor.workspace_id must match the caller's workspace_id
//   3. storage_path LIKE `vendor/${vendorId}/%`
//   4. workspace_id RLS gates the documents row read/write naturally

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_UPLOAD_BYTES } from "@/lib/ai-quota";
import type { DocumentKind, DocumentRow } from "@/lib/wave2-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_REQUEST_BYTES = 50 * 1024 * 1024; // 50 MB total per request
const DOCUMENTS_BUCKET = "documents";

interface VendorScopeRow {
  id: string;
  workspace_id: string;
  org_id: string;
}

interface UserProfileRow {
  workspace_id: string | null;
  org_id: string | null;
  org_role: string | null;
}

async function requireVendorScope(vendorId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "unauthorized", status: 401 as const };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id, org_id, org_role")
    .eq("id", user.id)
    .maybeSingle();
  const p = profile as UserProfileRow | null;
  if (!p?.workspace_id || !p?.org_id) {
    return { error: "no workspace", status: 400 as const };
  }

  // Vendors aren't in generated Database types — cast to bypass typed builder.
  const sbAny = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: VendorScopeRow | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  const { data: vendor } = await sbAny
    .from("vendors")
    .select("id, workspace_id, org_id")
    .eq("id", vendorId)
    .maybeSingle();

  if (!vendor) {
    return { error: "not found", status: 404 as const };
  }
  // Members can only act on vendors in their own workspace.
  if (vendor.workspace_id !== p.workspace_id) {
    return { error: "forbidden", status: 403 as const };
  }

  return { supabase, user, profile: p, vendor };
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

function shortId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
}

// Loose-typed view of supabase for tables not in types.gen.ts.
type LooseSb = {
  from: (t: string) => {
    select: (cols: string) => {
      like: (col: string, val: string) => {
        eq: (col: string, val: string) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{
            data: DocumentRow[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
    insert: (rows: Record<string, unknown>[]) => {
      select: (cols: string) => Promise<{
        data: DocumentRow[] | null;
        error: { message: string } | null;
      }>;
    };
  };
};

const DOC_COLS =
  "id, org_id, workspace_id, name, storage_path, file_size_bytes, mime_type, kind, uploaded_by, notes, created_at, updated_at";

export async function GET(
  _request: NextRequest,
  { params }: { params: { vendorId: string } },
) {
  const ctx = await requireVendorScope(params.vendorId);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { supabase, vendor } = ctx;
  const sb = supabase as unknown as LooseSb;

  const { data, error } = await sb
    .from("documents")
    .select(DOC_COLS)
    .like("storage_path", `vendor/${params.vendorId}/%`)
    .eq("workspace_id", vendor.workspace_id)
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
  { params }: { params: { vendorId: string } },
) {
  const ctx = await requireVendorScope(params.vendorId);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { supabase, user, vendor } = ctx;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "expected multipart/form-data" },
      { status: 400 },
    );
  }

  const fd = await request.formData();
  const raw = [
    ...fd.getAll("file"),
    ...fd.getAll("files"),
    ...fd.getAll("file[]"),
  ].filter((v): v is File => v instanceof File);
  const files = raw.filter((f) => f.size > 0);
  if (files.length === 0) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

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
      // Vendor-prefixed path — this is the ONLY thing tying the doc back to
      // the vendor since the schema has no vendor_id column.
      const storagePath = `vendor/${params.vendorId}/${id}/${safeName}`;
      const buf = Buffer.from(await file.arrayBuffer());

      const { error: upErr } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(storagePath, buf, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) {
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
        org_id: vendor.org_id,
        workspace_id: vendor.workspace_id,
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
      .select(DOC_COLS);
    if (insErr || !rows) {
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
