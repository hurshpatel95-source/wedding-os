import { NextRequest, NextResponse } from "next/server";
import { format, parseISO } from "date-fns";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import {
  anthropicReady,
  getAnthropic,
  DEFAULT_CHAT_MODEL,
  estimateChatCost,
} from "@/lib/anthropic";
import { fetchEventSummaries } from "@/lib/data/events";
import { EVENT_ROLE_LABEL } from "@/lib/event-types";
import { currencySymbol, normalizeCurrency } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 30;

// Per-user daily message cap. Generous enough for active use, low enough
// that even all 7 family members maxed out is < $1.50/week at Haiku rates.
const DAILY_CAP = 30;
// Hard ceiling on output so a runaway response can't blow up the bill.
const MAX_OUTPUT_TOKENS = 700;
// Conversation memory — only the last N turns are sent. Older messages
// drop off, keeping context small + cache hits steady.
const CONVERSATION_MEMORY_TURNS = 12;

interface ChatRequest {
  conversation_id?: string;
  user_message: string;
}

const SYSTEM_PROMPT = `You are Acquired Planner Co-pilot — a private AI assistant for a couple planning their wedding.

Style:
- Warm but direct. Short answers (2-5 sentences) unless the user asks for depth.
- Cite the user's actual data when it's relevant — venue names, prices in the workspace's currency, scenario totals, vendor statuses, plan progress %, days-to-wedding, etc. The CONTEXT block below is the source of truth. All money amounts in CONTEXT are already pre-formatted with the workspace's currency symbol — quote them verbatim. (Internal field names may end in "_eur" for legacy reasons; ignore that suffix and trust the formatted amount + the workspace.base_currency value.)
- If the answer requires data that's not in CONTEXT, say so plainly ("I don't see [thing] yet — add it on /vendors and I can include it.").
- Never invent prices, dates, vendor names, or guest counts. If you don't know, say so.
- For comparisons (two scenarios you've saved, two venues you've added, etc.) give a structured pros/cons + a clear recommendation.
- For "what should we do this week?" type questions, pull from the planning checklist + plan progress + upcoming payments.
- Never apologize at length. Get to the answer.

Cite real workspace entries (not generic advice):
- When the user asks "what should I do?" / "what's left?" / "what's next?" / similar action-oriented questions, CITE ACTUAL TASK TITLES from upcoming_tasks. Don't invent generic advice like "build your timeline" or "finalize guest list" when the workspace has real task rows. If upcoming_tasks is empty, then say "no tasks queued — start by visiting /plan."
- Same rule applies for vendors: cite ACTUAL vendor names from the vendors array. Don't say "you should book a photographer" if a photographer is already in vendors (even if their status isn't "booked" yet — refer to them by name and say where they sit in the pipeline).
- Same for venues, scenarios, estimates, payments, guests: refer to specific rows by name.

App routes (use these when telling the user where to go):
- /                       — Dashboard
- /onboarding             — First-time AI intake chat
- /plan                   — Planning tasks
- /venues                 — Venue list (add, browse, decide)
- /vendors                — Vendor list + status pipeline
- /vendors/find           — AI-assisted vendor search
- /guests                 — Guest list (use ?event=<role> to filter)
- /guests/import          — Bulk Excel/CSV import
- /guests/seating         — Floor plans
- /budget                 — Budget tree (use ?group=event to group)
- /estimator              — Live forecast tab inside budget
- /spend                  — Actuals tab inside budget
- /payments               — Deposit + final balance calendar
- /timeline               — Day-of run sheet (use ?event=<role> to filter)
- /events                 — Multi-event hub (sangeet/ceremony/reception/etc.)
- /settings               — Settings hub (preferences, public site)
- /settings/preferences   — Wedding date, currency, names
- /settings/public-site   — URL slug, theme, story, schedule, FAQ
- /assistant              — This Co-pilot

When suggesting an action, point the user at the right route. If you can't do something directly (e.g., add an event, add a venue), explain how the user does it: "Go to /events to enable the sangeet — you can set the date and venue from there." Venues live at /venues (not /vendors); events live at /events. Don't guess.

Don't:
- Don't recommend vendors you don't see in their data.
- Don't promise to send emails or take actions — you're advisory only.
- Don't give generic wedding-blog advice. Some users have a human planner, some are self-planning — be neutral and use what the workspace data tells you.
- Don't moralize about budget or guest count.`;

interface WorkspaceContextSnapshot {
  workspace: {
    name: string | null;
    wedding_date: string | null;
    days_to_wedding: number | null;
    // Workspace's display currency. The internal "_eur" suffix on price
    // fields below is legacy — the actual value is stored in this currency.
    // Same pattern as /(app)/payments/page.tsx + /(app)/budget/page.tsx.
    base_currency: string;
    currency_symbol: string;
  };
  venues: Array<{
    name: string;
    status: string;
    capacity_min: number | null;
    capacity_max: number | null;
    is_lead_pick: boolean;
    event_roles: string[];
    // Money fields are stored in workspace.base_currency. The "_eur" suffix
    // is legacy; the formatted versions below are what to quote to users.
    hire_fee_weekend_eur: number | null;
    hire_fee_weekend_display: string | null;
    hire_fee_sunday_eur: number | null;
    hire_fee_sunday_display: string | null;
    hire_fee_weekday_eur: number | null;
    hire_fee_weekday_display: string | null;
    minimum_pax_weekend: number | null;
    minimum_pax_sunday: number | null;
  }>;
  scenarios: Array<{
    name: string;
    description: string;
    calculated_total_eur: number;
    calculated_total_display: string;
  }>;
  vendors: Array<{
    name: string;
    category: string;
    status: string;
    quoted_price_eur: number | null;
    quoted_price_display: string | null;
    deposit_amount_eur: number | null;
    deposit_amount_display: string | null;
    deposit_paid: boolean;
    final_balance_eur: number | null;
    final_balance_display: string | null;
    final_paid: boolean;
  }>;
  guests: {
    total: number;
    yes: number;
    maybe: number;
    no: number;
    pending: number;
  };
  plan_progress: {
    total: number;
    done: number;
    in_progress: number;
    blocked: number;
    pct_done: number;
  };
  // Recent / upcoming open tasks — names so Claude can answer "what's
  // next?" / "what's overdue?" specifically.
  upcoming_tasks: Array<{
    title: string;
    phase: string | null;
    status: string;
    due_at: string | null;
  }>;
  // Per-couple budget estimates from /estimator
  estimates: Array<{
    name: string;
    summary: string | null;
    baseline_total_eur: number | null;
    baseline_total_display: string | null;
  }>;
  // Upcoming + recent payment milestones
  payments: Array<{
    label: string;
    amount_eur: number | null;
    amount_display: string | null;
    due_at: string | null;
    paid_at: string | null;
  }>;
  // Decisions the planner has logged (final calls on venues)
  decisions: Array<{
    venue_name: string | null;
    kind: string;
    note: string | null;
    created_at: string;
  }>;
  // Open Q&A on venues
  open_questions: Array<{
    venue_name: string | null;
    question: string;
    status: string;
  }>;
  // Top sample of guests by name (for "is X coming?" type questions)
  guest_sample: Array<{
    name: string;
    side: string | null;
    rsvp: string;
  }>;
  // Move 5 — multi-event orchestration. One row per active event in
  // event_details (sangeet / ceremony / reception / etc.) with the
  // venue name, guest counts, timeline item count. Empty array when
  // event_details doesn't exist (pre-migration) OR when no active
  // events are set up — the system-prompt injector omits the section
  // entirely in that case so the model doesn't see noise.
  events_summary: Array<{
    event_role: string;
    display_name: string;
    date_label: string | null;
    venue_name: string | null;
    guests_invited: number;
    guests_yes: number;
    guests_no: number;
    guests_pending: number;
    timeline_items: number;
  }>;
}

async function buildContext(workspaceId: string): Promise<WorkspaceContextSnapshot> {
  const supabase = createClient();
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => Promise<{ data: Record<string, unknown>[] | null }> & {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ data: Record<string, unknown>[] | null }>;
      };
    };
  };

  const [
    { data: workspaceRow },
    { data: venues },
    { data: scenarios },
    { data: vendors },
    { data: guestsRow },
    { data: tasks },
    { data: estimates },
    { data: paymentsRow },
    { data: decisions },
    { data: questions },
  ] = await Promise.all([
    supabase
      .from("workspaces")
      .select("name, wedding_date, base_currency")
      .eq("id", workspaceId)
      .maybeSingle(),
    supabase
      .from("venues")
      .select(
        "id, name, status, capacity_min, capacity_max, is_lead_pick, event_roles, hire_fee_weekend_eur, hire_fee_sunday_eur, hire_fee_weekday_eur, minimum_pax_weekend, minimum_pax_sunday",
      )
      .eq("workspace_id", workspaceId),
    supabase
      .from("pricing_scenarios")
      .select("name, inputs, calculated_total")
      .eq("workspace_id", workspaceId),
    sb
      .from("vendors")
      .select(
        "id, name, category, status, quoted_price_eur, deposit_amount_eur, deposit_due_at, deposit_paid_at, final_balance_eur, final_due_at, final_paid_at",
      )
      .eq("workspace_id", workspaceId),
    supabase
      .from("guests")
      .select("full_name, side, overall_rsvp")
      .eq("workspace_id", workspaceId),
    supabase
      .from("planning_tasks")
      .select("title, phase, status, due_date")
      .eq("workspace_id", workspaceId),
    sb
      .from("budget_estimates")
      .select("name, scenario_summary, baseline_total_eur")
      .eq("workspace_id", workspaceId),
    sb
      .from("vendors")
      .select(
        "name, deposit_amount_eur, deposit_due_at, deposit_paid_at, final_balance_eur, final_due_at, final_paid_at",
      )
      .eq("workspace_id", workspaceId),
    sb
      .from("venue_decisions")
      .select("venue_id, kind, note, created_at")
      .eq("workspace_id", workspaceId),
    sb
      .from("venue_questions")
      .select("venue_id, question, status")
      .eq("workspace_id", workspaceId),
  ]);

  const weddingDate = (workspaceRow as { wedding_date: string | null } | null)?.wedding_date ?? null;
  const daysTo = weddingDate
    ? Math.ceil((new Date(weddingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // Currency-neutral money formatting. The DB columns still end in
  // "_eur" (legacy) but the stored value is in workspace.base_currency.
  // We surface a `*_display` string alongside each raw number so the
  // model can quote money verbatim without guessing the symbol.
  const baseCurrency = normalizeCurrency(
    (workspaceRow as { base_currency: string | null } | null)?.base_currency,
  );
  const sym = currencySymbol(baseCurrency);
  const fmtMoney = (n: number | null | undefined): string | null =>
    n == null ? null : `${sym}${Number(n).toLocaleString("en-US")}`;

  const guestList = (guestsRow ?? []) as Array<{ overall_rsvp: string }>;
  const guestCounts = {
    total: guestList.length,
    yes: guestList.filter((g) => g.overall_rsvp === "yes").length,
    maybe: guestList.filter((g) => g.overall_rsvp === "maybe").length,
    no: guestList.filter((g) => g.overall_rsvp === "no").length,
    pending: guestList.filter((g) => g.overall_rsvp === "pending").length,
  };

  const taskList = (tasks ?? []) as unknown as Array<{ status: string }>;
  const planTotal = taskList.length;
  const planDone = taskList.filter((t) => t.status === "done").length;
  const planInProgress = taskList.filter((t) => t.status === "in_progress").length;
  const planBlocked = taskList.filter((t) => t.status === "blocked").length;

  // ── Move 5: per-event summary ─────────────────────────────────────
  // fetchEventSummaries is tolerant of event_details not existing yet
  // (returns [] in that case). We also map venue_id → venue name from
  // the venues list we already pulled above, so we don't double-fetch.
  let eventsSummary: WorkspaceContextSnapshot["events_summary"] = [];
  try {
    const summaries = await fetchEventSummaries(supabase, workspaceId);
    const venueRows = (venues ?? []) as Array<{ id: string; name: string }>;
    eventsSummary = summaries.map((s) => {
      const display =
        s.detail?.display_name?.trim() || EVENT_ROLE_LABEL[s.event_role];
      let dateLabel: string | null = null;
      if (s.detail?.start_at) {
        try {
          dateLabel = format(parseISO(s.detail.start_at), "EEEE, MMMM d");
        } catch {
          dateLabel = null;
        }
      }
      const venue = s.detail?.venue_id
        ? venueRows.find((v) => v.id === s.detail!.venue_id) ?? null
        : null;
      const responded = s.guests_responded;
      const yes = s.guests_yes;
      const no = Math.max(0, responded - yes);
      const pending = Math.max(0, s.guests_invited - responded);
      return {
        event_role: s.event_role,
        display_name: display,
        date_label: dateLabel,
        venue_name: venue?.name ?? null,
        guests_invited: s.guests_invited,
        guests_yes: yes,
        guests_no: no,
        guests_pending: pending,
        timeline_items: s.timeline_items,
      };
    });
  } catch {
    eventsSummary = [];
  }

  return {
    workspace: {
      name: (workspaceRow as { name: string | null } | null)?.name ?? null,
      wedding_date: weddingDate,
      days_to_wedding: daysTo,
      base_currency: baseCurrency,
      currency_symbol: sym,
    },
    venues: ((venues ?? []) as Array<Record<string, unknown>>).map((v) => ({
      name: String(v.name),
      status: String(v.status),
      capacity_min: (v.capacity_min as number | null) ?? null,
      capacity_max: (v.capacity_max as number | null) ?? null,
      is_lead_pick: Boolean(v.is_lead_pick),
      event_roles: (v.event_roles as string[]) ?? [],
      hire_fee_weekend_eur: (v.hire_fee_weekend_eur as number | null) ?? null,
      hire_fee_weekend_display: fmtMoney(v.hire_fee_weekend_eur as number | null),
      hire_fee_sunday_eur: (v.hire_fee_sunday_eur as number | null) ?? null,
      hire_fee_sunday_display: fmtMoney(v.hire_fee_sunday_eur as number | null),
      hire_fee_weekday_eur: (v.hire_fee_weekday_eur as number | null) ?? null,
      hire_fee_weekday_display: fmtMoney(v.hire_fee_weekday_eur as number | null),
      minimum_pax_weekend: (v.minimum_pax_weekend as number | null) ?? null,
      minimum_pax_sunday: (v.minimum_pax_sunday as number | null) ?? null,
    })),
    scenarios: ((scenarios ?? []) as Array<Record<string, unknown>>).map((s) => {
      const total = Number(s.calculated_total ?? 0);
      return {
        name: String(s.name),
        description: String((s.inputs as { description?: string })?.description ?? ""),
        calculated_total_eur: total,
        calculated_total_display: `${sym}${total.toLocaleString("en-US")}`,
      };
    }),
    vendors: ((vendors ?? []) as Array<Record<string, unknown>>).map((v) => ({
      name: String(v.name),
      category: String(v.category),
      status: String(v.status),
      quoted_price_eur: (v.quoted_price_eur as number | null) ?? null,
      quoted_price_display: fmtMoney(v.quoted_price_eur as number | null),
      deposit_amount_eur: (v.deposit_amount_eur as number | null) ?? null,
      deposit_amount_display: fmtMoney(v.deposit_amount_eur as number | null),
      deposit_paid: Boolean(v.deposit_paid_at),
      final_balance_eur: (v.final_balance_eur as number | null) ?? null,
      final_balance_display: fmtMoney(v.final_balance_eur as number | null),
      final_paid: Boolean(v.final_paid_at),
    })),
    guests: guestCounts,
    plan_progress: {
      total: planTotal,
      done: planDone,
      in_progress: planInProgress,
      blocked: planBlocked,
      pct_done: planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0,
    },
    upcoming_tasks: ((tasks ?? []) as unknown as Array<Record<string, unknown>>)
      .filter((t) => t.status !== "done")
      .map((t) => ({
        title: String(t.title ?? ""),
        phase: (t.phase as string | null) ?? null,
        status: String(t.status ?? "not_started"),
        due_at: (t.due_date as string | null) ?? null,
      }))
      .slice(0, 30),
    estimates: ((estimates ?? []) as Array<Record<string, unknown>>).map((e) => ({
      name: String(e.name ?? ""),
      summary: (e.scenario_summary as string | null) ?? null,
      baseline_total_eur: (e.baseline_total_eur as number | null) ?? null,
      baseline_total_display: fmtMoney(e.baseline_total_eur as number | null),
    })),
    payments: ((paymentsRow ?? []) as Array<Record<string, unknown>>).flatMap(
      (v) => {
        const out: Array<{
          label: string;
          amount_eur: number | null;
          amount_display: string | null;
          due_at: string | null;
          paid_at: string | null;
        }> = [];
        if (v.deposit_amount_eur != null) {
          const amt = (v.deposit_amount_eur as number | null) ?? null;
          out.push({
            label: `${String(v.name)} — deposit`,
            amount_eur: amt,
            amount_display: fmtMoney(amt),
            due_at: (v.deposit_due_at as string | null) ?? null,
            paid_at: (v.deposit_paid_at as string | null) ?? null,
          });
        }
        if (v.final_balance_eur != null) {
          const amt = (v.final_balance_eur as number | null) ?? null;
          out.push({
            label: `${String(v.name)} — final balance`,
            amount_eur: amt,
            amount_display: fmtMoney(amt),
            due_at: (v.final_due_at as string | null) ?? null,
            paid_at: (v.final_paid_at as string | null) ?? null,
          });
        }
        return out;
      },
    ),
    decisions: ((decisions ?? []) as Array<Record<string, unknown>>).map((d) => {
      const venue = (
        (venues ?? []) as Array<{ id: string; name: string }>
      ).find((v) => v.id === d.venue_id);
      return {
        venue_name: venue?.name ?? null,
        kind: String(d.kind ?? ""),
        note: (d.note as string | null) ?? null,
        created_at: String(d.created_at ?? ""),
      };
    }),
    open_questions: ((questions ?? []) as Array<Record<string, unknown>>)
      .filter((q) => q.status === "open")
      .map((q) => {
        const venue = (
          (venues ?? []) as Array<{ id: string; name: string }>
        ).find((v) => v.id === q.venue_id);
        return {
          venue_name: venue?.name ?? null,
          question: String(q.question ?? ""),
          status: String(q.status ?? ""),
        };
      })
      .slice(0, 25),
    guest_sample: guestList.slice(0, 40).map((g) => ({
      name: String((g as unknown as { full_name?: string }).full_name ?? ""),
      side:
        ((g as unknown as { side?: string | null }).side as string | null) ??
        null,
      rsvp: g.overall_rsvp,
    })),
    events_summary: eventsSummary,
  };
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
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id) {
    return NextResponse.json({ error: "no workspace" }, { status: 403 });
  }

  // Daily cap check
  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await supabase
    .from("ai_usage_daily")
    .select("message_count, total_cost_usd")
    .eq("user_id", user.id)
    .eq("workspace_id", profile.workspace_id)
    .eq("day", today)
    .maybeSingle();
  if (usage && usage.message_count >= DAILY_CAP) {
    return NextResponse.json(
      {
        error: `Daily message cap (${DAILY_CAP}) reached. Resets at midnight.`,
        cap: DAILY_CAP,
        used: usage.message_count,
      },
      { status: 429 },
    );
  }

  const body = (await request.json()) as ChatRequest;
  if (!body.user_message?.trim()) {
    return NextResponse.json({ error: "missing user_message" }, { status: 400 });
  }

  // Conversation: load existing or create
  let conversationId = body.conversation_id;
  if (!conversationId) {
    const { data: created, error: convErr } = await supabase
      .from("ai_conversations")
      .insert({
        workspace_id: profile.workspace_id,
        user_id: user.id,
        title: body.user_message.slice(0, 80),
      })
      .select("id")
      .single();
    if (convErr || !created) {
      return NextResponse.json(
        { error: `Couldn't start conversation: ${convErr?.message}` },
        { status: 500 },
      );
    }
    conversationId = created.id;
  }

  // Load prior messages (most recent N)
  const { data: prior } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(CONVERSATION_MEMORY_TURNS * 2);

  const priorRows = (prior ?? []).reverse();

  // Insert the user message immediately so it's persisted even if Claude fails
  await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: body.user_message,
  });

  // Build the context snapshot — cached per-conversation
  const context = await buildContext(profile.workspace_id);
  const contextJson = JSON.stringify(context, null, 2);

  // Move 5 — multi-event prelude. If the workspace has active events
  // we build a human-readable summary section so Claude treats the
  // wedding as a multi-event whole, not a single ceremony. Omitted
  // entirely (no injection) when events_summary is empty — pre-
  // migration state OR a fresh workspace with no events set up — so
  // the model doesn't see confusing empty bullets.
  let eventsPrelude = "";
  if (context.events_summary.length > 0) {
    const bullets = context.events_summary
      .map((e) => {
        const parts: string[] = [];
        if (e.date_label) parts.push(e.date_label);
        if (e.venue_name) parts.push(`at ${e.venue_name}`);
        parts.push(`${e.guests_invited} invited`);
        parts.push(`${e.guests_yes} yes`);
        parts.push(
          `${e.timeline_items} timeline item${e.timeline_items === 1 ? "" : "s"}`,
        );
        return `- ${e.display_name}: ${parts.join(" — ")}`;
      })
      .join("\n");
    eventsPrelude = `The user's wedding has the following events:\n${bullets}\n\nWhen the user asks about "the wedding" without specifying an event, default to the ceremony unless context clearly suggests otherwise. When the user asks about specific events, scope your answers to that event's data.`;
  }

  const currencyPrelude = `The user's workspace currency is ${context.workspace.base_currency} (symbol "${context.workspace.currency_symbol}"). All money values in CONTEXT have a *_display string pre-formatted with this symbol — quote those verbatim. Do NOT say "EUR" unless workspace.base_currency is "EUR". Do NOT say "USD" unless workspace.base_currency is "USD".`;

  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: SYSTEM_PROMPT },
    { type: "text", text: currencyPrelude },
    ...(eventsPrelude
      ? [{ type: "text" as const, text: eventsPrelude }]
      : []),
    {
      type: "text",
      text: `CONTEXT (live workspace data — re-read from DB this turn):\n\n${contextJson}`,
      // Cache the context block so subsequent turns within ~5 min hit the cache
      // at 10% the input cost.
      cache_control: { type: "ephemeral" },
    },
  ];

  const messages: Anthropic.MessageParam[] = [
    ...priorRows.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: body.user_message },
  ];

  const anthropic = getAnthropic();
  let resp;
  try {
    resp = await anthropic.messages.create({
      model: DEFAULT_CHAT_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: systemBlocks,
      messages,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Claude error: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const textBlock = resp.content.find((c) => c.type === "text");
  const replyText = textBlock && textBlock.type === "text" ? textBlock.text : "";

  const cost = estimateChatCost({
    input_tokens: resp.usage.input_tokens,
    output_tokens: resp.usage.output_tokens,
    cache_read_input_tokens: resp.usage.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: resp.usage.cache_creation_input_tokens ?? 0,
  });

  // Persist assistant message
  await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: replyText,
    model: DEFAULT_CHAT_MODEL,
    input_tokens: resp.usage.input_tokens,
    output_tokens: resp.usage.output_tokens,
    cache_read_tokens: resp.usage.cache_read_input_tokens ?? 0,
    cache_creation_tokens: resp.usage.cache_creation_input_tokens ?? 0,
    cost_usd: cost,
  });

  // Update daily usage roll-up (upsert)
  const newCount = (usage?.message_count ?? 0) + 1;
  const newCost = Number(usage?.total_cost_usd ?? 0) + cost;
  await supabase.from("ai_usage_daily").upsert({
    workspace_id: profile.workspace_id,
    user_id: user.id,
    day: today,
    message_count: newCount,
    total_cost_usd: newCost,
  });

  return NextResponse.json({
    conversation_id: conversationId,
    reply: replyText,
    usage: {
      input_tokens: resp.usage.input_tokens,
      output_tokens: resp.usage.output_tokens,
      cache_read_input_tokens: resp.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: resp.usage.cache_creation_input_tokens ?? 0,
      cost_usd: cost,
    },
    daily: {
      used: newCount,
      cap: DAILY_CAP,
      cost_usd_today: newCost,
    },
  });
}

// GET — fetch full conversation thread (for the UI to load)
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const conversationId = new URL(request.url).searchParams.get("conversation_id");
  if (!conversationId) return NextResponse.json({ messages: [] });

  const { data: messages } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ messages: messages ?? [] });
}
