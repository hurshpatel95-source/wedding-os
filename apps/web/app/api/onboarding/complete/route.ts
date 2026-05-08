import { NextRequest, NextResponse } from "next/server";
import { addMonths, parseISO, formatISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type {
  IntakeExtractedData,
  IntakeSessionRow,
} from "@/lib/autopilot-types";

export const runtime = "nodejs";
export const maxDuration = 30;

interface CompleteRequest {
  session_id: string;
}

// Cast pattern for tables not in generated DB types yet.
interface IntakeSessionsTable {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{
          data: IntakeSessionRow | null;
        }>;
      };
    };
    update: (
      payload: Record<string, unknown>,
    ) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
}

// Re-anchor an existing planning_task whose due_date is null. Computes
// `wedding_date - months_before` (months) and returns ISO yyyy-mm-dd.
// Returns null if we can't compute (no months_before, etc.) — callers leave
// the row's due_date null in that case.
function computeAnchoredDueDate(
  weddingDate: string,
  monthsBefore: number | null,
): string | null {
  if (monthsBefore == null) return null;
  try {
    const wedding = parseISO(weddingDate);
    if (Number.isNaN(wedding.getTime())) return null;
    const due = addMonths(wedding, -monthsBefore);
    return formatISO(due, { representation: "date" });
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
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
  if (!profile?.workspace_id) {
    return NextResponse.json({ error: "no workspace" }, { status: 403 });
  }

  const body = (await request.json()) as CompleteRequest;
  if (!body.session_id) {
    return NextResponse.json({ error: "missing session_id" }, { status: 400 });
  }

  const sb = supabase as unknown as IntakeSessionsTable;
  const { data: session } = await sb
    .from("intake_sessions")
    .select(
      "id, workspace_id, org_id, status, started_at, completed_at, chat_messages, extracted_data, total_cost_usd, created_at, updated_at",
    )
    .eq("id", body.session_id)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (session.workspace_id !== profile.workspace_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const data: IntakeExtractedData = session.extracted_data ?? {};

  // Read the current workspace so we know which fields were already set
  // (re-anchoring tasks only matters if wedding_date was previously null).
  const { data: workspaceBefore } = await supabase
    .from("workspaces")
    .select("id, name, wedding_date")
    .eq("id", profile.workspace_id)
    .maybeSingle();
  const previousWeddingDate = workspaceBefore?.wedding_date ?? null;

  // Build the workspace patch from the extracted fields.
  const workspacePatch: Record<string, unknown> = {};
  if (data.wedding_date) workspacePatch.wedding_date = data.wedding_date;
  if (data.wedding_region) workspacePatch.wedding_region = data.wedding_region;
  if (data.style_tags && data.style_tags.length > 0) {
    workspacePatch.style_tags = data.style_tags;
  }
  if (typeof data.guest_count_estimate === "number") {
    workspacePatch.guest_count_estimate = data.guest_count_estimate;
  }
  if (typeof data.budget_target_eur === "number") {
    workspacePatch.budget_target_eur = data.budget_target_eur;
  }
  // Update workspace name if both partner names came in and the workspace
  // is still on its default ("New workspace" / blank). Cheap heuristic:
  // only override if both names known AND existing name is empty/default.
  if (data.partner_a_name && data.partner_b_name && workspaceBefore) {
    const current = (workspaceBefore.name ?? "").toLowerCase();
    const isDefault =
      !current ||
      current === "new workspace" ||
      current.includes("untitled") ||
      current.includes("workspace");
    if (isDefault) {
      workspacePatch.name = `${data.partner_a_name} & ${data.partner_b_name}'s wedding`;
    }
  }

  // Cast workspaces — wedding_region / style_tags / guest_count_estimate /
  // budget_target_eur columns aren't in the generated types yet.
  if (Object.keys(workspacePatch).length > 0) {
    const sbWs = supabase as unknown as {
      from: (t: string) => {
        update: (payload: Record<string, unknown>) => {
          eq: (
            col: string,
            val: string,
          ) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
    const { error: wsErr } = await sbWs
      .from("workspaces")
      .update(workspacePatch)
      .eq("id", profile.workspace_id);
    if (wsErr) {
      return NextResponse.json(
        { error: `Couldn't update workspace: ${wsErr.message}` },
        { status: 500 },
      );
    }
  }

  // Re-anchor planning tasks if wedding_date is now set and was previously null.
  // We only fill in `due_date` for tasks where it's currently null AND
  // `months_before` is known. We do NOT expand recurrences — just anchor.
  const newWeddingDate = (workspacePatch.wedding_date as string | undefined) ?? null;
  if (newWeddingDate && !previousWeddingDate) {
    const sbTasks = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, val: string) => {
            is: (
              col: string,
              val: null,
            ) => Promise<{
              data: Array<{
                id: string;
                months_before: number | null;
                due_date: string | null;
              }> | null;
            }>;
          };
        };
        update: (payload: Record<string, unknown>) => {
          eq: (
            col: string,
            val: string,
          ) => Promise<{ error: { message: string } | null }>;
        };
      };
    };

    const { data: tasksToAnchor } = await sbTasks
      .from("planning_tasks")
      .select("id, months_before, due_date")
      .eq("workspace_id", profile.workspace_id)
      .is("due_date", null);

    for (const t of tasksToAnchor ?? []) {
      const computed = computeAnchoredDueDate(newWeddingDate, t.months_before);
      if (!computed) continue;
      // Best effort — ignore individual update failures so a single bad row
      // doesn't break the whole flow.
      await sbTasks
        .from("planning_tasks")
        .update({ due_date: computed })
        .eq("id", t.id);
    }
  }

  // Mark the intake session complete.
  const { error: sessionErr } = await sb
    .from("intake_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", session.id);
  if (sessionErr) {
    return NextResponse.json(
      { error: `Couldn't finalize session: ${sessionErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
