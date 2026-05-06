// One-shot: copy hire-fee values from apps/web/lib/venue-pricing.ts constants
// into the venues table now that those columns exist.
// Re-runnable safely — does an UPDATE, won't duplicate.

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

interface HireRow {
  weekend_eur: number | null;
  weekday_eur: number | null;
  sunday_eur: number | null;
  minimum_weekend: number | null;
  minimum_sunday: number | null;
  minimum_weekday: number | null;
  shortfall: number | null;
  extra_hour: number | null;
  spaces: { label: string; price_eur: number }[];
  notes: string | null;
}

const VALUES: Record<string, HireRow> = {
  "Casa Del Mar": {
    weekend_eur: 14000,
    weekday_eur: 12400,
    sunday_eur: 14000,
    minimum_weekend: null,
    minimum_sunday: null,
    minimum_weekday: null,
    shortfall: null,
    extra_hour: null,
    spaces: [],
    notes: "Bridal suite incl. Sat €14k / Fri €12.4k. 12-guest takeover OFF per Hursh.",
  },
  "Xalet Del Nin": {
    weekend_eur: 22000,
    weekday_eur: null,
    sunday_eur: 19000,
    minimum_weekend: null,
    minimum_sunday: null,
    minimum_weekday: null,
    shortfall: null,
    extra_hour: null,
    spaces: [],
    notes: "Sat €22k / Sun €19k. Friday rate not quoted.",
  },
  "Marina Port Vell": {
    weekend_eur: 6500,
    weekday_eur: 9500,
    sunday_eur: 6500,
    minimum_weekend: null,
    minimum_sunday: null,
    minimum_weekday: null,
    shortfall: null,
    extra_hour: null,
    spaces: [],
    notes: "Weekday is MORE expensive at this venue. Friday rate unconfirmed.",
  },
  "Mas de Sant Llei": {
    weekend_eur: null,
    weekday_eur: null,
    sunday_eur: null,
    minimum_weekend: 280,
    minimum_sunday: 220,
    minimum_weekday: null,
    shortfall: 80,
    extra_hour: 1100,
    spaces: [
      { label: "Orange courtyard (ceremony)", price_eur: 2000 },
      { label: "Forest area (ceremony backup)", price_eur: 2500 },
      { label: "Courtyard in front of house (cocktail)", price_eur: 2500 },
      { label: "Indoor space + 2h dancing (dinner)", price_eur: 4500 },
    ],
    notes:
      "Composite — sum of selected spaces. Whole venue €11,500. Sat min 280 / Sun min 220 → €80/pax shortfall fee.",
  },
  "ME Sitges Terramar": {
    weekend_eur: null,
    weekday_eur: null,
    sunday_eur: null,
    minimum_weekend: null,
    minimum_sunday: null,
    minimum_weekday: null,
    shortfall: null,
    extra_hour: null,
    spaces: [],
    notes: "Stay venue. Rooftop event space available; no quote yet.",
  },
  "ME Barcelona": {
    weekend_eur: 5200,
    weekday_eur: 5200,
    sunday_eur: 5200,
    minimum_weekend: null,
    minimum_sunday: null,
    minimum_weekday: null,
    shortfall: null,
    extra_hour: null,
    spaces: [],
    notes: "Event space hire €5,200. Cocktail menus from €60/pp.",
  },
};

async function main() {
  for (const [name, v] of Object.entries(VALUES)) {
    const { error } = await sb
      .from("venues")
      .update({
        hire_fee_weekend_eur: v.weekend_eur,
        hire_fee_weekday_eur: v.weekday_eur,
        hire_fee_sunday_eur: v.sunday_eur,
        minimum_pax_weekend: v.minimum_weekend,
        minimum_pax_sunday: v.minimum_sunday,
        minimum_pax_weekday: v.minimum_weekday,
        shortfall_per_pax_eur: v.shortfall,
        extra_hour_eur: v.extra_hour,
        spaces: v.spaces,
        hire_fee_notes: v.notes,
      })
      .eq("name", name);
    if (error) console.warn(`! ${name}: ${error.message}`);
    else console.log(`✓ ${name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
