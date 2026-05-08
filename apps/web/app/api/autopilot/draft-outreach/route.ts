// POST /api/autopilot/draft-outreach
//
// Given a list of vendor_ids the couple just added (typically from
// /vendors/find), draft N personalized RFP emails — one per vendor —
// that the couple can review, copy, send via mailto, or save to their
// Gmail Drafts folder.
//
// Personalization sources: vendor.name, vendor.category, vendor.gplaces_data
// (description, address, rating), workspace.name + wedding_date + region +
// guest_count_estimate + budget_target_eur.
//
// Sonnet 4.6 with forced tool. Cost: ~$0.05 per batch of 5 drafts.

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

export const runtime = "nodejs";
export const maxDuration = 60;

interface DraftOutreachBody {
  vendor_ids: string[];
}

interface VendorLite {
  id: string;
  workspace_id: string;
  org_id: string;
  name: string;
  category: string | null;
  contact_email: string | null;
  contact_name: string | null;
  website: string | null;
  notes: string | null;
  gplaces_data: unknown;
}

const DRAFT_TOOL: Anthropic.Tool = {
  name: "emit_personalized_rfps",
  description:
    "Emit one personalized RFP email per vendor. Each draft references something specific from that vendor (their work, location, rating, specialty) so it feels like a real human wrote it — not a mass mail.",
  input_schema: {
    type: "object",
    required: ["drafts"],
    properties: {
      drafts: {
        type: "array",
        description:
          "One draft per vendor in the same order as the input vendors list.",
        items: {
          type: "object",
          required: ["vendor_id", "subject", "body_text"],
          properties: {
            vendor_id: { type: "string" },
            subject: { type: "string", description: "Concise, specific. Not 'Inquiry' or 'Wedding'." },
            body_text: {
              type: "string",
              description:
                "Friendly, ~5-8 sentences. Open with a specific reference to that vendor. State the wedding details (date, region, guest count, budget if useful). Ask 2-3 specific questions. Sign off as the couple's first name(s) — use the partner_a name if available, otherwise '[Your name]'.",
            },
          },
        },
      },
    },
  },
};

const DRAFT_SYSTEM = [
  "You are an autopilot writing personalized cold-outreach emails on behalf of a couple to wedding vendors.",
  "RULES:",
  "- One draft per vendor. Each one is unique. Never write the same opening line twice across the batch.",
  "- Open with something SPECIFIC to that vendor — their work style, their location, their rating count, an explicit mention of their website. NOT generic ('Hi, I love your work').",
  "- Always state the wedding date, region, guest count, and budget hint when available.",
  "- Ask 2-3 specific questions. Examples: 'Are you available [date]?', 'What's your typical package for {N} guests?', 'Do you offer {category-specific thing}?'",
  "- Sign off using the couple's first names (or first name) when provided. Never use 'The {couple_name} family' or formal titles.",
  "- DO NOT include placeholders like {{name}} or [insert]. Fill everything from the data given.",
  "- DO NOT hallucinate the vendor's portfolio details. If gplaces_data has no description, talk about general wedding-{category} qualities.",
  "- Tone: warm, casual, human. Like a friend asking a friend.",
].join("\n");

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
  if (!profile?.workspace_id || !profile?.org_id) {
    return NextResponse.json({ error: "no profile" }, { status: 403 });
  }

  const overBudget = await assertNonChatAiQuota(supabase, profile.org_id);
  if (overBudget) {
    return NextResponse.json({ error: overBudget }, { status: 429 });
  }

  if (!anthropicReady) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured on the server." },
      { status: 503 },
    );
  }

  let body: DraftOutreachBody;
  try {
    body = (await request.json()) as DraftOutreachBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const ids = Array.isArray(body.vendor_ids)
    ? body.vendor_ids.filter((s): s is string => typeof s === "string").slice(0, 8)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "vendor_ids required" }, { status: 400 });
  }

  // Load vendors (workspace-scoped via RLS) + the workspace context.
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        in: (col: string, vals: string[]) => Promise<{ data: VendorLite[] | null }>;
      };
    };
  };
  const { data: vendorsRaw } = await sb
    .from("vendors")
    .select(
      "id, workspace_id, org_id, name, category, contact_email, contact_name, website, notes, gplaces_data",
    )
    .in("id", ids);
  const vendors = (vendorsRaw ?? []).filter(
    (v) => v.workspace_id === profile.workspace_id,
  );
  if (vendors.length === 0) {
    return NextResponse.json(
      { error: "no matching vendors in this workspace" },
      { status: 404 },
    );
  }

  // Workspace + couple context (cast — wave3 columns may not be in types)
  const wsClient = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: {
              name: string;
              wedding_date: string | null;
              wedding_region: string | null;
              guest_count_estimate: number | null;
              budget_target_eur: number | null;
            } | null;
          }>;
        };
      };
    };
  };
  const { data: workspace } = await wsClient
    .from("workspaces")
    .select(
      "name, wedding_date, wedding_region, guest_count_estimate, budget_target_eur",
    )
    .eq("id", profile.workspace_id)
    .maybeSingle();

  // Pull first name from workspace.name pattern e.g. "Kyle & Michelle — Newport"
  const coupleNameRaw = workspace?.name?.split("—")[0]?.trim() ?? "";
  const firstNames =
    coupleNameRaw && coupleNameRaw.length > 0 ? coupleNameRaw : "[your name]";

  const userMessage = JSON.stringify(
    {
      couple: {
        names: firstNames,
        wedding_date: workspace?.wedding_date ?? null,
        region: workspace?.wedding_region ?? null,
        guest_count: workspace?.guest_count_estimate ?? null,
        budget_target_eur: workspace?.budget_target_eur ?? null,
      },
      vendors: vendors.map((v) => ({
        id: v.id,
        name: v.name,
        category: v.category,
        website: v.website,
        notes: v.notes,
        gplaces: v.gplaces_data,
      })),
    },
    null,
    2,
  );

  const anthropic = getAnthropic();
  const t0 = Date.now();
  const message = await anthropic.messages.create({
    model: DEFAULT_INTAKE_MODEL,
    max_tokens: 4096,
    tools: [DRAFT_TOOL],
    tool_choice: { type: "tool", name: "emit_personalized_rfps" },
    system: DRAFT_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
  });
  const durationMs = Date.now() - t0;

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json(
      { error: "Claude didn't emit drafts" },
      { status: 502 },
    );
  }
  const input = toolUse.input as {
    drafts?: Array<{ vendor_id: string; subject: string; body_text: string }>;
  };
  const drafts = (input.drafts ?? []).filter(
    (d) => d.vendor_id && d.subject && d.body_text,
  );

  const cost = estimateCost(
    message.usage.input_tokens,
    message.usage.output_tokens,
  );
  await recordNonChatAiCall(supabase, profile.org_id, profile.workspace_id, cost);

  // Trace
  await (
    supabase as unknown as {
      from: (t: string) => {
        insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .from("autopilot_runs")
    .insert({
      org_id: profile.org_id,
      workspace_id: profile.workspace_id,
      kind: "draft_outreach",
      input_ref: { vendor_ids: ids },
      output: { draft_count: drafts.length },
      model: DEFAULT_INTAKE_MODEL,
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
      cost_usd: cost,
      status: "success",
      duration_ms: durationMs,
      triggered_by: "manual",
    });

  // Stamp last_outbound_at on each vendor (we don't actually send here —
  // but the couple is about to either copy/mailto/save-to-gmail, so the
  // intent is clear). Set to now.
  const nowIso = new Date().toISOString();
  await (
    supabase as unknown as {
      from: (t: string) => {
        update: (row: unknown) => {
          in: (col: string, vals: string[]) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .from("vendors")
    .update({ last_outbound_at: nowIso, autopilot_status: "contacted" })
    .in(
      "id",
      drafts.map((d) => d.vendor_id),
    );

  // Build a "to" address per draft (use vendor.contact_email if present)
  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  const result = drafts.map((d) => {
    const v = vendorById.get(d.vendor_id);
    return {
      vendor_id: d.vendor_id,
      vendor_name: v?.name ?? null,
      to_email: v?.contact_email ?? null,
      subject: d.subject,
      body_text: d.body_text,
    };
  });

  return NextResponse.json({
    ok: true,
    drafts: result,
    cost_usd: cost,
  });
}
