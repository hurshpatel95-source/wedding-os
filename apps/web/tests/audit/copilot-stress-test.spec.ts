// Move 1 — Co-pilot answer-quality stress test (2026-05-13)
//
// One-off audit script. NOT part of the smoke suite — kept in
// tests/audit/ so playwright.config.ts (testDir: tests/smoke) skips it
// during normal runs. Invoked explicitly via:
//
//   npx playwright test tests/audit/copilot-stress-test.spec.ts \
//     --config=playwright.config.ts --workers=1
//
// What it does:
// 1. Signs in to prod as b2c-rodnj.
// 2. For each of the 10 audit questions, creates a fresh conversation
//    (POST /api/ai/chat with conversation_id=null) so questions don't
//    poison each other's context.
// 3. Captures the verbatim reply + token usage + cost.
// 4. Writes the run to /tmp/copilot-audit-rodnj.json for the audit doc.

import { test, expect } from "@playwright/test";
import { signInAs } from "../smoke/auth";
import * as fs from "fs";
import * as path from "path";

const QUESTIONS = [
  "What should I do this week?",
  "Who's our photographer?",
  "How are we tracking vs our budget?",
  "Which vendors do we still need to book?",
  "Compare our two venues",
  "How many guests have RSVP'd yes?",
  "What's the next deposit due?",
  "Add a sangeet on Friday Sept 11 at Casa Del Mar",
  "I think we should switch venues. Help me think through it.",
  "Is this app actually going to help me plan my wedding or am I wasting my time?",
];

interface Turn {
  q_index: number;
  question: string;
  reply: string;
  conversation_id: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  cost_usd: number;
  daily_used: number;
  cost_usd_today: number;
  http_status: number;
  error?: string;
}

test("co-pilot stress test (b2c-rodnj, 10 questions)", async ({ page, request }) => {
  test.setTimeout(15 * 60 * 1000); // 15min — 10 sequential AI calls

  await signInAs(page, "b2c-rodnj");
  // After signInAs we have a session cookie. page.request reuses
  // the page's cookies, so calls to /api/ai/chat are authenticated.

  const turns: Turn[] = [];
  let totalCost = 0;

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    console.log(`\n--- Q${i + 1}: ${q}`);

    const res = await page.request.post("/api/ai/chat", {
      headers: { "content-type": "application/json" },
      // conversation_id intentionally omitted → server creates a fresh
      // conversation each turn, so no carry-over between questions.
      data: { user_message: q },
      timeout: 60_000,
    });

    const status = res.status();
    let body: Record<string, unknown> = {};
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      // empty
    }

    if (status !== 200) {
      console.log(`!! HTTP ${status}`, body);
      turns.push({
        q_index: i + 1,
        question: q,
        reply: "",
        conversation_id: "",
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        cost_usd: 0,
        daily_used: 0,
        cost_usd_today: 0,
        http_status: status,
        error: typeof body.error === "string" ? body.error : `HTTP ${status}`,
      });
      // Break on cap or auth failure — no point continuing
      if (status === 429 || status === 401) break;
      continue;
    }

    const usage = (body.usage ?? {}) as Record<string, number>;
    const daily = (body.daily ?? {}) as Record<string, number>;
    const reply = String(body.reply ?? "");
    const convId = String(body.conversation_id ?? "");
    totalCost += Number(usage.cost_usd ?? 0);

    console.log(`>> ${reply.length} chars · $${usage.cost_usd?.toFixed(4)} · cumulative $${totalCost.toFixed(4)}`);
    console.log(reply.slice(0, 200));

    turns.push({
      q_index: i + 1,
      question: q,
      reply,
      conversation_id: convId,
      input_tokens: Number(usage.input_tokens ?? 0),
      output_tokens: Number(usage.output_tokens ?? 0),
      cache_read_input_tokens: Number(usage.cache_read_input_tokens ?? 0),
      cache_creation_input_tokens: Number(usage.cache_creation_input_tokens ?? 0),
      cost_usd: Number(usage.cost_usd ?? 0),
      daily_used: Number(daily.used ?? 0),
      cost_usd_today: Number(daily.cost_usd_today ?? 0),
      http_status: status,
    });

    // Safety: bail if cumulative cost > $1
    if (totalCost > 1.0) {
      console.log(`!! cumulative cost $${totalCost.toFixed(4)} > $1 cap — stopping`);
      break;
    }
  }

  const outPath = path.join("/tmp", "copilot-audit-rodnj.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        account: "b2c-rodnj",
        date: new Date().toISOString(),
        total_cost_usd: totalCost,
        turns,
      },
      null,
      2,
    ),
  );
  console.log(`\n=== Wrote ${outPath} (total: $${totalCost.toFixed(4)}) ===`);

  expect(turns.length).toBeGreaterThan(0);
});
