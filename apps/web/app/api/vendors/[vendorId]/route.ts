// PATCH /api/vendors/[id] — narrow update endpoint for couple-side actions
// (currently: "Mark as winner" from the quote-compare view).
//
// We DO NOT support arbitrary updates. Only a small allow-listed subset of
// fields is patchable here so this endpoint stays safe to expose to couples
// without re-implementing the full vendor form. RLS still gates writes.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbUpdate, dbWriteErrorResponse } from "@/lib/db-write-guard";
import type { VendorRow, VendorStatus } from "@/lib/vendor-types";
import type { VendorAutopilotStatus } from "@/lib/autopilot-types";

export const runtime = "nodejs";

const VALID_STATUS: VendorStatus[] = [
  "researching",
  "rfp_sent",
  "quoted",
  "shortlisted",
  "booked",
  "completed",
  "declined",
];

const VALID_AUTOPILOT: VendorAutopilotStatus[] = [
  "none",
  "researching",
  "contacted",
  "quoted",
  "booked",
  "declined",
  "unavailable",
];

interface PatchBody {
  status?: VendorStatus;
  autopilot_status?: VendorAutopilotStatus;
  notes?: string | null;
}

interface UserProfileRow {
  workspace_id: string | null;
  org_id: string | null;
}

interface VendorScopeRow {
  id: string;
  workspace_id: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { vendorId: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id, org_id")
    .eq("id", user.id)
    .maybeSingle();
  const p = profile as UserProfileRow | null;
  if (!p?.workspace_id) {
    return NextResponse.json({ error: "no workspace" }, { status: 400 });
  }

  const sbAny = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: VendorScopeRow | null;
            error: { message: string } | null;
          }>;
        };
      };
      update: (p: Record<string, unknown>) => {
        eq: (col: string, val: string) => {
          select: (cols: string) => PromiseLike<{
            data: VendorRow[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  const { data: existing } = await sbAny
    .from("vendors")
    .select("id, workspace_id")
    .eq("id", params.vendorId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.workspace_id !== p.workspace_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const patch: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!VALID_STATUS.includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (body.autopilot_status !== undefined) {
    if (!VALID_AUTOPILOT.includes(body.autopilot_status)) {
      return NextResponse.json(
        { error: "invalid autopilot_status" },
        { status: 400 },
      );
    }
    patch.autopilot_status = body.autopilot_status;
  }
  if (body.notes !== undefined) {
    if (body.notes === null) patch.notes = null;
    else if (typeof body.notes === "string") {
      const t = body.notes.trim();
      patch.notes = t.length === 0 ? null : t;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "no fields to update" },
      { status: 400 },
    );
  }

  try {
    const rows = await dbUpdate(
      "update vendor (status/autopilot/notes)",
      sbAny
        .from("vendors")
        .update(patch)
        .eq("id", params.vendorId)
        .select("*"),
    );
    return NextResponse.json({ vendor: rows[0] });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
