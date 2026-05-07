// POST /api/sign/[token]
//
// Public endpoint — the couple opens /sign/<token>, types their full name,
// and POSTs here to record the signature. The token (UUIDv4, 122 bits) is
// the auth — we use a service-role client and filter by exact token in
// every query. Anon Supabase access can no longer write contracts.
//
// Side-effects:
//   - status='sent'|'viewed' → 'signed'
//   - signed_full_name, signed_at, signed_ip, signed_user_agent stamped
//   - signed contract row stays world-readable to the planner via RLS

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

interface SignBody {
  signed_full_name?: string;
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

  let body: SignBody;
  try {
    body = (await request.json()) as SignBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const fullName = body.signed_full_name?.trim();
  if (!fullName || fullName.length < 2) {
    return NextResponse.json(
      { error: "Please type your full name to sign." },
      { status: 400 },
    );
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

  if (contract.status === "signed") {
    return NextResponse.json(
      { error: "This contract has already been signed." },
      { status: 409 },
    );
  }
  if (contract.status === "voided") {
    return NextResponse.json(
      { error: "This contract has been voided." },
      { status: 409 },
    );
  }
  if (contract.status === "declined") {
    return NextResponse.json(
      { error: "This contract was declined." },
      { status: 409 },
    );
  }
  if (contract.status === "draft") {
    return NextResponse.json(
      { error: "This contract isn't ready to sign yet." },
      { status: 409 },
    );
  }

  // Prefer X-Forwarded-For (Railway / proxies); fall back to remote address.
  const xff = request.headers.get("x-forwarded-for") ?? "";
  const signedIp = (xff.split(",")[0] ?? "").trim() || null;
  const userAgent = request.headers.get("user-agent") ?? null;

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
      status: "signed",
      signed_full_name: fullName,
      signed_at: new Date().toISOString(),
      signed_ip: signedIp,
      signed_user_agent: userAgent,
    })
    .eq("public_token", params.token);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
