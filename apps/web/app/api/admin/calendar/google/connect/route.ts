import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  GOOGLE_CALENDAR_SCOPES,
  makeGoogleOAuthClient,
  readGoogleOAuthEnv,
} from "@/lib/calendar-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/calendar/google/connect
// Org admins only. Builds the Google consent URL and 302-redirects.
export async function GET() {
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

  const env = readGoogleOAuthEnv();
  if (!env) {
    // Render a tiny HTML message instead of redirecting — this is the
    // fallback for when GOOGLE_OAUTH_* env vars haven't been wired up.
    return NextResponse.redirect(
      new URL(
        "/admin/settings/calendar?error=google_not_configured",
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      ),
      302,
    );
  }

  const oauth2 = makeGoogleOAuthClient(env);
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_CALENDAR_SCOPES,
    include_granted_scopes: true,
  });
  return NextResponse.redirect(url, 302);
}
