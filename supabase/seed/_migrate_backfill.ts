// One-time backfill — Stabilization Sprint T1.1
//
// All 34 migration files in supabase/migrations/ have ALREADY been
// pasted into the Supabase dashboard manually over the past weeks.
// The tracking table introduced by T1.1 is empty, so a naive
// `pnpm migrate` would try to re-apply all 34, hitting schema-already-
// exists errors.
//
// This script seeds the tracking table by recording every existing
// migration file as "applied-by-backfill" so the next `pnpm migrate`
// sees 0 pending. From that point on, NEW migrations committed get
// auto-applied normally.
//
// Run ONCE per environment after T1.1 ships:
//   SUPABASE_DB_URL=postgres://... pnpm tsx supabase/seed/_migrate_backfill.ts

import { Client } from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations");

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("❌ SUPABASE_DB_URL not set");
    process.exit(1);
  }

  const c = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  try {
    await c.query(`
      create table if not exists _acquired_migrations (
        filename text primary key,
        applied_at timestamptz not null default now(),
        sha256 text,
        applied_by text
      );
    `);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let insertedCount = 0;
    let skippedCount = 0;

    for (const f of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
      const sha = createHash("sha256").update(sql).digest("hex");

      const res = await c.query(
        `insert into _acquired_migrations (filename, sha256, applied_by)
         values ($1, $2, 'backfill-2026-05-11')
         on conflict (filename) do nothing
         returning filename`,
        [f, sha],
      );

      if (res.rowCount && res.rowCount > 0) {
        console.log(`  + ${f}`);
        insertedCount += 1;
      } else {
        console.log(`  - ${f} (already tracked)`);
        skippedCount += 1;
      }
    }

    console.log(
      `\n✓ Backfill complete. Inserted ${insertedCount}, skipped ${skippedCount} (already present).`,
    );
    console.log("Run `pnpm migrate:status` next to confirm 0 pending.\n");
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
