// Seed the 3 scenarios from Hursh's pricing spreadsheet into pricing_scenarios.
// Idempotent — won't duplicate if scenarios with matching names already exist.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/db/src/types.gen";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
loadEnv({ path: path.join(repoRoot, "apps/web/.env.local") });

const sb = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const { data: workspace } = await sb
    .from("workspaces")
    .select("id, base_currency")
    .limit(1)
    .maybeSingle();
  if (!workspace) throw new Error("no workspace; run pnpm db:seed first");

  const { data: venues } = await sb
    .from("venues")
    .select("id, name");
  if (!venues || venues.length === 0) throw new Error("no venues; seed first");

  const venueByName = (n: string) => venues.find((v) => v.name === n)?.id;
  const idCasaDelMar = venueByName("Casa Del Mar");
  const idXalet = venueByName("Xalet Del Nin");
  const idMSL = venueByName("Mas de Sant Llei");
  const idMarinaPV = venueByName("Marina Port Vell");
  const idMESitges = venueByName("ME Sitges Terramar");
  const idMEBcn = venueByName("ME Barcelona");

  if (!idCasaDelMar || !idXalet || !idMSL || !idMarinaPV || !idMEBcn || !idMESitges) {
    throw new Error("venues missing — re-run seed");
  }

  const mslSpaces = (allOn: boolean) => [
    { label: "Orange courtyard (ceremony)", price_eur: 2000, selected: allOn },
    { label: "Forest area (ceremony backup)", price_eur: 2500, selected: allOn },
    { label: "Courtyard in front of house (cocktail)", price_eur: 2500, selected: allOn },
    { label: "Indoor space + 2h dancing (dinner)", price_eur: 4500, selected: allOn },
  ];

  const scenarios = [
    {
      name: "Option 1 — Sitges",
      venueAnchor: idXalet, // anchor to wedding venue
      inputs: {
        version: 1 as const,
        description:
          "Sangeet @ Casa Del Mar (Fri 9/17) → Wedding @ Xalet del Nin (Sat 9/18) → Stay @ ME Sitges",
        date_range: { from: "2027-09-17", to: "2027-09-19" },
        guest_count: 220,
        link_guest_count: true,
        events: [
          {
            key: "welcome" as const,
            label: "Welcome / cocktail",
            enabled: false,
            venue_id: null,
            day: "weekend" as const,
            catering_per_pax_eur: 60,
            catering_label: "Cocktail welcome menu",
            guests: 220,
          },
          {
            key: "sangeet" as const,
            label: "Sangeet — Casa Del Mar",
            enabled: true,
            venue_id: idCasaDelMar,
            day: "weekday" as const, // Friday
            date: "2027-09-17",
            catering_per_pax_eur: 180,
            catering_label: "Sangeet menu (food + drink + service + tableware)",
            guests: 220,
          },
          {
            key: "wedding" as const,
            label: "Wedding — Xalet del Nin",
            enabled: true,
            venue_id: idXalet,
            day: "weekend" as const, // Saturday
            date: "2027-09-18",
            catering_per_pax_eur: 220,
            catering_label: "Wedding menu (food + drink + service + furniture)",
            guests: 220,
          },
        ],
        room_block: {
          enabled: true,
          hotel_venue_id: idMESitges,
          rooms: 12,
          nights: 3,
          online_rate_eur: 436,
          discount_pct: 0.2,
        },
        custom_lines: [],
        open_items: [
          "Decor, florals, lighting, AV, photo+video, planner fees — NOT in this model yet",
          "Accommodation shown for family planning only — guests book + pay their own rooms",
          "Room block default = 12 rooms (your range was 10-15) — adjust as needed",
        ],
      },
    },
    {
      name: "Option 2 — Barcelona",
      venueAnchor: idMSL,
      inputs: {
        version: 1 as const,
        description:
          "Sangeet @ Marina Port Vell (Fri 9/3) → Wedding @ Mas Sant Llei (Sat 9/4, whole venue) → Stay @ ME Barcelona",
        date_range: { from: "2027-09-03", to: "2027-09-05" },
        guest_count: 220,
        link_guest_count: true,
        events: [
          {
            key: "welcome" as const,
            label: "Welcome / cocktail",
            enabled: false,
            venue_id: null,
            day: "weekend" as const,
            catering_per_pax_eur: 60,
            catering_label: "Cocktail welcome menu",
            guests: 220,
          },
          {
            key: "sangeet" as const,
            label: "Sangeet — Marina Port Vell",
            enabled: true,
            venue_id: idMarinaPV,
            day: "weekday" as const, // Friday — confirm rate
            date: "2027-09-03",
            catering_per_pax_eur: 180,
            catering_label: "Sangeet menu (food + drink + service + tableware)",
            guests: 220,
          },
          {
            key: "wedding" as const,
            label: "Wedding — Mas Sant Llei (whole venue)",
            enabled: true,
            venue_id: idMSL,
            day: "weekend" as const, // Saturday — min 280
            date: "2027-09-04",
            spaces: mslSpaces(true),
            catering_per_pax_eur: 220,
            catering_label: "Wedding menu (food + drink + service + furniture)",
            guests: 220,
          },
        ],
        room_block: {
          enabled: true,
          hotel_venue_id: idMEBcn,
          rooms: 12,
          nights: 3,
          online_rate_eur: 408,
          discount_pct: 0.2,
        },
        custom_lines: [],
        open_items: [
          "MSL Saturday minimum is 280 guests — at 220 we incur €4,800 shortfall (€80 × 60)",
          "Marina Port Vell Friday rate: weekday €9,500 vs weekend €6,500 — confirm with Astia",
          "ME Barcelona 2027 rate (current input is 2026 ref of €408)",
        ],
      },
    },
    {
      name: "Scenario 3 — Hybrid (Sept 11/12)",
      venueAnchor: idMSL,
      inputs: {
        version: 1 as const,
        description:
          "Sangeet @ Casa Del Mar (Sat 9/11) → Wedding @ Mas Sant Llei (Sun 9/12, whole venue) → Stay @ ME Barcelona. Sun MSL minimum is 220 → no shortfall at 220 guests.",
        date_range: { from: "2027-09-10", to: "2027-09-13" },
        guest_count: 220,
        link_guest_count: true,
        events: [
          {
            key: "welcome" as const,
            label: "Welcome",
            enabled: false,
            venue_id: null,
            day: "weekday" as const,
            catering_per_pax_eur: 60,
            catering_label: "Cocktail welcome menu",
            guests: 220,
          },
          {
            key: "sangeet" as const,
            label: "Sangeet — Casa Del Mar",
            enabled: true,
            venue_id: idCasaDelMar,
            day: "weekend" as const, // Saturday
            date: "2027-09-11",
            catering_per_pax_eur: 180,
            catering_label: "Sangeet menu (food + drink + service + tableware)",
            guests: 220,
          },
          {
            key: "wedding" as const,
            label: "Wedding — Mas Sant Llei (whole venue)",
            enabled: true,
            venue_id: idMSL,
            day: "sunday" as const,
            date: "2027-09-12",
            spaces: mslSpaces(true),
            catering_per_pax_eur: 220,
            catering_label: "Wedding menu (food + drink + service + furniture)",
            guests: 220,
          },
        ],
        room_block: {
          enabled: true,
          hotel_venue_id: idMEBcn,
          rooms: 12,
          nights: 3,
          online_rate_eur: 408,
          discount_pct: 0.2,
        },
        custom_lines: [],
        open_items: [
          "Lead option: Sangeet Sat 9/11 @ Casa Del Mar + Wedding Sun 9/12 @ MSL whole venue.",
          "Casa Del Mar Sept 11 — confirm availability; deck listed Sept 4, 5, 17 (not 11).",
          "MSL Sunday min 220 → no shortfall at 220 guests (vs €4,800 shortfall on Saturday).",
          "Casa Del Mar (Sitges) ↔ MSL (Vilanova del Vallès) ≈ 1hr drive — coach transport recommended.",
        ],
      },
    },
  ];

  for (const s of scenarios) {
    const { data: existing } = await sb
      .from("pricing_scenarios")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("name", s.name)
      .maybeSingle();

    if (existing) {
      console.log(`- ${s.name} already exists (${existing.id})`);
      continue;
    }

    // calculated_total intentionally 0 here — the UI computes live from inputs
    const { data: row, error } = await sb
      .from("pricing_scenarios")
      .insert({
        workspace_id: workspace.id,
        venue_id: s.venueAnchor,
        name: s.name,
        inputs: s.inputs,
        calculated_total: 0,
        currency: "EUR",
      })
      .select()
      .single();
    if (error) {
      console.warn(`! ${s.name}: ${error.message}`);
    } else {
      console.log(`✓ ${s.name} → ${row?.id}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
