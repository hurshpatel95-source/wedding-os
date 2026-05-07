// Server-only email send wrapper. Backed by Resend when RESEND_API_KEY is
// configured; falls back to a no-op + console log so the rest of the
// product works in dev without DNS setup.
//
// Every send is logged to email_messages so threads + reply tracking work.
//
// Used by:
//   - /api/email/send                (planner inline composer)
//   - /api/admin/contracts/[id]/send (contract delivery)
//   - /api/admin/proposals/[id]/send (proposal delivery)
//   - /api/guests/messages           (couple-side mass send)

import "server-only";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@wedding-os.com";
const DEFAULT_FROM_NAME = process.env.RESEND_FROM_NAME ?? "wedding-os";

export const resendReady = Boolean(RESEND_API_KEY);

let _client: Resend | null = null;
function getResend(): Resend {
  if (!_client) {
    if (!RESEND_API_KEY) {
      throw new Error(
        "RESEND_API_KEY is not set. Add it in Railway → Variables (or apps/web/.env.local).",
      );
    }
    _client = new Resend(RESEND_API_KEY);
  }
  return _client;
}

export interface EmailToSend {
  to: string;
  toName?: string | null;
  fromEmail?: string;        // override default
  fromName?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
}

export interface EmailLogContext {
  org_id: string;
  workspace_id?: string | null;
  kind?: string | null;
  thread_key?: string | null;
  in_reply_to_message_id?: string | null;
  related_lead_id?: string | null;
  related_vendor_id?: string | null;
  related_guest_id?: string | null;
  related_contract_id?: string | null;
  created_by?: string | null;
}

export interface SendResult {
  ok: boolean;
  message_id: string | null;     // our email_messages.id
  provider_message_id: string | null;
  error?: string;
}

/** Send + log. If Resend isn't configured, logs as `status='queued'` so
 * the planner can still see the draft trail. */
export async function sendAndLogEmail(
  sb: SupabaseClient,
  email: EmailToSend,
  ctx: EmailLogContext,
): Promise<SendResult> {
  let providerMessageId: string | null = null;
  let status: "queued" | "sent" | "failed" = "queued";
  let statusDetail: string | null = null;

  if (resendReady) {
    try {
      const resend = getResend();
      const fromAddress = email.fromName
        ? `${email.fromName} <${email.fromEmail ?? DEFAULT_FROM_EMAIL}>`
        : `${DEFAULT_FROM_NAME} <${email.fromEmail ?? DEFAULT_FROM_EMAIL}>`;
      // Resend's strict types want `react | text | html` discriminated;
      // we always pass at least one of text/html — cast to satisfy TS.
      const sendOpts = {
        from: fromAddress,
        to: [email.to],
        cc: email.cc,
        bcc: email.bcc,
        replyTo: email.replyTo,
        subject: email.subject,
        text: email.bodyText ?? "",
        html: email.bodyHtml ?? `<pre>${email.bodyText ?? ""}</pre>`,
      } as unknown as Parameters<typeof resend.emails.send>[0];
      const result = await resend.emails.send(sendOpts);
      if (result.error) {
        status = "failed";
        statusDetail = result.error.message;
      } else {
        status = "sent";
        providerMessageId = result.data?.id ?? null;
      }
    } catch (err) {
      status = "failed";
      statusDetail = (err as Error).message;
    }
  } else {
    statusDetail = "RESEND_API_KEY not configured — queued only";
  }

  // Always log
  const insertRow = {
    org_id: ctx.org_id,
    workspace_id: ctx.workspace_id ?? null,
    direction: "outbound",
    kind: ctx.kind ?? null,
    thread_key: ctx.thread_key ?? null,
    in_reply_to_message_id: ctx.in_reply_to_message_id ?? null,
    provider: resendReady ? "resend" : "manual",
    provider_message_id: providerMessageId,
    to_email: email.to,
    to_name: email.toName ?? null,
    from_email: email.fromEmail ?? DEFAULT_FROM_EMAIL,
    from_name: email.fromName ?? DEFAULT_FROM_NAME,
    cc: email.cc ?? null,
    bcc: email.bcc ?? null,
    subject: email.subject,
    body_text: email.bodyText ?? null,
    body_html: email.bodyHtml ?? null,
    related_lead_id: ctx.related_lead_id ?? null,
    related_vendor_id: ctx.related_vendor_id ?? null,
    related_guest_id: ctx.related_guest_id ?? null,
    related_contract_id: ctx.related_contract_id ?? null,
    status,
    status_detail: statusDetail,
    sent_at: status === "sent" ? new Date().toISOString() : null,
    created_by: ctx.created_by ?? null,
  };

  const { data, error } = await (
    sb as unknown as {
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
    }
  )
    .from("email_messages")
    .insert(insertRow)
    .select("id")
    .single();

  if (error) {
    return {
      ok: false,
      message_id: null,
      provider_message_id: providerMessageId,
      error: error.message,
    };
  }

  return {
    ok: status !== "failed",
    message_id: data?.id ?? null,
    provider_message_id: providerMessageId,
    error: status === "failed" ? statusDetail ?? "send failed" : undefined,
  };
}
