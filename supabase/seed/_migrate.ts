// Migration applicator — Stabilization Sprint T1.1
//
// Reads every `supabase/migrations/*.sql` file in order, tracks which
// have been applied via a `_acquired_migrations` table on the target DB,
// applies any pending migrations idempotently.
//
// USE:
//   SUPABASE_DB_URL=postgres://... pnpm migrate     # apply pending
//   SUPABASE_DB_URL=postgres://... pnpm migrate:status   # just list, don't apply
//
// WIRED AS RAILWAY PRE-DEPLOY HOOK (in Railway settings → service →
// build command). On every push to main, Railway runs `pnpm migrate`
// before starting the new build, so missing migrations get applied
// before the new code that depends on them ships.
//
// Why this exists: May 8 regression where code referenced
// `planning_tasks.budget_line_id` but the migration was committed,
// never pasted into Supabase dashboard. Real user clicked the feature
// → 500. This script eliminates that class of bug.

import { Client } from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations");

const MODE = process.argv[2] === "status" ? "status" : "apply";

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error(
      "❌ SUPABASE_DB_URL not set.\n" +
        "   Get the connection string from Supabase dashboard → Project Settings → Database\n" +
        "   Format: postgres://postgres:[password]@db.[project-ref].supabase.co:5432/postgres",
    );
    process.exit(1);
  }

  const allFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (allFiles.length === 0) {
    console.log("No migration files found in supabase/migrations/");
    return;
  }

  const c = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  try {
    // Bootstrap the tracking table. Idempotent.
    await c.query(`
      create table if not exists _acquired_migrations (
        filename text primary key,
        applied_at timestamptz not null default now(),
        sha256 text,
        applied_by text
      );
    `);

    // Load the set of already-applied filenames
    const { rows: appliedRows } = await c.query<{ filename: string }>(
      `select filename from _acquired_migrations order by filename`,
    );
    const applied = new Set(appliedRows.map((r) => r.filename));

    const pending = allFiles.filter((f) => !applied.has(f));

    console.log(`\n=== Migration status ===`);
    console.log(`  Total migration files: ${allFiles.length}`);
    console.log(`  Already applied:        ${applied.size}`);
    console.log(`  Pending:                ${pending.length}\n`);

    if (pending.length === 0) {
      console.log("✓ All migrations applied. Nothing to do.");
      return;
    }

    console.log("Pending migrations:");
    for (const f of pending) console.log(`  - ${f}`);

    if (MODE === "status") {
      console.log("\n(status mode — no changes made)");
      return;
    }

    console.log("\nApplying pending migrations...\n");

    let appliedCount = 0;
    let failed: { filename: string; error: string } | null = null;

    for (const f of pending) {
      const fullPath = path.join(MIGRATIONS_DIR, f);
      const sql = fs.readFileSync(fullPath, "utf8");
      const sha = await sha256(sql);

      try {
        // Each migration runs in its own transaction. Failure aborts
        // that one but leaves prior applied ones intact.
        await c.query("begin");
        await c.query(sql);
        await c.query(
          `insert into _acquired_migrations (filename, sha256, applied_by)
           values ($1, $2, $3)
           on conflict (filename) do nothing`,
          [f, sha, process.env.USER ?? "ci"],
        );
        await c.query("commit");
        console.log(`  ✓ ${f}`);
        appliedCount += 1;
      } catch (err) {
        await c.query("rollback").catch(() => undefined);
        const msg = (err as Error).message;
        // Migrations that use DDL outside transactions (e.g. alter type
        // add value) need a retry without the begin/commit wrapper.
        const isTxnLimitation =
          /cannot run inside a transaction|cannot ALTER TYPE/i.test(msg);
        if (isTxnLimitation) {
          try {
            await c.query(sql);
            await c.query(
              `insert into _acquired_migrations (filename, sha256, applied_by)
               values ($1, $2, $3)
               on conflict (filename) do nothing`,
              [f, sha, process.env.USER ?? "ci"],
            );
            console.log(`  ✓ ${f} (auto-commit DDL)`);
            appliedCount += 1;
            continue;
          } catch (retryErr) {
            failed = { filename: f, error: (retryErr as Error).message };
            break;
          }
        }
        failed = { filename: f, error: msg };
        break;
      }
    }

    console.log("");
    if (failed) {
      console.error(
        `❌ Migration failed: ${failed.filename}\n   ${failed.error}\n` +
          `   Applied ${appliedCount} of ${pending.length} pending. Subsequent migrations skipped.`,
      );
      process.exit(1);
    }
    console.log(`✓ Applied ${appliedCount} migration(s) successfully.`);
  } finally {
    await c.end();
  }
}

async function sha256(s: string): Promise<string> {
  // Browser crypto would need polyfill; use node:crypto here. We avoid
  // a top-level import because tsx caches and we want this lazy.
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(s).digest("hex");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
