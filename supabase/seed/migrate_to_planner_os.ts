// Backfill org_role on every existing user, and seed workspace_branding for
// the existing workspace(s). Idempotent — safe to re-run.
//
// Run with: pnpm db:migrate-planner-os
//
// PRECONDITION: 20260506000012_planner_os.sql must be applied first.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
loadEnv({ path: path.join(repoRoot, "apps/web/.env.local") });

// Use a loose any-typed client — the service role bypasses RLS, and the
// new `org_role` column / `workspace_branding` table aren't necessarily in
// the generated `Database` types yet at the moment this runs.
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  // 1. Flip role='admin' rows to org_role='org_admin'.
  const { data: admins, error: adminsErr } = await sb
    .from("users")
    .update({ org_role: "org_admin" })
    .eq("role", "admin")
    .select("id, email");

  if (adminsErr) throw adminsErr;
  console.log(`✓ org_admin: ${admins?.length ?? 0} user(s)`);
  for (const u of admins ?? []) {
    console.log(`  - ${u.email}`);
  }

  // 2. Flip role='couple' rows to org_role='member' (defaults already, but
  //    we make it explicit to be safe + idempotent for future role types).
  const { data: members, error: membersErr } = await sb
    .from("users")
    .update({ org_role: "member" })
    .eq("role", "couple")
    .select("id, email");

  if (membersErr) throw membersErr;
  console.log(`✓ member: ${members?.length ?? 0} user(s)`);

  // 3. Insert default workspace_branding rows for every existing workspace.
  const { data: workspaces, error: workspacesErr } = await sb
    .from("workspaces")
    .select("id, name");

  if (workspacesErr) throw workspacesErr;

  let brandingCreated = 0;
  let brandingExisting = 0;

  for (const w of workspaces ?? []) {
    const { error: upsertErr } = await sb
      .from("workspace_branding")
      .upsert(
        {
          workspace_id: w.id,
          accent_hex: "#9d174d",
          planner_display_name: null,
          logo_storage_path: null,
        },
        { onConflict: "workspace_id", ignoreDuplicates: true },
      );

    if (upsertErr) {
      console.warn(`! branding for ${w.name}: ${upsertErr.message}`);
      continue;
    }

    // Detect whether row already existed (upsert with ignoreDuplicates returns
    // empty data either way) by re-selecting.
    const { data: existing } = await sb
      .from("workspace_branding")
      .select("workspace_id")
      .eq("workspace_id", w.id)
      .maybeSingle();

    if (existing) {
      brandingExisting += 1;
    } else {
      brandingCreated += 1;
    }
  }

  console.log(
    `✓ workspace_branding: ${workspaces?.length ?? 0} workspace(s) processed (${brandingCreated} new, ${brandingExisting} pre-existing)`,
  );

  console.log("");
  console.log("Summary:");
  console.log(`  org_admins: ${admins?.length ?? 0}`);
  console.log(`  members:    ${members?.length ?? 0}`);
  console.log(`  workspaces: ${workspaces?.length ?? 0}`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
