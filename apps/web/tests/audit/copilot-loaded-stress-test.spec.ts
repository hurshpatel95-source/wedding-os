// Move 1 — Co-pilot LOADED-STATE answer-quality stress test (2026-05-13)
//
// One-off audit script. NOT part of the smoke suite. Invoked explicitly:
//
//   npx playwright test tests/audit/copilot-loaded-stress-test.spec.ts \
//     --config=playwright.config.ts --workers=1
//
// Mirrors copilot-stress-test.spec.ts (the cold-start b2c-rodnj audit)
// but signs in as b2b-hursh-nisha — Hursh's own Barcelona Sept 2027
// workspace which has venues + scenarios + budget data. Same 10
// questions, fresh conversation per question, verbatim replies captured.

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

test("co-pilot LOADED stress test (b2b-hursh-nisha, 10 questions)", async ({ page }) => {
  test.setTimeout(15 * 60 * 1000); // 15min — 10 sequential AI calls

  await signInAs(page, "b2b-hursh-nisha");
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

  const outPath = path.join("/tmp", "copilot-audit-b2b-hursh-nisha.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        account: "b2b-hursh-nisha",
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
