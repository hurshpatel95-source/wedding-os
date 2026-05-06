// Update auth.users + public.users emails for the seeded couple.

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

const updates: { from: string; to: string }[] = [
  { from: "hursh@example.com", to: "hurshpatel95@gmail.com" },
  { from: "nisha@example.com", to: "nishadesai98@gmail.com" },
];

async function main() {
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const u of updates) {
    const target = list?.users.find((x) => x.email?.toLowerCase() === u.from);
    if (!target) {
      console.warn(`! no auth user with email ${u.from} — skipping`);
      continue;
    }
    const { error: authErr } = await sb.auth.admin.updateUserById(target.id, {
      email: u.to,
      email_confirm: true,
    });
    if (authErr) {
      console.warn(`! auth update failed for ${u.from}: ${authErr.message}`);
      continue;
    }
    const { error: rowErr } = await sb.from("users").update({ email: u.to }).eq("id", target.id);
    if (rowErr) {
      console.warn(`! users row update failed for ${u.from}: ${rowErr.message}`);
      continue;
    }
    console.log(`✓ ${u.from} → ${u.to}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
