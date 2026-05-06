// Seed a template Indian wedding timeline for the Sept 11/12 hybrid scenario.
// Idempotent — skips if any timeline_items already exist for the workspace.
//
// Run: pnpm db:seed-timeline
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.

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
type EventRole = Database["public"]["Enums"]["event_role"];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const sb = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Build an ISO from a base YYYY-MM-DD plus HH:mm in local time.
function isoAt(dateStr: string, time: string): string {
  // Treat as local time for the seeded "demo" wedding date.
  const [h, m] = time.split(":").map(Number);
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0).toISOString();
}

type Slot = {
  event_role: EventRole;
  time: string; // "HH:mm" local
  duration_minutes: number;
  what: string;
  who_responsible?: string;
  location?: string;
  notes?: string;
};

// Hybrid Sept 11 (Sangeet) + Sept 12 (Wedding) — placeholder times if no wedding_date.
const SANGEET_DATE_OFFSET_DAYS = -1;

const SANGEET_SLOTS: Slot[] = [
  { event_role: "sangeet", time: "18:00", duration_minutes: 60, what: "Doors open · welcome drinks", who_responsible: "Venue + bar", location: "Lobby" },
  { event_role: "sangeet", time: "19:00", duration_minutes: 60, what: "Mingling / family arrivals", who_responsible: "MOH + ushers" },
  { event_role: "sangeet", time: "20:00", duration_minutes: 90, what: "Performances", who_responsible: "DJ + emcee", location: "Main stage", notes: "Family choreo, friends' dance, couple's first dance" },
  { event_role: "sangeet", time: "22:00", duration_minutes: 60, what: "Dinner service", who_responsible: "Catering" },
  { event_role: "sangeet", time: "23:00", duration_minutes: 120, what: "Open dancing", who_responsible: "DJ" },
  { event_role: "sangeet", time: "01:00", duration_minutes: 0, what: "Close · last call", who_responsible: "Venue" },
];

const WEDDING_SLOTS: Slot[] = [
  { event_role: "wedding", time: "16:00", duration_minutes: 60, what: "Baraat", who_responsible: "Groom's family + dhol", location: "Front lawn" },
  { event_role: "wedding", time: "17:00", duration_minutes: 90, what: "Ceremony (Hindu rites)", who_responsible: "Pandit", location: "Mandap area", notes: "Milni → Jaimala → Phere → Sindoor → Mangalsutra" },
  { event_role: "wedding", time: "18:30", duration_minutes: 90, what: "Cocktail hour", who_responsible: "Bar + servers", location: "Garden terrace" },
  { event_role: "wedding", time: "20:00", duration_minutes: 30, what: "Reception entry · couple's first dance", who_responsible: "DJ + emcee", location: "Ballroom" },
  { event_role: "wedding", time: "20:30", duration_minutes: 30, what: "Speeches (parents, MOH, best man)", who_responsible: "Emcee" },
  { event_role: "wedding", time: "21:00", duration_minutes: 90, what: "Dinner service", who_responsible: "Catering" },
  { event_role: "wedding", time: "23:00", duration_minutes: 15, what: "Cake cut", who_responsible: "Venue + photographer" },
  { event_role: "wedding", time: "23:15", duration_minutes: 105, what: "Open dancing", who_responsible: "DJ" },
  { event_role: "wedding", time: "01:00", duration_minutes: 0, what: "Close · sparkler send-off", who_responsible: "Venue + photographer" },
];

async function main() {
  // Use the first workspace (matches the seed pattern in seed.ts).
  const { data: workspace, error: wsErr } = await sb
    .from("workspaces")
    .select("id, org_id, wedding_date")
    .limit(1)
    .maybeSingle();

  if (wsErr || !workspace) {
    console.error("No workspace found — run pnpm db:seed first.");
    process.exit(1);
  }

  // Idempotency check
  const { count, error: cErr } = await sb
    .from("timeline_items")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);
  if (cErr) {
    console.error(cErr.message);
    process.exit(1);
  }
  if ((count ?? 0) > 0) {
    console.log(`✓ Workspace already has ${count} timeline items — skipping.`);
    return;
  }

  // Resolve dates
  const weddingDateStr =
    (workspace.wedding_date as string | null) ?? "2027-09-12"; // placeholder
  const sangeetDate = (() => {
    const [y, mo, d] = weddingDateStr.split("-").map(Number);
    const dt = new Date(y, mo - 1, d);
    dt.setDate(dt.getDate() + SANGEET_DATE_OFFSET_DAYS);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  })();

  const rows: Tables["timeline_items"]["Insert"][] = [
    ...SANGEET_SLOTS.map((s, i) => ({
      workspace_id: workspace.id,
      org_id: workspace.org_id,
      event_role: s.event_role,
      occurs_at: isoAt(sangeetDate, s.time),
      duration_minutes: s.duration_minutes,
      what: s.what,
      who_responsible: s.who_responsible ?? null,
      location: s.location ?? null,
      notes: s.notes ?? null,
      sort_order: i * 10,
    })),
    ...WEDDING_SLOTS.map((s, i) => ({
      workspace_id: workspace.id,
      org_id: workspace.org_id,
      event_role: s.event_role,
      occurs_at: isoAt(weddingDateStr, s.time),
      duration_minutes: s.duration_minutes,
      what: s.what,
      who_responsible: s.who_responsible ?? null,
      location: s.location ?? null,
      notes: s.notes ?? null,
      sort_order: i * 10,
    })),
  ];

  const { error } = await sb.from("timeline_items").insert(rows);
  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }

  console.log(`✓ Inserted ${rows.length} timeline items for workspace ${workspace.id}`);
  console.log(`   Sangeet date: ${sangeetDate}`);
  console.log(`   Wedding date: ${weddingDateStr}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
