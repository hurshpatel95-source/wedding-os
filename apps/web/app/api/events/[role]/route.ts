// Move 5 — Day 2. PATCH / DELETE for event_details rows, keyed by
// (workspace_id, event_role). The role comes from the URL path.
//
// PATCH:
//   - Updates the existing event_details row matching this workspace+role.
//   - If no row exists yet AND the patch includes is_active=true (or
//     omits is_active — defaults to active), upserts a new row with
//     the provided fields. This unifies "edit" and "activate from
//     inactive chip" in a single endpoint.
//
// DELETE:
//   - Soft delete via is_active=false. We never actually remove rows
//     so that re-activating later restores the prior metadata.
//
// All writes go through dbInsert / dbUpdate so the May-8-style silent
// RLS failure can't happen here (T1.3 write-guard). The event_details
// table isn't in the generated Database types yet, so we cast the
// supabase client per the same pattern used in /api/budget-lines/[id].

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  dbInsert,
  dbUpdate,
  dbWriteErrorResponse,
} from "@/lib/db-write-guard";
import { isEventRole, type EventRole } from "@/lib/event-types";

export const runtime = "nodejs";

interface PatchBody {
  display_name?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  venue_id?: string | null;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

const PATCHABLE_KEYS: (keyof PatchBody)[] = [
  "display_name",
  "start_at",
  "end_at",
  "venue_id",
  "description",
  "is_active",
  "sort_order",
];

function trimOrNull(v: unknown): string | null {
  if (v === null) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function parseTimestamp(v: unknown): string | null | "invalid" {
  if (v === null || v === "" || v === undefined) return null;
  if (typeof v !== "string") return "invalid";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "invalid";
  return d.toISOString();
}

async function resolveAuth(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "unauthorized" as const };

  const { data: profile } = await supabase
    .from("users")
    .select("org_id, workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  const profileTyped = profile as
    | { org_id: string | null; workspace_id: string | null }
    | null;
  if (!profileTyped?.workspace_id || !profileTyped?.org_id) {
    return { kind: "no_workspace" as const };
  }
  return {
    kind: "ok" as const,
    user,
    workspaceId: profileTyped.workspace_id,
    orgId: profileTyped.org_id,
  };
}

function validateRole(raw: string): EventRole | null {
  // Decode in case the URL was percent-encoded.
  try {
    const decoded = decodeURIComponent(raw);
    return isEventRole(decoded) ? (decoded as EventRole) : null;
  } catch {
    return isEventRole(raw) ? (raw as EventRole) : null;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { role: string } },
) {
  const role = validateRole(params.role);
  if (!role) {
    return NextResponse.json({ error: "invalid event_role" }, { status: 400 });
  }

  const supabase = createClient();
  const auth = await resolveAuth(supabase);
  if (auth.kind === "unauthorized") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (auth.kind === "no_workspace") {
    return NextResponse.json({ error: "no workspace" }, { status: 403 });
  }
  const { workspaceId, orgId } = auth;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Whitelist only patchable fields.
  const patch: Record<string, unknown> = {};
  for (const k of PATCHABLE_KEYS) {
    if (k in body) {
      patch[k] = body[k];
    }
  }

  // Normalize text fields.
  if ("display_name" in patch) {
    patch.display_name = trimOrNull(patch.display_name);
  }
  if ("description" in patch) {
    patch.description = trimOrNull(patch.description);
  }
  if ("venue_id" in patch) {
    const v = patch.venue_id;
    patch.venue_id = v === null || v === "" ? null : (v as string);
  }
  if ("start_at" in patch) {
    const parsed = parseTimestamp(patch.start_at);
    if (parsed === "invalid") {
      return NextResponse.json(
        { error: "start_at must be a valid date or null" },
        { status: 400 },
      );
    }
    patch.start_at = parsed;
  }
  if ("end_at" in patch) {
    const parsed = parseTimestamp(patch.end_at);
    if (parsed === "invalid") {
      return NextResponse.json(
        { error: "end_at must be a valid date or null" },
        { status: 400 },
      );
    }
    patch.end_at = parsed;
  }
  if ("is_active" in patch && typeof patch.is_active !== "boolean") {
    return NextResponse.json(
      { error: "is_active must be a boolean" },
      { status: 400 },
    );
  }
  if (
    "sort_order" in patch &&
    (typeof patch.sort_order !== "number" || !Number.isInteger(patch.sort_order))
  ) {
    return NextResponse.json(
      { error: "sort_order must be an integer" },
      { status: 400 },
    );
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no patchable fields" }, { status: 400 });
  }

  // event_details is not in the generated Database types yet — cast.
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          eq: (
            col: string,
            val: string,
          ) => {
            limit: (n: number) => {
              maybeSingle: () => Promise<{
                data: { id: string } | null;
                error: { message?: string; code?: string } | null;
              }>;
            };
          };
        };
      };
      update: (p: Record<string, unknown>) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            select: (cols: string) => Promise<{
              data: Array<Record<string, unknown>> | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
      insert: (rows: Array<Record<string, unknown>>) => {
        select: (cols: string) => Promise<{
          data: Array<Record<string, unknown>> | null;
          error: { message: string } | null;
        }>;
      };
    };
  };

  // Check if row exists for this workspace+role.
  let existing: { id: string } | null = null;
  try {
    const { data } = await sb
      .from("event_details")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("event_role", role)
      .limit(1)
      .maybeSingle();
    existing = data ?? null;
  } catch {
    existing = null;
  }

  try {
    if (existing) {
      const rows = await dbUpdate(
        "update event_details",
        sb
          .from("event_details")
          .update(patch)
          .eq("workspace_id", workspaceId)
          .eq("event_role", role)
          .select("*"),
      );
      return NextResponse.json({ ok: true, event: rows[0] });
    }

    // No existing row. Upsert path — accept only if the caller wants
    // this event activated (is_active default = true). If they
    // explicitly sent is_active=false, that's a no-op; pretend success.
    const wantActive = patch.is_active !== false;
    if (!wantActive) {
      return NextResponse.json({ ok: true, event: null });
    }

    const insertRow: Record<string, unknown> = {
      workspace_id: workspaceId,
      org_id: orgId,
      event_role: role,
      is_active: true,
      sort_order: 0,
      ...patch,
    };

    const rows = await dbInsert(
      "create event_details",
      sb.from("event_details").insert([insertRow]).select("*"),
    );
    return NextResponse.json({ ok: true, event: rows[0] });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { role: string } },
) {
  const role = validateRole(params.role);
  if (!role) {
    return NextResponse.json({ error: "invalid event_role" }, { status: 400 });
  }

  const supabase = createClient();
  const auth = await resolveAuth(supabase);
  if (auth.kind === "unauthorized") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (auth.kind === "no_workspace") {
    return NextResponse.json({ error: "no workspace" }, { status: 403 });
  }
  const { workspaceId } = auth;

  // Soft delete — flip is_active=false. event_details not in generated
  // types yet, so cast same as the PATCH handler.
  const sb = supabase as unknown as {
    from: (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            select: (cols: string) => Promise<{
              data: Array<Record<string, unknown>> | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };

  try {
    await dbUpdate(
      "soft-delete event_details (is_active=false)",
      sb
        .from("event_details")
        .update({ is_active: false })
        .eq("workspace_id", workspaceId)
        .eq("event_role", role)
        .select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
