import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import {
  GMAIL_SCOPES,
  getOAuth2Client,
  gmailOauthReady,
  verifyGmailStateToken,
} from "@/lib/gmail-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/gmail/oauth/callback?code=…&state=…
// Google redirects here after consent. Verify state, exchange code for
// tokens, fetch profile.email, upsert into gmail_connections, redirect
// back to /settings/gmail with a flash query.
export async function GET(request: NextRequest) {
  const settingsUrl = new URL(
    "/settings/gmail",
    process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin,
  );

  if (!gmailOauthReady) {
    settingsUrl.searchParams.set("error", "gmail_not_configured");
    return NextResponse.redirect(settingsUrl, 302);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login", request.nextUrl.origin),
      302,
    );
  }

  const stateToken = request.nextUrl.searchParams.get("state");
  const state = stateToken ? verifyGmailStateToken(stateToken) : null;
  if (!state) {
    settingsUrl.searchParams.set("error", "bad_state");
    return NextResponse.redirect(settingsUrl, 302);
  }
  if (state.user_id !== user.id) {
    settingsUrl.searchParams.set("error", "state_user_mismatch");
    return NextResponse.redirect(settingsUrl, 302);
  }

  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    settingsUrl.searchParams.set("error", `oauth_${oauthError}`);
    return NextResponse.redirect(settingsUrl, 302);
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    settingsUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(settingsUrl, 302);
  }

  const oauth2 = getOAuth2Client();
  let tokens: {
    refresh_token?: string | null;
    access_token?: string | null;
    expiry_date?: number | null;
    scope?: string | null;
  };
  try {
    const tokenRes = await oauth2.getToken(code);
    tokens = tokenRes.tokens;
  } catch {
    settingsUrl.searchParams.set("error", "token_exchange_failed");
    return NextResponse.redirect(settingsUrl, 302);
  }

  if (!tokens.refresh_token) {
    settingsUrl.searchParams.set("error", "no_refresh_token");
    return NextResponse.redirect(settingsUrl, 302);
  }

  oauth2.setCredentials({
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token ?? null,
    expiry_date: tokens.expiry_date ?? null,
  });

  // Fetch the connected email address
  let connectedEmail: string;
  try {
    const gmail = google.gmail({ version: "v1", auth: oauth2 });
    const profileRes = await gmail.users.getProfile({ userId: "me" });
    if (!profileRes.data.emailAddress) {
      settingsUrl.searchParams.set("error", "profile_email_missing");
      return NextResponse.redirect(settingsUrl, 302);
    }
    connectedEmail = profileRes.data.emailAddress.toLowerCase();
  } catch {
    settingsUrl.searchParams.set("error", "profile_fetch_failed");
    return NextResponse.redirect(settingsUrl, 302);
  }

  const accessTokenExpiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString()
    : null;

  const writeSb = supabase as unknown as {
    from: (t: string) => {
      upsert: (
        rows: unknown,
        opts?: { onConflict?: string },
      ) => {
        select: (cols: string) => {
          maybeSingle: () => Promise<{
            data: { id?: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  const { data: connRow, error: upsertErr } = await writeSb
    .from("gmail_connections")
    .upsert(
      [
        {
          org_id: state.org_id,
          workspace_id: state.workspace_id,
          user_id: user.id,
          email: connectedEmail,
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token ?? null,
          access_token_expires_at: accessTokenExpiresAt,
          scopes: GMAIL_SCOPES,
          status: "active",
          last_error: null,
        },
      ],
      { onConflict: "email" },
    )
    .select("id")
    .maybeSingle();

  if (upsertErr || !connRow?.id) {
    settingsUrl.searchParams.set("error", "save_failed");
    return NextResponse.redirect(settingsUrl, 302);
  }

  settingsUrl.searchParams.set("connected", "1");
  return NextResponse.redirect(settingsUrl, 302);
}
