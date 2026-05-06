import { Client } from "pg";
import fs from "node:fs";

async function main() {
  const file = process.argv[2];
  const url = process.env.SUPABASE_DB_URL;
  if (!file || !url) {
    console.error("usage: tsx _apply_one.ts <file.sql>  (with SUPABASE_DB_URL env)");
    process.exit(1);
  }

  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const sql = fs.readFileSync(file, "utf8");
  try {
    await c.query(sql);
    console.log(`✓ applied ${file}`);
  } catch (e) {
    console.error("ERR:", (e as Error).message);
    process.exitCode = 1;
  }
  await c.end();
}

main();
