// One-shot fix: "Yacht Charter — Marina Port Vell" is actually the same as
// "Marina Port Vell" (capacity ~250). Move all yacht photos to Marina, then
// delete the yacht venue.

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
  const { data: yacht } = await sb
    .from("venues")
    .select("id, name")
    .eq("name", "Yacht Charter — Marina Port Vell")
    .maybeSingle();

  if (!yacht) {
    console.log("- Yacht venue already removed.");
    return;
  }

  const { data: marina } = await sb
    .from("venues")
    .select("id, name")
    .eq("name", "Marina Port Vell")
    .maybeSingle();
  if (!marina) {
    console.error("! Marina Port Vell not found — aborting.");
    process.exit(1);
  }

  console.log(`Merging photos: ${yacht.id} → ${marina.id}`);
  const { count: photoCount, error: phErr } = await sb
    .from("venue_photos")
    .update({ venue_id: marina.id })
    .eq("venue_id", yacht.id)
    .select("*", { count: "exact", head: true });
  if (phErr) {
    console.error("photos move error:", phErr.message);
    process.exit(1);
  }
  console.log(`✓ Moved ${photoCount ?? "?"} photos`);

  // Move any visits or notes too
  await sb.from("venue_visits").update({ venue_id: marina.id }).eq("venue_id", yacht.id);
  await sb.from("venue_notes").update({ venue_id: marina.id }).eq("venue_id", yacht.id);

  // Delete venue_pricing row for yacht (template link)
  await sb.from("venue_pricing").delete().eq("venue_id", yacht.id);

  // Delete the venue
  const { error: delErr } = await sb.from("venues").delete().eq("id", yacht.id);
  if (delErr) {
    console.error("venue delete error:", delErr.message);
    process.exit(1);
  }
  console.log("✓ Deleted Yacht Charter venue");

  // If Marina has no hero photo, give it the first image now-merged
  const { data: marinaRow } = await sb
    .from("venues")
    .select("hero_photo_url")
    .eq("id", marina.id)
    .maybeSingle();

  if (!marinaRow?.hero_photo_url) {
    const { data: firstImage } = await sb
      .from("venue_photos")
      .select("url")
      .eq("venue_id", marina.id)
      .order("created_at", { ascending: true })
      .limit(50);

    const img = firstImage?.find((p) => !/\.(mov|mp4|m4v|webm)$/i.test(p.url));
    if (img) {
      await sb.from("venues").update({ hero_photo_url: img.url }).eq("id", marina.id);
      console.log(`✓ Set Marina hero photo`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
