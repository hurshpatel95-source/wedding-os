import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import {
  anthropicReady,
  getAnthropic,
  DEFAULT_INTAKE_MODEL,
  estimateCost,
} from "@/lib/anthropic";
import { assertNonChatAiQuota, recordNonChatAiCall } from "@/lib/ai-quota";
import {
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_LABEL,
  type BudgetCategory,
} from "@/lib/autopilot-types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GenerateBody {
  guest_count?: number;
  budget_target_eur?: number;
  region?: string | null;
}

interface ToolLine {
  label: string;
  qty?: number | null;
  unit_price_eur?: number | null;
  total_eur?: number | null;
  notes?: string | null;
}

interface ToolCategory {
  category: string;
  label: string;
  sort_order: number;
  lines: ToolLine[];
}

interface ToolOutput {
  categories: ToolCategory[];
}

const TOOL: Anthropic.Tool = {
  name: "emit_budget_baseline",
  description:
    "Emit a complete wedding budget tree organized by category, with 3-8 specific line items per category. Each line should have realistic qty + unit price + total in EUR (or USD; the user works in their workspace base currency).",
  input_schema: {
    type: "object",
    required: ["categories"],
    properties: {
      categories: {
        type: "array",
        description:
          "One entry per top-level category. Cover all 9 standard categories at minimum (venue, catering, bar, photo_video, flowers_decor, music, attire, stationery, transportation), and add any of the optional ones relevant to this wedding (hair_makeup, officiant, rehearsal_dinner, welcome_bags, favors, rentals, lighting, tipping, contingency).",
        items: {
          type: "object",
          required: ["category", "label", "sort_order", "lines"],
          properties: {
            category: {
              type: "string",
              enum: [...BUDGET_CATEGORIES],
              description:
                "Category key from the canonical enum.",
            },
            label: {
              type: "string",
              description: "Human-readable label for the category bucket.",
            },
            sort_order: {
              type: "integer",
              description: "Display order within the tree (0 = first).",
            },
            lines: {
              type: "array",
              description: "3-8 specific line items in this category.",
              items: {
                type: "object",
                required: ["label", "total_eur"],
                properties: {
                  label: {
                    type: "string",
                    description:
                      "Specific item — e.g. 'Bridal bouquet', 'Wine pairing for 120 guests'.",
                  },
                  qty: { type: ["number", "null"] },
                  unit_price_eur: { type: ["number", "null"] },
                  total_eur: {
                    type: "number",
                    description: "Total cost in workspace base currency.",
                  },
                  notes: { type: ["string", "null"] },
                },
              },
            },
          },
        },
      },
    },
  },
};

export async function POST(request: NextRequest) {
  if (!anthropicReady) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on the server." },
      { status: 503 },
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

  // Cost guard
  const overBudget = await assertNonChatAiQuota(supabase, profileTyped.org_id);
  if (overBudget) {
    return NextResponse.json({ error: overBudget }, { status: 429 });
  }

  const body = (await request.json()) as GenerateBody;
  const guestCount = Number(body.guest_count);
  const budgetTarget = Number(body.budget_target_eur);
  const region = body.region?.trim() || "mid-tier US";

  if (!Number.isFinite(guestCount) || guestCount <= 0) {
    return NextResponse.json(
      { error: "guest_count must be a positive number" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(budgetTarget) || budgetTarget <= 0) {
    return NextResponse.json(
      { error: "budget_target_eur must be a positive number" },
      { status: 400 },
    );
  }

  // Workspace currency — used to phrase the prompt naturally.
  const { data: ws } = await supabase
    .from("workspaces")
    .select("base_currency")
    .eq("id", profileTyped.workspace_id)
    .maybeSingle();
  const symbol =
    (ws?.base_currency as string | undefined) === "USD" ? "$" : "€";

  const SYSTEM_PROMPT = `You are an expert wedding budget planner.

Your job: generate a detailed, REALISTIC starting budget tree for a couple planning a wedding for ${guestCount} guests in ${region}, with a total target of ${symbol}${budgetTarget.toLocaleString()}.

Cover all of these categories (use the canonical keys exactly): venue, catering, bar, photo_video, flowers_decor, music, attire, stationery, transportation, hair_makeup, officiant, rehearsal_dinner, welcome_bags, favors, rentals, lighting, tipping, contingency.

Rules:
- Per-guest pricing for catering and bar should be specifically called out as "qty × unit_price_eur" lines (e.g. plated dinner ${guestCount} × ${symbol}120 = ${symbol}${(guestCount * 120).toLocaleString()}).
- Include welcome bags (e.g. ${symbol}15-25 gift bag with snacks + map per out-of-town guest), tipping (~10% buffer for vendor gratuities), and contingency (~10% of total).
- Each category gets 3-8 line items. Be specific (not "decor" but "ceremony aisle florals").
- The sum of all total_eur fields should be within ±5% of ${symbol}${budgetTarget.toLocaleString()}.
- Use round-ish numbers (50/100/250 increments) — these are starting estimates, not invoices.
- Currency is the workspace base currency. Treat the total_eur field as "amount in base currency" regardless of whether that's EUR or USD; do NOT convert.
- sort_order: 0 for venue, 1 for catering, 2 for bar, etc — most-load-bearing first.

Output via the emit_budget_baseline tool. Don't reply in plain text.`;

  const anthropic = getAnthropic();
  let resp;
  const startedAt = Date.now();
  try {
    resp = await anthropic.messages.create({
      model: DEFAULT_INTAKE_MODEL,
      max_tokens: 6000,
      system: SYSTEM_PROMPT,
      tool_choice: { type: "tool", name: TOOL.name },
      tools: [TOOL],
      messages: [
        {
          role: "user",
          content: `Generate the baseline budget for ${guestCount} guests, ${symbol}${budgetTarget.toLocaleString()} target, in ${region}.`,
        },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Claude error: ${(err as Error).message}` },
      { status: 502 },
    );
  }
  const durationMs = Date.now() - startedAt;

  const toolBlock = resp.content.find((c) => c.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    return NextResponse.json(
      { error: "Claude returned no budget tree" },
      { status: 502 },
    );
  }

  const out = toolBlock.input as ToolOutput;
  const categories = Array.isArray(out.categories) ? out.categories : [];

  if (categories.length === 0) {
    return NextResponse.json(
      { error: "Claude returned an empty tree" },
      { status: 502 },
    );
  }

  // Build the rows. Parents first (parent_line_id null), then children with FK.
  // We have to insert parents, get their IDs back, then insert children.
  type InsertRow = {
    workspace_id: string;
    org_id: string;
    parent_line_id: string | null;
    category: string;
    label: string;
    qty: number | null;
    unit_price_eur: number | null;
    total_eur: number | null;
    amount_estimated: number | null;
    amount_committed: number | null;
    amount_paid: number | null;
    vendor_id: string | null;
    status: string;
    source: string;
    sort_order: number;
    notes: string | null;
  };

  const parentRows: InsertRow[] = [];
  for (const cat of categories) {
    if (!cat.category || !cat.label) continue;
    const catKey = (BUDGET_CATEGORIES as readonly string[]).includes(
      cat.category,
    )
      ? (cat.category as BudgetCategory)
      : "misc";
    parentRows.push({
      workspace_id: profileTyped.workspace_id,
      org_id: profileTyped.org_id,
      parent_line_id: null,
      category: catKey,
      label: cat.label || BUDGET_CATEGORY_LABEL[catKey],
      qty: null,
      unit_price_eur: null,
      total_eur: null,
      amount_estimated: null,
      amount_committed: null,
      amount_paid: null,
      vendor_id: null,
      status: "placeholder",
      source: "ai_baseline",
      sort_order: Number.isFinite(cat.sort_order) ? cat.sort_order : 0,
      notes: null,
    });
  }

  // Cast: budget_lines not in generated types
  const sb = supabase as unknown as {
    from: (t: string) => {
      insert: (rows: InsertRow[]) => {
        select: (cols: string) => Promise<{
          data: Array<InsertRow & { id: string }> | null;
          error: { message: string } | null;
        }>;
      };
    };
  };

  const { data: insertedParents, error: insErr } = await sb
    .from("budget_lines")
    .insert(parentRows)
    .select("*");

  if (insErr || !insertedParents) {
    return NextResponse.json(
      {
        error: `Couldn't insert parent categories: ${insErr?.message ?? "unknown"}`,
      },
      { status: 500 },
    );
  }

  // Map (category, sort_order) -> id, since we don't have a unique key
  const parentIdByCategory: Record<string, string> = {};
  for (let i = 0; i < insertedParents.length; i++) {
    const ip = insertedParents[i];
    parentIdByCategory[ip.category] = ip.id;
  }

  // Build children rows
  const childRows: InsertRow[] = [];
  for (const cat of categories) {
    const parentId = parentIdByCategory[cat.category] ?? null;
    if (!parentId) continue;
    const lines = Array.isArray(cat.lines) ? cat.lines : [];
    let order = 0;
    for (const line of lines) {
      if (!line.label) continue;
      const total = Number(line.total_eur ?? 0);
      const qty = line.qty != null ? Number(line.qty) : null;
      const unitPrice =
        line.unit_price_eur != null ? Number(line.unit_price_eur) : null;
      childRows.push({
        workspace_id: profileTyped.workspace_id,
        org_id: profileTyped.org_id,
        parent_line_id: parentId,
        category: cat.category,
        label: line.label,
        qty: Number.isFinite(qty as number) ? (qty as number) : null,
        unit_price_eur: Number.isFinite(unitPrice as number)
          ? (unitPrice as number)
          : null,
        total_eur: Number.isFinite(total) ? total : null,
        amount_estimated: Number.isFinite(total) ? total : null,
        amount_committed: 0,
        amount_paid: 0,
        vendor_id: null,
        status: "placeholder",
        source: "ai_baseline",
        sort_order: order++,
        notes: line.notes ?? null,
      });
    }
  }

  let childInserted = 0;
  if (childRows.length > 0) {
    const { data: kids, error: kidsErr } = await sb
      .from("budget_lines")
      .insert(childRows)
      .select("id");
    if (kidsErr) {
      return NextResponse.json(
        {
          error: `Couldn't insert child lines: ${kidsErr.message}`,
        },
        { status: 500 },
      );
    }
    childInserted = (kids ?? []).length;
  }

  // Persist guest_count + budget_target on the workspace (and region) for next time.
  const sbWs = supabase as unknown as {
    from: (t: string) => {
      update: (
        patch: Record<string, unknown>,
      ) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
  try {
    await sbWs
      .from("workspaces")
      .update({
        guest_count_estimate: guestCount,
        budget_target_eur: budgetTarget,
        wedding_region: region === "mid-tier US" ? null : region,
      })
      .eq("id", profileTyped.workspace_id);
  } catch {
    // tolerate pre-migration
  }

  // Cost tracking
  const cost = estimateCost(resp.usage.input_tokens, resp.usage.output_tokens);
  await recordNonChatAiCall(
    supabase,
    profileTyped.org_id,
    profileTyped.workspace_id,
    cost,
  );

  // Trace row in autopilot_runs
  const sbRun = supabase as unknown as {
    from: (t: string) => {
      insert: (
        row: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
  try {
    await sbRun.from("autopilot_runs").insert({
      workspace_id: profileTyped.workspace_id,
      org_id: profileTyped.org_id,
      kind: "budget_baseline",
      input_ref: {
        guest_count: guestCount,
        budget_target_eur: budgetTarget,
        region,
      },
      output: {
        categories_count: insertedParents.length,
        lines_count: childInserted,
      },
      model: DEFAULT_INTAKE_MODEL,
      input_tokens: resp.usage.input_tokens,
      output_tokens: resp.usage.output_tokens,
      cost_usd: cost,
      status: "success",
      duration_ms: durationMs,
      triggered_by: "manual",
    });
  } catch {
    // best-effort
  }

  return NextResponse.json({
    ok: true,
    lines_inserted: insertedParents.length + childInserted,
    parents_inserted: insertedParents.length,
    children_inserted: childInserted,
    cost_usd: cost,
  });
}
