// PATCH /api/admin/contracts/[id]
//
// Update a draft contract. Only allowed when status='draft' — once sent we
// preserve the wording the client saw.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ContractRow } from "@/lib/tier1-types";
import { dbUpdate, dbWriteErrorResponse } from "@/lib/db-write-guard";

export const runtime = "nodejs";

interface PatchBody {
  title?: string;
  body_md?: string;
  terms_summary?: string | null;
  total_eur?: number | null;
  retainer_eur?: number | null;
  retainer_due_date?: string | null;
  workspace_id?: string | null;
  lead_id?: string | null;
  signer_name?: string | null;
  signer_email?: string | null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const profileSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { org_role?: string | null; org_id?: string | null } | null;
          }>;
        };
      };
    };
  };
  const { data: profile } = await profileSb
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.org_id || profile.org_role !== "org_admin") {
    return NextResponse.json({ error: "org admin only" }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Look up current row to enforce draft-only edits.
  const lookupSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: ContractRow | null }>;
        };
      };
    };
  };
  const { data: current } = await lookupSb
    .from("contracts")
    .select(
      "id, org_id, workspace_id, lead_id, title, body_md, terms_summary, total_eur, retainer_eur, retainer_due_date, status, public_token, signer_name, signer_email, signed_full_name, signed_at, signed_ip, signed_user_agent, declined_at, declined_reason, voided_at, sent_at, viewed_at, pdf_storage_path, created_by, created_at, updated_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!current) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (current.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft contracts can be edited." },
      { status: 409 },
    );
  }

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const t = body.title?.trim();
    if (!t) return NextResponse.json({ error: "title required" }, { status: 400 });
    patch.title = t;
  }
  if (body.body_md !== undefined) {
    const b = body.body_md?.trim();
    if (!b) return NextResponse.json({ error: "body_md required" }, { status: 400 });
    patch.body_md = b;
  }
  if (body.terms_summary !== undefined) patch.terms_summary = body.terms_summary;
  if (body.total_eur !== undefined) patch.total_eur = body.total_eur;
  if (body.retainer_eur !== undefined) patch.retainer_eur = body.retainer_eur;
  if (body.retainer_due_date !== undefined) patch.retainer_due_date = body.retainer_due_date;
  if (body.workspace_id !== undefined) patch.workspace_id = body.workspace_id;
  if (body.lead_id !== undefined) patch.lead_id = body.lead_id;
  if (body.signer_name !== undefined) patch.signer_name = body.signer_name;
  if (body.signer_email !== undefined) patch.signer_email = body.signer_email;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const sb = supabase as unknown as {
    from: (t: string) => {
      update: (row: unknown) => {
        eq: (col: string, val: string) => {
          select: (cols: string) => PromiseLike<{
            data: { id: string }[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  try {
    await dbUpdate(
      "update contract (draft)",
      sb.from("contracts").update(patch).eq("id", params.id).select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
