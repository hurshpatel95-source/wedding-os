// POST /api/email/webhook/resend
//
// Public webhook endpoint for Resend. Handles two flavours of events:
//
//   1. Delivery / engagement events on outbound mail
//        email.delivered, email.opened, email.clicked, email.bounced,
//        email.complained, email.delivery_delayed
//
//   2. Inbound mail (replies). Resend forwards mail addressed to our
//      configured inbound domain to this endpoint as an event whose
//      `data` carries headers + body. We insert a NEW email_messages row
//      with direction='inbound' and try to thread it back to an existing
//      outbound message via In-Reply-To / References.
//
// Auth: Resend uses Svix-style signed webhooks. The signing key is the
// shared secret. We verify HMAC-SHA256 over `${id}.${timestamp}.${body}`
// against the `svix-signature` header. If RESEND_WEBHOOK_SIGNING_KEY is
// not configured we accept all events (dev mode) and log a warning so
// it's obvious in logs.
//
// This route NEVER throws — every per-event handler is wrapped in
// try/catch, errors are logged, and the route returns 200 so Resend
// doesn't retry on our bugs (4xx is reserved for signature failures).

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import type { Database } from "@wedding-os/db";

export const runtime = "nodejs";

// ─── env / clients ───────────────────────────────────────────────────

const SIGNING_KEY = process.env.RESEND_WEBHOOK_SIGNING_KEY ?? "";
const INBOUND_DOMAIN = process.env.RESEND_INBOUND_DOMAIN ?? "";

function adminClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─── Svix signature verification ─────────────────────────────────────
//
// Svix headers:
//   svix-id:        message id (uuid)
//   svix-timestamp: unix seconds
//   svix-signature: space-separated list like "v1,<base64sig> v1,<base64sig>"
//
// Signed string: `${id}.${timestamp}.${rawBody}`
// HMAC-SHA256 with the secret (Svix prefixes the secret with `whsec_`;
// the bytes after the prefix are the actual key, base64-decoded).

function decodeSecret(secret: string): Buffer {
  const trimmed = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  try {
    return Buffer.from(trimmed, "base64");
  } catch {
    return Buffer.from(trimmed);
  }
}

function verifySvixSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatureHeader = headers.get("svix-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  // Replay protection: tolerate up to 5 minutes of clock skew.
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > 5 * 60) return false;

  const signedPayload = `${id}.${timestamp}.${rawBody}`;
  const key = decodeSecret(secret);
  const expected = crypto
    .createHmac("sha256", key)
    .update(signedPayload)
    .digest("base64");

  // svix-signature can carry multiple comma/space separated entries,
  // e.g. "v1,<sig1> v1,<sig2>". Match any.
  for (const part of signatureHeader.split(/\s+/)) {
    const [, sig] = part.split(",");
    if (!sig) continue;
    try {
      const a = Buffer.from(sig, "base64");
      const b = Buffer.from(expected, "base64");
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return true;
      }
    } catch {
      // skip malformed entries
    }
  }
  return false;
}

// ─── event types ─────────────────────────────────────────────────────

interface ResendEventBase {
  type: string;
  created_at?: string;
  data?: Record<string, unknown>;
}

// ─── route ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Read the raw body once — needed for signature verification.
  const rawBody = await request.text();

  if (SIGNING_KEY) {
    if (!verifySvixSignature(rawBody, request.headers, SIGNING_KEY)) {
      return NextResponse.json(
        { error: "invalid signature" },
        { status: 401 },
      );
    }
  } else {
    // Dev / pre-config mode — log loudly so it shows up in Railway.
    console.warn(
      "[resend-webhook] RESEND_WEBHOOK_SIGNING_KEY not set — accepting unsigned event (DEV ONLY)",
    );
  }

  let event: ResendEventBase;
  try {
    event = JSON.parse(rawBody) as ResendEventBase;
  } catch (err) {
    console.warn(
      "[resend-webhook] body parse failed:",
      (err as Error).message,
    );
    return NextResponse.json({ ok: true, ignored: "unparseable" });
  }

  const sb = adminClient();
  if (!sb) {
    console.warn(
      "[resend-webhook] Supabase service role key not configured — event dropped",
    );
    return NextResponse.json(
      { error: "service-role key not configured" },
      { status: 503 },
    );
  }

  try {
    await dispatchEvent(sb, event);
  } catch (err) {
    console.error(
      "[resend-webhook] handler crashed (swallowed):",
      (err as Error).message,
    );
  }
  return NextResponse.json({ ok: true });
}

// ─── dispatcher ──────────────────────────────────────────────────────

async function dispatchEvent(
  sb: SupabaseClient<Database>,
  event: ResendEventBase,
): Promise<void> {
  const type = (event?.type ?? "").toLowerCase();
  const data = (event?.data ?? {}) as Record<string, unknown>;

  // Delivery + engagement events: identified by data.email_id.
  if (type === "email.delivered") {
    await tryHandle(() => onDelivered(sb, data));
    return;
  }
  if (type === "email.opened") {
    await tryHandle(() => onOpened(sb, data));
    return;
  }
  if (type === "email.clicked") {
    await tryHandle(() => onClicked(sb, data));
    return;
  }
  if (type === "email.bounced") {
    await tryHandle(() => onBounced(sb, data));
    return;
  }
  if (type === "email.complained") {
    await tryHandle(() => onComplained(sb, data));
    return;
  }
  if (type === "email.delivery_delayed") {
    console.info("[resend-webhook] delivery_delayed:", data["email_id"] ?? "?");
    return;
  }

  // Inbound mail. Resend hasn't fully standardised the event type name
  // for inbound parse yet — accept a couple of variants so we don't have
  // to ship a code change when their naming settles.
  if (
    type === "email.received" ||
    type === "inbound.email.received" ||
    type === "email.inbound" ||
    type.startsWith("inbound")
  ) {
    await tryHandle(() => onInbound(sb, data));
    return;
  }

  console.info("[resend-webhook] ignored event type:", type);
}

async function tryHandle(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(
      "[resend-webhook] handler error (swallowed):",
      (err as Error).message,
    );
  }
}

// ─── delivery events ─────────────────────────────────────────────────

const FORWARD_RANK: Record<string, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  bounced: 5,
  complained: 5,
  failed: 5,
  received: 5,
};

interface MessageLite {
  id: string;
  status: string;
}

async function findByProvider(
  sb: SupabaseClient<Database>,
  providerMessageId: string,
): Promise<MessageLite | null> {
  const { data } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{ data: MessageLite | null }>;
          };
        };
      };
    }
  )
    .from("email_messages")
    .select("id, status")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();
  return data;
}

async function updateById(
  sb: SupabaseClient<Database>,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await (
    sb as unknown as {
      from: (t: string) => {
        update: (row: unknown) => {
          eq: (col: string, val: string) => Promise<{
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .from("email_messages")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.warn("[resend-webhook] update failed:", error.message);
  }
}

async function onDelivered(
  sb: SupabaseClient<Database>,
  data: Record<string, unknown>,
): Promise<void> {
  const emailId = (data["email_id"] as string | undefined) ?? null;
  if (!emailId) return;
  const row = await findByProvider(sb, emailId);
  if (!row) return;
  if ((FORWARD_RANK[row.status] ?? 0) > FORWARD_RANK["delivered"]) return;
  await updateById(sb, row.id, {
    status: "delivered",
    delivered_at: new Date().toISOString(),
  });
}

async function onOpened(
  sb: SupabaseClient<Database>,
  data: Record<string, unknown>,
): Promise<void> {
  const emailId = (data["email_id"] as string | undefined) ?? null;
  if (!emailId) return;
  const row = await findByProvider(sb, emailId);
  if (!row) return;
  if ((FORWARD_RANK[row.status] ?? 0) >= FORWARD_RANK["opened"]) {
    // Only stamp opened_at, don't downgrade clicked.
    await updateById(sb, row.id, { opened_at: new Date().toISOString() });
    return;
  }
  await updateById(sb, row.id, {
    status: "opened",
    opened_at: new Date().toISOString(),
  });
}

async function onClicked(
  sb: SupabaseClient<Database>,
  data: Record<string, unknown>,
): Promise<void> {
  const emailId = (data["email_id"] as string | undefined) ?? null;
  if (!emailId) return;
  const row = await findByProvider(sb, emailId);
  if (!row) return;
  const link =
    typeof data["link"] === "string"
      ? (data["link"] as string)
      : typeof (data["click"] as Record<string, unknown> | undefined)?.["link"] ===
        "string"
      ? ((data["click"] as Record<string, unknown>)["link"] as string)
      : null;
  const detail = link ? link.slice(0, 500) : null;
  if ((FORWARD_RANK[row.status] ?? 0) >= FORWARD_RANK["clicked"]) {
    if (detail) await updateById(sb, row.id, { status_detail: detail });
    return;
  }
  await updateById(sb, row.id, {
    status: "clicked",
    status_detail: detail,
  });
}

async function onBounced(
  sb: SupabaseClient<Database>,
  data: Record<string, unknown>,
): Promise<void> {
  const emailId = (data["email_id"] as string | undefined) ?? null;
  if (!emailId) return;
  const row = await findByProvider(sb, emailId);
  if (!row) return;
  const reason =
    (typeof data["reason"] === "string" ? (data["reason"] as string) : null) ??
    (typeof (data["bounce"] as Record<string, unknown> | undefined)?.[
      "message"
    ] === "string"
      ? ((data["bounce"] as Record<string, unknown>)["message"] as string)
      : null);
  await updateById(sb, row.id, {
    status: "bounced",
    status_detail: reason ? reason.slice(0, 500) : null,
  });
}

async function onComplained(
  sb: SupabaseClient<Database>,
  data: Record<string, unknown>,
): Promise<void> {
  const emailId = (data["email_id"] as string | undefined) ?? null;
  if (!emailId) return;
  const row = await findByProvider(sb, emailId);
  if (!row) return;
  await updateById(sb, row.id, { status: "complained" });
}

// ─── inbound parse ───────────────────────────────────────────────────

interface InboundParsed {
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  in_reply_to_header: string | null;
  references_header: string | null;
}

function pickHeader(
  headers: Record<string, unknown> | undefined,
  name: string,
): string | null {
  if (!headers) return null;
  // Resend may give us either a flat object or an array of {name, value}.
  // Be permissive.
  if (Array.isArray(headers)) {
    for (const h of headers as Array<{ name?: string; value?: string }>) {
      if (h?.name?.toLowerCase() === name.toLowerCase()) {
        return typeof h.value === "string" ? h.value : null;
      }
    }
    return null;
  }
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === name.toLowerCase()) {
      const v = headers[k];
      if (typeof v === "string") return v;
      if (Array.isArray(v) && typeof v[0] === "string") return v[0] as string;
    }
  }
  return null;
}

function parseAddress(raw: string | null): { email: string | null; name: string | null } {
  if (!raw) return { email: null, name: null };
  const trimmed = raw.trim();
  // "Display Name <addr@host>"
  const m = trimmed.match(/^(.*?)<([^>]+)>$/);
  if (m) {
    const name = m[1].trim().replace(/^"|"$/g, "");
    return { email: m[2].trim(), name: name.length > 0 ? name : null };
  }
  return { email: trimmed, name: null };
}

function coerceAddress(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  if (v && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const email = typeof obj["email"] === "string" ? (obj["email"] as string) : null;
    const name = typeof obj["name"] === "string" ? (obj["name"] as string) : null;
    if (email && name) return `${name} <${email}>`;
    if (email) return email;
  }
  return null;
}

function parseInbound(data: Record<string, unknown>): InboundParsed {
  // Try a number of shapes Resend (or a forwarder) might use.
  const headers = (data["headers"] as Record<string, unknown> | undefined) ??
    ((data["email"] as Record<string, unknown> | undefined)?.[
      "headers"
    ] as Record<string, unknown> | undefined);

  const fromRaw = coerceAddress(data["from"]) ?? pickHeader(headers, "From");
  const toRaw = coerceAddress(data["to"]) ?? pickHeader(headers, "To");

  const from = parseAddress(fromRaw);
  const to = parseAddress(toRaw);

  return {
    from_email: from.email,
    from_name: from.name,
    to_email: to.email,
    subject:
      (data["subject"] as string | undefined) ??
      pickHeader(headers, "Subject") ??
      "(no subject)",
    body_text:
      (data["text"] as string | undefined) ??
      (data["body_text"] as string | undefined) ??
      null,
    body_html:
      (data["html"] as string | undefined) ??
      (data["body_html"] as string | undefined) ??
      null,
    in_reply_to_header:
      (data["in_reply_to"] as string | undefined) ??
      pickHeader(headers, "In-Reply-To"),
    references_header:
      (data["references"] as string | undefined) ??
      pickHeader(headers, "References"),
  };
}

function normalizeMessageId(raw: string | null): string | null {
  if (!raw) return null;
  // Strip <…> wrapping.
  const m = raw.trim().match(/<([^>]+)>/);
  return (m?.[1] ?? raw.trim()) || null;
}

interface ParentLite {
  id: string;
  org_id: string;
  workspace_id: string | null;
  thread_key: string | null;
  related_lead_id: string | null;
  related_vendor_id: string | null;
  related_guest_id: string | null;
  related_contract_id: string | null;
  to_email: string;
  from_email: string | null;
  subject: string;
}

async function findParentByMessageId(
  sb: SupabaseClient<Database>,
  inReplyTo: string | null,
  references: string | null,
): Promise<ParentLite | null> {
  const candidates: string[] = [];
  const a = normalizeMessageId(inReplyTo);
  if (a) candidates.push(a);
  if (references) {
    for (const part of references.split(/\s+/)) {
      const id = normalizeMessageId(part);
      if (id) candidates.push(id);
    }
  }
  for (const id of candidates) {
    const { data } = await (
      sb as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              maybeSingle: () => Promise<{ data: ParentLite | null }>;
            };
          };
        };
      }
    )
      .from("email_messages")
      .select(
        "id, org_id, workspace_id, thread_key, related_lead_id, related_vendor_id, related_guest_id, related_contract_id, to_email, from_email, subject",
      )
      .eq("provider_message_id", id)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

async function findOrgByContactEmail(
  sb: SupabaseClient<Database>,
  email: string | null,
): Promise<string | null> {
  if (!email) return null;
  const { data } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{ data: { id: string } | null }>;
          };
        };
      };
    }
  )
    .from("organizations")
    .select("id")
    .eq("contact_email", email)
    .maybeSingle();
  return data?.id ?? null;
}

function normalizeSubject(s: string): string {
  return s
    .replace(/^\s*(re|fwd|fw)\s*:\s*/i, "")
    .replace(/^\s*(re|fwd|fw)\s*:\s*/i, "")
    .trim()
    .toLowerCase();
}

async function onInbound(
  sb: SupabaseClient<Database>,
  data: Record<string, unknown>,
): Promise<void> {
  const parsed = parseInbound(data);
  if (!parsed.from_email && !parsed.to_email) {
    console.warn("[resend-webhook] inbound parse: missing addresses, skipping");
    return;
  }

  // Threading: prefer In-Reply-To match.
  const parent = await findParentByMessageId(
    sb,
    parsed.in_reply_to_header,
    parsed.references_header,
  );

  let orgId: string | null = parent?.org_id ?? null;
  let workspaceId: string | null = parent?.workspace_id ?? null;
  let threadKey: string | null = parent?.thread_key ?? null;
  let inReplyToId: string | null = parent?.id ?? null;

  // Fallback org resolution: match To address to organizations.contact_email.
  if (!orgId) {
    orgId = await findOrgByContactEmail(sb, parsed.to_email);
  }

  // If the To address matches the inbound domain, the local part may
  // encode an org id (e.g. "<orgid>@inbound.wedding-os.com"). Best-effort.
  if (!orgId && parsed.to_email && INBOUND_DOMAIN) {
    const [local, host] = parsed.to_email.split("@");
    if (host && host.toLowerCase() === INBOUND_DOMAIN.toLowerCase() && local) {
      // Try as-is — UUID local part?
      const uuidLike =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidLike.test(local)) {
        orgId = local;
      }
    }
  }

  if (!orgId) {
    console.warn(
      "[resend-webhook] inbound: could not resolve org_id for to=",
      parsed.to_email,
      " — dropping",
    );
    return;
  }

  if (!threadKey) {
    threadKey = `subj:${normalizeSubject(parsed.subject)}`;
  }

  const insertRow = {
    org_id: orgId,
    workspace_id: workspaceId,
    direction: "inbound" as const,
    kind: "reply",
    thread_key: threadKey,
    in_reply_to_message_id: inReplyToId,
    provider: "resend",
    provider_message_id:
      normalizeMessageId(pickHeader(
        (data["headers"] as Record<string, unknown> | undefined) ??
          ((data["email"] as Record<string, unknown> | undefined)?.[
            "headers"
          ] as Record<string, unknown> | undefined),
        "Message-ID",
      )) ?? null,
    to_email: parsed.to_email ?? "",
    to_name: null,
    from_email: parsed.from_email,
    from_name: parsed.from_name,
    cc: null,
    bcc: null,
    subject: parsed.subject,
    body_text: parsed.body_text,
    body_html: parsed.body_html,
    related_lead_id: parent?.related_lead_id ?? null,
    related_vendor_id: parent?.related_vendor_id ?? null,
    related_guest_id: parent?.related_guest_id ?? null,
    related_contract_id: parent?.related_contract_id ?? null,
    status: "received",
    status_detail: null,
    sent_at: null,
    created_by: null,
  };

  const { error } = await (
    sb as unknown as {
      from: (t: string) => {
        insert: (row: unknown) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .from("email_messages")
    .insert(insertRow);

  if (error) {
    console.warn("[resend-webhook] inbound insert failed:", error.message);
  }
}
