// Set venues.hero_photo_url to the first JPG uploaded for each venue.

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

async function main() {
  const { data: venues } = await sb.from("venues").select("id, name, hero_photo_url");
  if (!venues) return;

  for (const v of venues) {
    if (v.hero_photo_url) {
      console.log(`- ${v.name} (already set)`);
      continue;
    }
    const { data: photos } = await sb
      .from("venue_photos")
      .select("url, caption")
      .eq("venue_id", v.id)
      .order("created_at", { ascending: true });

    const firstImage = photos?.find(
      (p) => !/\.(mov|mp4|m4v|webm)$/i.test(p.url),
    );
    if (!firstImage) {
      console.log(`- ${v.name} (no photos yet)`);
      continue;
    }
    await sb.from("venues").update({ hero_photo_url: firstImage.url }).eq("id", v.id);
    console.log(`✓ ${v.name} → ${firstImage.caption}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
