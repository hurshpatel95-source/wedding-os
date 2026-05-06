// Set passwords for every user + create the admin login Hursh uses for
// admin-view testing. Idempotent — re-running just re-applies the same passwords.
//
// Run: tsx supabase/seed/set_passwords.ts

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

const SHARED_PASSWORD = "Wedding2027!";

interface UserSpec {
  email: string;
  role: "admin" | "couple";
  display: string;
}

const USERS: UserSpec[] = [
  { email: "astha@astiaevents.com", role: "admin", display: "Astha (planner)" },
  { email: "hurshpatel@greenskynj.com", role: "admin", display: "Hursh (admin view)" },
  { email: "hurshpatel95@gmail.com", role: "couple", display: "Hursh (couple)" },
  { email: "nishadesai98@gmail.com", role: "couple", display: "Nisha" },
  { email: "Nirvisd@umich.edu", role: "couple", display: "Nirvi" },
  { email: "Devaldesai73@gmail.com", role: "couple", display: "Deval" },
  { email: "Sdndesai@msn.com", role: "couple", display: "Sandy" },
];

async function ensureUser(spec: UserSpec, orgId: string, workspaceId: string) {
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  let authUser = list?.users.find((u) => u.email?.toLowerCase() === spec.email.toLowerCase());

  if (!authUser) {
    const { data, error } = await sb.auth.admin.createUser({
      email: spec.email,
      password: SHARED_PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error(`failed to create ${spec.email}`);
    authUser = data.user;
  } else {
    const { error } = await sb.auth.admin.updateUserById(authUser.id, {
      password: SHARED_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
  }

  const { error: rowErr } = await sb.from("users").upsert({
    id: authUser.id,
    email: spec.email,
    role: spec.role,
    org_id: orgId,
    workspace_id: workspaceId,
  });
  if (rowErr) throw rowErr;
  return authUser.id;
}

async function main() {
  const { data: workspace } = await sb
    .from("workspaces")
    .select("id, org_id")
    .limit(1)
    .maybeSingle();
  if (!workspace) throw new Error("no workspace");

  console.log("Setting password for everyone…\n");
  const credentials: { display: string; email: string; role: string }[] = [];

  for (const u of USERS) {
    try {
      await ensureUser(u, workspace.org_id, workspace.id);
      credentials.push({ display: u.display, email: u.email, role: u.role });
      console.log(`  ✓ ${u.display.padEnd(22)} ${u.email}`);
    } catch (err) {
      console.warn(`  ! ${u.email}: ${(err as Error).message}`);
    }
  }

  console.log(
    `\n  Password for everyone: ${SHARED_PASSWORD}` +
      `\n  Login URL: https://wedding-os-production.up.railway.app/login` +
      `\n  (or http://localhost:3200/login while developing)\n`,
  );

  console.log("┌─────────────────────────────────────────────────────────────────");
  console.log("│ DM-ready credential card");
  console.log("├─────────────────────────────────────────────────────────────────");
  for (const c of credentials) {
    console.log(`│  ${c.display.padEnd(22)} ${c.email.padEnd(32)} (${c.role})`);
  }
  console.log("└─────────────────────────────────────────────────────────────────");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
