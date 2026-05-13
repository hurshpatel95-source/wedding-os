# Co-pilot re-audit after fix-bundle — 2026-05-13

**Audit against commit:** `903462f` (`fix(move-1): Co-pilot prompt + context fixes from 2026-05-13 audit`)
**Tester:** Claude (Opus 4.7, 1M context) driving Playwright against PROD (`https://wedding-os-production.up.railway.app`)
**Account:** b2c-rodnj (`rodnj.ops@gmail.com`) — USD couple, cold-start workspace (same conditions as the original audit)
**Method:** Same script (`apps/web/tests/audit/copilot-stress-test.spec.ts`), unchanged. Same 10 questions, fresh conversation per question.
**Anthropic spend:** **$0.0339** for all 10 turns (vs $0.0259 original — slightly higher because answers are a bit longer / more concrete)
**Raw output:** `/tmp/copilot-audit-rodnj.json` (kept)
**Bar to clear:** avg ≥ 4.0, no question scored 1, no hallucinations
**Result:** **PASS** — avg 4.9/5, no question ≤ 4, no hallucinations detected

---

## Score delta

The original audit doc reported an average of 3.2 in its summary, but the explicit per-question scores in the same doc sum to 39/10 = 3.9. We honor the explicit per-question values here (noting the 3.2 ↔ 3.9 arithmetic mismatch in the original).

| Q | Question (truncated) | Before | After | Δ |
|---|---|---|---|---|
| 1 | What should I do this week? | 4 | 5 | +1 |
| 2 | Who's our photographer? | 5 | 5 | 0 |
| 3 | How are we tracking vs our budget? | 2 | 5 | +3 |
| 4 | Which vendors do we still need to book? | 4 | 5 | +1 |
| 5 | Compare our two venues | 5 | 5 | 0 |
| 6 | How many guests have RSVP'd yes? | 5 | 5 | 0 |
| 7 | What's the next deposit due? | 4 | 5 | +1 |
| 8 | Add a sangeet on Friday Sept 11 at Casa Del Mar | 3 | 5 | +2 |
| 9 | Switch venues — help me think through it | 4 | 5 | +1 |
| 10 | Is this app actually going to help me… | 3 | 4 | +1 |
| **Avg** | | **3.9** (audit doc claimed 3.2) | **4.9** | **+1.0** |

Three questions stayed at 5 (they were already perfect). Six improved by +1, one by +2, one by +3. None regressed.

## Where the fixes worked

- **Fix 1 (currency neutralization)** — Q3 went from 2 → 5. Co-pilot no longer hallucinates EUR. Q3 reply (verbatim): "You haven't set a total budget yet. Start by going to **/budget** and entering your target spend…" No "EUR spend by category" leak. The `_eur` legacy field-name comment + the currency prelude block + the `*_display` formatted strings together gave the model an unambiguous read on the workspace currency.
- **Fix 2 (routes map)** — Q8 went from 3 → 5 (single largest non-currency win). Co-pilot now says "To add the sangeet event: Go to **/events**, click 'Add event'" — exact route. It also correctly tells the user to add Casa Del Mar via `/venues` first (instead of silently treating Casa Del Mar as a known venue, which was the audit's hallucination concern). Q10 also benefits: now points users at `/plan` (not the broken "venue options on `/vendors`" instruction from before). Q4 picked up `/vendors/find` as a bonus route mention. Q2 also mentions `/vendors/find` proactively.
- **Fix 3 (prefer real task titles)** — Q1 surfaces real task titles ("Pick wedding date", "Set total budget", "Draft initial guest list (rough headcount)", "Pick wedding region / style"), not generic blog advice. Q2 cites "Research photographers" and "Tour 3+ photographer portfolios" verbatim. Q7 cites "Pick wedding date", "Set total budget", "Shortlist 3–5 venues" by name. Co-pilot is no longer manufacturing generic checklists when the workspace has 84 real task rows.

## Where they didn't (or didn't reach 5)

- **Q10 only reached 4/5**, not 5. The answer is good — routes are right, AI features (AI vendor find, scenario comparison) are surfaced, tone is honest. But it still leans on the "It'll help if you / it won't help if you" structure which can feel formulaic; a 5 would weave the user's actual workspace state into a more specific pitch ("you've got a wedding date locked but no budget — let's start there"). Not a blocker; just leaves a half-point on the table. This is a subjective tonal call and not symptomatic of a remaining bug.
- No remaining hallucinations or wrong routes detected. No EUR leaks. No invented entity names.

## Verdict

- **Clear to ship Move 2.** All three bar criteria met:
  - Avg 4.9 ≥ 4.0 ✓
  - No question scored 1 (lowest was 4) ✓
  - No hallucinations (currency correct, no fabricated entities, all routes resolve to real pages) ✓
- Recommend doing the **loaded-state pass** the original audit flagged as a follow-up (~2 months of usage, with 6 vendors / 1 venue / 80 guests / partial RSVPs) before declaring Co-pilot "Move 2 ready" in a deeper sense, but that's a separate concern; the cold-start bar is clearly cleared.

## Anthropic spend

**$0.0339** for this re-run (10 turns, all hit cache_creation = 0 / cache_read = 0 since each question used a fresh conversation, same as the original audit's caching behavior). Well under the $1 cap.
