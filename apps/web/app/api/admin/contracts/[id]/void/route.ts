// POST /api/admin/contracts/[id]/void
//
// Mark a contract as voided. Allowed unless the contract is already
// signed (we don't pretend a signed agreement was undone).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ContractRow } from "@/lib/tier1-types";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
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
  if (current.status === "signed") {
    return NextResponse.json(
      { error: "Can't void a signed contract." },
      { status: 409 },
    );
  }
  if (current.status === "voided") {
    return NextResponse.json({ ok: true });
  }

  const updSb = supabase as unknown as {
    from: (t: string) => {
      update: (row: unknown) => {
        eq: (col: string, val: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
  };
  const { error } = await updSb
    .from("contracts")
    .update({
      status: "voided",
      voided_at: new Date().toISOString(),
    })
    .eq("id", current.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
