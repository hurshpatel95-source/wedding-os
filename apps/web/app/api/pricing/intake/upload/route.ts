import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import {
  anthropicReady,
  getAnthropic,
  DEFAULT_INTAKE_MODEL,
  estimateCost,
} from "@/lib/anthropic";
import type { IntakePreview, ProposalDTO } from "@/lib/pricing-intake-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You extract wedding-pricing changes from planner messages (WhatsApp, email, PDFs, screenshots) into structured proposals against an existing pricing template.

Rules:
- For every price you find in the source, emit one proposal.
- 'matched_line_item_id' must be the id of the closest existing line item when confidence ≥ 0.6; otherwise leave null and set kind='new_line_item' with the proposed_label/category/unit you'd create.
- 'kind': 'default_price' if the price is a template-wide default; 'override' if the source clearly ties it to a specific venue (then the user will pick the venue at apply time); 'new_line_item' for prices that don't match any existing line.
- 'unit' must be one of per_guest / per_event / flat / per_hour / per_day. Pick the right one from context (e.g. "€220/pp" = per_guest, "€14,000 hire fee" = flat).
- 'evidence.quote' must be a verbatim short quote from the source (≤140 chars). For images, the OCR'd text. For PDFs, the snippet. For chat, the message line.
- 'confidence' (0-1) reflects how sure you are about (matched_line_item_id, unit_price, unit). If under 0.6 on price+unit, set 'needs_info' with one targeted question and confidence ≤ 0.5.
- Skip lines that are clearly not pricing (greetings, logistics).
- If the source is mostly logistics with no pricing, return an empty array.`;

const TOOL: Anthropic.Tool = {
  name: "propose_pricing_changes",
  description: "Emit structured pricing-change proposals extracted from the source.",
  input_schema: {
    type: "object",
    required: ["proposals"],
    properties: {
      proposals: {
        type: "array",
        items: {
          type: "object",
          required: ["kind", "confidence", "rationale", "evidence"],
          properties: {
            kind: { enum: ["default_price", "override", "new_line_item"] },
            matched_line_item_id: { type: ["string", "null"] },
            proposed_category: { type: ["string", "null"] },
            proposed_label: { type: ["string", "null"] },
            proposed_description: { type: ["string", "null"] },
            proposed_unit: {
              enum: ["per_guest", "per_event", "flat", "per_hour", "per_day", null],
            },
            proposed_tier: { enum: ["basic", "standard", "premium", null] },
            proposed_unit_price: { type: ["number", "null"] },
            proposed_currency: { type: ["string", "null"] },
            proposed_included: { type: ["boolean", "null"] },
            proposed_notes: { type: ["string", "null"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            rationale: { type: "string" },
            evidence: {
              type: "object",
              required: ["quote"],
              properties: {
                quote: { type: "string" },
                page: { type: "integer" },
                message_idx: { type: "integer" },
              },
            },
            needs_info: { type: ["string", "null"] },
          },
        },
      },
    },
  },
};

interface CatalogLine {
  id: string;
  category: string;
  label: string;
  unit: string;
  default_unit_price: number;
  currency: string;
  tier: string | null;
}

async function loadCatalog(orgId: string): Promise<CatalogLine[]> {
  const supabase = createClient();
  const { data: tpl } = await supabase
    .from("pricing_templates")
    .select("id")
    .eq("org_id", orgId)
    .limit(1)
    .maybeSingle();
  if (!tpl) return [];
  const { data: rows } = await supabase
    .from("pricing_line_items")
    .select("id, category_id, label, unit, default_unit_price, currency, tier");
  if (!rows) return [];
  const { data: cats } = await supabase
    .from("pricing_categories")
    .select("id, label");
  const catMap = new Map((cats ?? []).map((c) => [c.id, c.label]));
  return rows.map((r) => ({
    id: r.id,
    category: catMap.get(r.category_id) ?? "Other",
    label: r.label,
    unit: r.unit,
    default_unit_price: Number(r.default_unit_price),
    currency: r.currency,
    tier: r.tier,
  }));
}

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
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("role, workspace_id, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  // Get template to attach
  const { data: template } = await supabase
    .from("pricing_templates")
    .select("id")
    .eq("org_id", profile.org_id)
    .limit(1)
    .maybeSingle();
  if (!template) {
    return NextResponse.json({ error: "no pricing template — run pnpm db:seed first" }, { status: 400 });
  }

  // Accept either multipart (file) or JSON (text/source_label/venue_id)
  const contentType = request.headers.get("content-type") ?? "";
  let kind: "image" | "pdf" | "text" = "text";
  let storagePath: string | null = null;
  let mimeType: string | null = null;
  let byteSize: number | null = null;
  let rawText: string | null = null;
  let sourceLabel: string | null = null;
  let venueId: string | null = null;
  // For Claude content
  const claudeContent: Anthropic.MessageParam["content"] = [];

  if (contentType.includes("multipart/form-data")) {
    const fd = await request.formData();
    const file = fd.get("file") as File | null;
    sourceLabel = (fd.get("source_label") as string | null) ?? null;
    venueId = (fd.get("venue_id") as string | null) ?? null;

    if (!file) return NextResponse.json({ error: "missing file" }, { status: 400 });

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);
    byteSize = buf.length;
    mimeType = file.type;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    storagePath = `${profile.workspace_id}/${Date.now()}-${safeName}`;
    await supabase.storage
      .from("pricing-intake")
      .upload(storagePath, buf, { contentType: file.type, upsert: false });

    const isPdf = mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    kind = isPdf ? "pdf" : "image";

    if (isPdf) {
      claudeContent.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") },
      } as Anthropic.DocumentBlockParam);
    } else {
      claudeContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: (mimeType as Anthropic.Base64ImageSource["media_type"]) ?? "image/jpeg",
          data: buf.toString("base64"),
        },
      });
    }
  } else {
    const body = (await request.json()) as {
      text?: string;
      source_label?: string;
      venue_id?: string;
    };
    rawText = body.text?.trim() ?? "";
    sourceLabel = body.source_label ?? null;
    venueId = body.venue_id ?? null;
    if (!rawText) return NextResponse.json({ error: "missing text" }, { status: 400 });
    kind = "text";
    claudeContent.push({ type: "text", text: rawText });
  }

  // Insert source row
  const { data: source, error: srcErr } = await supabase
    .from("pricing_intake_sources")
    .insert({
      org_id: profile.org_id,
      workspace_id: profile.workspace_id,
      template_id: template.id,
      venue_id: venueId,
      uploaded_by: user.id,
      kind,
      status: "extracting",
      storage_path: storagePath,
      mime_type: mimeType,
      byte_size: byteSize,
      raw_text: rawText,
      source_label: sourceLabel,
    })
    .select()
    .single();
  if (srcErr || !source) {
    return NextResponse.json(
      { error: `Couldn't record intake: ${srcErr?.message}` },
      { status: 500 },
    );
  }

  // Load catalog for Claude
  const catalog = await loadCatalog(profile.org_id);
  const catalogText = JSON.stringify(catalog);

  // Add the catalog + label as a leading text block before the file/text
  claudeContent.unshift({
    type: "text",
    text: `Existing line-item catalog (use these ids for matched_line_item_id when confident):\n${catalogText}\n\nSource label: ${sourceLabel ?? "(none)"}\nVenue context: ${venueId ?? "(none — defaults are template-wide)"}`,
  });

  const anthropic = getAnthropic();
  let resp;
  try {
    resp = await anthropic.messages.create({
      model: DEFAULT_INTAKE_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tool_choice: { type: "tool", name: TOOL.name },
      tools: [TOOL],
      messages: [{ role: "user", content: claudeContent }],
    });
  } catch (err) {
    await supabase
      .from("pricing_intake_sources")
      .update({ status: "failed", error: (err as Error).message })
      .eq("id", source.id);
    return NextResponse.json(
      { error: `Claude error: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const toolBlock = resp.content.find((c) => c.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    await supabase
      .from("pricing_intake_sources")
      .update({ status: "failed", error: "no tool call" })
      .eq("id", source.id);
    return NextResponse.json({ error: "Claude returned no proposals" }, { status: 502 });
  }
  const out = toolBlock.input as { proposals: ProposalDTO[] };
  const proposals = out.proposals ?? [];

  const cost = estimateCost(resp.usage.input_tokens, resp.usage.output_tokens);

  // Persist proposals
  if (proposals.length > 0) {
    await supabase.from("pricing_intake_proposals").insert(
      proposals.map((p) => ({
        source_id: source.id,
        kind: p.kind,
        matched_line_item_id: p.matched_line_item_id ?? null,
        proposed_category: p.proposed_category ?? null,
        proposed_label: p.proposed_label ?? null,
        proposed_description: p.proposed_description ?? null,
        proposed_unit: p.proposed_unit ?? null,
        proposed_tier: p.proposed_tier ?? null,
        proposed_unit_price: p.proposed_unit_price ?? null,
        proposed_currency: p.proposed_currency ?? null,
        proposed_included: p.proposed_included ?? null,
        proposed_notes: p.proposed_notes ?? null,
        confidence: p.confidence,
        rationale: p.rationale,
        evidence: p.evidence as never,
        needs_info: p.needs_info ?? null,
      })),
    );
  }

  await supabase
    .from("pricing_intake_sources")
    .update({
      status: "extracted",
      model: DEFAULT_INTAKE_MODEL,
      claude_response: out as never,
      prompt_tokens: resp.usage.input_tokens,
      output_tokens: resp.usage.output_tokens,
      cost_usd: cost,
    })
    .eq("id", source.id);

  const preview: IntakePreview = {
    source_id: source.id,
    source_label: sourceLabel,
    status: "extracted",
    proposals,
    cost_usd: cost,
    claude_used: true,
    warning: proposals.length === 0 ? "Claude found no pricing in this source." : undefined,
  };
  return NextResponse.json(preview);
}
