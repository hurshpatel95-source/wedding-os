// Backfill venues.geo_lat/geo_lng with hand-set coordinates so the map view
// has real points to plot. (Free Nominatim geocoding would also work but
// the 6 venues are static, hardcoding is simpler and more accurate.)

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

// Approximate coordinates from public sources (Astha's deck + Google Maps).
const COORDS: Record<string, { lat: number; lng: number }> = {
  "Casa Del Mar": { lat: 41.2406, lng: 1.7944 }, // Sitges area
  "Xalet Del Nin": { lat: 41.2186, lng: 1.7211 }, // Vilanova i la Geltrú
  "ME Sitges Terramar": { lat: 41.2326, lng: 1.7945 }, // Sitges Terramar
  "Marina Port Vell": { lat: 41.3777, lng: 2.1830 }, // Barcelona harbor
  "Mas de Sant Llei": { lat: 41.5958, lng: 2.2722 }, // Vilanova del Vallès
  "ME Barcelona": { lat: 41.3949, lng: 2.1611 }, // Passeig de Gràcia
};

async function main() {
  for (const [name, c] of Object.entries(COORDS)) {
    const { error } = await sb
      .from("venues")
      .update({ geo_lat: c.lat, geo_lng: c.lng })
      .eq("name", name);
    if (error) console.warn(`! ${name}: ${error.message}`);
    else console.log(`✓ ${name}  →  ${c.lat}, ${c.lng}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
