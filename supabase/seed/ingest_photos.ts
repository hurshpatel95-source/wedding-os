// Ingest local venue photo folders into Supabase Storage + venue_photos rows.
//
// Reads files from ~/Downloads/<venue folder>/ matching the SOURCE_MAP below,
// uploads each to the venue-photos bucket under <venue_id>/<filename>, and inserts
// a venue_photos row for each. Skips files larger than MAX_BYTES (default 40MB).
//
// Run: pnpm db:ingest-photos
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/db/src/types.gen";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
loadEnv({ path: path.join(repoRoot, "apps/web/.env.local") });
loadEnv({ path: path.join(repoRoot, ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "venue-photos";
const MAX_BYTES = 195 * 1024 * 1024; // matches the 200MiB bucket ceiling in supabase/config.toml
const MEDIA_EXT = new Set([".jpg", ".jpeg", ".png", ".heic", ".webp", ".mov", ".mp4"]);

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Map local folder name (under ~/Downloads/) → venue name (must match seed).
const SOURCE_MAP: Record<string, string> = {
  "casa del mar": "Casa Del Mar",
  "xalet del nin": "Xalet Del Nin",
  "Mas de sant:sant esteve": "Mas de Sant Llei",
  "yacht marina": "Yacht Charter — Marina Port Vell",
};

const downloadsDir = path.join(os.homedir(), "Downloads");

async function uploadFolder(folderName: string, venueName: string) {
  const folderPath = path.join(downloadsDir, folderName);
  let entries: string[];
  try {
    entries = await fs.readdir(folderPath);
  } catch {
    console.warn(`  ! folder not found: ${folderPath} — skipping`);
    return { uploaded: 0, skipped: 0 };
  }

  const { data: venue, error: venueErr } = await sb
    .from("venues")
    .select("id")
    .eq("name", venueName)
    .maybeSingle();
  if (venueErr || !venue) {
    console.warn(`  ! venue "${venueName}" not in DB — run pnpm db:seed first`);
    return { uploaded: 0, skipped: 0 };
  }

  let uploaded = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const ext = path.extname(entry).toLowerCase();
    if (!MEDIA_EXT.has(ext)) continue;

    const filePath = path.join(folderPath, entry);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) continue;

    if (stat.size > MAX_BYTES) {
      console.log(`    skip (too large, ${(stat.size / 1024 / 1024).toFixed(1)}MB): ${entry}`);
      skipped++;
      continue;
    }

    const objectKey = `${venue.id}/${entry}`;
    const fileBuffer = await fs.readFile(filePath);

    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(objectKey, fileBuffer, {
        contentType: contentTypeFor(ext),
        upsert: true,
      });

    if (upErr) {
      console.warn(`    upload error for ${entry}: ${upErr.message}`);
      skipped++;
      continue;
    }

    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(objectKey);

    const { error: insErr } = await sb.from("venue_photos").insert({
      venue_id: venue.id,
      url: pub.publicUrl,
      caption: entry,
      taken_at: stat.mtime.toISOString(),
    });
    if (insErr) {
      console.warn(`    db insert error for ${entry}: ${insErr.message}`);
      skipped++;
      continue;
    }

    uploaded++;
    process.stdout.write(`    ✓ ${entry}\n`);
  }

  return { uploaded, skipped };
}

function contentTypeFor(ext: string): string {
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".heic":
      return "image/heic";
    case ".mov":
      return "video/quicktime";
    case ".mp4":
      return "video/mp4";
    default:
      return "application/octet-stream";
  }
}

async function main() {
  console.log(`Ingesting from ${downloadsDir}`);
  let total = { uploaded: 0, skipped: 0 };
  for (const [folder, venue] of Object.entries(SOURCE_MAP)) {
    console.log(`\n→ ${folder}  →  ${venue}`);
    const r = await uploadFolder(folder, venue);
    total.uploaded += r.uploaded;
    total.skipped += r.skipped;
  }
  console.log(`\n✓ Done. Uploaded ${total.uploaded}, skipped ${total.skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
