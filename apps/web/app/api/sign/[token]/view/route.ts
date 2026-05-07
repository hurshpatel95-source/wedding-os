// POST /api/sign/[token]/view
//
// First-view tracker. The /sign/<token> page calls this on mount; we move
// status from 'sent' → 'viewed' (and stamp viewed_at) so the planner sees
// the couple opened the link. Idempotent — no-op for any other status.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";
import type { ContractRow } from "@/lib/tier1-types";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(
  _request: NextRequest,
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

  const sb = adminClient();
  const lookup = sb as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: ContractRow | null }>;
        };
      };
    };
  };
  const { data: contract } = await lookup
    .from("contracts")
    .select(
      "id, org_id, workspace_id, lead_id, title, body_md, terms_summary, total_eur, retainer_eur, retainer_due_date, status, public_token, signer_name, signer_email, signed_full_name, signed_at, signed_ip, signed_user_agent, declined_at, declined_reason, voided_at, sent_at, viewed_at, pdf_storage_path, created_by, created_at, updated_at",
    )
    .eq("public_token", params.token)
    .maybeSingle();

  if (!contract) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (contract.status !== "sent") {
    // Already viewed/signed/declined/voided/draft — nothing to do.
    return NextResponse.json({ ok: true, status: contract.status });
  }

  const upd = sb as unknown as {
    from: (t: string) => {
      update: (row: unknown) => {
        eq: (col: string, val: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
  };
  const { error } = await upd
    .from("contracts")
    .update({
      status: "viewed",
      viewed_at: new Date().toISOString(),
    })
    .eq("public_token", params.token);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: "viewed" });
}
