// POST /api/public/rsvp — public, no-auth RSVP submission for /w/<slug>.
// GET  /api/public/rsvp?slug=<workspace_slug>&q=<name> — typeahead match
//      against the workspace's guest list, case-insensitive.
//
// SECURITY: anon-callable. We use SERVICE ROLE on the server only and gate
// every read/write by `(guest_id, workspace_slug)` so an attacker who knows a
// random guest UUID still can't write to a different workspace. Soft IP rate
// limit defends against form spam.
//
// SCHEMA NOTES (don't write a new migration — work with what's already there):
//   - Per-event RSVP table is `guest_event_invitations` (NOT `guest_invitations`
//     as the spec called it). One row per (guest_id, event_role). We upsert.
//   - The spec asked for columns `guests.allowed_plus_one`, `plus_one_name`,
//     `plus_one_attending`, and `rsvp_completed_at`. NONE of those exist.
//     Instead the schema we have is:
//       * guests.plus_one_max (integer, count of +1s primary may bring)
//       * guests.is_plus_one (boolean)
//       * guests.plus_one_of_guest_id (FK back to the primary guest)
//     So a "plus-one" is a real guests row, linked to the primary via
//     plus_one_of_guest_id. We follow that pattern: when the form supplies a
//     plus-one name we upsert a real guests row for them.
//   - There is no `rsvp_completed_at` column. We instead stamp a marker into
//     guests.notes (append-only) — the spec asked for notes append anyway —
//     and rely on guests.updated_at for "when did this RSVP land?". The
//     dashboard already orders by updated_at desc.
//   - If a future migration adds `rsvp_completed_at` and `rsvp_song_request`
//     columns we'd want, the SQL would be:
//
//       alter table guests
//         add column rsvp_completed_at timestamptz,
//         add column rsvp_song_request text,
//         add column rsvp_accessibility text;
//
//     For now we shove song-request / accessibility into the appended notes
//     blob with stable headings so the couple can read them in the dashboard.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";
import { sanitizeText } from "@/lib/lead-types";

export const runtime = "nodejs";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// ─── Rate limit (in-memory, process-local) ─────────────────────────────
// Mirrors the pattern in /api/couples-signup. Each Railway dyno keeps its
// own counter; that's fine — the goal is "make form spam annoying", not
// to defend against a distributed attacker.
const RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 10;

function ratelimit(key: string): boolean {
  const now = Date.now();
  const bucket = RATE_BUCKETS.get(key);
  if (!bucket || bucket.resetAt < now) {
    RATE_BUCKETS.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_PER_HOUR) return false;
  bucket.count += 1;
  return true;
}

// We accept any string from the venues.event_roles array — DB-side enum is
// the source of truth and Postgres rejects invalid values on insert. We
// still pre-filter to keep error responses friendly.
const ALLOWED_RSVP = new Set(["yes", "no", "maybe"]);

// EventRole values that exist in the DB enum (incl. 0508 extension).
const KNOWN_EVENT_ROLES = new Set<string>([
  "mehndi",
  "sangeet",
  "welcome",
  "haldi",
  "ceremony",
  "reception",
  "wedding",
  "stay",
  "rehearsal",
  "after_party",
  "brunch",
]);

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s,
  );
}

// ─── GET: typeahead match for step 1 ──────────────────────────────────
// Returns up to 10 guests for the workspace whose name contains `q`
// (case-insensitive). Plus-one rows (is_plus_one=true) are excluded — a +1
// shouldn't RSVP through the public form, the primary guest manages them.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const slug = (url.searchParams.get("slug") ?? "").trim();
  const q = (url.searchParams.get("q") ?? "").trim();

  if (!slug) {
    return NextResponse.json({ error: "missing slug" }, { status: 400 });
  }
  if (q.length < 2) {
    // Avoid exposing the entire guest list to a 1-character probe.
    return NextResponse.json({ matches: [] });
  }

  const sb = adminClient();
  const { data: ws } = await sb
    .from("workspaces")
    .select("id, public_published_at")
    .eq("public_slug", slug)
    .maybeSingle();

  if (!ws || !ws.public_published_at) {
    // Don't leak whether a slug exists vs is unpublished.
    return NextResponse.json({ matches: [] });
  }

  // ilike is case-insensitive in Postgres. We escape % and _ so a guest
  // named "10% Off" doesn't act as a wildcard probe.
  const safe = q.replace(/[%_\\]/g, (c) => `\\${c}`);
  // Cast — is_plus_one + plus_one_of_guest_id columns aren't in the
  // generated Database types yet (migration 0025).
  const sbSearch = sb as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          ilike: (col: string, pattern: string) => {
            order: (col: string, opts: { ascending: boolean }) => {
              limit: (n: number) => Promise<{
                data: Array<{
                  id: string;
                  full_name: string;
                  is_plus_one: boolean | null;
                  plus_one_of_guest_id: string | null;
                }> | null;
              }>;
            };
          };
        };
      };
    };
  };
  const { data: rowsRaw } = await sbSearch
    .from("guests")
    .select("id, full_name, is_plus_one, plus_one_of_guest_id")
    .eq("workspace_id", ws.id)
    .ilike("full_name", `%${safe}%`)
    .order("full_name", { ascending: true })
    .limit(20);

  const rows = rowsRaw ?? [];

  // Hide pure plus-one rows from the typeahead — they shouldn't self-RSVP.
  const filtered = rows.filter((r) => !r.is_plus_one).slice(0, 10);
  return NextResponse.json({
    matches: filtered.map((r) => ({ id: r.id, full_name: r.full_name })),
  });
}

// ─── POST: submit the form ─────────────────────────────────────────────
interface RsvpSubmission {
  workspaceSlug?: string;
  guest_id?: string;
  // { wedding: "yes", reception: "no" }
  per_event?: Record<string, string>;
  // optional plus-one — we create a real guests row for them
  plus_one_name?: string | null;
  plus_one_attending?: boolean | null;
  // collected on step 4
  dietary?: string | null;
  allergies?: string | null;
  song_request?: string | null;
  accessibility?: string | null;
  notes?: string | null;
  // honeypot
  website?: string;
}

export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "service role not configured" },
      { status: 503 },
    );
  }

  let body: RsvpSubmission;
  try {
    body = (await request.json()) as RsvpSubmission;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Honeypot — silent success so bots don't iterate
  if (body.website && typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (!ratelimit(ip)) {
    return NextResponse.json(
      { error: "Too many RSVPs from this network — try again in a bit" },
      { status: 429 },
    );
  }

  const slug = sanitizeText(body.workspaceSlug, 120);
  const guestId = sanitizeText(body.guest_id, 64);
  if (!slug || !guestId || !isUuid(guestId)) {
    return NextResponse.json(
      { error: "missing workspaceSlug or guest_id" },
      { status: 400 },
    );
  }

  const sb = adminClient();

  // Resolve workspace + guest in one round-trip apiece. We require:
  //   1. Workspace published (don't accept RSVPs for draft sites)
  //   2. Guest row's workspace_id matches the slug's workspace.id
  // This is the "scope guard" that prevents an attacker who guessed a guest
  // UUID from another wedding from writing into this couple's data.
  const { data: ws } = await sb
    .from("workspaces")
    .select("id, org_id, public_published_at")
    .eq("public_slug", slug)
    .maybeSingle();

  if (!ws || !ws.public_published_at) {
    return NextResponse.json({ error: "wedding not found" }, { status: 404 });
  }

  // Cast around stale generated types — guests.is_plus_one/plus_one_*
  // landed in migration 0025 but Database types haven't been regenerated.
  const sbGuests = sb as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: {
              id: string;
              full_name: string;
              workspace_id: string;
              org_id: string;
              dietary: string | null;
              allergies: string | null;
              notes: string | null;
              is_plus_one: boolean | null;
              plus_one_of_guest_id: string | null;
              plus_one_max: number | null;
              overall_rsvp: string | null;
            } | null;
          }>;
        };
      };
    };
  };
  const { data: guest } = await sbGuests
    .from("guests")
    .select(
      "id, full_name, workspace_id, org_id, dietary, allergies, notes, is_plus_one, plus_one_of_guest_id, plus_one_max, overall_rsvp",
    )
    .eq("id", guestId)
    .maybeSingle();

  if (!guest || guest.workspace_id !== ws.id) {
    return NextResponse.json(
      { error: "guest not found for this wedding" },
      { status: 404 },
    );
  }

  if (guest.is_plus_one) {
    // Plus-ones don't RSVP via this flow — the primary handles them.
    return NextResponse.json(
      {
        error:
          "Plus-ones can't RSVP directly — the primary guest covers your response.",
      },
      { status: 400 },
    );
  }

  // ─── Validate and apply per-event RSVPs ───────────────────────────
  const perEvent = body.per_event ?? {};
  const eventInserts: Array<{
    guest_id: string;
    event_role: string;
    rsvp: "yes" | "no" | "maybe";
    is_invited: true;
  }> = [];
  const eventRecord: Record<string, "yes" | "no" | "maybe"> = {};

  for (const [role, value] of Object.entries(perEvent)) {
    if (!KNOWN_EVENT_ROLES.has(role)) continue;
    if (typeof value !== "string" || !ALLOWED_RSVP.has(value)) continue;
    eventInserts.push({
      guest_id: guest.id,
      event_role: role,
      rsvp: value as "yes" | "no" | "maybe",
      is_invited: true,
    });
    eventRecord[role] = value as "yes" | "no" | "maybe";
  }

  if (eventInserts.length === 0) {
    return NextResponse.json(
      { error: "Pick at least one event response" },
      { status: 400 },
    );
  }

  // Upsert per-event invitations. The unique constraint is (guest_id,
  // event_role) per the migration — onConflict ensures idempotency if the
  // guest fills the form twice.
  const { error: invErr } = await (
    sb as unknown as {
      from: (t: string) => {
        upsert: (
          rows: unknown,
          opts: { onConflict: string },
        ) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .from("guest_event_invitations")
    .upsert(eventInserts, { onConflict: "guest_id,event_role" });

  if (invErr) {
    return NextResponse.json({ error: invErr.message }, { status: 500 });
  }

  // ─── Aggregate overall RSVP ────────────────────────────────────────
  // If the guest said yes to ANY event, overall is yes. Otherwise if any
  // maybe → maybe. Otherwise no. (Pending stays pending only when the form
  // submitted nothing, which we already rejected above.)
  let overall: "yes" | "no" | "maybe" = "no";
  const values = Object.values(eventRecord);
  if (values.includes("yes")) overall = "yes";
  else if (values.includes("maybe")) overall = "maybe";

  // ─── Append-only notes update + dietary/allergies merge ─────────────
  // The spec said "append, don't overwrite" for notes. We also fold in the
  // song request + accessibility blocks since there's no dedicated column.
  const stamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  const blocks: string[] = [];
  if (body.song_request && typeof body.song_request === "string") {
    const v = sanitizeText(body.song_request, 500);
    if (v) blocks.push(`Song request: ${v}`);
  }
  if (body.accessibility && typeof body.accessibility === "string") {
    const v = sanitizeText(body.accessibility, 500);
    if (v) blocks.push(`Accessibility: ${v}`);
  }
  if (body.notes && typeof body.notes === "string") {
    const v = sanitizeText(body.notes, 2000);
    if (v) blocks.push(`Note: ${v}`);
  }

  const newNoteBlock =
    blocks.length > 0 ? `[RSVP ${stamp}]\n${blocks.join("\n")}` : null;

  const guestUpdate: Record<string, unknown> = {
    overall_rsvp: overall,
  };
  if (body.dietary !== undefined) {
    const v = sanitizeText(body.dietary, 500);
    // Only overwrite when the guest actually typed something, so we don't
    // wipe planner-entered dietary info on an empty form submit.
    if (v) guestUpdate.dietary = v;
  }
  if (body.allergies !== undefined) {
    const v = sanitizeText(body.allergies, 500);
    if (v) guestUpdate.allergies = v;
  }
  if (newNoteBlock) {
    guestUpdate.notes = guest.notes
      ? `${guest.notes}\n\n${newNoteBlock}`
      : newNoteBlock;
  }

  const { error: guestErr } = await sb
    .from("guests")
    .update(guestUpdate as never)
    .eq("id", guest.id);

  if (guestErr) {
    return NextResponse.json({ error: guestErr.message }, { status: 500 });
  }

  // ─── Plus-one handling ────────────────────────────────────────────
  // Schema-aware: a +1 is a real guests row linked via plus_one_of_guest_id.
  // We only act if the primary is allowed at least one +1 (plus_one_max > 0).
  // If a name is provided we upsert one +1 row; if attendance flag is
  // provided we set its overall_rsvp accordingly.
  let plusOneRowId: string | null = null;
  const plusName = sanitizeText(body.plus_one_name, 120);
  const allowedMax = Number(guest.plus_one_max ?? 0);
  if (plusName && allowedMax > 0) {
    const plusRsvp =
      body.plus_one_attending === true
        ? "yes"
        : body.plus_one_attending === false
          ? "no"
          : "pending";

    // Try to find an existing +1 row for this primary first — we don't want
    // to keep creating new guest rows if the couple submits the form twice.
    const { data: existingPlus } = await (
      sb as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => {
                limit: (n: number) => Promise<{
                  data: Array<{ id: string }> | null;
                }>;
              };
            };
          };
        };
      }
    )
      .from("guests")
      .select("id")
      .eq("plus_one_of_guest_id", guest.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (existingPlus && existingPlus.length > 0) {
      plusOneRowId = existingPlus[0].id;
      await sb
        .from("guests")
        .update({
          full_name: plusName,
          overall_rsvp: plusRsvp,
        } as never)
        .eq("id", plusOneRowId);
    } else {
      const { data: created } = await (
        sb as unknown as {
          from: (t: string) => {
            insert: (row: unknown) => {
              select: (cols: string) => {
                single: () => Promise<{ data: { id: string } | null }>;
              };
            };
          };
        }
      )
        .from("guests")
        .insert({
          workspace_id: ws.id,
          org_id: ws.org_id,
          full_name: plusName,
          is_plus_one: true,
          plus_one_of_guest_id: guest.id,
          overall_rsvp: plusRsvp,
          // mirror primary's "side" so the dashboard counts make sense —
          // skip; we don't have that on the form. Leave null.
        })
        .select("id")
        .single();
      plusOneRowId = created?.id ?? null;

      // Mirror the primary's per-event invitations onto the +1 so the
      // dashboard shows them per event too.
      if (plusOneRowId) {
        const plusInvites = eventInserts.map((ev) => ({
          guest_id: plusOneRowId!,
          event_role: ev.event_role,
          rsvp: plusRsvp,
          is_invited: true,
        }));
        if (plusInvites.length > 0) {
          await (
            sb as unknown as {
              from: (t: string) => {
                upsert: (
                  rows: unknown,
                  opts: { onConflict: string },
                ) => Promise<{ error: unknown }>;
              };
            }
          )
            .from("guest_event_invitations")
            .upsert(plusInvites, { onConflict: "guest_id,event_role" });
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    guest: {
      id: guest.id,
      full_name: guest.full_name,
      overall_rsvp: overall,
    },
    plus_one_id: plusOneRowId,
    thank_you: {
      heading:
        overall === "yes"
          ? `Thank you, ${guest.full_name.split(" ")[0]}!`
          : overall === "no"
            ? "We'll miss you!"
            : "Thanks for letting us know",
      body:
        overall === "yes"
          ? "We can't wait to celebrate with you. We'll be in touch with logistics closer to the date."
          : overall === "no"
            ? "Thanks for letting us know — we'll be thinking of you on the day."
            : "We've recorded your maybe — feel free to come back and update once you know.",
    },
  });
}
