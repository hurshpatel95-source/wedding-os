// AI Studio — Stage 2: generate.
//
// POST /api/studio/<tool>/generate
// Body: { user_input: string, answers: Record<string, string>, variant_count?: number }
//
// Server:
//   1. Auth + workspace.
//   2. Validate tool slug + status (live only).
//   3. Check credit balance against tool.cost_credits. 402 if short.
//   4. AI-quota check (per-org daily budget for the Anthropic side of
//      the call; Higgsfield has its own budget once it's wired).
//   5. Read workspace context.
//   6. finalizePrompt() → dense Higgsfield prompt.
//   7. generateImage() → N variants (stub or real).
//   8. Atomic credit spend.
//   9. Return StudioGenerationResult.
//
// Generation records are not persisted yet — the spec calls for a
// `generations` table behind T1.1 part 2. For Day 2 the result is
// returned to the client and lives there.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { assertNonChatAiQuota, recordNonChatAiCall } from "@/lib/ai-quota";
import { normalizeCurrency } from "@/lib/utils";
import { getStudioTool } from "@/lib/studio/tool-registry";
import { finalizePrompt } from "@/lib/studio/prompt-optimizer";
import { generateImage } from "@/lib/studio/higgsfield-client";
import { getBalance, spend } from "@/lib/studio/credits";
import type {
  StudioGenerationResult,
  WorkspaceContext,
} from "@/lib/studio/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GenerateBody {
  user_input?: unknown;
  answers?: unknown;
  variant_count?: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { tool: string } },
) {
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
  if (tool.slug === "pricing-analyzer") {
    return NextResponse.json(
      {
        error:
          "pricing-analyzer uses the legacy /visualize endpoint today. Day 3 migration will wire generate.",
      },
      { status: 404 },
    );
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
  const workspaceId = profileTyped.workspace_id;

  // ── Credit check (before any AI calls) ─────────────────────────────
  const balance = await getBalance(workspaceId);
  if (balance < tool.cost_credits) {
    return NextResponse.json(
      {
        error: "Insufficient credits",
        balance,
        needed: tool.cost_credits,
      },
      { status: 402 },
    );
  }

  // Cost guard for the Anthropic finalize call
  const overBudget = await assertNonChatAiQuota(supabase, profileTyped.org_id);
  if (overBudget) {
    return NextResponse.json({ error: overBudget }, { status: 429 });
  }

  // ── Body validation ────────────────────────────────────────────────
  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
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

  const answersRaw =
    body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
      ? (body.answers as Record<string, unknown>)
      : {};
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(answersRaw)) {
    if (typeof v === "string" && v.length <= 500) {
      answers[k] = v;
    }
  }

  const requestedVariants =
    typeof body.variant_count === "number" && body.variant_count > 0
      ? Math.min(24, Math.floor(body.variant_count))
      : tool.default_variant_count;

  // ── Workspace context ──────────────────────────────────────────────
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
    .eq("id", workspaceId)
    .maybeSingle();

  const context: WorkspaceContext = {
    workspace_id: workspaceId,
    workspace_name: ws?.name ?? null,
    wedding_region: ws?.wedding_region ?? null,
    wedding_date: ws?.wedding_date ?? null,
    guest_count_estimate: ws?.guest_count_estimate ?? null,
    style_tags: Array.isArray(ws?.style_tags) ? (ws!.style_tags as string[]) : [],
    base_currency: normalizeCurrency(ws?.base_currency ?? null),
  };

  // ── Finalize prompt (Anthropic call) ───────────────────────────────
  let finalized;
  try {
    finalized = await finalizePrompt(tool.slug, userInput, answers, context);
  } catch (err) {
    return NextResponse.json(
      { error: `Finalize failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  // Cost recording for Anthropic side
  if (finalized.cost_usd > 0) {
    await recordNonChatAiCall(
      supabase,
      profileTyped.org_id,
      workspaceId,
      finalized.cost_usd,
    );
  }

  // ── Image generation (Higgsfield call — stub today) ────────────────
  // Aspect ratio choice is tool-specific. Mood board → 16:9 collage.
  const dimensions = tool.slug === "mood-board" ? "16:9" : "1:1";
  let images;
  try {
    images = await generateImage({
      prompt: finalized.optimized_prompt,
      variant_count: requestedVariants,
      dimensions: dimensions as "16:9" | "1:1",
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Image generation failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  // ── Atomic credit spend (post-success) ─────────────────────────────
  // Spending AFTER generation so a failed render doesn't burn credits.
  // This means a race on two concurrent requests from the same user
  // could over-spend by one tool worth — acceptable for the in-memory
  // stub; the durable ledger will use a row lock.
  const spendRes = await spend(
    workspaceId,
    tool.cost_credits,
    `spend_tool_${tool.slug.replace(/-/g, "_")}`,
  );
  if (!spendRes.ok) {
    // Edge case: balance dropped between the pre-check and now. Honest
    // 402 — but the user already got images. Refund pattern goes here
    // once the durable ledger is wired.
    return NextResponse.json(
      {
        error: "Insufficient credits at spend time (race).",
        balance: spendRes.balance,
        needed: tool.cost_credits,
      },
      { status: 402 },
    );
  }

  const result: StudioGenerationResult = {
    variants: images.image_urls.map((url) => ({
      image_url: url,
      is_placeholder: images.was_stub ? true : undefined,
    })),
    optimized_prompt: finalized.optimized_prompt,
    cost_usd: finalized.cost_usd + images.cost_usd,
    credits_spent: tool.cost_credits,
    generation_id: randomUUID(),
  };

  return NextResponse.json({
    ...result,
    balance_after: spendRes.balance,
    was_stub: images.was_stub,
  });
}
