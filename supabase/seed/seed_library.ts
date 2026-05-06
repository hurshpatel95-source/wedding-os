// Port the existing 6 demo `venues` rows from the workspace into the
// org-scoped `library_venues` table, so a planner has a starter inventory
// they can reuse for future couples. Maps fields where shapes differ
// (geo_lat → lat, capacity_min/max → capacity_seated/standing, planner_notes
// → internal_notes). Generates a slug from the name.
//
// Storage choice for media: this script does NOT re-upload photo bytes from
// the `venue-photos` bucket to the `library-media` bucket. It copies the
// storage_path STRING into `library_venue_media`, which means the rows
// reference paths in a different bucket. This is intentional for v1 —
// the planner can re-upload via /admin/library/venues/[id] if they want
// the bytes in the library-media bucket. The signed-url helpers in
// library-venue-media-manager.tsx try the library-media bucket; if the
// bytes aren't there, the gallery shows a broken placeholder. Trade-off:
// avoid double-storage cost + script-side service-role byte copy. Note
// in the snapshot doc.
//
// Idempotent — UPSERT keyed on (org_id, name).

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

interface VenueRow {
  id: string;
  workspace_id: string;
  org_id: string;
  name: string;
  address: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  capacity_min: number | null;
  capacity_max: number | null;
  hire_fee_weekend_eur: number | null;
  hire_fee_notes: string | null;
  planner_notes: string | null;
  event_roles: string[] | null;
  pros: string[] | null;
  cons: string[] | null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const { data: workspace } = await sb
    .from("workspaces")
    .select("id, org_id")
    .limit(1)
    .maybeSingle();
  if (!workspace) throw new Error("no workspace; run pnpm db:seed first");
  const orgId = workspace.org_id;

  const { data: venues, error } = (await sb
    .from("venues")
    .select(
      "id, workspace_id, org_id, name, address, geo_lat, geo_lng, capacity_min, capacity_max, hire_fee_weekend_eur, hire_fee_notes, planner_notes, event_roles, pros, cons",
    )
    .eq("workspace_id", workspace.id)
    .order("name")) as unknown as {
    data: VenueRow[] | null;
    error: { message: string } | null;
  };
  if (error) throw error;
  if (!venues || venues.length === 0) {
    throw new Error("no venues to port; run pnpm db:seed first");
  }

  let venuesCreated = 0;
  let venuesExisting = 0;
  let mediaCreated = 0;

  const sbAny = sb as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          eq: (
            col: string,
            val: string,
          ) => {
            maybeSingle: () => Promise<{
              data: { id: string } | null;
              error: { message: string } | null;
            }>;
          };
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{
            data: { id: string; storage_path: string; sort_order: number }[] | null;
          }>;
        };
      };
      insert: (payload: Record<string, unknown>) => {
        select: (cols: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  for (const v of venues) {
    const { data: existing } = await sbAny
      .from("library_venues")
      .select("id")
      .eq("org_id", orgId)
      .eq("name", v.name)
      .maybeSingle();

    let libVenueId: string;
    if (existing) {
      libVenueId = existing.id;
      venuesExisting += 1;
      console.log(`  · ${v.name} — already in library, skipping`);
      continue;
    }

    // Insert the library venue
    const { data: created, error: insErr } = await sbAny
      .from("library_venues")
      .insert({
        org_id: orgId,
        name: v.name,
        slug: slugify(v.name),
        address: v.address,
        lat: v.geo_lat,
        lng: v.geo_lng,
        capacity_seated: v.capacity_min,
        capacity_standing: v.capacity_max,
        hire_fee_eur: v.hire_fee_weekend_eur,
        hire_fee_notes: v.hire_fee_notes,
        event_roles: v.event_roles ?? [],
        pros: v.pros ?? [],
        cons: v.cons ?? [],
        internal_notes: v.planner_notes,
      })
      .select("id")
      .single();
    if (insErr || !created) {
      throw new Error(`library_venues insert (${v.name}): ${insErr?.message}`);
    }
    libVenueId = created.id;
    venuesCreated += 1;
    console.log(`  ✓ ${v.name}`);

    // Copy venue_photos rows → library_venue_media (path-only, no byte copy)
    const photosResult = await (sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{
              data:
                | { storage_path: string; sort_order: number; alt: string | null }[]
                | null;
            }>;
          };
        };
      };
    })
      .from("venue_photos")
      .select("storage_path, sort_order, alt")
      .eq("venue_id", v.id)
      .order("sort_order", { ascending: true });

    const photos = photosResult.data ?? [];
    for (const p of photos) {
      const { error: mediaErr } = await (sb as unknown as {
        from: (t: string) => {
          insert: (payload: Record<string, unknown>) => Promise<{
            error: { message: string } | null;
          }>;
        };
      })
        .from("library_venue_media")
        .insert({
          library_venue_id: libVenueId,
          kind: "photo",
          storage_path: p.storage_path,
          sort_order: p.sort_order ?? 0,
          alt: p.alt,
        });
      if (mediaErr) {
        console.warn(
          `    ! media row for ${v.name}/${p.storage_path}: ${mediaErr.message}`,
        );
        continue;
      }
      mediaCreated += 1;
    }
  }

  console.log("");
  console.log("Library seeded:");
  console.log(
    `  venues: ${venuesCreated} created, ${venuesExisting} pre-existing`,
  );
  console.log(`  media: ${mediaCreated} rows ported (path references only)`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
