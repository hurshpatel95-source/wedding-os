import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import {
  anthropicReady,
  getAnthropic,
  DEFAULT_INTAKE_MODEL,
} from "@/lib/anthropic";
import { EVENT_ROLES } from "@/lib/event-roles";
import type { LibraryVenueBrochureExtraction } from "@/lib/library-venue-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You extract wedding-venue facts from a brochure / website screenshot / PDF for a wedding planner's internal library.

Rules:
- Only extract what is explicitly stated. If the brochure doesn't mention seated capacity, return null — do not guess.
- 'hire_fee_eur' is the headline hire fee in EUR. If multiple rates exist (Sat/Sun/weekday) or it's quoted in another currency, leave 'hire_fee_eur' null and put the full pricing summary in 'hire_fee_notes'.
- 'event_roles' must use values from this enum: ${EVENT_ROLES.join(", ")}. Pick all that apply (e.g. an estate that hosts ceremonies + receptions returns ["ceremony","reception","wedding"]).
- 'description' is a 1-2 sentence summary suitable for couples to read — neutral and factual.
- 'confidence' (0-1) reflects how clearly the source documented these fields. ≥0.8 means the brochure was explicit. <0.5 means most fields are guesses or absent.
- 'notes' is a short freeform string flagging anything the planner should review (e.g. "Hire fee was in GBP — converted at €/£ rate of the day").`;

const TOOL: Anthropic.Tool = {
  name: "emit_venue_facts",
  description:
    "Emit structured venue facts extracted from the brochure for human review.",
  input_schema: {
    type: "object",
    required: ["confidence"],
    properties: {
      name: { type: ["string", "null"] },
      city: { type: ["string", "null"] },
      region: { type: ["string", "null"] },
      country: { type: ["string", "null"] },
      capacity_seated: { type: ["integer", "null"] },
      capacity_standing: { type: ["integer", "null"] },
      hire_fee_eur: { type: ["number", "null"] },
      hire_fee_notes: { type: ["string", "null"] },
      description: { type: ["string", "null"] },
      event_roles: {
        type: "array",
        items: { enum: EVENT_ROLES },
      },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      notes: { type: ["string", "null"] },
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
    .select("org_role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.org_role !== "org_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "expected multipart/form-data" },
      { status: 400 },
    );
  }

  const fd = await request.formData();
  const file = fd.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  const ab = await file.arrayBuffer();
  const buf = Buffer.from(ab);
  const mime = file.type;
  const isPdf = mime === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  const claudeContent: Anthropic.MessageParam["content"] = [];
  if (isPdf) {
    claudeContent.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: buf.toString("base64"),
      },
    } as Anthropic.DocumentBlockParam);
  } else {
    claudeContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type:
          (mime as Anthropic.Base64ImageSource["media_type"]) ?? "image/jpeg",
        data: buf.toString("base64"),
      },
    });
  }
  claudeContent.push({
    type: "text",
    text: "Extract the facts you can see. Use the emit_venue_facts tool.",
  });

  const anthropic = getAnthropic();
  let resp;
  try {
    resp = await anthropic.messages.create({
      model: DEFAULT_INTAKE_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tool_choice: { type: "tool", name: TOOL.name },
      tools: [TOOL],
      messages: [{ role: "user", content: claudeContent }],
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Claude error: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const toolBlock = resp.content.find((c) => c.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    return NextResponse.json(
      { error: "Claude returned no extraction" },
      { status: 502 },
    );
  }

  const out = toolBlock.input as Partial<LibraryVenueBrochureExtraction>;

  const extraction: LibraryVenueBrochureExtraction = {
    name: out.name ?? null,
    city: out.city ?? null,
    region: out.region ?? null,
    country: out.country ?? null,
    capacity_seated: out.capacity_seated ?? null,
    capacity_standing: out.capacity_standing ?? null,
    hire_fee_eur: out.hire_fee_eur ?? null,
    hire_fee_notes: out.hire_fee_notes ?? null,
    description: out.description ?? null,
    event_roles: out.event_roles ?? [],
    confidence: typeof out.confidence === "number" ? out.confidence : 0,
    notes: out.notes ?? null,
  };

  return NextResponse.json({
    extraction,
    input_tokens: resp.usage?.input_tokens ?? 0,
    output_tokens: resp.usage?.output_tokens ?? 0,
  });
}
