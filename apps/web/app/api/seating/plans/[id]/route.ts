import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  dbUpdate,
  dbDelete,
  dbWriteErrorResponse,
} from "@/lib/db-write-guard";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    name?: string;
    venue_id?: string | null;
    event_role?: string | null;
    table_count?: number;
    seats_per_table?: number;
    notes?: string | null;
  };

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.venue_id !== undefined) patch.venue_id = body.venue_id;
  if (body.event_role !== undefined) patch.event_role = body.event_role;
  if (body.table_count !== undefined) patch.table_count = body.table_count;
  if (body.seats_per_table !== undefined) patch.seats_per_table = body.seats_per_table;
  if (body.notes !== undefined) patch.notes = body.notes;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const sbUpdate = supabase as unknown as {
    from: (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (col: string, val: string) => {
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
      "update floor_plan",
      sbUpdate.from("floor_plans").update(patch).eq("id", params.id).select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body: errBody } = dbWriteErrorResponse(err);
    return NextResponse.json(errBody, { status });
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

  const sbDelete = supabase as unknown as {
    from: (t: string) => {
      delete: () => {
        eq: (col: string, val: string) => {
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
      "delete floor_plan",
      sbDelete.from("floor_plans").delete().eq("id", params.id).select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body: errBody } = dbWriteErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
