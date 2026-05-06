// POST /api/admin/push/library-vendor
//
// Clones a library_vendors row into a workspace's `vendors` table.
// Simple field mapping; no media to copy.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";
import type {
  PushLibraryVendorRequest,
  PushLibraryVendorResponse,
} from "@/lib/admin-onboarding-types";

export const runtime = "nodejs";

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
  if (!profile?.org_id || profile.org_role !== "org_admin") {
    return NextResponse.json({ error: "org admin only" }, { status: 403 });
  }

  let body: PushLibraryVendorRequest;
  try {
    body = (await request.json()) as PushLibraryVendorRequest;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.library_vendor_id || !body.workspace_id) {
    return NextResponse.json(
      { error: "library_vendor_id and workspace_id required" },
      { status: 400 },
    );
  }

  const service = buildServiceClient();

  const { data: lv } = await service
    .from("library_vendors")
    .select("*")
    .eq("id", body.library_vendor_id)
    .maybeSingle();
  if (!lv || lv.org_id !== profile.org_id) {
    return NextResponse.json(
      { error: "library vendor not found in your org" },
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

  // The `vendors` table predates types.gen.ts, so we cast `service` to a
  // loose shape — same pattern used elsewhere in app/(app)/vendors/...
  const looseService = service as unknown as {
    from: (t: string) => {
      insert: (row: Record<string, unknown>) => {
        select: (cols: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  const vendorsTable = looseService.from("vendors");

  const { data: vendor, error: insErr } = await vendorsTable
    .insert({
      workspace_id: ws.id,
      org_id: profile.org_id,
      category: lv.category,
      name: lv.name,
      contact_name: lv.contact_name ?? null,
      contact_email: lv.contact_email ?? null,
      contact_phone: lv.contact_phone ?? null,
      quoted_price_eur: lv.default_quoted_price_eur ?? null,
      quoted_currency: "EUR",
      notes: lv.notes ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (insErr || !vendor) {
    return NextResponse.json(
      { error: `couldn't create vendor: ${insErr?.message}` },
      { status: 500 },
    );
  }

  const response: PushLibraryVendorResponse = { vendor_id: vendor.id };
  return NextResponse.json(response);
}
