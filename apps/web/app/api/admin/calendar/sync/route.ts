import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listGoogleBusySlots,
  looksLikeIcal,
  parseIcalBusySlots,
  readGoogleOAuthEnv,
  type BusySlot,
} from "@/lib/calendar-sync";
import type { CalendarConnectionRow } from "@/lib/wave2-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/calendar/sync
//   body: { connection_id?: string }
// Optional connection_id syncs just that one; otherwise sync all of the
// caller's connections.
export async function POST(request: NextRequest) {
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

  let body: { connection_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const listSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => Promise<{
            data: CalendarConnectionRow[] | null;
          }>;
        } & Promise<{ data: CalendarConnectionRow[] | null }>;
      };
    };
  };

  let connections: CalendarConnectionRow[] = [];
  if (body.connection_id) {
    const { data } = await listSb
      .from("calendar_connections")
      .select(
        "id, org_id, user_id, provider, label, refresh_token, access_token, access_token_expires_at, ical_url, external_calendar_id, status, last_synced_at, last_error, created_at, updated_at",
      )
      .eq("id", body.connection_id)
      .eq("user_id", user.id);
    connections = (data ?? []) as CalendarConnectionRow[];
  } else {
    const { data } = await listSb
      .from("calendar_connections")
      .select(
        "id, org_id, user_id, provider, label, refresh_token, access_token, access_token_expires_at, ical_url, external_calendar_id, status, last_synced_at, last_error, created_at, updated_at",
      )
      .eq("user_id", user.id);
    connections = (data ?? []) as CalendarConnectionRow[];
  }

  const writeSb = supabase as unknown as {
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

  const results: { id: string; ok: boolean; error?: string; count: number }[] = [];

  for (const conn of connections) {
    try {
      let slots: BusySlot[] = [];
      let updates: Record<string, unknown> = {
        last_synced_at: new Date().toISOString(),
        status: "active",
        last_error: null,
      };

      if (conn.provider === "google") {
        const env = readGoogleOAuthEnv();
        if (!env) {
          throw new Error("Google Calendar not configured");
        }
        if (!conn.refresh_token) {
          throw new Error("missing refresh token — reconnect required");
        }
        const result = await listGoogleBusySlots(
          env,
          conn.refresh_token,
          conn.access_token,
          conn.access_token_expires_at,
        );
        slots = result.slots;
        updates = {
          ...updates,
          access_token: result.newAccessToken,
          access_token_expires_at: result.newAccessTokenExpiresAt,
        };
      } else if (conn.provider === "ical") {
        if (!conn.ical_url) {
          throw new Error("missing ical url");
        }
        const res = await fetch(conn.ical_url, { redirect: "follow" });
        if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
        const text = await res.text();
        if (!looksLikeIcal(text)) throw new Error("not a valid iCal feed");
        slots = parseIcalBusySlots(text);
      } else {
        throw new Error(`provider ${conn.provider} not supported`);
      }

      // Replace busy slots for this connection in the [now, +90d] window.
      // Simplest: nuke all slots for this connection and reinsert.
      await writeSb
        .from("calendar_busy_slots")
        .delete()
        .eq("connection_id", conn.id);
      if (slots.length) {
        const rows = slots.map((s) => ({
          org_id: conn.org_id,
          connection_id: conn.id,
          starts_at: s.starts_at,
          ends_at: s.ends_at,
          external_event_id: s.external_event_id,
        }));
        const { error: insErr } = await writeSb
          .from("calendar_busy_slots")
          .insert(rows);
        if (insErr) throw new Error(insErr.message);
      }
      await writeSb
        .from("calendar_connections")
        .update(updates)
        .eq("id", conn.id);

      results.push({ id: conn.id, ok: true, count: slots.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "sync failed";
      await writeSb
        .from("calendar_connections")
        .update({ status: "error", last_error: msg.slice(0, 500) })
        .eq("id", conn.id);
      results.push({ id: conn.id, ok: false, error: msg, count: 0 });
    }
  }

  return NextResponse.json({ ok: true, results });
}
