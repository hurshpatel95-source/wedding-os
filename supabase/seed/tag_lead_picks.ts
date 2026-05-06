// Tag the 3 lead venues for the dashboard.

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

const LEAD_VENUES = ["Casa Del Mar", "Mas de Sant Llei", "ME Barcelona"];

async function main() {
  // Reset all to false first so this is idempotent
  await sb.from("venues").update({ is_lead_pick: false }).neq("id", "00000000-0000-0000-0000-000000000000");

  for (const name of LEAD_VENUES) {
    const { error } = await sb.from("venues").update({ is_lead_pick: true }).eq("name", name);
    if (error) console.warn(`! ${name}: ${error.message}`);
    else console.log(`✓ ${name} → lead pick`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
