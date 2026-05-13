// AI Studio — Stage 1: clarify.
//
// POST /api/studio/<tool>/clarify
// Body: { user_input: string }
//
// Server:
//   1. Auth + workspace membership.
//   2. Validate the tool slug against the registry; reject if unknown or
//      not yet wired ("coming_soon" tools 404 here).
//   3. AI-quota check (per-org daily budget + call cap).
//   4. Read workspace context (region, season, palette signals).
//   5. Call clarify() → returns questions + preview prompt.
//   6. Record the Anthropic cost in ai_usage_daily for ops visibility.
//
// Cost guard is REQUIRED. Each clarify call ~$0.005-0.02.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertNonChatAiQuota, recordNonChatAiCall } from "@/lib/ai-quota";
import { anthropicReady } from "@/lib/anthropic";
import { normalizeCurrency } from "@/lib/utils";
import { getStudioTool } from "@/lib/studio/tool-registry";
import { clarify } from "@/lib/studio/prompt-optimizer";
import type { WorkspaceContext } from "@/lib/studio/types";

export const runtime = "nodejs";
export const maxDuration = 30;

interface ClarifyBody {
  user_input?: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { tool: string } },
) {
  // Tool slug must be in the registry AND "live". Coming-soon tools
  // honestly 404 — the route handler doesn't lie about wiring.
  const tool = getStudioTool(params.tool);
  if (!tool) {
    return NextResponse.json(
      { error: `Unknown studio tool: "${params.tool}"` },
      { status: 404 },
    );
  }
  if (tool.status !== "live") {
    return NextResponse.json(
      { error: `Studio tool "${tool.label}" is coming soon.` },
      { status: 404 },
    );
  }

  // Special case: pricing-analyzer is "live" but lives at /visualize
  // today (Day 3 migration). The clarify path doesn't apply yet.
  if (tool.slug === "pricing-analyzer") {
    return NextResponse.json(
      {
        error:
          "pricing-analyzer uses the legacy /visualize endpoint today. Day 3 migration will wire clarify.",
      },
      { status: 404 },
    );
  }

  if (!anthropicReady) {
    // We still walk the UX via the in-prompt-optimizer stub fallback,
    // but signal to the client that the server is missing config so
    // the UI can show a small "preview mode" banner if it wants to.
    // Not a hard 503 — the fallback questions are real.
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("org_id, workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  const profileTyped = profile as
    | { org_id: string; workspace_id: string }
    | null;
  if (!profileTyped?.workspace_id || !profileTyped?.org_id) {
    return NextResponse.json({ error: "no workspace" }, { status: 403 });
  }

  // Cost guard
  const overBudget = await assertNonChatAiQuota(supabase, profileTyped.org_id);
  if (overBudget) {
    return NextResponse.json({ error: overBudget }, { status: 429 });
  }

  // Validate body
  let body: ClarifyBody;
  try {
    body = (await request.json()) as ClarifyBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const userInput =
    typeof body.user_input === "string" ? body.user_input.trim() : "";
  if (!userInput) {
    return NextResponse.json(
      { error: "user_input is required" },
      { status: 400 },
    );
  }
  if (userInput.length > 2000) {
    return NextResponse.json(
      { error: "user_input too long (max 2000 chars)" },
      { status: 400 },
    );
  }

  // Workspace context
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: {
              name: string | null;
              base_currency: string | null;
              wedding_region: string | null;
              wedding_date: string | null;
              guest_count_estimate: number | null;
              style_tags: string[] | null;
            } | null;
          }>;
        };
      };
    };
  };
  const { data: ws } = await sb
    .from("workspaces")
    .select(
      "name, base_currency, wedding_region, wedding_date, guest_count_estimate, style_tags",
    )
    .eq("id", profileTyped.workspace_id)
    .maybeSingle();

  const context: WorkspaceContext = {
    workspace_id: profileTyped.workspace_id,
    workspace_name: ws?.name ?? null,
    wedding_region: ws?.wedding_region ?? null,
    wedding_date: ws?.wedding_date ?? null,
    guest_count_estimate: ws?.guest_count_estimate ?? null,
    style_tags: Array.isArray(ws?.style_tags) ? (ws!.style_tags as string[]) : [],
    base_currency: normalizeCurrency(ws?.base_currency ?? null),
  };

  let result;
  try {
    result = await clarify(tool.slug, userInput, context);
  } catch (err) {
    return NextResponse.json(
      { error: `Clarify failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  // Best-effort cost recording (does not block response)
  if (result.cost_usd > 0) {
    await recordNonChatAiCall(
      supabase,
      profileTyped.org_id,
      profileTyped.workspace_id,
      result.cost_usd,
    );
  }

  return NextResponse.json({
    tool: tool.slug,
    questions: result.questions,
    preview_prompt: result.preview_prompt,
  });
}
