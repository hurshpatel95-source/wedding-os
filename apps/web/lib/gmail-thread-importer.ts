// Server-only helper for translating a Gmail message-with-payload object into
// the row-shape we insert into email_messages.
//
// Used by /api/gmail/sync. Kept pure (no I/O) so we can unit-test it later.
//
// Gmail returns a tree of MIME parts on the message payload. For our purposes
// we only care about extracting plain text + html bodies and the standard
// header set (From / To / Subject / Date / Message-ID / In-Reply-To).

import "server-only";

// We don't import the googleapis types here to keep this module
// pure-data; we describe the slice of the shape we use.
export interface GmailMessageHeader {
  name?: string | null;
  value?: string | null;
}

export interface GmailMessagePartBody {
  data?: string | null;
  size?: number | null;
}

export interface GmailMessagePart {
  mimeType?: string | null;
  filename?: string | null;
  headers?: GmailMessageHeader[] | null;
  body?: GmailMessagePartBody | null;
  parts?: GmailMessagePart[] | null;
}

export interface GmailMessage {
  id?: string | null;
  threadId?: string | null;
  historyId?: string | null;
  internalDate?: string | null;
  labelIds?: string[] | null;
  snippet?: string | null;
  payload?: GmailMessagePart | null;
}

export interface ParsedGmailMessage {
  provider_message_id: string;
  thread_key: string | null;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  to_name: string | null;
  cc: string[] | null;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  // RFC 2822 Message-ID header value (for in-reply-to lookups)
  message_id_header: string | null;
  // The In-Reply-To header value (Message-ID we are replying to)
  in_reply_to_header: string | null;
  // RFC 2822 Date / fallback to Gmail internalDate
  received_at: string;
  snippet: string | null;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Convert a Gmail message into the data we need to insert into email_messages.
 * Caller is responsible for resolving in_reply_to_message_id (uuid) from
 * `in_reply_to_header` against existing rows.
 */
export function parseGmailMessage(msg: GmailMessage): ParsedGmailMessage {
  const headers = collectHeaders(msg.payload);
  const fromHeader = pickHeader(headers, "from");
  const toHeader = pickHeader(headers, "to");
  const ccHeader = pickHeader(headers, "cc");
  const subjectHeader = pickHeader(headers, "subject") ?? "(no subject)";
  const dateHeader = pickHeader(headers, "date");
  const messageIdHeader = pickHeader(headers, "message-id");
  const inReplyToHeader = pickHeader(headers, "in-reply-to");

  const { name: fromName, email: fromEmail } = parseAddress(fromHeader);
  const { name: toName, email: toEmail } = parseAddress(toHeader);
  const ccList = parseAddressList(ccHeader);

  const { text, html } = extractBodies(msg.payload);

  const receivedIso = parseDateHeader(dateHeader, msg.internalDate ?? null);

  return {
    provider_message_id: msg.id ?? "",
    thread_key: msg.threadId ?? null,
    from_email: fromEmail,
    from_name: fromName,
    to_email: toEmail,
    to_name: toName,
    cc: ccList.length ? ccList : null,
    subject: subjectHeader,
    body_text: text,
    body_html: html,
    message_id_header: messageIdHeader,
    in_reply_to_header: inReplyToHeader,
    received_at: receivedIso,
    snippet: msg.snippet ?? null,
  };
}

// ─── Internals ───────────────────────────────────────────────────────

function collectHeaders(payload: GmailMessagePart | null | undefined): GmailMessageHeader[] {
  return payload?.headers ?? [];
}

function pickHeader(
  headers: GmailMessageHeader[],
  nameLower: string,
): string | null {
  for (const h of headers) {
    if ((h?.name ?? "").toLowerCase() === nameLower) {
      return h?.value ?? null;
    }
  }
  return null;
}

/** Parse a single address header like `"Jane Doe" <jane@example.com>`. */
export function parseAddress(value: string | null): {
  name: string | null;
  email: string | null;
} {
  if (!value) return { name: null, email: null };
  const trimmed = value.trim();
  // "Name" <addr>
  const angle = trimmed.match(/^\s*"?([^"<]*?)"?\s*<\s*([^>]+?)\s*>\s*$/);
  if (angle) {
    const rawName = angle[1].trim();
    return {
      name: rawName.length > 0 ? rawName : null,
      email: angle[2].trim().toLowerCase(),
    };
  }
  // bare email
  if (/^\S+@\S+$/.test(trimmed)) {
    return { name: null, email: trimmed.toLowerCase() };
  }
  return { name: trimmed || null, email: null };
}

function parseAddressList(value: string | null): string[] {
  if (!value) return [];
  // Comma-split is naive but fine for normal headers; Gmail rarely
  // sends quoted commas in Cc:.
  return value
    .split(",")
    .map((part) => parseAddress(part).email)
    .filter((e): e is string => Boolean(e));
}

/** Recurse through MIME parts; return first text/plain + first text/html. */
function extractBodies(
  payload: GmailMessagePart | null | undefined,
): { text: string | null; html: string | null } {
  if (!payload) return { text: null, html: null };

  let text: string | null = null;
  let html: string | null = null;

  function walk(part: GmailMessagePart) {
    const mt = (part.mimeType ?? "").toLowerCase();
    const data = part.body?.data;

    // Skip attachments — they have a filename
    if (part.filename && part.filename.length > 0) {
      return;
    }

    if (data) {
      if (mt === "text/plain" && text === null) {
        text = decodeBase64Url(data);
      } else if (mt === "text/html" && html === null) {
        html = decodeBase64Url(data);
      }
    }

    if (Array.isArray(part.parts)) {
      for (const child of part.parts) walk(child);
    }
  }

  walk(payload);
  return { text, html };
}

/** Decode Gmail's base64url-encoded body data. */
export function decodeBase64Url(encoded: string): string {
  // base64url → base64
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  // Pad to multiple of 4
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  try {
    return Buffer.from(padded, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function parseDateHeader(
  dateHeader: string | null,
  internalDateMs: string | null,
): string {
  if (dateHeader) {
    const d = new Date(dateHeader);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (internalDateMs) {
    const ms = Number(internalDateMs);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}
