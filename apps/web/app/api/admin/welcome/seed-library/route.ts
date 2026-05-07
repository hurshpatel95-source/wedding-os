// POST /api/admin/welcome/seed-library
//
// Idempotently inserts a few "starter" library_venues rows into the caller's
// org so the freshly-onboarded planner has something to look at when they
// land on /admin/library/venues.
//
// Body: { picks: string[] } where each entry is one of STARTER_VENUES.id
//
// Behavior:
//   - Filter picks to known starter ids
//   - For each pick, only insert if no library_venue with the same name
//     already exists in the org (case-insensitive). This makes the route
//     safe to re-run if the planner navigates back into the wizard.
//
// Auth: org_admin only. RLS on library_venues also enforces this; the explicit
// guard gives nicer error messages.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STARTER_VENUE_BY_ID, type StarterVenue } from "@/lib/welcome-types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profileSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
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
  if (!profile?.org_id || profile.org_role !== "org_admin") {
    return NextResponse.json({ error: "org admin only" }, { status: 403 });
  }
  const orgId = profile.org_id;

  let body: { picks?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const picksRaw = Array.isArray(body.picks) ? body.picks : [];
  const picks = Array.from(
    new Set(picksRaw.filter((p): p is string => typeof p === "string")),
  )
    .map((id) => STARTER_VENUE_BY_ID.get(id))
    .filter((v): v is StarterVenue => v !== undefined);

  if (picks.length === 0) {
    return NextResponse.json({ inserted: 0, skipped: 0 });
  }

  // Idempotency: pull existing names for this org and skip duplicates by name.
  const { data: existingRaw } = await supabase
    .from("library_venues")
    .select("name")
    .eq("org_id", orgId);
  const existingNames = new Set(
    (existingRaw ?? []).map((r) => (r.name ?? "").trim().toLowerCase()),
  );

  const toInsert = picks.filter(
    (v) => !existingNames.has(v.name.trim().toLowerCase()),
  );

  if (toInsert.length === 0) {
    return NextResponse.json({ inserted: 0, skipped: picks.length });
  }

  const rows = toInsert.map((v) => ({
    org_id: orgId,
    created_by: user.id,
    name: v.name,
    city: v.city,
    region: v.region,
    country: v.country,
    capacity_seated: v.capacity_min,
    capacity_standing: v.capacity_max,
    description: v.description,
    pros: v.pros,
    cons: v.cons,
    event_roles: [],
  }));

  const { error } = await supabase
    .from("library_venues")
    .insert(rows as never);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    inserted: toInsert.length,
    skipped: picks.length - toInsert.length,
  });
}
