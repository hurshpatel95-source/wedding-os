// Apply combined migrations directly to a hosted Supabase Postgres.
// Reads the individual migration files in order and runs them in a transaction.
// Auth: SUPABASE_DB_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE.

import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { Client } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
loadEnv({ path: path.join(repoRoot, "apps/web/.env.local") });
loadEnv({ path: path.join(repoRoot, ".env") });

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Missing SUPABASE_DB_URL in env");
  process.exit(1);
}

const migrationsDir = path.join(repoRoot, "supabase/migrations");

async function main() {
  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} migration file(s):`);
  files.forEach((f) => console.log("  -", f));

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("\nConnected to Postgres.");

  try {
    await client.query("begin");
    for (const file of files) {
      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      console.log(`\n→ ${file} (${sql.length} bytes)`);
      await client.query(sql);
      console.log(`  ✓ applied`);
    }
    await client.query("commit");
    console.log("\n✓ All migrations committed.");
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    console.error("\n✗ Migration failed, rolled back:");
    console.error(err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
