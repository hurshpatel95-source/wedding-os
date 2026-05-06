// Generate a one-shot magic link via Supabase admin API.
// Use to bypass the email rate limit during development.
// Run: SEED_TARGET_EMAIL=you@example.com tsx supabase/seed/gen_magic_link.ts

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/db/src/types.gen";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
loadEnv({ path: path.join(repoRoot, "apps/web/.env.local") });

const target = process.env.SEED_TARGET_EMAIL;
if (!target) {
  console.error("Missing SEED_TARGET_EMAIL");
  process.exit(1);
}

const sb = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const { data, error } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: target!,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200"}/auth/callback` },
  });
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(data.properties?.action_link);
}

main();
