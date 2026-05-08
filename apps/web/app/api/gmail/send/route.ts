import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import {
  buildMimeMessage,
  clientWithCredentials,
  gmailOauthReady,
} from "@/lib/gmail-server";
import { loadActiveGmailConnection } from "@/lib/gmail-connection-loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SendBody {
  to?: string;
  subject?: string;
  body_text?: string;
  in_reply_to?: string;          // RFC Message-ID we are replying to
  references?: string;           // RFC References header
  thread_key?: string | null;    // Gmail thread id, if known
  related_vendor_id?: string | null;
  related_lead_id?: string | null;
}

// POST /api/gmail/send
// Sends from the connected Gmail address, logs to email_messages.
export async function POST(request: NextRequest) {
  if (!gmailOauthReady) {
    return NextResponse.json(
      { ok: false, error: "gmail_not_configured" },
      { status: 503 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const profileSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { workspace_id?: string | null; org_id?: string | null } | null;
          }>;
        };
      };
    };
  };
  const { data: profile } = await profileSb
    .from("users")
    .select("workspace_id, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id || !profile?.org_id) {
    return NextResponse.json({ ok: false, error: "no_workspace" }, { status: 400 });
  }

  let body: SendBody;
  try {
    body = (await request.json()) as SendBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const to = (body.to ?? "").trim();
  const subject = (body.subject ?? "").trim();
  const bodyText = body.body_text ?? "";
  if (!to || !subject) {
    return NextResponse.json(
      { ok: false, error: "to and subject are required" },
      { status: 400 },
    );
  }

  const connection = await loadActiveGmailConnection(supabase, profile.workspace_id);
  if (!connection || !connection.refresh_token) {
    return NextResponse.json(
      { ok: false, error: "no_connection" },
      { status: 404 },
    );
  }

  let oauth2;
  try {
    oauth2 = await clientWithCredentials(
      connection.refresh_token,
      connection.access_token,
      connection.access_token_expires_at,
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "token_refresh_failed" },
      { status: 502 },
    );
  }

  const raw = buildMimeMessage(connection.email, to, subject, bodyText, {
    inReplyTo: body.in_reply_to,
    references: body.references,
  });

  let providerMessageId: string | null = null;
  let threadId: string | null = body.thread_key ?? null;
  try {
    const gmail = google.gmail({ version: "v1", auth: oauth2 });
    const sendRes = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
        ...(body.thread_key ? { threadId: body.thread_key } : {}),
      },
    });
    providerMessageId = sendRes.data.id ?? null;
    threadId = sendRes.data.threadId ?? threadId;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "gmail_send_failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }

  // Log to email_messages
  const insertRow = {
    org_id: profile.org_id,
    workspace_id: profile.workspace_id,
    direction: "outbound",
    kind: body.related_vendor_id ? "vendor_outbound" : null,
    thread_key: threadId,
    in_reply_to_message_id: null,
    provider: "gmail",
    provider_message_id: providerMessageId,
    to_email: to,
    to_name: null,
    from_email: connection.email,
    from_name: null,
    cc: null,
    bcc: null,
    subject,
    body_text: bodyText,
    body_html: null,
    related_lead_id: body.related_lead_id ?? null,
    related_vendor_id: body.related_vendor_id ?? null,
    status: "sent",
    status_detail: body.in_reply_to ?? null,
    sent_at: new Date().toISOString(),
    created_by: user.id,
  };

  const insSb = supabase as unknown as {
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
  const { data: logged, error: logErr } = await insSb
    .from("email_messages")
    .insert(insertRow)
    .select("id")
    .single();

  if (logErr) {
    return NextResponse.json(
      {
        ok: true,
        message_id: null,
        provider_message_id: providerMessageId,
        warning: `sent but log failed: ${logErr.message}`,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    ok: true,
    message_id: logged?.id ?? null,
    provider_message_id: providerMessageId,
    thread_id: threadId,
  });
}
