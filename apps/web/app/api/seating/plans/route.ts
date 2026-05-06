import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface CreateBody {
  name: string;
  venue_id?: string | null;
  event_role?: string | null;
  table_count: number;
  seats_per_table: number;
  notes?: string | null;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id || !profile?.org_id) {
    return NextResponse.json({ error: "no workspace" }, { status: 400 });
  }

  const body = (await request.json()) as CreateBody;
  if (!body.name || !body.table_count || !body.seats_per_table) {
    return NextResponse.json(
      { error: "name, table_count, seats_per_table required" },
      { status: 400 },
    );
  }
  if (body.table_count < 1 || body.table_count > 200) {
    return NextResponse.json({ error: "table_count out of range" }, { status: 400 });
  }
  if (body.seats_per_table < 1 || body.seats_per_table > 50) {
    return NextResponse.json({ error: "seats_per_table out of range" }, { status: 400 });
  }

  const { data, error } = await (supabase as unknown as {
    from: (t: string) => {
      insert: (p: Record<string, unknown>) => {
        select: (c: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  })
    .from("floor_plans")
    .insert({
      workspace_id: profile.workspace_id,
      org_id: profile.org_id,
      name: body.name.trim(),
      venue_id: body.venue_id ?? null,
      event_role: body.event_role ?? null,
      table_count: body.table_count,
      seats_per_table: body.seats_per_table,
      notes: body.notes ?? null,
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
