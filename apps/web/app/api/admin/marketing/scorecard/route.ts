// POST /api/admin/marketing/scorecard
//
// Fetch the planner's website, parse SEO signals, ask Claude Sonnet to
// write a prioritized fix list, persist a marketing_scorecards row.
//
// Cost: ~$0.05 per scorecard (Sonnet, ~3k input tokens + 800 output).
// Counts against the org's NON_CHAT_DAILY_BUDGET_USD ($5/day).

import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import {
  anthropicReady,
  getAnthropic,
  DEFAULT_INTAKE_MODEL,
  estimateCost,
} from "@/lib/anthropic";
import {
  assertNonChatAiQuota,
  recordNonChatAiCall,
} from "@/lib/ai-quota";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ScorecardBody {
  url: string;
}

const SCORECARD_TOOL: Anthropic.Tool = {
  name: "emit_scorecard",
  description:
    "Emit a structured marketing/SEO scorecard for a wedding-planner website.",
  input_schema: {
    type: "object",
    required: ["scorecard_md", "recommendations"],
    properties: {
      scorecard_md: {
        type: "string",
        description:
          "A 200-400 word Markdown report on the page — strengths, weaknesses, what couples will think when they land here. Be specific, not generic.",
      },
      recommendations: {
        type: "array",
        description:
          "Top 3-5 prioritized fixes, ordered by likely impact on lead conversion.",
        items: {
          type: "object",
          required: ["title", "detail", "effort"],
          properties: {
            title: { type: "string", description: "Short imperative phrase, e.g. 'Add a phone number to the header'." },
            detail: { type: "string", description: "Why this matters and what to do specifically." },
            effort: {
              type: "string",
              enum: ["low", "medium", "high"],
              description: "low = under 30 min copy edit, medium = an afternoon, high = redesign / dev work",
            },
          },
        },
      },
    },
  },
};

interface ParsedPage {
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  wordCount: number;
  hasCta: boolean;
  hasContactInfo: boolean;
  hasSchemaOrg: boolean;
  textExcerpt: string;
}

function parsePage(html: string): ParsedPage {
  // Lightweight regex-based extraction. Not a full HTML parser, but
  // sufficient signal for the agent.
  const title =
    /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? null;
  const metaDescription =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i.exec(html)?.[1] ??
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description/i.exec(html)?.[1] ??
    null;

  const h1Matches = html.match(/<h1\b/gi);
  const h1Count = h1Matches?.length ?? 0;

  // Strip tags + scripts/styles for word count + excerpt
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = stripped.split(/\s+/).filter(Boolean).length;
  const textExcerpt = stripped.slice(0, 4000);

  const ctaWords =
    /(book\s+(a\s+)?(call|consult|consultation|now)|schedule\s+(a\s+)?(call|consult)|contact\s+us|inquire|get\s+in\s+touch|reach\s+out|let'?s\s+talk)/i;
  const hasCta = ctaWords.test(stripped);

  const hasContactInfo =
    /\+?\d[\d\s().-]{6,}/.test(stripped) ||
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(stripped);

  const hasSchemaOrg =
    /application\/ld\+json/i.test(html) || /itemtype=["']https?:\/\/schema\.org/i.test(html);

  return {
    title,
    metaDescription,
    h1Count,
    wordCount,
    hasCta,
    hasContactInfo,
    hasSchemaOrg,
    textExcerpt,
  };
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profileSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { org_role?: string | null; org_id?: string | null } | null;
          }>;
        };
      };
    };
  };
  const { data: profile } = await profileSb
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.org_id || profile.org_role !== "org_admin") {
    return NextResponse.json({ error: "org admin only" }, { status: 403 });
  }

  // Cost guard
  const overBudget = await assertNonChatAiQuota(supabase, profile.org_id);
  if (overBudget) {
    return NextResponse.json({ error: overBudget }, { status: 429 });
  }

  if (!anthropicReady) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on the server." },
      { status: 503 },
    );
  }

  let body: ScorecardBody;
  try {
    body = (await request.json()) as ScorecardBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const url = (body.url ?? "").trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "http/https only" }, { status: 400 });
  }

  // Fetch the page (with timeout + size cap)
  let html = "";
  let pageSpeed: number | null = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const t0 = Date.now();
    const res = await fetch(parsed.toString(), {
      headers: {
        "user-agent":
          "wedding-os-marketing-bot/1.0 (+https://wedding-os.com/bot)",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    pageSpeed = (Date.now() - t0) / 1000;
    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch returned ${res.status}` },
        { status: 502 },
      );
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Page too large (>5MB)" },
        { status: 413 },
      );
    }
    html = new TextDecoder().decode(buf);
  } catch (err) {
    return NextResponse.json(
      { error: `Fetch failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const page = parsePage(html);

  // Ask Claude
  const anthropic = getAnthropic();
  const userMessage = `URL: ${parsed.toString()}

Title: ${page.title ?? "(none)"}
Meta description: ${page.metaDescription ?? "(none)"}
H1 count: ${page.h1Count}
Word count: ${page.wordCount}
Has clear call-to-action: ${page.hasCta ? "yes" : "no"}
Has contact info on page: ${page.hasContactInfo ? "yes" : "no"}
Has schema.org structured data: ${page.hasSchemaOrg ? "yes" : "no"}
Page load: ${pageSpeed?.toFixed(2)}s

Visible text excerpt (first 4000 chars):
${page.textExcerpt}

Audit this wedding planner's website. Focus on what's costing them couple inquiries. Be specific — name the actual phrase, the actual section, the actual missing piece. Don't be generic.`;

  const message = await anthropic.messages.create({
    model: DEFAULT_INTAKE_MODEL,
    max_tokens: 1500,
    tools: [SCORECARD_TOOL],
    tool_choice: { type: "tool", name: "emit_scorecard" },
    system: [
      "You are a senior conversion-focused SEO + marketing consultant for high-end wedding planners.",
      "Audit the page from the perspective of a couple who just landed there from Google or Instagram.",
      "Always emit the emit_scorecard tool. Never give generic advice — name the actual problem on this specific page.",
      "Tone: confident, warm, no jargon. Output as if you were sending the planner a personal note.",
    ].join("\n"),
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json(
      { error: "Claude didn't emit a scorecard" },
      { status: 502 },
    );
  }
  const input = toolUse.input as {
    scorecard_md?: string;
    recommendations?: Array<{ title: string; detail: string; effort: string }>;
  };

  const cost = estimateCost(
    message.usage.input_tokens,
    message.usage.output_tokens,
  );

  await recordNonChatAiCall(supabase, profile.org_id, null, cost);

  // Persist the row
  const insertRow = {
    org_id: profile.org_id,
    url: parsed.toString(),
    title_text: page.title,
    meta_description: page.metaDescription,
    h1_count: page.h1Count,
    word_count: page.wordCount,
    has_call_to_action: page.hasCta,
    has_contact_info: page.hasContactInfo,
    has_schema_org: page.hasSchemaOrg,
    page_speed_seconds: pageSpeed,
    scorecard_md: input.scorecard_md ?? null,
    recommendations: input.recommendations ?? [],
    raw_excerpt: page.textExcerpt,
  };

  const { error: insErr } = await (
    supabase as unknown as {
      from: (t: string) => {
        insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .from("marketing_scorecards")
    .insert(insertRow);
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    cost_usd: cost,
    page,
    scorecard_md: input.scorecard_md,
    recommendations: input.recommendations,
  });
}
