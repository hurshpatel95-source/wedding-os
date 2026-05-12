import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  dbInsert,
  dbUpdate,
  dbWriteErrorResponse,
} from "@/lib/db-write-guard";

export const runtime = "nodejs";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

interface PatchBody {
  accent_hex?: string;
  planner_display_name?: string | null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
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
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();
  const orgRole = (profile?.org_role ?? null) as
    | "org_admin"
    | "member"
    | null;
  if (orgRole !== "org_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Verify the workspace belongs to this org (RLS would block writes either
  // way, but we want a clean 404 instead of a 500).
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, org_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!workspace) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (workspace.org_id !== profile?.org_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody;

  const update: { accent_hex?: string; planner_display_name?: string | null } =
    {};
  if (typeof body.accent_hex === "string") {
    if (!HEX_RE.test(body.accent_hex)) {
      return NextResponse.json(
        { error: "accent_hex must be a 6-digit hex like #9d174d" },
        { status: 400 },
      );
    }
    update.accent_hex = body.accent_hex;
  }
  if (body.planner_display_name !== undefined) {
    const dn = body.planner_display_name;
    if (dn === null) {
      update.planner_display_name = null;
    } else if (typeof dn === "string") {
      const trimmed = dn.trim();
      update.planner_display_name = trimmed.length === 0 ? null : trimmed;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "no fields to update" },
      { status: 400 },
    );
  }

  // UPSERT — workspace_id is PK; fall back to default accent for fresh rows.
  const { data: existing } = await supabase
    .from("workspace_branding")
    .select("workspace_id")
    .eq("workspace_id", params.id)
    .maybeSingle();

  if (!existing) {
    const insertRow = {
      workspace_id: params.id,
      accent_hex: update.accent_hex ?? "#9d174d",
      planner_display_name: update.planner_display_name ?? null,
    };
    try {
      await dbInsert(
        "insert workspace_branding",
        supabase
          .from("workspace_branding")
          .insert(insertRow as never)
          .select("workspace_id"),
      );
    } catch (err) {
      const { status, body } = dbWriteErrorResponse(err);
      return NextResponse.json(body, { status });
    }
  } else {
    try {
      await dbUpdate(
        "update workspace_branding",
        supabase
          .from("workspace_branding")
          .update(update as never)
          .eq("workspace_id", params.id)
          .select("workspace_id"),
      );
    } catch (err) {
      const { status, body } = dbWriteErrorResponse(err);
      return NextResponse.json(body, { status });
    }
  }

  const { data: row } = await supabase
    .from("workspace_branding")
    .select(
      "workspace_id, accent_hex, logo_storage_path, planner_display_name, updated_at",
    )
    .eq("workspace_id", params.id)
    .maybeSingle();

  return NextResponse.json({ branding: row });
}
