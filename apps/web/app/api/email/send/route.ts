import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendAndLogEmail } from "@/lib/email-send";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SendBody {
  to?: unknown;
  to_name?: unknown;
  subject?: unknown;
  body_text?: unknown;
  body_html?: unknown;
  kind?: unknown;
  related_lead_id?: unknown;
  related_vendor_id?: unknown;
  related_guest_id?: unknown;
  in_reply_to_message_id?: unknown;
  thread_key?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireOrgAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized", status: 401 as const };

  const sb = supabase as unknown as {
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

  const { data: profile } = await sb
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.org_id || profile.org_role !== "org_admin") {
    return { error: "org admin only", status: 403 as const };
  }
  return { supabase, user, profile };
}

export async function POST(request: NextRequest) {
  const auth = await requireOrgAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, user, profile } = auth;

  let raw: SendBody;
  try {
    raw = (await request.json()) as SendBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Validate required fields
  const to = typeof raw.to === "string" ? raw.to.trim() : "";
  const subject = typeof raw.subject === "string" ? raw.subject.trim() : "";
  if (!EMAIL_RE.test(to)) {
    return NextResponse.json({ error: "invalid 'to' email" }, { status: 400 });
  }
  if (!subject) {
    return NextResponse.json({ error: "subject required" }, { status: 400 });
  }
  const bodyText = typeof raw.body_text === "string" ? raw.body_text : undefined;
  const bodyHtml = typeof raw.body_html === "string" ? raw.body_html : undefined;
  if (!bodyText && !bodyHtml) {
    return NextResponse.json(
      { error: "body_text or body_html required" },
      { status: 400 },
    );
  }
  const toName = typeof raw.to_name === "string" ? raw.to_name : undefined;
  const kind = typeof raw.kind === "string" ? raw.kind : undefined;
  const relatedLeadId =
    typeof raw.related_lead_id === "string" ? raw.related_lead_id : null;
  const relatedVendorId =
    typeof raw.related_vendor_id === "string" ? raw.related_vendor_id : null;
  const relatedGuestId =
    typeof raw.related_guest_id === "string" ? raw.related_guest_id : null;
  const inReplyToMessageId =
    typeof raw.in_reply_to_message_id === "string"
      ? raw.in_reply_to_message_id
      : null;
  const threadKeyOverride =
    typeof raw.thread_key === "string" && raw.thread_key.trim()
      ? raw.thread_key.trim()
      : null;

  const orgId = profile.org_id as string;

  // Look up org's contact_email + name to use as the From identity.
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: Record<string, unknown> | null;
          }>;
        };
      };
    };
  };

  const { data: org } = await sb
    .from("organizations")
    .select("name, contact_email")
    .eq("id", orgId)
    .maybeSingle();

  const fromEmail =
    typeof org?.contact_email === "string" && org.contact_email.trim()
      ? (org.contact_email as string)
      : undefined;
  const fromName =
    typeof org?.name === "string" && org.name.trim()
      ? (org.name as string)
      : undefined;

  // Derive workspace_id from whichever entity context was passed.
  let workspaceId: string | null = null;
  if (relatedLeadId) {
    const { data: lead } = await sb
      .from("leads")
      .select("converted_workspace_id")
      .eq("id", relatedLeadId)
      .maybeSingle();
    if (lead && typeof lead.converted_workspace_id === "string") {
      workspaceId = lead.converted_workspace_id;
    }
  }
  if (!workspaceId && relatedVendorId) {
    const { data: vendor } = await sb
      .from("vendors")
      .select("workspace_id")
      .eq("id", relatedVendorId)
      .maybeSingle();
    if (vendor && typeof vendor.workspace_id === "string") {
      workspaceId = vendor.workspace_id;
    }
  }
  if (!workspaceId && relatedGuestId) {
    const { data: guest } = await sb
      .from("guests")
      .select("workspace_id")
      .eq("id", relatedGuestId)
      .maybeSingle();
    if (guest && typeof guest.workspace_id === "string") {
      workspaceId = guest.workspace_id;
    }
  }

  // Generate a thread_key if none provided. `${to}|${subject}` lowercased
  // gives us a stable bucket per recipient + subject thread.
  const threadKey =
    threadKeyOverride ?? `${to}|${subject}`.toLowerCase();

  const result = await sendAndLogEmail(
    supabase,
    {
      to,
      toName,
      fromEmail,
      fromName,
      subject,
      bodyText,
      bodyHtml,
    },
    {
      org_id: orgId,
      workspace_id: workspaceId,
      kind: kind ?? null,
      thread_key: threadKey,
      in_reply_to_message_id: inReplyToMessageId,
      related_lead_id: relatedLeadId,
      related_vendor_id: relatedVendorId,
      related_guest_id: relatedGuestId,
      created_by: user.id,
    },
  );

  if (!result.ok && !result.message_id) {
    return NextResponse.json(
      { error: result.error ?? "send failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: result.ok,
    message_id: result.message_id,
    provider_message_id: result.provider_message_id,
  });
}
