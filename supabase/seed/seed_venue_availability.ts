// Seed venue date availability marks from Astha (Astia Events) deck.
//
// The deck explicitly calls out specific dates each venue is open in
// September 2027 — pre-populate those so the matrix is useful on day 1.
// Stay venues (ME Sitges Terramar, ME Barcelona) get the entire 9/2-9/19
// window marked available since rooms are bookable any night.
//
// Hursh's two lead-option dates (Sept 11 / 12) are marked "tentative"
// against the venues he's targeting for them, so the matrix surfaces
// the still-to-confirm questions in amber.
//
// Idempotent — upserts on (venue_id, date).
//
// Run: pnpm db:seed-availability

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/db/src/types.gen";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
loadEnv({ path: path.join(repoRoot, "apps/web/.env.local") });
loadEnv({ path: path.join(repoRoot, ".env") });

type Tables = Database["public"]["Tables"];
type VenueDateStatus = Database["public"]["Enums"]["venue_date_status"];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const sb = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface MarkSpec {
  venue: string;
  dates: string[];
  status: VenueDateStatus;
  notes?: string | null;
  source?: string;
}

// Generate every yyyy-mm-dd between start (inclusive) and end (inclusive)
function dateRange(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

const STAY_WINDOW = dateRange("2027-09-02", "2027-09-19");

const MARKS: MarkSpec[] = [
  // Casa Del Mar — explicit availability from deck
  {
    venue: "Casa Del Mar",
    dates: ["2027-09-04", "2027-09-05", "2027-09-17"],
    status: "available",
    source: "astia_deck",
  },
  // Xalet Del Nin
  {
    venue: "Xalet Del Nin",
    dates: ["2027-09-06", "2027-09-18"],
    status: "available",
    source: "astia_deck",
  },
  // Marina Port Vell
  {
    venue: "Marina Port Vell",
    dates: ["2027-09-03", "2027-09-04"],
    status: "available",
    source: "astia_deck",
  },
  // Mas de Sant Llei — whole property on 9/4, Sant Esteve only on 9/5 + 9/18
  {
    venue: "Mas de Sant Llei",
    dates: ["2027-09-04"],
    status: "available",
    notes: "Whole property available (280pax min)",
    source: "astia_deck",
  },
  {
    venue: "Mas de Sant Llei",
    dates: ["2027-09-05"],
    status: "available",
    notes: "Sant Esteve area only (250pax cap)",
    source: "astia_deck",
  },
  {
    venue: "Mas de Sant Llei",
    dates: ["2027-09-18"],
    status: "available",
    notes: "Sant Esteve area only (250pax cap)",
    source: "astia_deck",
  },
  // Stay venues — bookable every night of the wedding window
  {
    venue: "ME Sitges Terramar",
    dates: STAY_WINDOW,
    status: "available",
    notes: "Stay venue — rooms bookable",
    source: "astia_deck",
  },
  {
    venue: "ME Barcelona",
    dates: STAY_WINDOW,
    status: "available",
    notes: "Stay venue — rooms bookable",
    source: "astia_deck",
  },
  // Hursh's lead-option dates
  {
    venue: "Casa Del Mar",
    dates: ["2027-09-11"],
    status: "tentative",
    notes: "Hursh's lead Sangeet date — confirm with Astia",
    source: "manual",
  },
  {
    venue: "Mas de Sant Llei",
    dates: ["2027-09-12"],
    status: "tentative",
    notes: "Hursh's lead Wedding date — Sunday min 220, no shortfall",
    source: "manual",
  },
];

async function main() {
  const { data: workspace } = await sb
    .from("workspaces")
    .select("id, org_id")
    .limit(1)
    .maybeSingle();
  if (!workspace) throw new Error("no workspace found — run pnpm db:seed first");

  const { data: venues, error: venuesErr } = await sb
    .from("venues")
    .select("id, name")
    .eq("workspace_id", workspace.id);
  if (venuesErr || !venues) throw venuesErr;

  const byName = new Map(venues.map((v) => [v.name, v.id]));

  const rows: Tables["venue_date_marks"]["Insert"][] = [];
  for (const m of MARKS) {
    const venueId = byName.get(m.venue);
    if (!venueId) {
      console.warn(`! venue not found: ${m.venue}`);
      continue;
    }
    for (const d of m.dates) {
      rows.push({
        workspace_id: workspace.id,
        venue_id: venueId,
        date: d,
        status: m.status,
        notes: m.notes ?? null,
        source: m.source ?? "astia_deck",
      });
    }
  }

  // Upsert on (venue_id, date) — re-runs replace status/notes.
  const { error: upErr } = await sb
    .from("venue_date_marks")
    .upsert(rows, { onConflict: "venue_id,date" });
  if (upErr) {
    console.error(upErr);
    process.exit(1);
  }

  console.log(`✓ Seeded ${rows.length} venue date marks across ${MARKS.length} venue/status groups`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
