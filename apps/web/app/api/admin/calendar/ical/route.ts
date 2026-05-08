import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { looksLikeIcal, parseIcalBusySlots } from "@/lib/calendar-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/calendar/ical
// body: { url: string, label?: string }
//
// Validates the URL fetches an iCal-looking payload, stores the
// connection, runs an initial sync.
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

  let body: { url?: string; label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const url = (body.url ?? "").trim();
  const label = (body.label ?? "").trim() || "iCal feed";
  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  // Block obvious SSRF — localhost / private ranges / non-http(s) schemes
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:" &&
      parsed.protocol !== "webcal:") {
    return NextResponse.json({ error: "url must be http(s) or webcal" }, { status: 400 });
  }
  // webcal:// → https://
  const fetchUrl = parsed.protocol === "webcal:"
    ? `https://${parsed.host}${parsed.pathname}${parsed.search}`
    : url;
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host === "0.0.0.0"
  ) {
    return NextResponse.json({ error: "url not allowed" }, { status: 400 });
  }

  // Validate by fetching
  let text: string;
  try {
    const res = await fetch(fetchUrl, { redirect: "follow" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `feed returned HTTP ${res.status}` },
        { status: 400 },
      );
    }
    text = await res.text();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? `fetch failed: ${err.message}` : "fetch failed",
      },
      { status: 400 },
    );
  }
  if (!looksLikeIcal(text)) {
    return NextResponse.json(
      { error: "URL did not return an iCalendar (.ics) feed" },
      { status: 400 },
    );
  }

  // Insert connection
  const writeSb = supabase as unknown as {
    from: (t: string) => {
      insert: (rows: unknown) => {
        select: (cols: string) => {
          maybeSingle: () => Promise<{
            data: { id?: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
      delete: () => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
      update: (vals: unknown) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };

  const { data: connRow, error: insErr } = await writeSb
    .from("calendar_connections")
    .insert([
      {
        org_id: profile.org_id,
        user_id: user.id,
        provider: "ical",
        label,
        ical_url: fetchUrl,
        external_calendar_id: fetchUrl, // unique key per user/provider/cal
        status: "active",
      },
    ])
    .select("id")
    .maybeSingle();

  if (insErr || !connRow?.id) {
    return NextResponse.json(
      { error: insErr?.message ?? "could not save" },
      { status: 500 },
    );
  }

  // Initial sync
  try {
    const slots = parseIcalBusySlots(text);
    await writeSb
      .from("calendar_busy_slots")
      .delete()
      .eq("connection_id", connRow.id);
    if (slots.length) {
      const rows = slots.map((s) => ({
        org_id: profile.org_id,
        connection_id: connRow.id,
        starts_at: s.starts_at,
        ends_at: s.ends_at,
        external_event_id: s.external_event_id,
      }));
      await writeSb.from("calendar_busy_slots").insert(rows);
    }
    await writeSb
      .from("calendar_connections")
      .update({
        last_synced_at: new Date().toISOString(),
        status: "active",
        last_error: null,
      })
      .eq("id", connRow.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "initial sync failed";
    await writeSb
      .from("calendar_connections")
      .update({ status: "error", last_error: msg.slice(0, 500) })
      .eq("id", connRow.id);
  }

  return NextResponse.json({ ok: true, id: connRow.id });
}
