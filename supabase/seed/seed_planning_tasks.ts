// Seed the A-Z planning checklist. ~70 tasks across phases, categories, and
// owners. Mixes operational items (auto-derived from existing venues / vendors
// / guests data) with personal milestones (outfits, marriage license, vows)
// and cultural rituals (mehndi, sangeet, pithi/haldi, baraat).
//
// Idempotent — checks for existing tasks before inserting.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
loadEnv({ path: path.join(repoRoot, "apps/web/.env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

type Phase =
  | "pre_12_months"
  | "months_9_12"
  | "months_6_9"
  | "months_3_6"
  | "months_1_3"
  | "final_month"
  | "final_week"
  | "day_of"
  | "post_wedding";

type Category =
  | "venue"
  | "vendor"
  | "attire"
  | "paperwork"
  | "guest"
  | "logistics"
  | "design"
  | "ritual"
  | "finance"
  | "honeymoon"
  | "other";

type Owner = "couple" | "planner" | "groom" | "bride" | "family" | "vendor";

interface TaskSpec {
  title: string;
  description?: string;
  phase: Phase;
  category: Category;
  owner: Owner;
  months_before?: number;
  auto_derive_kind?: string;
}

const TASKS: TaskSpec[] = [
  // ============================================================
  // PRE-12 MONTHS — set the foundation
  // ============================================================
  { title: "Set the wedding date", description: "Lock the date(s) — Sangeet, Wedding, anything else.", phase: "pre_12_months", category: "logistics", owner: "couple", months_before: 14 },
  { title: "Set the budget", description: "Total budget + per-event allocation. Drives every other call.", phase: "pre_12_months", category: "finance", owner: "couple", months_before: 14 },
  { title: "Hire the planner", description: "Astia Events confirmed. Contract signed.", phase: "pre_12_months", category: "vendor", owner: "couple", months_before: 14 },
  { title: "Compile guest list (rough)", description: "First-pass headcount drives venue capacity selection.", phase: "pre_12_months", category: "guest", owner: "couple", months_before: 14, auto_derive_kind: "guests_count_above:50" },
  { title: "Pick the venue(s)", description: "Decide between Sitges / Barcelona packages. Lock the wedding venue first.", phase: "pre_12_months", category: "venue", owner: "couple", months_before: 13, auto_derive_kind: "venue_status:decided" },
  { title: "Sign venue contract + pay deposit", description: "Holds the date.", phase: "pre_12_months", category: "venue", owner: "planner", months_before: 13 },
  { title: "Engagement photos", description: "For save-the-dates + the wedding website.", phase: "pre_12_months", category: "design", owner: "couple", months_before: 12 },

  // ============================================================
  // 9-12 MONTHS OUT — book the heavy hitters
  // ============================================================
  { title: "Book photographer", description: "First major creative vendor. Lock before they sell out for the date.", phase: "months_9_12", category: "vendor", owner: "couple", months_before: 12, auto_derive_kind: "vendor_booked:photographer" },
  { title: "Book videographer", phase: "months_9_12", category: "vendor", owner: "couple", months_before: 12, auto_derive_kind: "vendor_booked:videographer" },
  { title: "Book DJ / live band", phase: "months_9_12", category: "vendor", owner: "couple", months_before: 11, auto_derive_kind: "vendor_booked_any:dj,live_band" },
  { title: "Book caterer / confirm in-house package", description: "Astia menus are €180 sangeet / €220 wedding for these venues.", phase: "months_9_12", category: "vendor", owner: "planner", months_before: 11 },
  { title: "Book florist + decor lead", phase: "months_9_12", category: "vendor", owner: "couple", months_before: 11, auto_derive_kind: "vendor_booked_any:florist,decor" },
  { title: "Send save-the-dates", description: "Use the AI compose button on /guests.", phase: "months_9_12", category: "guest", owner: "couple", months_before: 10 },
  { title: "Bride: start dress shopping", description: "Indian bridal lehengas can take 6+ months. Start early.", phase: "months_9_12", category: "attire", owner: "bride", months_before: 10 },
  { title: "Groom: start sherwani / suit planning", phase: "months_9_12", category: "attire", owner: "groom", months_before: 10 },
  { title: "Hotel block for guests", description: "ME Sitges or ME Barcelona — negotiate room block + group rate.", phase: "months_9_12", category: "logistics", owner: "planner", months_before: 10 },
  { title: "Set up wedding website / RSVP page", description: "Public wedding-os page with logistics + RSVP link (Phase 2).", phase: "months_9_12", category: "guest", owner: "planner", months_before: 10 },

  // ============================================================
  // 6-9 MONTHS OUT — the cultural + personal layer
  // ============================================================
  { title: "Book MUA + hair stylist", description: "Bride + family. Trial session 3-4 months out.", phase: "months_6_9", category: "vendor", owner: "bride", months_before: 9, auto_derive_kind: "vendor_booked:mua_hair" },
  { title: "Book mehndi artist", description: "For Mehndi night — number of artists scales with guest count.", phase: "months_6_9", category: "vendor", owner: "bride", months_before: 9, auto_derive_kind: "vendor_booked:mehndi" },
  { title: "Book pandit / officiant", description: "For ceremony rituals. Confirm puja items list, fire-ceremony permits if outdoor.", phase: "months_6_9", category: "vendor", owner: "couple", months_before: 9, auto_derive_kind: "vendor_booked_any:pandit,priest_officiant" },
  { title: "Order wedding invitations", description: "Formal invites separate from save-the-dates.", phase: "months_6_9", category: "design", owner: "couple", months_before: 9 },
  { title: "Book transportation", description: "Coach for guests · bridal car · baraat horse if Indian wedding includes baraat.", phase: "months_6_9", category: "vendor", owner: "planner", months_before: 8, auto_derive_kind: "vendor_booked_any:guest_shuttle,bridal_car,transport" },
  { title: "Book honeymoon", description: "Lock dates + flights early for September departures.", phase: "months_6_9", category: "honeymoon", owner: "couple", months_before: 8 },
  { title: "Cake / dessert order", phase: "months_6_9", category: "vendor", owner: "couple", months_before: 8, auto_derive_kind: "vendor_booked:cake_dessert" },
  { title: "Book dhol players", description: "For baraat / sangeet entrance.", phase: "months_6_9", category: "vendor", owner: "couple", months_before: 8 },
  { title: "Plan Sangeet performances", description: "Family choreography, group dances, special performances.", phase: "months_6_9", category: "ritual", owner: "family", months_before: 8 },
  { title: "Book stationery / signage", phase: "months_6_9", category: "design", owner: "planner", months_before: 7, auto_derive_kind: "vendor_booked_any:stationery,signage" },

  // ============================================================
  // 3-6 MONTHS OUT — final selections + RSVPs
  // ============================================================
  { title: "Send formal invitations", phase: "months_3_6", category: "guest", owner: "couple", months_before: 6 },
  { title: "Track RSVPs", description: "Auto-derives when guests RSVP through the portal.", phase: "months_3_6", category: "guest", owner: "planner", months_before: 5, auto_derive_kind: "guests_rsvp_response_rate:0.5" },
  { title: "Menu tasting", description: "Confirm menu + taste with caterer.", phase: "months_3_6", category: "vendor", owner: "couple", months_before: 5 },
  { title: "Final dress / sherwani fitting #1", phase: "months_3_6", category: "attire", owner: "couple", months_before: 5 },
  { title: "Buy wedding bands", phase: "months_3_6", category: "attire", owner: "couple", months_before: 5 },
  { title: "Honeymoon — passports + visas + vaccinations", description: "Check passport expiry (must be 6+ months past honeymoon end).", phase: "months_3_6", category: "honeymoon", owner: "couple", months_before: 5 },
  { title: "Plan bachelor / bachelorette parties", phase: "months_3_6", category: "logistics", owner: "couple", months_before: 4 },
  { title: "Hair + makeup trial", phase: "months_3_6", category: "attire", owner: "bride", months_before: 4 },
  { title: "Confirm all vendor timelines", description: "Day-of arrival times, load-in plans.", phase: "months_3_6", category: "vendor", owner: "planner", months_before: 4 },
  { title: "Choose wedding outfits for parents", description: "Mother-of-bride, mother-of-groom, etc.", phase: "months_3_6", category: "attire", owner: "family", months_before: 4 },
  { title: "Book sound / AV / lighting", phase: "months_3_6", category: "vendor", owner: "planner", months_before: 4, auto_derive_kind: "vendor_booked_any:sound_av,lighting" },
  { title: "Plan pithi / haldi ceremony", description: "Setup, attire, location (often morning of wedding day or day before).", phase: "months_3_6", category: "ritual", owner: "family", months_before: 4 },

  // ============================================================
  // 1-3 MONTHS OUT — the count-down
  // ============================================================
  { title: "Final headcount to caterer", description: "Auto-locks once 90% of guests have RSVP'd.", phase: "months_1_3", category: "vendor", owner: "planner", months_before: 2, auto_derive_kind: "guests_rsvp_response_rate:0.9" },
  { title: "Final seating chart", phase: "months_1_3", category: "guest", owner: "couple", months_before: 2 },
  { title: "Wedding programs printed", phase: "months_1_3", category: "design", owner: "couple", months_before: 2 },
  { title: "Write vows", phase: "months_1_3", category: "ritual", owner: "couple", months_before: 2 },
  { title: "Welcome bags assembled", description: "For destination guests at hotel check-in.", phase: "months_1_3", category: "logistics", owner: "couple", months_before: 2 },
  { title: "Final dress alterations", phase: "months_1_3", category: "attire", owner: "bride", months_before: 2 },
  { title: "Marriage license — Spain", description: "Spain requires 2 witnesses and apostilled docs for non-residents. Start early.", phase: "months_1_3", category: "paperwork", owner: "couple", months_before: 3 },
  { title: "Confirm transportation for parents + wedding party", phase: "months_1_3", category: "logistics", owner: "planner", months_before: 2 },
  { title: "Final payments to most vendors", description: "Most contracts have 30-60 day final-balance terms.", phase: "months_1_3", category: "finance", owner: "couple", months_before: 2, auto_derive_kind: "deposits_paid_count:>=5" },
  { title: "Pack for honeymoon", phase: "months_1_3", category: "honeymoon", owner: "couple", months_before: 1 },

  // ============================================================
  // FINAL MONTH — every last detail
  // ============================================================
  { title: "Confirm timeline with all vendors (run-of-show)", description: "Final day-of timeline shared with every vendor.", phase: "final_month", category: "vendor", owner: "planner" },
  { title: "Drop off welcome bags at hotels", description: "Day before guests arrive.", phase: "final_month", category: "logistics", owner: "couple" },
  { title: "Wedding party rehearsal", phase: "final_month", category: "ritual", owner: "couple" },
  { title: "Pack for wedding venue (bridal suite)", phase: "final_month", category: "attire", owner: "bride" },
  { title: "Confirm pandit / officiant items list", description: "Mandap setup, agni samagri, mantras.", phase: "final_month", category: "ritual", owner: "planner" },
  { title: "Print emergency contact sheet", description: "Every vendor's day-of phone number on one page.", phase: "final_month", category: "logistics", owner: "planner" },

  // ============================================================
  // FINAL WEEK
  // ============================================================
  { title: "Mehndi night", description: "Pre-wedding ritual — bride's hands + close family.", phase: "final_week", category: "ritual", owner: "bride" },
  { title: "Sangeet", description: "Music + dance + family performances.", phase: "final_week", category: "ritual", owner: "family" },
  { title: "Pithi / Haldi ceremony", description: "Turmeric paste applied to bride + groom (typically morning of wedding day or day before).", phase: "final_week", category: "ritual", owner: "family" },
  { title: "Final hair / makeup confirmation", phase: "final_week", category: "attire", owner: "bride" },
  { title: "Confirm transportation pickup times", phase: "final_week", category: "logistics", owner: "planner" },

  // ============================================================
  // DAY OF — see the run-of-show timeline for the minute-by-minute
  // ============================================================
  { title: "Ganesh puja (morning)", phase: "day_of", category: "ritual", owner: "family" },
  { title: "Baraat", description: "Groom's procession to the venue with dhol + dance.", phase: "day_of", category: "ritual", owner: "groom" },
  { title: "Wedding ceremony", description: "Pheras / saat phere. Use the timeline tab for detail.", phase: "day_of", category: "ritual", owner: "couple" },
  { title: "Cocktail hour", phase: "day_of", category: "logistics", owner: "planner" },
  { title: "Reception / dinner", phase: "day_of", category: "logistics", owner: "planner" },
  { title: "First dance", phase: "day_of", category: "ritual", owner: "couple" },
  { title: "Cake cutting", phase: "day_of", category: "ritual", owner: "couple" },

  // ============================================================
  // POST-WEDDING — wrap it up
  // ============================================================
  { title: "Tip vendors + final balances", phase: "post_wedding", category: "finance", owner: "couple" },
  { title: "Send thank-you notes", phase: "post_wedding", category: "guest", owner: "couple" },
  { title: "Marriage certificate filing", description: "Spain registry, then translated/apostilled if needed for home country.", phase: "post_wedding", category: "paperwork", owner: "couple" },
  { title: "Order wedding album / photo prints", phase: "post_wedding", category: "design", owner: "couple" },
  { title: "Honeymoon", phase: "post_wedding", category: "honeymoon", owner: "couple" },
  { title: "Update legal docs (driver's license, passport, taxes)", phase: "post_wedding", category: "paperwork", owner: "couple" },
];

async function main() {
  const { data: workspace } = await sb
    .from("workspaces")
    .select("id, org_id, wedding_date")
    .limit(1)
    .maybeSingle();
  if (!workspace) throw new Error("no workspace");

  const { count: existingCount } = await sb
    .from("planning_tasks")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);

  if ((existingCount ?? 0) > 0) {
    console.log(`- ${existingCount} planning_tasks already seeded — skipping`);
    return;
  }

  const rows = TASKS.map((t, i) => ({
    workspace_id: workspace.id,
    org_id: workspace.org_id,
    category: t.category,
    phase: t.phase,
    sort_order: i,
    title: t.title,
    description: t.description ?? null,
    owner: t.owner,
    months_before: t.months_before ?? null,
    auto_derive_kind: t.auto_derive_kind ?? null,
    status: "not_started" as const,
  }));

  const { error } = await sb.from("planning_tasks").insert(rows);
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(`✓ Seeded ${rows.length} planning tasks`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
