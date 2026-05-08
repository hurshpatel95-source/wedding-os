import { NextRequest, NextResponse } from "next/server";
import { addMonths, parseISO, formatISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type {
  IntakeExtractedData,
  IntakeSessionRow,
} from "@/lib/autopilot-types";
import { STARTER_CHECKLIST } from "@/lib/starter-checklist";
import { googlePlacesReady, searchPlaces } from "@/lib/google-places";

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

  // ─── Insert venue candidates from chat ───────────────────────────
  // For each name the AI captured, INSERT a venue row. If Google Places
  // is configured, enrich each with address/phone/photo/rating from the
  // first matching Place. Best-effort — failures don't block the flow.
  const venueCandidates = data.venue_candidates ?? [];
  if (venueCandidates.length > 0) {
    const region = data.wedding_region ?? "";
    type VenueInsertRow = {
      workspace_id: string;
      org_id: string;
      name: string;
      status: "shortlisted" | "visited" | "decided";
      address?: string | null;
      contact_phone?: string | null;
      hero_photo_url?: string | null;
      event_roles?: string[];
      notes?: string | null;
    };
    const venueRows: VenueInsertRow[] = [];
    for (const v of venueCandidates) {
      const row: VenueInsertRow = {
        workspace_id: profile.workspace_id,
        org_id: profile.org_id,
        name: v.name,
        status: v.status ?? "shortlisted",
      };
      // event_role from the AI maps to the venues.event_roles enum array.
      // Migration 0033 (event_roles_extension) adds rehearsal/after_party/brunch.
      // If the migration hasn't been applied yet the insert will fail and we
      // fall back to stashing the role in notes so the data isn't lost.
      if (v.event_role) {
        row.event_roles = [v.event_role];
        row.notes = `Event: ${v.event_role}`;
      }
      if (googlePlacesReady) {
        try {
          const query = region ? `${v.name} ${region}` : `${v.name} wedding venue`;
          const results = await searchPlaces(query, { maxResults: 1 });
          const top = results[0];
          if (top) {
            if (top.address) row.address = top.address;
            if (top.phone) row.contact_phone = top.phone;
            if (top.photos && top.photos.length > 0) {
              row.hero_photo_url = top.photos[0];
            }
          }
        } catch {
          // Places error — just insert without enrichment.
        }
      }
      venueRows.push(row);
    }
    const sbVenues = supabase as unknown as {
      from: (t: string) => {
        insert: (
          rows: unknown,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error: venueErr } = await sbVenues
      .from("venues")
      .insert(venueRows);
    if (venueErr) {
      // If the new event_role enum values aren't applied yet, retry without
      // event_roles so the venue still lands.
      const looksLikeEnumMissing = /event_role|invalid input value/i.test(
        venueErr.message,
      );
      if (looksLikeEnumMissing) {
        const fallbackRows = venueRows.map(
          ({ event_roles: _er, ...rest }) => rest,
        );
        const { error: retryErr } = await sbVenues
          .from("venues")
          .insert(fallbackRows);
        if (retryErr) {
          console.error(
            "[onboarding/complete] venue insert (fallback):",
            retryErr.message,
          );
        }
      } else {
        console.error("[onboarding/complete] venue insert:", venueErr.message);
      }
    }
  }

  // ─── Auto-seed the 84-task starter checklist if planning_tasks empty ──
  const sbCheck = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          limit: (n: number) => Promise<{ data: unknown[] | null }>;
        };
      };
      insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { data: existingTasks } = await sbCheck
    .from("planning_tasks")
    .select("id")
    .eq("workspace_id", profile.workspace_id)
    .limit(1);
  if (!existingTasks || existingTasks.length === 0) {
    function mapPhase(friendly: string, m: number): string {
      if (friendly === "Wedding week") return "final_week";
      if (friendly === "After") return "post_wedding";
      if (friendly === "Final stretch") return "final_month";
      if (m >= 12) return "pre_12_months";
      if (m >= 9) return "months_9_12";
      if (m >= 6) return "months_6_9";
      if (m >= 3) return "months_3_6";
      if (m >= 1) return "months_1_3";
      return "day_of";
    }
    function mapCategory(c: string | undefined): string {
      if (!c) return "other";
      if (c === "venue") return "venue";
      if (c === "attire") return "attire";
      if (c === "transportation" || c === "rentals") return "logistics";
      if (c === "officiant") return "ritual";
      if (
        ["photo_video", "catering", "music", "flowers_decor", "bar", "hair_makeup"].includes(c)
      ) {
        return "vendor";
      }
      return "other";
    }
    const computeDue = (months: number): string | null => {
      if (!newWeddingDate) return null;
      try {
        const wedding = parseISO(newWeddingDate);
        if (Number.isNaN(wedding.getTime())) return null;
        return formatISO(addMonths(wedding, -months), { representation: "date" });
      } catch {
        return null;
      }
    };
    const tasks = STARTER_CHECKLIST.map((t, i) => ({
      workspace_id: profile.workspace_id,
      org_id: profile.org_id,
      phase: mapPhase(t.phase, t.months_before),
      category: mapCategory(t.category),
      title: t.title,
      months_before: t.months_before,
      sort_order: i,
      status: "not_started",
      owner: "couple",
      due_date: computeDue(t.months_before),
    }));
    const { error: seedErr } = await sbCheck
      .from("planning_tasks")
      .insert(tasks);
    if (seedErr) {
      console.error("[onboarding/complete] checklist seed:", seedErr.message);
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
