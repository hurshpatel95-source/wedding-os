// Calendar sync helpers — shared between OAuth connect/callback routes,
// the sync endpoint, and the settings page.
//
// Two providers right now:
//   - google: googleapis OAuth2 + Calendar v3 events.list
//   - ical:   plain HTTP fetch of an .ics URL + minimal regex parser
//
// Env vars for Google OAuth (planner sets these in Vercel — when missing,
// callers should fall back to a clear "Google Calendar not configured"
// error rather than crashing the build):
//
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//   GOOGLE_OAUTH_REDIRECT_URI

import { google, type Auth } from "googleapis";

export interface GoogleOAuthEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function readGoogleOAuthEnv(): GoogleOAuthEnv | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function makeGoogleOAuthClient(env: GoogleOAuthEnv): Auth.OAuth2Client {
  return new google.auth.OAuth2(env.clientId, env.clientSecret, env.redirectUri);
}

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.readonly",
];

export interface BusySlot {
  starts_at: string;
  ends_at: string;
  external_event_id: string | null;
}

// ─── Google Calendar: list busy slots in [now, now+90d] ──────────────
export async function listGoogleBusySlots(
  env: GoogleOAuthEnv,
  refreshToken: string,
  accessToken: string | null,
  accessTokenExpiresAt: string | null,
): Promise<{
  slots: BusySlot[];
  newAccessToken: string | null;
  newAccessTokenExpiresAt: string | null;
}> {
  const oauth2 = makeGoogleOAuthClient(env);
  oauth2.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken ?? undefined,
    expiry_date: accessTokenExpiresAt
      ? new Date(accessTokenExpiresAt).getTime()
      : undefined,
  });

  // Force refresh if expired (or about to expire within 60s)
  let newAccessToken: string | null = accessToken;
  let newAccessTokenExpiresAt: string | null = accessTokenExpiresAt;
  const expMs = accessTokenExpiresAt
    ? new Date(accessTokenExpiresAt).getTime()
    : 0;
  if (!accessToken || expMs - Date.now() < 60_000) {
    const tokenRes = await oauth2.getAccessToken();
    if (tokenRes.token) {
      newAccessToken = tokenRes.token;
      const creds = oauth2.credentials;
      if (creds.expiry_date) {
        newAccessTokenExpiresAt = new Date(creds.expiry_date).toISOString();
      }
    }
  }

  const calendar = google.calendar({ version: "v3", auth: oauth2 });
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  interface RawEvent {
    id?: string | null;
    status?: string | null;
    transparency?: string | null;
    start?: { dateTime?: string | null; date?: string | null } | null;
    end?: { dateTime?: string | null; date?: string | null } | null;
  }
  interface RawListResp {
    data: { items?: RawEvent[] | null; nextPageToken?: string | null };
  }

  const slots: BusySlot[] = [];
  let pageToken: string | undefined = undefined;
  // Cap pagination at 5 pages (1250 events) — defensive
  for (let i = 0; i < 5; i++) {
    const res = (await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      showDeleted: false,
      maxResults: 250,
      pageToken,
    })) as unknown as RawListResp;
    const items: RawEvent[] = res.data.items ?? [];
    for (const ev of items) {
      if (ev.status === "cancelled") continue;
      if (ev.transparency === "transparent") continue;
      const startIso =
        ev.start?.dateTime ??
        (ev.start?.date ? `${ev.start.date}T00:00:00Z` : null);
      const endIso =
        ev.end?.dateTime ??
        (ev.end?.date ? `${ev.end.date}T00:00:00Z` : null);
      if (!startIso || !endIso) continue;
      slots.push({
        starts_at: startIso,
        ends_at: endIso,
        external_event_id: ev.id ?? null,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }

  return {
    slots,
    newAccessToken,
    newAccessTokenExpiresAt,
  };
}

// ─── iCal parser ─────────────────────────────────────────────────────
// Minimal — we only need DTSTART/DTEND of each VEVENT in the next 90
// days. Skips RRULE/RECURRENCE expansion (good enough for v1).

function parseIcalDate(raw: string): Date | null {
  // Forms we accept:
  //   20260512T140000Z
  //   20260512T140000
  //   20260512
  //   TZID=Europe/London:20260512T140000  (drop tzid, treat as local UTC-ish)
  let v = raw.trim();
  const colonIdx = v.indexOf(":");
  if (colonIdx >= 0 && v.includes("=")) {
    v = v.slice(colonIdx + 1);
  }
  if (/^\d{8}$/.test(v)) {
    const y = +v.slice(0, 4);
    const mo = +v.slice(4, 6);
    const d = +v.slice(6, 8);
    return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0));
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z === "Z") {
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  }
  // No tz — treat as UTC-ish; this is approximate but the only thing that
  // matters for booking-page conflict dimming is roughly correct intervals.
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
}

export function parseIcalBusySlots(
  text: string,
  windowEndMs: number = Date.now() + 90 * 24 * 60 * 60 * 1000,
): BusySlot[] {
  // Unfold continuation lines per RFC 5545: lines starting with space/tab
  // continue the previous line.
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const slots: BusySlot[] = [];
  const now = Date.now();

  let inEvent = false;
  let dtstart: string | null = null;
  let dtend: string | null = null;
  let uid: string | null = null;
  let status: string | null = null;
  let transp: string | null = null;

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      dtstart = dtend = uid = status = transp = null;
      continue;
    }
    if (line === "END:VEVENT") {
      if (inEvent && dtstart && dtend) {
        const s = parseIcalDate(dtstart);
        const e = parseIcalDate(dtend);
        if (
          s &&
          e &&
          status !== "CANCELLED" &&
          transp !== "TRANSPARENT" &&
          e.getTime() > now &&
          s.getTime() < windowEndMs
        ) {
          slots.push({
            starts_at: s.toISOString(),
            ends_at: e.toISOString(),
            external_event_id: uid,
          });
        }
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;
    // Match property name (with optional ;params) up to the colon
    const propMatch = line.match(/^([A-Z\-]+)(;[^:]*)?:(.*)$/);
    if (!propMatch) continue;
    const [, prop, params, value] = propMatch;
    const fullValue = (params ?? "") + (params ? ":" : "") + value;
    if (prop === "DTSTART") dtstart = fullValue.startsWith(":") ? value : fullValue;
    else if (prop === "DTEND") dtend = fullValue.startsWith(":") ? value : fullValue;
    else if (prop === "UID") uid = value;
    else if (prop === "STATUS") status = value.toUpperCase();
    else if (prop === "TRANSP") transp = value.toUpperCase();
  }
  return slots;
}

export function looksLikeIcal(text: string): boolean {
  return text.includes("BEGIN:VCALENDAR");
}
