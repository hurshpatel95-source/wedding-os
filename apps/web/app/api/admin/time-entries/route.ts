import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface CreateBody {
  workspace_id: string;
  started_at: string;
  ended_at?: string | null;
  duration_minutes?: number | null;
  label?: string | null;
  billable?: boolean;
  hourly_rate_eur?: number | null;
  notes?: string | null;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { org_role?: string | null; org_id?: string | null } | null;
          }>;
        };
      };
      insert: (p: Record<string, unknown>) => {
        select: (c: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  const { data: profile } = await sb
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.org_role !== "org_admin" || !profile.org_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as CreateBody;
  if (!body.workspace_id || !body.started_at) {
    return NextResponse.json(
      { error: "workspace_id, started_at required" },
      { status: 400 },
    );
  }

  // Compute the missing field: if both started + ended given → duration;
  // if only duration + started given → ended.
  const startMs = new Date(body.started_at).getTime();
  if (Number.isNaN(startMs)) {
    return NextResponse.json({ error: "bad started_at" }, { status: 400 });
  }

  let endedAt: string | null = body.ended_at ?? null;
  let durationMin: number | null =
    body.duration_minutes != null ? Number(body.duration_minutes) : null;

  if (endedAt && durationMin == null) {
    const endMs = new Date(endedAt).getTime();
    if (Number.isNaN(endMs) || endMs < startMs) {
      return NextResponse.json({ error: "bad ended_at" }, { status: 400 });
    }
    durationMin = Math.round((endMs - startMs) / 60000);
  } else if (!endedAt && durationMin != null) {
    if (!Number.isFinite(durationMin) || durationMin < 0) {
      return NextResponse.json({ error: "bad duration_minutes" }, { status: 400 });
    }
    const endMs = startMs + durationMin * 60000;
    endedAt = new Date(endMs).toISOString();
  } else if (!endedAt && durationMin == null) {
    return NextResponse.json(
      { error: "supply ended_at or duration_minutes" },
      { status: 400 },
    );
  }

  const { data, error } = await sb
    .from("time_entries")
    .insert({
      org_id: profile.org_id,
      workspace_id: body.workspace_id,
      user_id: user.id,
      started_at: body.started_at,
      ended_at: endedAt,
      duration_minutes: durationMin,
      label: body.label?.trim() || null,
      billable: body.billable ?? true,
      hourly_rate_eur:
        body.hourly_rate_eur != null ? Number(body.hourly_rate_eur) : null,
      notes: body.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "insert failed" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, id: data.id });
}
