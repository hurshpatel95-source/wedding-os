// POST /api/admin/contracts
//
// Create a new contract draft for the calling org_admin's organization.
// Either workspace_id (post-conversion client) or lead_id (pre-conversion
// inquiry) may be supplied — both null is allowed for ad-hoc contracts.
//
// Auth: org_admin only. The contracts table is RLS-locked with
// `contracts_org_admin` so we ride the planner's session for the insert.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface CreateBody {
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

export async function POST(request: NextRequest) {
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

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const title = body.title?.trim();
  const body_md = body.body_md?.trim();
  if (!title || !body_md) {
    return NextResponse.json(
      { error: "title and body_md are required" },
      { status: 400 },
    );
  }

  const insertRow = {
    org_id: profile.org_id,
    workspace_id: body.workspace_id ?? null,
    lead_id: body.lead_id ?? null,
    title,
    body_md,
    terms_summary: body.terms_summary ?? null,
    total_eur: body.total_eur ?? null,
    retainer_eur: body.retainer_eur ?? null,
    retainer_due_date: body.retainer_due_date ?? null,
    signer_name: body.signer_name ?? null,
    signer_email: body.signer_email ?? null,
    status: "draft" as const,
    created_by: user.id,
  };

  const sb = supabase as unknown as {
    from: (t: string) => {
      insert: (row: unknown) => {
        select: (cols: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  const { data, error } = await sb
    .from("contracts")
    .insert(insertRow)
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Couldn't create contract: ${error?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}
