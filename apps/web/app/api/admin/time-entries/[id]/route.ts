import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  dbUpdate,
  dbDelete,
  dbWriteErrorResponse,
} from "@/lib/db-write-guard";

export const runtime = "nodejs";

interface PatchBody {
  workspace_id?: string;
  started_at?: string;
  ended_at?: string | null;
  duration_minutes?: number | null;
  label?: string | null;
  billable?: boolean;
  hourly_rate_eur?: number | null;
  notes?: string | null;
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

  const body = (await request.json()) as PatchBody;
  const patch: Record<string, unknown> = {};

  if (body.workspace_id !== undefined) patch.workspace_id = body.workspace_id;
  if (body.label !== undefined) patch.label = body.label;
  if (body.billable !== undefined) patch.billable = body.billable;
  if (body.hourly_rate_eur !== undefined) {
    patch.hourly_rate_eur =
      body.hourly_rate_eur != null ? Number(body.hourly_rate_eur) : null;
  }
  if (body.notes !== undefined) patch.notes = body.notes;

  // If any of the time fields change, recompute the dependent value when we can.
  if (
    body.started_at !== undefined ||
    body.ended_at !== undefined ||
    body.duration_minutes !== undefined
  ) {
    const started = body.started_at;
    const ended = body.ended_at;
    const dur = body.duration_minutes;

    if (started !== undefined) patch.started_at = started;

    if (ended !== undefined) patch.ended_at = ended;
    if (dur !== undefined) patch.duration_minutes = dur;

    // Best-effort recompute when both ends are known on this PATCH.
    if (started && ended) {
      const s = new Date(started).getTime();
      const e = new Date(ended).getTime();
      if (Number.isFinite(s) && Number.isFinite(e) && e >= s) {
        patch.duration_minutes = Math.round((e - s) / 60000);
      }
    } else if (started && dur != null && ended === undefined) {
      const s = new Date(started).getTime();
      if (Number.isFinite(s)) {
        patch.ended_at = new Date(s + Number(dur) * 60000).toISOString();
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const sb = supabase as unknown as {
    from: (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (col: string, val: string) => {
          select: (cols: string) => PromiseLike<{
            data: { id: string }[] | null;
            error: { message: string } | null;
          }>;
        };
      };
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
    await dbUpdate(
      "update time_entry",
      sb.from("time_entries").update(patch).eq("id", params.id).select("id"),
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

  const sb = supabase as unknown as {
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
      "delete time_entry",
      sb.from("time_entries").delete().eq("id", params.id).select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
