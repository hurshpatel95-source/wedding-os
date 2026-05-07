// POST /api/admin/contracts/[id]/send
//
// Move a draft contract → 'sent' and email the public sign link to the
// signer. Logs the outbound email row in email_messages with
// kind='contract_sent' and related_contract_id pointing back so the
// drill page's Conversation panel renders the trail.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendAndLogEmail } from "@/lib/email-send";
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
  if (current.status !== "draft") {
    return NextResponse.json(
      { error: `Contract is ${current.status}, can only send drafts.` },
      { status: 409 },
    );
  }

  const recipient = current.signer_email?.trim();
  if (!recipient) {
    return NextResponse.json(
      { error: "Set signer_email on the contract before sending." },
      { status: 400 },
    );
  }

  // 1. Stamp status='sent', sent_at=now (before sending so a partial-failure
  //    leaves the row in a recoverable state — planner can re-send via the
  //    "Copy public link" button if email transport flakes).
  const nowIso = new Date().toISOString();
  const updSb = supabase as unknown as {
    from: (t: string) => {
      update: (row: unknown) => {
        eq: (col: string, val: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
  };
  const { error: updErr } = await updSb
    .from("contracts")
    .update({ status: "sent", sent_at: nowIso })
    .eq("id", current.id);
  if (updErr) {
    return NextResponse.json(
      { error: `Couldn't update status: ${updErr.message}` },
      { status: 500 },
    );
  }

  // 2. Send the email + log it in email_messages.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200";
  const signLink = `${siteUrl}/sign/${current.public_token}`;

  const greeting = current.signer_name
    ? `Hi ${current.signer_name.split(" ")[0]},`
    : "Hello,";

  const bodyText = [
    greeting,
    "",
    `Your contract — "${current.title}" — is ready for review and signature.`,
    "",
    "Open the link below to read it through and sign when you're happy:",
    signLink,
    "",
    "If you have any questions before signing, just reply to this email.",
    "",
    "— The team",
  ].join("\n");

  const bodyHtml = `
<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#292524;">
  <p style="font-size:16px;margin-bottom:16px;">${greeting}</p>
  <p style="font-size:15px;line-height:1.6;">
    Your contract — <strong>${escapeHtml(current.title)}</strong> — is ready for review and signature.
  </p>
  <p style="font-size:15px;line-height:1.6;">
    Open the link below to read it through and sign when you're happy:
  </p>
  <p style="margin:28px 0;">
    <a href="${signLink}" style="display:inline-block;padding:12px 22px;background:#1c1917;color:#ffffff;text-decoration:none;border-radius:9999px;font-size:14px;font-weight:500;">
      Review &amp; sign contract →
    </a>
  </p>
  <p style="font-size:13px;color:#78716c;line-height:1.6;">
    Or paste this link into your browser:<br />
    <a href="${signLink}" style="color:#9f1239;">${signLink}</a>
  </p>
  <p style="font-size:14px;color:#57534e;margin-top:32px;">
    If you have any questions before signing, just reply to this email.
  </p>
  <p style="font-size:14px;color:#57534e;">— The team</p>
</div>
`.trim();

  const sendResult = await sendAndLogEmail(
    supabase,
    {
      to: recipient,
      toName: current.signer_name ?? undefined,
      subject: `Please sign: ${current.title}`,
      bodyText,
      bodyHtml,
    },
    {
      org_id: profile.org_id,
      workspace_id: current.workspace_id,
      kind: "contract_sent",
      related_contract_id: current.id,
      related_lead_id: current.lead_id,
      created_by: user.id,
    },
  );

  return NextResponse.json({
    ok: sendResult.ok,
    message_id: sendResult.message_id,
    sign_url: signLink,
    error: sendResult.error,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
