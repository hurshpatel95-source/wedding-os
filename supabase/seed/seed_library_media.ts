// Copy venue photos from the workspace `venue-photos` bucket into the
// org-scoped `library-media` bucket so library_venues display their photos
// in /admin/library/venues/[id].
//
// Source: `venue_photos.url` is the public URL like
//   https://<project>.supabase.co/storage/v1/object/public/venue-photos/<path>
// We extract <path>, download bytes via storage admin API, re-upload to
// library-media at `{org_id}/{library_venue_id}/{basename}`, and insert
// a `library_venue_media` row pointing to the new path.
//
// Idempotent — skips photos already in library-media (matches by basename).
//
// PRECONDITION: db:seed-library has run (library_venues exist for the org).

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

interface LibraryVenue {
  id: string;
  org_id: string;
  name: string;
}
interface VenueRow {
  id: string;
  name: string;
}
interface PhotoRow {
  id: string;
  venue_id: string;
  url: string;
}

function extractPathFromPublicUrl(url: string): string | null {
  // .../object/public/venue-photos/<path>
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/venue-photos\/(.+?)(?:\?|$)/);
  return m ? decodeURIComponent(m[1]) : null;
}

const VIDEO_EXTENSIONS = new Set([
  ".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv",
]);

function detectKind(filename: string): "photo" | "video" {
  const lower = filename.toLowerCase();
  for (const ext of VIDEO_EXTENSIONS) {
    if (lower.endsWith(ext)) return "video";
  }
  return "photo";
}

function detectContentType(filename: string, fallback: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".mov") || lower.endsWith(".m4v")) return "video/quicktime";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".avi")) return "video/x-msvideo";
  if (lower.endsWith(".mkv")) return "video/x-matroska";
  return fallback;
}

async function main() {
  // 1. Get the org id
  const { data: workspace } = await sb
    .from("workspaces")
    .select("id, org_id")
    .limit(1)
    .maybeSingle();
  if (!workspace) throw new Error("no workspace");
  const orgId = workspace.org_id;

  // 2. Get all library_venues + matching workspace venues
  const sbAny = sb as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          order?: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
          maybeSingle?: () => Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
  };

  const { data: libraryVenues } = (await sbAny
    .from("library_venues")
    .select("id, org_id, name")
    .eq("org_id", orgId)) as { data: LibraryVenue[] | null };
  if (!libraryVenues || libraryVenues.length === 0) {
    throw new Error("no library_venues; run pnpm db:seed-library first");
  }

  const { data: venues } = (await sb
    .from("venues")
    .select("id, name")
    .eq("workspace_id", workspace.id)) as { data: VenueRow[] | null };
  const venueByName = new Map<string, string>(
    (venues ?? []).map((v) => [v.name, v.id]),
  );

  let copied = 0;
  let skipped = 0;
  let failed = 0;

  for (const lv of libraryVenues) {
    const venueId = venueByName.get(lv.name);
    if (!venueId) {
      console.log(`  · ${lv.name} — no matching workspace venue, skipping`);
      continue;
    }

    const { data: photos } = (await sb
      .from("venue_photos")
      .select("id, venue_id, url")
      .eq("venue_id", venueId)) as { data: PhotoRow[] | null };
    if (!photos || photos.length === 0) {
      console.log(`  · ${lv.name} — 0 photos`);
      continue;
    }

    console.log(`  ▸ ${lv.name} — ${photos.length} photos`);

    for (let i = 0; i < photos.length; i += 1) {
      const photo = photos[i];
      const sourcePath = extractPathFromPublicUrl(photo.url);
      if (!sourcePath) {
        console.warn(`    ! could not parse path from ${photo.url}`);
        failed += 1;
        continue;
      }

      const filename = sourcePath.split("/").pop() ?? `photo-${i}`;
      const destPath = `${orgId}/${lv.id}/${filename}`;

      // Idempotent check: does a library_venue_media row already exist for this filename?
      const { data: existingMedia } = (await sb
        .from("library_venue_media")
        .select("id")
        .eq("library_venue_id", lv.id)
        .eq("storage_path", destPath)) as { data: { id: string }[] | null };
      if (existingMedia && existingMedia.length > 0) {
        skipped += 1;
        continue;
      }

      // Download bytes from venue-photos
      const { data: blob, error: dlErr } = await sb.storage
        .from("venue-photos")
        .download(sourcePath);
      if (dlErr || !blob) {
        console.warn(`    ! download ${sourcePath}: ${dlErr?.message ?? "no blob"}`);
        failed += 1;
        continue;
      }

      // Upload to library-media
      const buf = Buffer.from(await blob.arrayBuffer());
      const kind = detectKind(filename);
      const contentType = detectContentType(filename, blob.type || "image/jpeg");
      const { error: upErr } = await sb.storage
        .from("library-media")
        .upload(destPath, buf, { contentType, upsert: true });
      if (upErr) {
        console.warn(`    ! upload ${destPath}: ${upErr.message}`);
        failed += 1;
        continue;
      }

      // Insert library_venue_media row
      const { error: insErr } = await sb.from("library_venue_media").insert({
        library_venue_id: lv.id,
        kind,
        storage_path: destPath,
        sort_order: i,
        alt: null,
      });
      if (insErr) {
        console.warn(`    ! row insert: ${insErr.message}`);
        failed += 1;
        continue;
      }
      copied += 1;
    }
  }

  console.log("");
  console.log("Library media seeded:");
  console.log(`  copied:  ${copied}`);
  console.log(`  skipped: ${skipped} (already in library-media)`);
  console.log(`  failed:  ${failed}`);
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
