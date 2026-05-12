import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DocumentKind, DocumentRow } from "@/lib/wave2-types";
import {
  dbUpdate,
  dbDelete,
  dbWriteErrorResponse,
} from "@/lib/db-write-guard";

export const runtime = "nodejs";

const DOCUMENTS_BUCKET = "documents";
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireOrgAdmin();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { supabase, profile } = ctx;
  const sb = supabase as unknown as LooseSb;

  const { data: existing, error: fetchErr } = await sb
    .from("documents")
    .select(
      "id, org_id, workspace_id, name, storage_path, file_size_bytes, mime_type, kind, uploaded_by, notes, created_at, updated_at",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (fetchErr || !existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.org_id !== profile.org_id) {
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
      return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
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
      "update document (admin)",
      sb
        .from("documents")
        .update(patch)
        .eq("id", params.id)
        .select(
          "id, org_id, workspace_id, name, storage_path, file_size_bytes, mime_type, kind, uploaded_by, notes, created_at, updated_at",
        ),
    );
    return NextResponse.json({ document: rows[0] });
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
  const { supabase, profile } = ctx;
  const sb = supabase as unknown as LooseSb;

  const { data: existing } = await sb
    .from("documents")
    .select(
      "id, org_id, workspace_id, name, storage_path, file_size_bytes, mime_type, kind, uploaded_by, notes, created_at, updated_at",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.org_id !== profile.org_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Delete the row first — if storage delete fails we'd rather have a
  // dangling object than a row that 404s on download.
  try {
    await dbDelete(
      "delete document (admin)",
      sb.from("documents").delete().eq("id", params.id).select("id"),
    );
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  // Best-effort storage cleanup.
  await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([existing.storage_path])
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
