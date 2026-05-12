import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { LibraryVendorUpdate } from "@/lib/library-vendor-types";
import type { VendorCategory } from "@/lib/vendor-types";
import {
  dbUpdate,
  dbDelete,
  dbWriteErrorResponse,
} from "@/lib/db-write-guard";

export const runtime = "nodejs";

interface PatchBody {
  name?: string;
  category?: VendorCategory;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  default_quoted_price_eur?: number | null;
  notes?: string | null;
  website?: string | null;
  instagram?: string | null;
  planner_rating?: number | null;
  tags?: string[];
  lead_time_days?: number | null;
  price_band?: string | null;
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
  if (body.website !== undefined)
    patch.website = body.website?.toString().trim() || null;
  if (body.instagram !== undefined)
    patch.instagram = body.instagram?.toString().trim() || null;
  if (body.planner_rating !== undefined) patch.planner_rating = body.planner_rating;
  if (body.tags !== undefined) patch.tags = body.tags;
  if (body.lead_time_days !== undefined) patch.lead_time_days = body.lead_time_days;
  if (body.price_band !== undefined)
    patch.price_band = (body.price_band as never) ?? null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const sb = supabase as unknown as {
    from: (table: string) => {
      update: (values: Record<string, unknown>) => {
        eq: (
          col: string,
          val: string,
        ) => {
          select: (cols: string) => PromiseLike<{
            data: { id: string }[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  try {
    await dbUpdate(
      "update library_vendor",
      sb
        .from("library_vendors")
        .update(patch as unknown as Record<string, unknown>)
        .eq("id", params.id)
        .select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
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
        ) => {
          select: (cols: string) => PromiseLike<{
            data: { id: string }[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  try {
    await dbDelete(
      "delete library_vendor",
      sb.from("library_vendors").delete().eq("id", params.id).select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
