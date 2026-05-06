// Bulk-invite couple-side users (you + Nisha + in-laws + parents).
// Creates auth users, inserts public.users rows with role='couple',
// and prints a one-shot magic link (pointed at Railway) per email.
//
// Run: tsx supabase/seed/invite_couple.ts
//   override SITE_URL with: SITE_URL=https://your-domain.com tsx ...

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

const SITE_URL = process.env.SITE_URL ?? "https://wedding-os-production.up.railway.app";

// Edit this list when you want to invite more people
const INVITEES = [
  "Nirvisd@umich.edu",
  "Devaldesai73@gmail.com",
  "Sdndesai@msn.com",
];

async function ensureUser(email: string, orgId: string, workspaceId: string): Promise<string> {
  const lc = email.toLowerCase();
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  let authId = list?.users.find((u) => u.email?.toLowerCase() === lc)?.id;
  if (!authId) {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error(`failed to create ${email}`);
    authId = data.user.id;
  }
  const { error: rowErr } = await sb.from("users").upsert({
    id: authId,
    email,
    role: "couple",
    org_id: orgId,
    workspace_id: workspaceId,
  });
  if (rowErr) throw rowErr;
  return authId;
}

async function main() {
  const { data: workspace } = await sb
    .from("workspaces")
    .select("id, org_id")
    .limit(1)
    .maybeSingle();
  if (!workspace) throw new Error("no workspace");

  for (const email of INVITEES) {
    const authId = await ensureUser(email, workspace.org_id, workspace.id);
    const { data, error } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${SITE_URL}/auth/callback` },
    });
    if (error || !data.properties?.action_link) {
      console.warn(`! ${email}: ${error?.message ?? "no link"}`);
      continue;
    }
    console.log(`\n${email}  (${authId})`);
    console.log(`  ${data.properties.action_link}`);
  }
  console.log(`\n✓ Done. Magic links above redirect to ${SITE_URL}/auth/callback`);
  console.log(`  Each link is single-use; once clicked, user stays signed in for ~7 days.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
