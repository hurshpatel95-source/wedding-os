import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { anthropicReady, getAnthropic, DEFAULT_INTAKE_MODEL } from "@/lib/anthropic";
import { EMAIL_TEMPLATES, type EmailKind } from "@/lib/email-templates";

export const runtime = "nodejs";
export const maxDuration = 60;

interface DraftRequest {
  kind: EmailKind;
  // One of these must be present depending on the template's context_kind:
  vendor_id?: string;
  guest_id?: string;
  guest_filter?: {
    side?: "groom" | "bride" | "both";
    rsvp?: "pending" | "yes" | "no" | "maybe";
  };
  // Freeform user note (always allowed, layered into the prompt)
  user_brief?: string;
}

const DRAFT_TOOL: Anthropic.Tool = {
  name: "emit_email_draft",
  description:
    "Emit a finished email draft. The user will copy this into their mail client.",
  input_schema: {
    type: "object",
    required: ["subject", "body"],
    properties: {
      subject: {
        type: "string",
        description: "Concise subject line — specific, not generic.",
      },
      body: {
        type: "string",
        description: "Full email body, including greeting and sign-off.",
      },
      to_suggestion: {
        type: "string",
        description: "Suggested recipient(s) when known (vendor email, or 'family@example.com').",
      },
      reply_by: {
        type: "string",
        description: "ISO date if a specific reply-by makes sense, otherwise omit.",
      },
    },
  },
};

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("role, workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "no profile" }, { status: 403 });

  if (!anthropicReady) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on the server. Add it in Railway → Variables." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as DraftRequest;
  const template = EMAIL_TEMPLATES[body.kind];
  if (!template) {
    return NextResponse.json({ error: `unknown email kind: ${body.kind}` }, { status: 400 });
  }

  // Build context — this is the meat of the prompt. We pull workspace + the
  // specific entity so Claude can reference real names, dates, prices.
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name, wedding_date, base_currency")
    .limit(1)
    .maybeSingle();

  const contextParts: string[] = [];
  if (workspace) {
    contextParts.push(
      `Workspace: ${workspace.name}${workspace.wedding_date ? ` · wedding date ${workspace.wedding_date}` : ""}`,
    );
  }

  if (template.context_kind === "vendor" && body.vendor_id) {
    // vendors table is not yet in generated Database types — cast for one read.
    const sb = supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
          };
        };
      };
    };
    const { data: vendor } = await sb
      .from("vendors")
      .select(
        "name, category, status, contact_name, contact_email, quoted_price_eur, deposit_amount_eur, deposit_due_at, final_balance_eur, final_due_at, notes",
      )
      .eq("id", body.vendor_id)
      .maybeSingle();
    if (vendor) {
      contextParts.push(
        `Vendor: ${vendor.name} (${vendor.category}) — ${vendor.status}`,
      );
      if (vendor.contact_name) contextParts.push(`Contact: ${vendor.contact_name}`);
      if (vendor.contact_email) contextParts.push(`Email: ${vendor.contact_email}`);
      if (vendor.quoted_price_eur)
        contextParts.push(`Quoted: €${vendor.quoted_price_eur}`);
      if (vendor.deposit_amount_eur)
        contextParts.push(
          `Deposit: €${vendor.deposit_amount_eur} due ${vendor.deposit_due_at ?? "?"}`,
        );
      if (vendor.final_balance_eur)
        contextParts.push(
          `Final balance: €${vendor.final_balance_eur} due ${vendor.final_due_at ?? "?"}`,
        );
      if (vendor.notes) contextParts.push(`Notes: ${vendor.notes}`);
    }
  } else if (template.context_kind === "guest" && body.guest_id) {
    const { data: guest } = await supabase
      .from("guests")
      .select("full_name, email, side, relationship, dietary, overall_rsvp")
      .eq("id", body.guest_id)
      .maybeSingle();
    if (guest) {
      contextParts.push(
        `Guest: ${guest.full_name}${guest.relationship ? ` (${guest.relationship})` : ""} — RSVP ${guest.overall_rsvp}`,
      );
      if (guest.email) contextParts.push(`Email: ${guest.email}`);
      if (guest.side) contextParts.push(`Side: ${guest.side}`);
      if (guest.dietary) contextParts.push(`Dietary: ${guest.dietary}`);
    }
  } else if (template.context_kind === "guest_filter" && body.guest_filter) {
    const f = body.guest_filter;
    let q = supabase
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", profile.workspace_id);
    if (f.side) q = q.eq("side", f.side);
    if (f.rsvp) q = q.eq("overall_rsvp", f.rsvp);
    const { count } = await q;
    const filterDesc = [
      f.side && `side=${f.side}`,
      f.rsvp && `RSVP=${f.rsvp}`,
    ]
      .filter(Boolean)
      .join(", ");
    contextParts.push(
      `Audience: ${count ?? "unknown number of"} guests${filterDesc ? ` matching {${filterDesc}}` : ""}`,
    );
  }

  if (body.user_brief) contextParts.push(`Planner brief: ${body.user_brief}`);

  const userMessage = [
    `Email kind: ${template.label}`,
    `Description: ${template.description}`,
    "",
    "Context:",
    ...contextParts.map((p) => `- ${p}`),
    "",
    "Write the email now. Use the emit_email_draft tool.",
  ].join("\n");

  const anthropic = getAnthropic();
  const resp = await anthropic.messages.create({
    model: DEFAULT_INTAKE_MODEL,
    max_tokens: 1500,
    system: template.system,
    tool_choice: { type: "tool", name: DRAFT_TOOL.name },
    tools: [DRAFT_TOOL],
    messages: [{ role: "user", content: userMessage }],
  });

  const toolBlock = resp.content.find((c) => c.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    return NextResponse.json({ error: "Claude did not return a draft" }, { status: 500 });
  }

  const draft = toolBlock.input as {
    subject: string;
    body: string;
    to_suggestion?: string;
    reply_by?: string;
  };

  return NextResponse.json({
    kind: body.kind,
    subject: draft.subject,
    body: draft.body,
    to_suggestion: draft.to_suggestion,
    reply_by: draft.reply_by,
    input_tokens: resp.usage?.input_tokens ?? 0,
    output_tokens: resp.usage?.output_tokens ?? 0,
  });
}
