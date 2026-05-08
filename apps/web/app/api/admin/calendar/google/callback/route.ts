import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  makeGoogleOAuthClient,
  readGoogleOAuthEnv,
  listGoogleBusySlots,
} from "@/lib/calendar-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/calendar/google/callback?code=…
// Google redirects here after consent. We exchange the code for tokens,
// store the connection, run an initial sync, then redirect back to
// /admin/settings/calendar with a flash.
export async function GET(request: NextRequest) {
  const settingsUrl = new URL(
    "/admin/settings/calendar",
    process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin,
  );

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/sign-in", request.nextUrl.origin),
      302,
    );
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
    settingsUrl.searchParams.set("error", "forbidden");
    return NextResponse.redirect(settingsUrl, 302);
  }

  const env = readGoogleOAuthEnv();
  if (!env) {
    settingsUrl.searchParams.set("error", "google_not_configured");
    return NextResponse.redirect(settingsUrl, 302);
  }

  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    settingsUrl.searchParams.set("error", `oauth_${oauthError}`);
    return NextResponse.redirect(settingsUrl, 302);
  }
  if (!code) {
    settingsUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(settingsUrl, 302);
  }

  const oauth2 = makeGoogleOAuthClient(env);
  let tokens: {
    refresh_token?: string | null;
    access_token?: string | null;
    expiry_date?: number | null;
  };
  try {
    const tokenRes = await oauth2.getToken(code);
    tokens = tokenRes.tokens;
  } catch {
    settingsUrl.searchParams.set("error", "token_exchange_failed");
    return NextResponse.redirect(settingsUrl, 302);
  }

  if (!tokens.refresh_token) {
    // Without a refresh token we can't sync long-term. Tell user to
    // remove the existing access in their Google account and reconnect.
    settingsUrl.searchParams.set("error", "no_refresh_token");
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
    .from("calendar_connections")
    .upsert(
      [
        {
          org_id: profile.org_id,
          user_id: user.id,
          provider: "google",
          label: "Google Calendar",
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token ?? null,
          access_token_expires_at: accessTokenExpiresAt,
          external_calendar_id: "primary",
          status: "active",
          last_error: null,
        },
      ],
      { onConflict: "user_id,provider,external_calendar_id" },
    )
    .select("id")
    .maybeSingle();

  if (upsertErr || !connRow?.id) {
    settingsUrl.searchParams.set(
      "error",
      upsertErr?.message ? "save_failed" : "save_failed",
    );
    return NextResponse.redirect(settingsUrl, 302);
  }

  // Initial sync — best-effort. Don't fail the redirect if it errors.
  try {
    const { slots, newAccessToken, newAccessTokenExpiresAt } =
      await listGoogleBusySlots(
        env,
        tokens.refresh_token,
        tokens.access_token ?? null,
        accessTokenExpiresAt,
      );
    await persistInitialSlots(
      supabase,
      profile.org_id!,
      connRow.id,
      slots,
      newAccessToken,
      newAccessTokenExpiresAt,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "initial sync failed";
    await markConnectionError(supabase, connRow.id, msg);
  }

  settingsUrl.searchParams.set("connected", "google");
  return NextResponse.redirect(settingsUrl, 302);
}

async function persistInitialSlots(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  connectionId: string,
  slots: { starts_at: string; ends_at: string; external_event_id: string | null }[],
  newAccessToken: string | null,
  newAccessTokenExpiresAt: string | null,
) {
  const sb = supabase as unknown as {
    from: (t: string) => {
      delete: () => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
      insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
      update: (vals: unknown) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
  await sb.from("calendar_busy_slots").delete().eq("connection_id", connectionId);
  if (slots.length) {
    const rows = slots.map((s) => ({
      org_id: orgId,
      connection_id: connectionId,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      external_event_id: s.external_event_id,
    }));
    await sb.from("calendar_busy_slots").insert(rows);
  }
  await sb
    .from("calendar_connections")
    .update({
      access_token: newAccessToken,
      access_token_expires_at: newAccessTokenExpiresAt,
      last_synced_at: new Date().toISOString(),
      status: "active",
      last_error: null,
    })
    .eq("id", connectionId);
}

async function markConnectionError(
  supabase: ReturnType<typeof createClient>,
  connectionId: string,
  message: string,
) {
  const sb = supabase as unknown as {
    from: (t: string) => {
      update: (vals: unknown) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
  await sb
    .from("calendar_connections")
    .update({ status: "error", last_error: message.slice(0, 500) })
    .eq("id", connectionId);
}
