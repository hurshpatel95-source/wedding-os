import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { LibraryVendorUpdate } from "@/lib/library-vendor-types";
import type { VendorCategory } from "@/lib/vendor-types";

export const runtime = "nodejs";

interface PatchBody {
  name?: string;
  category?: VendorCategory;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  default_quoted_price_eur?: number | null;
  notes?: string | null;
}

async function ensureAdmin(userId: string) {
  const supabase = createClient();
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
    };
  };
  const { data: profile } = await sb
    .from("users")
    .select("org_role, org_id")
    .eq("id", userId)
    .maybeSingle();
  return profile?.org_role === "org_admin" ? profile : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profile = await ensureAdmin(user.id);
  if (!profile) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as PatchBody;
  const patch: LibraryVendorUpdate = {};

  if (body.name !== undefined) {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    }
    patch.name = trimmed;
  }
  if (body.category !== undefined) patch.category = body.category;
  if (body.contact_name !== undefined)
    patch.contact_name = body.contact_name?.toString().trim() || null;
  if (body.contact_email !== undefined)
    patch.contact_email = body.contact_email?.toString().trim() || null;
  if (body.contact_phone !== undefined)
    patch.contact_phone = body.contact_phone?.toString().trim() || null;
  if (body.default_quoted_price_eur !== undefined) {
    patch.default_quoted_price_eur =
      body.default_quoted_price_eur == null ||
      Number.isNaN(Number(body.default_quoted_price_eur))
        ? null
        : Number(body.default_quoted_price_eur);
  }
  if (body.notes !== undefined) patch.notes = body.notes?.toString().trim() || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const sb = supabase as unknown as {
    from: (table: string) => {
      update: (values: Record<string, unknown>) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };

  const { error } = await sb
    .from("library_vendors")
    .update(patch as unknown as Record<string, unknown>)
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profile = await ensureAdmin(user.id);
  if (!profile) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sb = supabase as unknown as {
    from: (table: string) => {
      delete: () => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };

  const { error } = await sb.from("library_vendors").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
