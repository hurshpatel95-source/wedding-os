import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbInsert, dbWriteErrorResponse } from "@/lib/db-write-guard";

export const runtime = "nodejs";

interface WindowIn {
  id?: string;
  day_of_week: number;
  start_minute: number;
  end_minute: number;
  label: string | null;
}

// PUT replaces the whole set — windows is the source of truth from the
// editor, so we delete everything for the org and reinsert. Each row is
// validated upfront.
export async function PUT(request: NextRequest) {
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

  let body: { windows?: WindowIn[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const incoming = Array.isArray(body.windows) ? body.windows : [];

  for (const w of incoming) {
    if (
      typeof w.day_of_week !== "number" ||
      w.day_of_week < 0 ||
      w.day_of_week > 6
    ) {
      return NextResponse.json({ error: "invalid day_of_week" }, { status: 400 });
    }
    if (
      typeof w.start_minute !== "number" ||
      typeof w.end_minute !== "number" ||
      w.start_minute < 0 ||
      w.end_minute > 1440 ||
      w.end_minute <= w.start_minute
    ) {
      return NextResponse.json({ error: "invalid window times" }, { status: 400 });
    }
  }

  const sb = supabase as unknown as {
    from: (t: string) => {
      delete: () => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
      insert: (rows: unknown) => {
        select: (cols: string) => PromiseLike<{
          data: { id: string }[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };

  // Replace-all. We intentionally don't wrap the DELETE in dbDelete —
  // 0 rows affected is a valid state (org may have no prior windows),
  // so 0 rows ≠ silent-fail here.
  const { error: delErr } = await sb
    .from("booking_windows")
    .delete()
    .eq("org_id", profile.org_id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  if (incoming.length > 0) {
    const rows = incoming.map((w) => ({
      org_id: profile.org_id,
      day_of_week: w.day_of_week,
      start_minute: w.start_minute,
      end_minute: w.end_minute,
      label: w.label ?? null,
    }));
    try {
      await dbInsert(
        "insert booking_windows (replace-all)",
        sb.from("booking_windows").insert(rows).select("id"),
      );
    } catch (err) {
      const { status, body } = dbWriteErrorResponse(err);
      return NextResponse.json(body, { status });
    }
  }

  return NextResponse.json({ ok: true, count: incoming.length });
}
