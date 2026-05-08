// POST /api/vendor-search/add-results
// Batch-creates vendor rows from a list of VendorSearchResult picks.
// Each new row gets autopilot_status='researching' + autopilot_enabled=true
// so the autopilot agents pick it up.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VENDOR_CATEGORIES } from "@/lib/vendor-categories";
import type { VendorSearchResult } from "@/lib/autopilot-types";

export const runtime = "nodejs";
export const maxDuration = 30;

interface AddBody {
  picks?: VendorSearchResult[];
  category?: string;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id || !profile?.org_id) {
    return NextResponse.json({ error: "no workspace" }, { status: 400 });
  }
  const workspaceId = profile.workspace_id as string;
  const orgId = profile.org_id as string;

  const body = (await request.json().catch(() => ({}))) as AddBody;
  const picks = Array.isArray(body.picks) ? body.picks : [];
  const category = (body.category ?? "").trim();

  if (picks.length === 0) {
    return NextResponse.json({ error: "no picks provided" }, { status: 400 });
  }
  if (picks.length > 25) {
    return NextResponse.json(
      { error: "max 25 picks per batch" },
      { status: 400 },
    );
  }
  if (!(VENDOR_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json(
      { error: `unknown category "${category}"` },
      { status: 400 },
    );
  }

  const rows = picks
    .filter((p) => p && typeof p.name === "string" && p.name.trim().length > 0)
    .map((p) => ({
      workspace_id: workspaceId,
      org_id: orgId,
      category,
      name: p.name.trim(),
      contact_phone: p.phone ?? null,
      contact_email: p.email ?? null,
      website: p.website ?? null,
      status: "researching" as const,
      autopilot_status: "researching" as const,
      autopilot_enabled: true,
      gplaces_place_id: p.place_id ?? null,
      gplaces_rating:
        typeof p.rating === "number" ? p.rating : null,
      gplaces_data: p as unknown as Record<string, unknown>,
      // address column doesn't exist on vendors today — stash in notes so
      // the planner sees it without a schema change.
      notes: p.address ? `Address: ${p.address}` : null,
      created_by: user.id,
    }));

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "no valid rows after filtering" },
      { status: 400 },
    );
  }

  const sbInsert = supabase as unknown as {
    from: (t: string) => {
      insert: (p: Record<string, unknown>[]) => {
        select: (c: string) => Promise<{
          data: { id: string }[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };

  const { data, error } = await sbInsert
    .from("vendors")
    .insert(rows)
    .select("id");

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "insert failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    vendor_ids: (data ?? []).map((r) => r.id),
    inserted: (data ?? []).length,
  });
}
