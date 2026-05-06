// Tag the seeded venues with their event roles, derived from Astha's notes.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/db/src/types.gen";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
loadEnv({ path: path.join(repoRoot, "apps/web/.env.local") });

type EventRole = Database["public"]["Enums"]["event_role"];

const TAGS: Record<string, EventRole[]> = {
  "Casa Del Mar": ["sangeet", "welcome"],
  "Xalet Del Nin": ["wedding", "ceremony", "reception"],
  "ME Sitges Terramar": ["welcome", "stay"],
  "Marina Port Vell": ["sangeet", "welcome", "reception"],
  "Mas de Sant Llei": ["wedding", "ceremony", "reception", "welcome"],
  "ME Barcelona": ["welcome", "stay"],
};

const sb = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  for (const [name, roles] of Object.entries(TAGS)) {
    const { error } = await sb.from("venues").update({ event_roles: roles }).eq("name", name);
    if (error) {
      console.warn(`! ${name}: ${error.message}`);
    } else {
      console.log(`✓ ${name}  →  ${roles.join(", ")}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
