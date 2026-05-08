// GET  /api/testimonial/[token] — public read of testimonial (couple-facing)
// POST /api/testimonial/[token] — public submit (status='requested' → 'submitted')
//
// Service-role keyed: the 122-bit public_token in the URL IS the auth.
// We never echo contact_email back over the wire.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";
import type { TestimonialRow } from "@/lib/wave2-types";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

interface SubmitBody {
  quote?: string;
  rating?: number;
  photo_storage_path?: string | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Service role key not configured" },
      { status: 503 },
    );
  }
  if (!UUID_RE.test(params.token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  const sb = adminClient();
  const lookup = sb as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: TestimonialRow | null }>;
        };
      };
    };
  };
  const { data: row } = await lookup
    .from("testimonials")
    .select(
      "id, org_id, workspace_id, couple_names, contact_email, quote, rating, photo_storage_path, status, public_token, requested_at, submitted_at, published_at, created_by, created_at, updated_at",
    )
    .eq("public_token", params.token)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: row.id,
    couple_names: row.couple_names,
    status: row.status,
    quote: row.quote,
    rating: row.rating,
    photo_storage_path: row.photo_storage_path,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Service role key not configured" },
      { status: 503 },
    );
  }
  if (!UUID_RE.test(params.token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const quote = body.quote?.trim();
  if (!quote || quote.length < 10) {
    return NextResponse.json(
      { error: "Please share at least 10 characters." },
      { status: 400 },
    );
  }
  if (quote.length > 2000) {
    return NextResponse.json(
      { error: "Please keep your testimonial under 2000 characters." },
      { status: 400 },
    );
  }

  const rating = body.rating;
  if (
    typeof rating !== "number" ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return NextResponse.json(
      { error: "Pick a rating from 1 to 5 stars." },
      { status: 400 },
    );
  }

  const sb = adminClient();
  const lookup = sb as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: TestimonialRow | null }>;
        };
      };
    };
  };
  const { data: current } = await lookup
    .from("testimonials")
    .select(
      "id, org_id, workspace_id, couple_names, contact_email, quote, rating, photo_storage_path, status, public_token, requested_at, submitted_at, published_at, created_by, created_at, updated_at",
    )
    .eq("public_token", params.token)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (current.status === "declined") {
    return NextResponse.json(
      { error: "This request has been closed." },
      { status: 409 },
    );
  }
  if (current.status === "published") {
    return NextResponse.json(
      { error: "This testimonial has already been published." },
      { status: 409 },
    );
  }

  const upd = sb as unknown as {
    from: (t: string) => {
      update: (row: unknown) => {
        eq: (col: string, val: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
  };
  const { error } = await upd
    .from("testimonials")
    .update({
      quote,
      rating,
      photo_storage_path: body.photo_storage_path ?? current.photo_storage_path,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("public_token", params.token);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
