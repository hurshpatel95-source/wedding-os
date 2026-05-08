import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildConsentUrl,
  gmailOauthReady,
  makeGmailStateToken,
} from "@/lib/gmail-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/gmail/oauth/connect
// Workspace member only. Builds the Gmail consent URL with a signed
// state token (workspace_id + user_id + org_id + nonce) and 302-redirects.
export async function GET() {
  if (!gmailOauthReady) {
    return NextResponse.json(
      {
        error: "gmail_not_configured",
        detail:
          "Set GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET, and GMAIL_OAUTH_REDIRECT_URI in Railway → Variables.",
      },
      { status: 503 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = supabase as unknown as {
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
  const { data: profile } = await sb
    .from("users")
    .select("workspace_id, org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.workspace_id || !profile?.org_id) {
    return NextResponse.json(
      { error: "no_workspace", detail: "Your user has no workspace yet." },
      { status: 400 },
    );
  }

  let stateToken: string;
  try {
    stateToken = makeGmailStateToken({
      workspace_id: profile.workspace_id,
      org_id: profile.org_id,
      user_id: user.id,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "state_signing_unavailable",
        detail:
          err instanceof Error
            ? err.message
            : "Cannot sign state token (missing service-role key).",
      },
      { status: 503 },
    );
  }

  const url = buildConsentUrl(stateToken);
  return NextResponse.redirect(url, 302);
}
