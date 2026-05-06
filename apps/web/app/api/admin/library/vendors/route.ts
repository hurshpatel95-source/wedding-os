import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { LibraryVendorInsert } from "@/lib/library-vendor-types";
import type { VendorCategory } from "@/lib/vendor-types";

export const runtime = "nodejs";

interface CreateBody {
  name?: string;
  category?: VendorCategory;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  default_quoted_price_eur?: number | null;
  notes?: string | null;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Cast — `users.org_role` and `org_id` aren't in the strict generated types
  // for the planner-OS slab; mirror the (admin)/layout.tsx pattern.
  const sb = supabase as unknown as {
    from: (table: string) => {
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
      insert: (
        values: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };

  const { data: profile } = await sb
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.org_role !== "org_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!profile.org_id) {
    return NextResponse.json({ error: "no org" }, { status: 400 });
  }

  const body = (await request.json()) as CreateBody;
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!body.category) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }

  const insertPayload: LibraryVendorInsert = {
    org_id: profile.org_id,
    name: body.name.trim(),
    category: body.category,
    contact_name: body.contact_name?.toString().trim() || null,
    contact_email: body.contact_email?.toString().trim() || null,
    contact_phone: body.contact_phone?.toString().trim() || null,
    default_quoted_price_eur:
      body.default_quoted_price_eur == null ||
      Number.isNaN(Number(body.default_quoted_price_eur))
        ? null
        : Number(body.default_quoted_price_eur),
    notes: body.notes?.toString().trim() || null,
  };

  const { error } = await sb
    .from("library_vendors")
    .insert(insertPayload as unknown as Record<string, unknown>);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
