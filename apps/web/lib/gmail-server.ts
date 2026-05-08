// Server-only Gmail OAuth + send/draft/list helpers.
// Used by GMAIL-CONNECTOR + AUTOPILOT-DASHBOARD + THREAD-ANALYZER.
//
// Keep this thin: just wraps googleapis with our token-refresh pattern.
// Higher-level "draft and send for vendor X" lives in the route handlers.

import "server-only";
import { google } from "googleapis";
import type { Auth } from "googleapis";

const CLIENT_ID = process.env.GMAIL_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = process.env.GMAIL_OAUTH_REDIRECT_URI;

export const gmailOauthReady = Boolean(
  CLIENT_ID && CLIENT_SECRET && REDIRECT_URI,
);

// Scopes we ask for. Read = pull threads, compose = drafts.create,
// send = users.messages.send, modify = mark read / label.
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
];

export function getOAuth2Client(): Auth.OAuth2Client {
  if (!gmailOauthReady) {
    throw new Error("GMAIL_OAUTH env vars not configured");
  }
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

/** Build the consent URL the user clicks to grant us access. */
export function buildConsentUrl(stateToken: string): string {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state: stateToken,
  });
}

/** Hydrate an OAuth client with a refresh token, refreshing access if needed. */
export async function clientWithCredentials(
  refreshToken: string,
  accessToken: string | null = null,
  accessExpiresAt: string | null = null,
): Promise<Auth.OAuth2Client> {
  const oauth2 = getOAuth2Client();
  const credentials: Auth.Credentials = {
    refresh_token: refreshToken,
  };
  if (accessToken) credentials.access_token = accessToken;
  if (accessExpiresAt) {
    credentials.expiry_date = new Date(accessExpiresAt).getTime();
  }
  oauth2.setCredentials(credentials);

  // If access token is missing or within 60s of expiry, refresh.
  const expiry = credentials.expiry_date ?? 0;
  const needsRefresh = !accessToken || expiry < Date.now() + 60_000;
  if (needsRefresh) {
    const { credentials: fresh } = await oauth2.refreshAccessToken();
    oauth2.setCredentials(fresh);
  }
  return oauth2;
}

/** Build a base64-url-encoded RFC 2822 message for users.messages.send. */
export function buildMimeMessage(
  from: string,
  to: string,
  subject: string,
  bodyText: string,
  opts?: { cc?: string[]; bcc?: string[]; replyTo?: string; inReplyTo?: string; references?: string },
): string {
  const lines: string[] = [
    `From: ${from}`,
    `To: ${to}`,
  ];
  if (opts?.cc?.length) lines.push(`Cc: ${opts.cc.join(", ")}`);
  if (opts?.bcc?.length) lines.push(`Bcc: ${opts.bcc.join(", ")}`);
  if (opts?.replyTo) lines.push(`Reply-To: ${opts.replyTo}`);
  if (opts?.inReplyTo) lines.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts?.references) lines.push(`References: ${opts.references}`);
  lines.push(`Subject: ${subject}`);
  lines.push("Content-Type: text/plain; charset=utf-8");
  lines.push("");
  lines.push(bodyText);
  const raw = lines.join("\r\n");
  // base64url
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
