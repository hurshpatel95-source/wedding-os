import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface AssignBody {
  floor_plan_id: string;
  guest_id: string;
  table_number: number | null; // null = unassign
  seat_number?: number | null;
  notes?: string | null;
}

// Upsert by (floor_plan_id, guest_id). If table_number is null, delete the row.
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json()) as AssignBody;
  if (!body.floor_plan_id || !body.guest_id) {
    return NextResponse.json(
      { error: "floor_plan_id + guest_id required" },
      { status: 400 },
    );
  }

  const sb = supabase as unknown as {
    from: (t: string) => {
      delete: () => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => Promise<{
            error: { message: string } | null;
          }>;
        };
      };
      upsert: (
        payload: Record<string, unknown>,
        opts: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
    };
  };

  // Unassign?
  if (body.table_number == null) {
    const { error } = await sb
      .from("seating_assignments")
      .delete()
      .eq("floor_plan_id", body.floor_plan_id)
      .eq("guest_id", body.guest_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: "unassigned" });
  }

  // Validate table_number against the plan
  const { data: plan } = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { table_count: number; seats_per_table: number } | null;
          }>;
        };
      };
    };
  })
    .from("floor_plans")
    .select("table_count, seats_per_table")
    .eq("id", body.floor_plan_id)
    .maybeSingle();
  if (!plan) {
    return NextResponse.json({ error: "plan not found" }, { status: 404 });
  }
  if (body.table_number < 1 || body.table_number > plan.table_count) {
    return NextResponse.json(
      {
        error: `table_number must be between 1 and ${plan.table_count}`,
      },
      { status: 400 },
    );
  }
  if (
    body.seat_number != null &&
    (body.seat_number < 1 || body.seat_number > plan.seats_per_table)
  ) {
    return NextResponse.json(
      {
        error: `seat_number must be between 1 and ${plan.seats_per_table}`,
      },
      { status: 400 },
    );
  }

  const { error } = await sb.from("seating_assignments").upsert(
    {
      floor_plan_id: body.floor_plan_id,
      guest_id: body.guest_id,
      table_number: body.table_number,
      seat_number: body.seat_number ?? null,
      notes: body.notes ?? null,
    },
    { onConflict: "floor_plan_id,guest_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, action: "assigned" });
}
