// POST /api/admin/push/library-venue
//
// Clones a library_venues row + its library_venue_media into a target
// workspace's `venues` + `venue_photos`. Photos are re-uploaded from the
// `library-media` bucket into the existing `venue-photos` bucket so that the
// workspace's normal RLS continues to work for couples on that workspace.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";
import type {
  PushLibraryVenueRequest,
  PushLibraryVenueResponse,
} from "@/lib/admin-onboarding-types";

export const runtime = "nodejs";
export const maxDuration = 60;

function buildServiceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: NextRequest) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json(
      { error: "Supabase service role key not configured." },
      { status: 503 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const profileSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: { org_role?: string | null; org_id?: string | null } | null;
          }>;
        };
      };
    };
  };
  const { data: profile } = await profileSb
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (
    !profile?.org_id ||
    profile.org_role !== "org_admin"
  ) {
    return NextResponse.json({ error: "org admin only" }, { status: 403 });
  }

  let body: PushLibraryVenueRequest;
  try {
    body = (await request.json()) as PushLibraryVenueRequest;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.library_venue_id || !body.workspace_id) {
    return NextResponse.json(
      { error: "library_venue_id and workspace_id required" },
      { status: 400 },
    );
  }

  const service = buildServiceClient();

  // Confirm both the library row and the workspace are inside the caller's org.
  const { data: lv } = await service
    .from("library_venues")
    .select("*")
    .eq("id", body.library_venue_id)
    .maybeSingle();
  if (!lv || lv.org_id !== profile.org_id) {
    return NextResponse.json(
      { error: "library venue not found in your org" },
      { status: 404 },
    );
  }

  const { data: ws } = await service
    .from("workspaces")
    .select("id, org_id")
    .eq("id", body.workspace_id)
    .maybeSingle();
  if (!ws || ws.org_id !== profile.org_id) {
    return NextResponse.json(
      { error: "workspace not found in your org" },
      { status: 404 },
    );
  }

  // 1. Insert the venues row. Map library schema → workspace schema.
  const { data: venue, error: venueErr } = await service
    .from("venues")
    .insert({
      workspace_id: ws.id,
      org_id: profile.org_id,
      name: lv.name,
      address: lv.address ?? null,
      geo_lat: lv.lat ?? null,
      geo_lng: lv.lng ?? null,
      capacity_min: lv.capacity_seated ?? null,
      capacity_max: lv.capacity_standing ?? lv.capacity_seated ?? null,
      planner_notes: lv.internal_notes ?? null,
      event_roles: lv.event_roles ?? [],
      pros: lv.pros ?? [],
      cons: lv.cons ?? [],
      hire_fee_notes: lv.hire_fee_notes ?? null,
      // Store the single library hire fee as the weekend rate by default —
      // planner can split it across day-types after the push.
      hire_fee_weekend_eur: lv.hire_fee_eur ?? null,
      spaces:
        Array.isArray(lv.spaces)
          ? (lv.spaces as { label: string; price_eur: number }[])
          : [],
    })
    .select("id")
    .single();
  if (venueErr || !venue) {
    return NextResponse.json(
      { error: `couldn't create venue: ${venueErr?.message}` },
      { status: 500 },
    );
  }

  // 2. Re-upload media. Read each library_venue_media row, download from
  //    `library-media`, upload to `venue-photos`, create a venue_photos row.
  const { data: media } = await service
    .from("library_venue_media")
    .select("id, library_venue_id, kind, storage_path, sort_order, alt")
    .eq("library_venue_id", lv.id)
    .order("sort_order", { ascending: true });

  let firstPhotoUrl: string | null = null;
  let photoCount = 0;
  const errors: string[] = [];

  for (const m of media ?? []) {
    if (m.kind !== "photo" || !m.storage_path) continue;
    try {
      const { data: blob, error: dlErr } = await service.storage
        .from("library-media")
        .download(m.storage_path);
      if (dlErr || !blob) {
        errors.push(`download ${m.storage_path}: ${dlErr?.message}`);
        continue;
      }
      const arrayBuf = await blob.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      // Preserve filename when possible to keep extensions intact.
      const filename =
        m.storage_path.split("/").pop() ?? `photo-${m.id}.jpg`;
      const newPath = `${ws.id}/${venue.id}/${Date.now()}-${filename}`;
      const contentType = blob.type || "image/jpeg";
      const { error: upErr } = await service.storage
        .from("venue-photos")
        .upload(newPath, buf, { contentType, upsert: false });
      if (upErr) {
        errors.push(`upload ${newPath}: ${upErr.message}`);
        continue;
      }
      const {
        data: { publicUrl },
      } = service.storage.from("venue-photos").getPublicUrl(newPath);
      const { error: rowErr } = await service.from("venue_photos").insert({
        venue_id: venue.id,
        url: publicUrl,
        caption: m.alt ?? null,
        uploaded_by: user.id,
      });
      if (rowErr) {
        errors.push(`venue_photos row: ${rowErr.message}`);
        continue;
      }
      photoCount += 1;
      if (!firstPhotoUrl) firstPhotoUrl = publicUrl;
    } catch (err) {
      errors.push(`media copy: ${(err as Error).message}`);
    }
  }

  // 3. Set hero_photo_url on the new venue from the first photo (if any).
  if (firstPhotoUrl) {
    await service
      .from("venues")
      .update({ hero_photo_url: firstPhotoUrl })
      .eq("id", venue.id);
  }

  const response: PushLibraryVenueResponse & {
    warnings?: string[];
  } = {
    venue_id: venue.id,
    photo_count: photoCount,
    hero_photo_url: firstPhotoUrl,
    ...(errors.length > 0 ? { warnings: errors } : {}),
  };
  return NextResponse.json(response);
}
