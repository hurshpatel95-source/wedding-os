// Capacity + planner-notes corrections per Hursh's review.

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

const FIXES: { name: string; capacity_min: number; capacity_max: number; planner_notes?: string }[] = [
  {
    name: "Casa Del Mar",
    capacity_min: 50,
    capacity_max: 250,
    planner_notes:
      "Welcome Party / Sangeet venue, capacity up to 250. Sat hire €14,000+VAT, Fri €12,400+VAT. Bridal suite included to get ready (€600/night with breakfast). Full 12-guest takeover €5,000/night. 15min from Sitges. Available 4, 5, 17 Sep 2027. No per-pax minimum.",
  },
  {
    name: "Marina Port Vell",
    capacity_min: 80,
    capacity_max: 250,
    planner_notes:
      "Welcome Party / Sangeet / Reception venue on the Barcelona waterfront — yacht-marina setting, capacity up to 250. Weekend hire €6,500, weekday €9,500. 15-20min from ME Barcelona. Available Fri 3 Sep + Sat 4 Sep 2027.",
  },
];

async function main() {
  for (const f of FIXES) {
    const { error } = await sb
      .from("venues")
      .update({
        capacity_min: f.capacity_min,
        capacity_max: f.capacity_max,
        ...(f.planner_notes ? { planner_notes: f.planner_notes } : {}),
      })
      .eq("name", f.name);
    if (error) {
      console.warn(`! ${f.name}: ${error.message}`);
    } else {
      console.log(`✓ ${f.name}  →  capacity ${f.capacity_min}-${f.capacity_max}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
