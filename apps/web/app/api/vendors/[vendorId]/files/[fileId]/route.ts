// Per-file routes for vendor folders.
// PATCH:  update kind / notes
// DELETE: verify storage_path begins with `vendor/${vendorId}/`, drop row + storage object
// GET:    302 redirect to a 60s signed URL for download

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  dbUpdate,
  dbDelete,
  dbWriteErrorResponse,
} from "@/lib/db-write-guard";
import type { DocumentKind, DocumentRow } from "@/lib/wave2-types";

export const runtime = "nodejs";

const DOCUMENTS_BUCKET = "documents";
const SIGNED_URL_TTL_SECONDS = 60;

const VALID_KINDS: DocumentKind[] = [
  "contract",
  "invoice_received",
  "vendor_proposal",
  "venue_agreement",
  "permit",
  "photo",
  "misc",
];

interface PatchBody {
  kind?: DocumentKind;
  notes?: string | null;
  name?: string;
}

interface VendorScopeRow {
  id: string;
  workspace_id: string;
}

interface UserProfileRow {
  workspace_id: string | null;
  org_id: string | null;
}

async function requireMemberWithVendor(vendorId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "unauthorized", status: 401 as const };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id, org_id")
    .eq("id", user.id)
    .maybeSingle();
  const p = profile as UserProfileRow | null;
  if (!p?.workspace_id) {
    return { error: "no workspace", status: 400 as const };
  }

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
    .select("id, workspace_id")
    .eq("id", vendorId)
    .maybeSingle();
  if (!vendor) {
    return { error: "not found", status: 404 as const };
  }
  if (vendor.workspace_id !== p.workspace_id) {
    return { error: "forbidden", status: 403 as const };
  }

  return { supabase, user, profile: p, vendor };
}

type LooseSb = {
  from: (t: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{
          data: DocumentRow | null;
          error: { message: string } | null;
        }>;
      };
    };
    update: (p: Record<string, unknown>) => {
      eq: (col: string, val: string) => {
        select: (cols: string) => PromiseLike<{
          data: DocumentRow[] | null;
          error: { message: string } | null;
        }>;
      };
    };
    delete: () => {
      eq: (col: string, val: string) => {
        select: (cols: string) => PromiseLike<{
          data: { id: string }[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

const DOC_COLS =
  "id, org_id, workspace_id, name, storage_path, file_size_bytes, mime_type, kind, uploaded_by, notes, created_at, updated_at";

function ensureBelongsToVendor(doc: DocumentRow, vendorId: string): boolean {
  return doc.storage_path.startsWith(`vendor/${vendorId}/`);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { vendorId: string; fileId: string } },
) {
  const ctx = await requireMemberWithVendor(params.vendorId);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { supabase, profile } = ctx;
  const sb = supabase as unknown as LooseSb;

  const { data: doc } = await sb
    .from("documents")
    .select(DOC_COLS)
    .eq("id", params.fileId)
    .maybeSingle();
  if (!doc) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (doc.workspace_id !== profile.workspace_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!ensureBelongsToVendor(doc, params.vendorId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: doc.name,
    });
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signErr?.message ?? "could not sign url" },
      { status: 500 },
    );
  }
  return NextResponse.redirect(signed.signedUrl, 302);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { vendorId: string; fileId: string } },
) {
  const ctx = await requireMemberWithVendor(params.vendorId);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { supabase, profile } = ctx;
  const sb = supabase as unknown as LooseSb;

  const { data: existing } = await sb
    .from("documents")
    .select(DOC_COLS)
    .eq("id", params.fileId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.workspace_id !== profile.workspace_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!ensureBelongsToVendor(existing, params.vendorId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const patch: Record<string, unknown> = {};
  if (body.kind !== undefined) {
    if (!VALID_KINDS.includes(body.kind)) {
      return NextResponse.json({ error: "invalid kind" }, { status: 400 });
    }
    patch.kind = body.kind;
  }
  if (body.notes !== undefined) {
    if (body.notes === null) patch.notes = null;
    else if (typeof body.notes === "string") {
      const t = body.notes.trim();
      patch.notes = t.length === 0 ? null : t;
    }
  }
  if (body.name !== undefined && typeof body.name === "string") {
    const t = body.name.trim();
    if (t.length === 0) {
      return NextResponse.json(
        { error: "name cannot be empty" },
        { status: 400 },
      );
    }
    patch.name = t;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "no fields to update" },
      { status: 400 },
    );
  }

  try {
    const rows = await dbUpdate(
      "update document (kind/notes/name)",
      sb
        .from("documents")
        .update(patch)
        .eq("id", params.fileId)
        .select(DOC_COLS),
    );
    return NextResponse.json({ document: rows[0] });
  } catch (err) {
    const { status, body: errBody } = dbWriteErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { vendorId: string; fileId: string } },
) {
  const ctx = await requireMemberWithVendor(params.vendorId);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { supabase, profile } = ctx;
  const sb = supabase as unknown as LooseSb;

  const { data: existing } = await sb
    .from("documents")
    .select(DOC_COLS)
    .eq("id", params.fileId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.workspace_id !== profile.workspace_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!ensureBelongsToVendor(existing, params.vendorId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await dbDelete(
      "delete document (vendor file)",
      sb.from("documents").delete().eq("id", params.fileId).select("id"),
    );
  } catch (err) {
    const { status, body: errBody } = dbWriteErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }

  // Best-effort storage cleanup. Even if this fails the row is gone.
  await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([existing.storage_path])
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
