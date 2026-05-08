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
import { sendAndLogEmail } from "@/lib/email-send";

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

  // Fire-and-forget confirmation emails. Failures here must NOT block the
  // signed=true response — we already committed the signature.
  try {
    await sendSignConfirmations(sb, contract, fullName);
  } catch (e) {
    console.warn(
      "[sign] confirmation send failed (non-fatal):",
      (e as Error).message,
    );
  }

  return NextResponse.json({ ok: true });
}

interface OrgContactLite {
  contact_email: string | null;
  name: string | null;
}

async function sendSignConfirmations(
  sb: ReturnType<typeof adminClient>,
  contract: ContractRow,
  signedFullName: string,
): Promise<void> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3200";
  const signLink = `${siteUrl}/sign/${contract.public_token}`;
  const adminLink = `${siteUrl}/admin/contracts/${contract.id}`;

  const orgLookup = sb as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: OrgContactLite | null }>;
        };
      };
    };
  };
  const { data: org } = await orgLookup
    .from("organizations")
    .select("contact_email, name")
    .eq("id", contract.org_id)
    .maybeSingle();

  const threadKey = `contract:${contract.id}`;
  const signedAtIso = new Date().toISOString();

  // 1. Confirmation to the signer.
  const signerEmail = contract.signer_email?.trim();
  if (signerEmail) {
    const signerName = contract.signer_name ?? "there";
    const greeting = `Hi ${signerName.split(" ")[0] ?? "there"},`;
    const bodyText = [
      greeting,
      "",
      `Thanks — your signature has been recorded for "${contract.title}".`,
      "",
      `Signed by:  ${signedFullName}`,
      `Signed at:  ${signedAtIso}`,
      "",
      "You can re-open the signed contract any time at:",
      signLink,
      "",
      "If anything looks off, reply to this email and we'll sort it.",
      "",
      `— ${org?.name ?? "The team"}`,
    ].join("\n");

    const bodyHtml = `
<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#292524;">
  <p style="font-size:16px;margin-bottom:16px;">${escapeHtml(greeting)}</p>
  <p style="font-size:15px;line-height:1.6;">
    Thanks — your signature has been recorded for <strong>${escapeHtml(contract.title)}</strong>.
  </p>
  <table style="margin:20px 0;font-size:14px;color:#44403c;">
    <tr><td style="padding:4px 12px 4px 0;color:#78716c;">Signed by</td><td style="padding:4px 0;">${escapeHtml(signedFullName)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#78716c;">Signed at</td><td style="padding:4px 0;">${escapeHtml(signedAtIso)}</td></tr>
  </table>
  <p style="margin:24px 0;">
    <a href="${signLink}" style="display:inline-block;padding:10px 18px;background:#1c1917;color:#fff;text-decoration:none;border-radius:9999px;font-size:13px;">
      View signed contract
    </a>
  </p>
  <p style="font-size:13px;color:#78716c;">— ${escapeHtml(org?.name ?? "The team")}</p>
</div>`.trim();

    await sendAndLogEmail(
      sb,
      {
        to: signerEmail,
        toName: contract.signer_name ?? undefined,
        subject: `Signed: ${contract.title}`,
        bodyText,
        bodyHtml,
      },
      {
        org_id: contract.org_id,
        workspace_id: contract.workspace_id,
        kind: "contract_signed_couple",
        thread_key: threadKey,
        related_contract_id: contract.id,
        related_lead_id: contract.lead_id,
      },
    );
  }

  // 2. Internal notification to the planner.
  const plannerEmail = org?.contact_email?.trim() ?? null;
  if (plannerEmail) {
    const couple = contract.signer_name ?? "Your client";
    const totalLine =
      contract.total_eur != null
        ? `Total:    €${Number(contract.total_eur).toFixed(2)}`
        : null;
    const retainerLine =
      contract.retainer_eur != null
        ? `Retainer: €${Number(contract.retainer_eur).toFixed(2)}`
        : null;
    const retainerDueLine = contract.retainer_due_date
      ? `Retainer due: ${contract.retainer_due_date}`
      : null;

    const summaryLines = [totalLine, retainerLine, retainerDueLine].filter(
      (x): x is string => x !== null,
    );

    const bodyText = [
      `${couple} just signed "${contract.title}".`,
      "",
      `Signed by:  ${signedFullName}`,
      `Signed at:  ${signedAtIso}`,
      ...(summaryLines.length ? ["", ...summaryLines] : []),
      "",
      "Open the contract:",
      adminLink,
    ].join("\n");

    const bodyHtml = `
<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#292524;">
  <p style="font-size:15px;line-height:1.6;">
    <strong>${escapeHtml(couple)}</strong> just signed <strong>${escapeHtml(contract.title)}</strong>.
  </p>
  <table style="margin:20px 0;font-size:14px;color:#44403c;">
    <tr><td style="padding:4px 12px 4px 0;color:#78716c;">Signed by</td><td style="padding:4px 0;">${escapeHtml(signedFullName)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#78716c;">Signed at</td><td style="padding:4px 0;">${escapeHtml(signedAtIso)}</td></tr>
    ${totalLine ? `<tr><td style="padding:4px 12px 4px 0;color:#78716c;">Total</td><td style="padding:4px 0;">${escapeHtml(totalLine.replace("Total:    ", ""))}</td></tr>` : ""}
    ${retainerLine ? `<tr><td style="padding:4px 12px 4px 0;color:#78716c;">Retainer</td><td style="padding:4px 0;">${escapeHtml(retainerLine.replace("Retainer: ", ""))}</td></tr>` : ""}
    ${retainerDueLine ? `<tr><td style="padding:4px 12px 4px 0;color:#78716c;">Retainer due</td><td style="padding:4px 0;">${escapeHtml(retainerDueLine.replace("Retainer due: ", ""))}</td></tr>` : ""}
  </table>
  <p style="margin:24px 0;">
    <a href="${adminLink}" style="display:inline-block;padding:10px 18px;background:#1c1917;color:#fff;text-decoration:none;border-radius:9999px;font-size:13px;">
      Open contract
    </a>
  </p>
</div>`.trim();

    await sendAndLogEmail(
      sb,
      {
        to: plannerEmail,
        subject: `${couple} signed ${contract.title}`,
        bodyText,
        bodyHtml,
      },
      {
        org_id: contract.org_id,
        workspace_id: contract.workspace_id,
        kind: "contract_signed_planner",
        thread_key: threadKey,
        related_contract_id: contract.id,
        related_lead_id: contract.lead_id,
      },
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
