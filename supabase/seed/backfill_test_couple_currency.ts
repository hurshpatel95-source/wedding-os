// Set base_currency = 'USD' on the test couples (rodnj.ops, kcdevine96,
// j.salicandro) — they were provisioned via different paths and may have
// landed on EUR. Hursh & Nisha (Barcelona) intentionally STAY on EUR.
//
// One-shot. Idempotent. Safe to re-run.

import { createClient } from "@supabase/supabase-js";

const TARGET_EMAILS = [
  "rodnj.ops@gmail.com",
  "kcdevine96@gmail.com",
  "j.salicandro@gmail.com",
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }
  const supa = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve workspace_id for each test email via public.users
  const { data: users, error: usersErr } = await supa
    .from("users")
    .select("email, workspace_id")
    .in("email", TARGET_EMAILS);
  if (usersErr) {
    console.error("Failed to load users:", usersErr.message);
    process.exit(1);
  }
  if (!users || users.length === 0) {
    console.warn("No matching users found.");
    return;
  }

  for (const u of users) {
    if (!u.workspace_id) {
      console.warn(`  ${u.email} has no workspace_id — skipping`);
      continue;
    }
    const { error: updErr } = await supa
      .from("workspaces")
      .update({ base_currency: "USD" })
      .eq("id", u.workspace_id);
    if (updErr) {
      console.error(`  ${u.email} update failed: ${updErr.message}`);
    } else {
      console.log(`✓ ${u.email} → USD`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
