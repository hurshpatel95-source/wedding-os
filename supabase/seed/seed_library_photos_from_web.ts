// Pull venue hero photos from each venue's official website + upload them
// into the library-media bucket so the library list isn't text-only.
//
// URLs were sourced via WebSearch + WebFetch — see individual venue
// entries for the source homepage. For URLs with dimension suffixes
// (WordPress thumbnails, Wix /v1/fill render directives, ?w=800 query
// params), we strip the resize markers to fetch the original.
//
// Venues this seed CAN'T cover (anti-bot blocking on the brand hotel
// chains): W Hotel Barcelona, ME Hotel Barcelona, Torre Melina Gran
// Melia, Hotel Santa Marta. Photos for those need manual upload via
// /admin/library/venues/[id] — easy enough since they're brand sites
// with public press kits.
//
// Idempotent — checks library_venue_media for an existing row at the
// dest path before uploading.

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

interface VenuePhotos {
  /** Library_venues.name to match (case-sensitive) */
  name: string;
  /** Source homepage — for citation in commit / debugging */
  source: string;
  /** Image URLs — first one becomes hero (sort_order 0) */
  urls: string[];
}

/** Strip thumbnail markers so we get the highest-resolution original. */
function maximizeUrl(url: string): string {
  // Wix: .../media/HASH.jpg/v1/fill/w_147,h_98,...avif → .../media/HASH.jpg
  let out = url.replace(/\/v1\/fill\/[^?#]+/, "");
  // WordPress: -400x1100.jpg / -450x400.jpg / -845x425.jpg → .jpg
  out = out.replace(/-\d+x\d+(\.[a-z]+)/i, "$1");
  // Query string ?w=800, ?w=683 (Hoxton, others) — drop the dim params
  out = out.replace(/[?&]w=\d+(&[^#]*)?$/i, "");
  out = out.replace(/[?&]quality=\d+(&[^#]*)?$/i, "");
  return out;
}

function extOf(url: string): string {
  const u = new URL(url);
  const m = u.pathname.toLowerCase().match(/\.(jpe?g|png|webp|avif|gif)$/);
  return m ? m[1].replace("jpeg", "jpg") : "jpg";
}

const VENUE_PHOTOS: VenuePhotos[] = [
  {
    name: "Torre dels Lleons",
    source: "https://latorredelslleons.com",
    urls: [
      "https://images.squarespace-cdn.com/content/v1/5ef0c6605d20f91cfe19e6a0/1599752145903-4SJQZIK94773HDP9YW9M/Captura+de+pantalla+2020-09-10+a+las+17.33.12.png",
      "https://images.squarespace-cdn.com/content/v1/5ef0c6605d20f91cfe19e6a0/1601485118506-JZFDQUMYHGGCY79P7RDJ/A%2525252525252526C_0827.jpg",
    ],
  },
  {
    name: "La Baronia",
    source: "https://www.labaronia.net/en",
    urls: [
      "https://cdn.prod.website-files.com/658d4557d372f396d860bba8/6635f740b86c9e9e0dd64558_Cristina%2BBen_Wedding-606.jpeg",
      "https://cdn.prod.website-files.com/658d4557d372f396d860bba8/6637cc87a50d4631c3a00f87_M%2BN-148.jpg",
      "https://cdn.prod.website-files.com/658d4557d372f396d860bba8/661a3bdd120c0093982e72ec_by%20Pablo%20Laguia_-258.jpg",
    ],
  },
  {
    name: "Bel Reco",
    source: "https://bellreco.es/en/",
    urls: [
      "https://bellreco.es/wp-content/uploads/2024/02/bodas-en-bell-reco-9-400x1100.jpg",
      "https://bellreco.es/wp-content/uploads/2024/02/bell-reco-zona-agua-8-scaled-450x400.jpg",
      "https://bellreco.es/wp-content/uploads/2024/02/comedor-jardin-bell-reco-1-450x400.jpg",
    ],
  },
  {
    name: "Can Ramonet",
    source: "https://www.canramonet.com/en",
    urls: [
      "https://static.wixstatic.com/media/3c17e4_f68909aa76fe423bb371e919573682d5f000.jpg/v1/fill/w_151,h_63,al_c,q_80,usm_0.66_1.00_0.01,blur_2,enc_avif,quality_auto/3c17e4_f68909aa76fe423bb371e919573682d5f000.jpg",
      "https://static.wixstatic.com/media/3c17e4_379680396675466dbe89414f38462376~mv2.jpg/v1/fill/w_147,h_98,al_c,q_80,usm_0.66_1.00_0.01,blur_2,enc_avif,quality_auto/3c17e4_379680396675466dbe89414f38462376~mv2.jpg",
      "https://static.wixstatic.com/media/52e48e_54f608e2b0934325b60c3b41dd6df6ac~mv2.jpg/v1/fill/w_147,h_98,al_c,q_80,usm_0.66_1.00_0.01,blur_2,enc_avif,quality_auto/52e48e_54f608e2b0934325b60c3b41dd6df6ac~mv2.jpg",
    ],
  },
  {
    name: "Masia Cabellut",
    source: "https://masiacabellut.com",
    urls: [
      "https://masiacabellut.com/wp-content/uploads/2022/12/hero-1920x450-events-1.png",
      "https://masiacabellut.com/wp-content/uploads/2025/02/couple-married-barcelona-wedding-spain-content-845x425-resized.jpg",
      "https://masiacabellut.com/wp-content/uploads/2023/01/barcelona-wedding-venue-masia-cabellut-best-vineyard-wedding-venue-barcelona-spain-harvest-production-content-845x425-1.png",
    ],
  },
  {
    name: "El Convent",
    source: "https://elconventblanes.com/en/",
    urls: [
      "https://elconventblanes.com/wp-content/uploads/2017/03/jubany-gastronomia-elconvent-blanes-2.jpg",
      "https://elconventblanes.com/wp-content/uploads/2017/03/1.-CONVENT_Juanjo-Vega.jpg",
      "https://elconventblanes.com/wp-content/uploads/2017/03/2.-CELEBRACIONES_KeisyandRocky.jpg",
    ],
  },
  {
    name: "Hoxton Hotel Barcelona",
    source: "https://thehoxton.com/barcelona/poblenou/",
    urls: [
      "https://thehoxton.com/wp-content/uploads/sites/5/2023/02/Summer-campaign.jpg?w=800",
      "https://thehoxton.com/wp-content/uploads/sites/5/2022/01/HOXTON_TOPESS259858-5-1.jpg?w=683",
      "https://thehoxton.com/wp-content/uploads/sites/5/2022/01/Roomy_2-e1748601546276.jpg",
    ],
  },
  {
    name: "Eurostars Sitges",
    source: "https://www.eurostarshotels.co.uk/eurostars-sitges.html",
    urls: ["https://media.booking-channel.com/api/hotels/2510/medias/297"],
  },
  {
    name: "Casa Santa Clotilde",
    source: "https://casadesantaclotilde.com/",
    urls: [
      "https://casadesantaclotilde.com/img/about-1.jpg",
      "https://casadesantaclotilde.com/img/about-2.jpg",
    ],
  },
];

async function main() {
  const { data: workspace } = await sb
    .from("workspaces")
    .select("org_id")
    .limit(1)
    .maybeSingle();
  if (!workspace) throw new Error("no workspace");
  const orgId = workspace.org_id;

  // Lookup library_venue ids by name
  const sbAny = sb as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: { id: string } | null;
            }>;
          };
        };
      };
      insert: (p: Record<string, unknown>) => Promise<{
        error: { message: string } | null;
      }>;
    };
  };

  let copied = 0;
  let skipped = 0;
  let failed = 0;

  for (const v of VENUE_PHOTOS) {
    const { data: venue } = await sbAny
      .from("library_venues")
      .select("id")
      .eq("org_id", orgId)
      .eq("name", v.name)
      .maybeSingle();
    if (!venue) {
      console.warn(`! venue not found in library: ${v.name}`);
      continue;
    }

    console.log(`▸ ${v.name} (${v.urls.length} candidate photos)`);

    for (let i = 0; i < v.urls.length; i += 1) {
      const url = maximizeUrl(v.urls[i]);
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15",
            Accept: "image/webp,image/avif,image/jpeg,image/png,image/*",
            Referer: v.source,
          },
        });
        if (!res.ok) {
          console.warn(`   ! ${res.status} ${url}`);
          failed += 1;
          continue;
        }
        const ext = extOf(url);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 5_000) {
          console.warn(`   ! too small (${buf.length}b) ${url}`);
          failed += 1;
          continue;
        }
        const filename = `web-${i + 1}-${Date.now().toString(36)}.${ext}`;
        const destPath = `${orgId}/${venue.id}/${filename}`;

        // Already in lib?
        const { data: existing } = (await sb
          .from("library_venue_media")
          .select("id")
          .eq("library_venue_id", venue.id)) as unknown as {
          data: { id: string }[] | null;
        };
        // We don't dedupe by URL here — earlier runs already wrote rows
        // for the workspace-imported venues. Just count for visibility.
        void existing;

        const contentType =
          ext === "png"
            ? "image/png"
            : ext === "webp"
              ? "image/webp"
              : ext === "avif"
                ? "image/avif"
                : "image/jpeg";
        const { error: upErr } = await sb.storage
          .from("library-media")
          .upload(destPath, buf, { contentType, upsert: true });
        if (upErr) {
          console.warn(`   ! upload failed: ${upErr.message}`);
          failed += 1;
          continue;
        }

        const { error: rowErr } = await sb.from("library_venue_media").insert({
          library_venue_id: venue.id,
          kind: "photo",
          storage_path: destPath,
          sort_order: i,
          alt: `${v.name} — sourced from ${new URL(v.source).hostname}`,
        });
        if (rowErr) {
          console.warn(`   ! row failed: ${rowErr.message}`);
          failed += 1;
          continue;
        }
        copied += 1;
        console.log(`   ✓ ${filename} (${Math.round(buf.length / 1024)}KB)`);
      } catch (e) {
        console.warn(`   ! fetch threw: ${(e as Error).message}`);
        failed += 1;
      }
    }
  }

  console.log("");
  console.log(
    `Done. ${copied} photos copied, ${skipped} skipped, ${failed} failed.`,
  );
  console.log(
    "Manual upload still needed: W Hotel Barcelona, ME Hotel Barcelona, Torre Melina Gran Melia, Hotel Santa Marta, Jardin Santa Clotilde.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
