// PATCH  /api/admin/testimonials/[id] — polish quote/rating/photo before publishing
// DELETE /api/admin/testimonials/[id] — remove testimonial entirely
//
// Both org_admin only — RLS scopes writes to caller's org.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TestimonialRow } from "@/lib/wave2-types";

export const runtime = "nodejs";

interface PatchBody {
  couple_names?: string | null;
  quote?: string | null;
  rating?: number | null;
  photo_storage_path?: string | null;
}

async function requireOrgAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" as const, status: 401 };
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
    return { error: "forbidden" as const, status: 403 };
  }
  return { supabase, orgId: profile.org_id, userId: user.id };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireOrgAdmin();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { supabase } = ctx;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const lookupSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: TestimonialRow | null }>;
        };
      };
    };
  };
  const { data: current } = await lookupSb
    .from("testimonials")
    .select(
      "id, org_id, workspace_id, couple_names, contact_email, quote, rating, photo_storage_path, status, public_token, requested_at, submitted_at, published_at, created_by, created_at, updated_at",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (body.couple_names !== undefined) patch.couple_names = body.couple_names;
  if (body.quote !== undefined) {
    if (body.quote !== null) {
      const q = body.quote.trim();
      if (q.length > 2000) {
        return NextResponse.json(
          { error: "quote must be 2000 characters or fewer" },
          { status: 400 },
        );
      }
      patch.quote = q;
    } else {
      patch.quote = null;
    }
  }
  if (body.rating !== undefined) {
    if (
      body.rating !== null &&
      (typeof body.rating !== "number" ||
        body.rating < 1 ||
        body.rating > 5 ||
        !Number.isInteger(body.rating))
    ) {
      return NextResponse.json(
        { error: "rating must be an integer 1–5" },
        { status: 400 },
      );
    }
    patch.rating = body.rating;
  }
  if (body.photo_storage_path !== undefined)
    patch.photo_storage_path = body.photo_storage_path;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const updSb = supabase as unknown as {
    from: (t: string) => {
      update: (row: unknown) => {
        eq: (col: string, val: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
  };
  const { error } = await updSb
    .from("testimonials")
    .update(patch)
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
  const ctx = await requireOrgAdmin();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { supabase } = ctx;

  // Best-effort photo cleanup
  const lookupSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: TestimonialRow | null }>;
        };
      };
    };
  };
  const { data: current } = await lookupSb
    .from("testimonials")
    .select(
      "id, org_id, workspace_id, couple_names, contact_email, quote, rating, photo_storage_path, status, public_token, requested_at, submitted_at, published_at, created_by, created_at, updated_at",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (current.photo_storage_path) {
    await supabase.storage
      .from("library-media")
      .remove([current.photo_storage_path]);
  }

  const delSb = supabase as unknown as {
    from: (t: string) => {
      delete: () => {
        eq: (col: string, val: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
  };
  const { error } = await delSb
    .from("testimonials")
    .delete()
    .eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
