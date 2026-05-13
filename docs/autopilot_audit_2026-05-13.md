# Autopilot audit + gap fixes — 2026-05-13

**Auditor:** Claude (Opus 4.7, 1M context)
**Branch:** `move4-autopilot-audit`
**Audit against commit:** post-`9d14e92` baseline (worktree before this commit)
**Method:** top-down code walk through `apps/web/app/api/autopilot/*`, `apps/web/app/api/gmail/*`, `apps/web/lib/autopilot-*.ts`, `apps/web/lib/gmail-*.ts`, `apps/web/components/autopilot/*`, `apps/web/app/(app)/{autopilot,settings/gmail}/*`. Cross-referenced with the EUR-leak class documented in `docs/copilot_audit_2026-05-13.md`.
**Audience profile under test:** B2C cold-start couple (Rachel) on a USD workspace, plus a thought-pass for a B2B planner (Astia).

---

## Summary

- **Total findings:** 9
- **Severity distribution:** 4 × SEV5 · 2 × SEV4 · 2 × SEV3 · 1 × SEV2
- **Single most-impactful gap:** the EUR leak class from the Co-pilot audit (`copilot_audit_2026-05-13.md`) is present in the autopilot **end-to-end** — the analyzer prompt actively instructs the AI to *convert* vendor quotes from USD to "approximate EUR equivalent," the draft-outreach prompt ships `budget_target_eur` to Claude without a currency anchor (vendor emails to USD-based businesses could carry an EUR number), and the in-app quote chips literally render `€$N` to every workspace regardless of `base_currency`. This is a **deterministic mis-fire** on every USD couple.
- **Second-most-impactful gap:** Gmail sync ingests inbound vendor replies into `email_messages` but **never triggers the analyzer**. The `analyze-thread/route.ts` docstring claims it's "triggered by … Gmail sync" — that's aspirational. Today the only auto-trigger is manual button or `/run-all`. So Rachel connects Gmail, vendor replies, sync runs, and… the autopilot dashboard stays empty until she clicks "Analyze with AI."

The rest of the autopilot is in much better shape than the brief implied. Cost guards work, the B2B fork on `/autopilot` works, Gmail OAuth flow is polished (state token signing, personal-mailbox hint warning, test-send override), `assertNonChatAiQuota` enforces both a $5/day and 50-call/day cap with per-iteration re-check inside `/run-all`.

---

## Per-finding

### 1. EUR leak in analyzer tool schema + prompt — analyzer ACTIVELY MUTATES quotes

**File:** `apps/web/lib/autopilot-analyzer.ts:50-53`
**Severity:** **5 / 5**

The `emit_vendor_status_change` tool schema defines:

```
quote_eur: {
  type: ["number", "null"],
  description:
    "Numeric quote (rough EUR). NULL unless the vendor explicitly stated a price in this thread. Strip currency symbols. If the vendor priced in another currency, give an approximate EUR equivalent.",
},
```

For a USD workspace this is wrong in three ways:
1. The field name `quote_eur` signals to Claude that the answer must be in EUR.
2. The instruction explicitly tells the model to **approximate-convert** non-EUR quotes to EUR. So a US florist quoting "$4,500" will be stored as the model's best-guess EUR conversion (e.g. ~€4,200) — destroying data integrity. The budget auto-roll then commits this wrong number into `budget_lines.amount_committed`.
3. There's no `base_currency` context — the analyzer doesn't know whether the workspace is USD or EUR.

**Why it matters:** Every USD vendor quote ingested by the autopilot is corrupted with an FX guess. Rachel's budget tracker would show inflated/deflated numbers. Hursh's Co-pilot quoting from `vendors.quote_eur` would compound the error.

**Suggested fix:** mirror Co-pilot fix `903462f` — read `workspaces.base_currency`, inject it into the analyzer prompt, replace the schema description so the AI takes the quote **verbatim in the vendor's currency** without converting. Add a `quote_currency` field if we want to track multi-currency in future; for now keep the column `quote_eur` (legacy) but stop the conversion.

---

### 2. EUR leak in draft-outreach context — vendors see "EUR" budget

**File:** `apps/web/app/api/autopilot/draft-outreach/route.ts:75-86, 176-194`
**Severity:** **5 / 5**

The `couple` block sent to Claude for outreach drafting includes:

```
budget_target_eur: workspace?.budget_target_eur ?? null,
```

…and the system prompt says only "Always state the wedding date, region, guest count, and budget hint when available." With no currency anchor, the model defaults to interpreting the field literally — meaning a Florida couple's $40,000 budget would be quoted to a Florida vendor as **€40,000**. That's a credibility cliff for the couple AND a likely scoping mismatch (€40,000 ≈ $43,500 — vendors may quote higher).

**Why it matters:** Vendor outreach is the most external-facing surface of the product. A single email saying "our budget for photography is €4,000" to a US photographer makes the couple look like they don't know how to use the app, and trains the photographer to either disregard the budget or quote in EUR back.

**Suggested fix:** read `workspaces.base_currency`. Inject `base_currency` + a pre-formatted `budget_target_display` string into the user message. Update the DRAFT_SYSTEM prompt to say "the couple's budget below is already formatted with the correct currency — quote it verbatim, don't convert or change the symbol."

---

### 3. Hardcoded `€` symbol in the quote chips

**Files:**
- `apps/web/components/autopilot/vendor-status-display.tsx:62`
- `apps/web/components/autopilot/analyze-button.tsx:65-67`

**Severity:** **4 / 5**

Both files render:

```ts
`€${quote_eur.toLocaleString()}`
```

— ignoring the workspace's `base_currency`. This is the same bug class as the legacy `formatEUR` call sites that were already fixed across `/payments` and `/budget`. `apps/web/lib/utils.ts` already exports `formatCurrency()` and `currencySymbol()`; the autopilot just doesn't use them.

**Why it matters:** Even after fixing the analyzer prompt (finding #1), a USD couple seeing `€4500` on their vendor card is still a daily Rachel-uninstaller signal.

**Suggested fix:** pass the workspace's `base_currency` down to these components (server-component prop drilling is fine), or call a wrapper that takes raw `(amount, base_currency)`. Use the existing `formatCurrency` helper. For the toast in `analyze-button.tsx` we can do a thin client fetch of `base_currency` once on mount; simpler is to fetch it as part of the server data passed to the parent.

---

### 4. Gmail sync ingests replies but never triggers analyzer

**File:** `apps/web/app/api/gmail/sync/route.ts:204-236` (insert path) — and the absence of any `analyzeVendorThread()` call after the insert.
**Severity:** **4 / 5**

The sync route binds inbound messages to vendors by from-email match, sets `kind = 'vendor_inbound'`, but doesn't trigger the analyzer. The autopilot dashboard therefore depends entirely on the couple clicking "Analyze with AI" on each vendor, or on someone hitting `/api/autopilot/run-all`.

Meanwhile `apps/web/app/api/autopilot/analyze-thread/route.ts:9-13` documents:

```
// Triggered by:
//   - The /vendors/[id] page "Analyze with AI" button (manual)
//   - The Resend inbound webhook (?triggered_by=webhook)
//   - The Gmail sync route (?triggered_by=webhook)
```

That third bullet is aspirational. `grep -rn "analyzeVendorThread\|analyze-thread" apps/web/app/api/gmail/` returns zero hits.

**Why it matters:** This breaks the autopilot's main promise — that vendor replies show up as alerts in "Today's queue" automatically. Without an auto-trigger, the dashboard's hero ("The latest things your AI co-pilot has surfaced — vendor replies, quote moves, follow-ups it's about to send") is false advertising. Rachel will sync Gmail, see her replies in Gmail, and wonder why the dashboard is empty.

**Suggested fix:** at the end of the sync loop, collect every vendor_id whose inbound landed in this batch and call `analyzeVendorThread(supabase, vendorId, "webhook")` for each (capped at 5 per sync to bound cost). The analyzer is idempotent against `last_inbound_at` so re-runs are safe. Wrap in try/catch so analyzer failure doesn't break sync.

---

### 5. Gmail Pub/Sub webhook is a logging stub

**File:** `apps/web/app/api/gmail/webhook/route.ts`
**Severity:** **3 / 5**

The endpoint accepts a Pub/Sub envelope, logs the shape, and 204s. It doesn't decode the `data` field, look up the connection by `emailAddress`, or trigger anything. This is fine as a placeholder — but combined with finding #4 it means there is **no realtime path** at all: inbound vendor reply → Pub/Sub fires → we log + ack → couple sees nothing until they manually sync.

**Why it matters:** Lower than #4 because there's no `gmail.users.watch()` cron yet anyway, so Pub/Sub probably isn't firing in prod. But once the watch cron exists, this stub will silently drop every event.

**Suggested fix:** out of scope for this audit (involves env vars + a cron). Document as known limitation. The fix is finding #4 (sync-time trigger) for now.

---

### 6. Analyzer prompt has no workspace-context expansion for B2B planners

**File:** `apps/web/lib/autopilot-analyzer.ts:282-300` (the prompt-building block)
**Severity:** **3 / 5**

When an Astia-served couple's vendor replies, the analyzer prompt currently shows only:
- workspace name + wedding_date
- vendor name + category
- the email thread

It doesn't tell the model that this is a B2B context — that the planner (Astia) is in the loop, that "we" in the email refers to the couple but the dashboard reader could be either the couple or the planner, or that proposed actions like "Schedule a site visit Tue 3pm" should mention the planner if she's the one who'd attend.

**Why it matters:** Today, the autopilot generates "Reply to confirm site visit Tue 3pm" as a next action — but for a B2B couple, Astia handles vendor coordination off-platform (per `/autopilot` page splash rules). The action is generated then never shown on the B2B `/autopilot` (because of the fork). But if Astia gets her own autopilot in the future, this prompt needs awareness.

**Suggested fix:** defer — needs the admin-side autopilot first. Document as a Phase 2 item.

---

### 7. Workspace mode fork on `/autopilot` works, but doesn't extend to draft-outreach API

**File:** `apps/web/app/(app)/autopilot/page.tsx:69-106` (splash) vs. `apps/web/app/api/autopilot/draft-outreach/route.ts` (no skin check)
**Severity:** **2 / 5**

The B2B couple sees a splash on the `/autopilot` UI — but if a planner-served couple wanders into `/vendors/find` and hits the "Draft outreach" button (which calls `/api/autopilot/draft-outreach`), the API happily generates drafts. The fork is UI-only.

**Why it matters:** Low — the splash effectively hides the entry. But a clever URL or a deep-link from another page could bypass it. Mostly a "consistency" concern.

**Suggested fix:** defer — the brief explicitly says don't build new B2B autopilot. The splash is the right answer for now. Add a TODO comment.

---

### 8. `name.split("—")` first-name extraction is fragile

**File:** `apps/web/app/api/autopilot/draft-outreach/route.ts:181-184`

```ts
const coupleNameRaw = workspace?.name?.split("—")[0]?.trim() ?? "";
```

**Severity:** **2 / 5**

This assumes workspaces are named like "Kyle & Michelle — Newport" (with an em-dash, NOT a hyphen). For:
- A workspace named just "Kyle & Michelle" → returns "Kyle & Michelle" (OK).
- A workspace named "Kyle & Michelle - Newport" (regular hyphen) → returns the whole string.
- A workspace named "rodnj.ops" → returns the whole technical id.

So some couples get vendor outreach signed "[your name]" (because the first names extraction fell through to the empty-string check), some get the whole technical workspace name, some get the right first names.

**Why it matters:** Cosmetic but annoying. Defer.

**Suggested fix:** check `intake_sessions.extracted_data.partner_a_name` (and `_b_name`) first; fall back to the split heuristic if absent. Out of scope.

---

### 9. `quote_summary` example uses `$` symbol in the schema description

**File:** `apps/web/lib/autopilot-analyzer.ts:58`

```
description: "1-line summary of what's included at that price (e.g. \"$4,500 includes ceremony + reception florals + delivery\"). NULL when quote_eur is null."
```

**Severity:** **2 / 5**

Mixed signal: the example uses `$`, the field name above it uses `_eur`, and the prompt elsewhere says convert to EUR. The model has to guess what the human wants.

**Why it matters:** Low — quote_summary is read verbatim from the vendor's email so the symbol depends on what they wrote. But for couples where the vendor quoted in $ and the analyzer is told to convert to EUR (finding #1), the summary would say "€4,200" but the body says "$4,500" — inconsistent.

**Suggested fix:** rewrite the example to say "use whatever currency the vendor quoted" and reference `workspace.base_currency`. Bundle this fix with finding #1.

---

## Themes — patterns across the 9

1. **EUR everywhere** (findings #1, #2, #3, #9). The autopilot system was built with a Barcelona-wedding assumption and never got the currency-neutralization treatment that `/(app)/budget`, `/(app)/payments`, `/(app)/spend` got. Every layer leaks: tool schema, system prompts, server-rendered context, client-rendered chips, toast messages.

2. **Gmail integration is the gateway, but the loop isn't closed** (findings #4, #5). Sync ingests; nothing triggers. Pub/Sub stub means no realtime. The couple has to manually click a button for the autopilot to do its core job.

3. **The B2C dashboard is solid, the B2B path is correctly stubbed.** No blockers there. The `T1.5` fork works exactly as designed for skin = `co_branded` or `white_label`. For B2B-served couples on `acquired_planner` skin (the current fallback), the B2C path renders — which is the intended interim state per the test skip comment.

4. **Cost guards are real.** `assertNonChatAiQuota` enforces $5/day + 50-call/day per org, re-checked inside `/run-all` per iteration. `MAX_VENDORS_PER_CALL = 20` caps batch runs. `recordNonChatAiCall` is best-effort but the assert is the primary defense. No runaway risk.

---

## Recommended fixes, ranked by impact

1. **Kill the EUR leak in the analyzer prompt + schema.** Findings #1 + #9. Make the AI stop converting quotes. Take the vendor's quote verbatim. Drop "EUR" from the tool description. **Effort: 25min.**

2. **Kill the EUR leak in draft-outreach.** Finding #2. Read `workspaces.base_currency`. Inject a pre-formatted `budget_target_display` string. Update prompt to quote it verbatim. **Effort: 20min.**

3. **Fix the hardcoded `€` symbol in the quote chips.** Finding #3. Pass `base_currency` down to `VendorStatusDisplay`. Use `currencySymbol()`. Fix `analyze-button.tsx` toast too. **Effort: 20min.**

4. **Auto-trigger analyzer on Gmail sync.** Finding #4. After sync writes inbound rows, run `analyzeVendorThread()` (capped, try/catched) on each vendor that received a new reply. Closes the loop. **Effort: 25min.**

Findings #5, #6, #7, #8 are deferred. They're either gated on infra I shouldn't build today (Pub/Sub cron), or future Phase 2 (B2B autopilot), or cosmetic.

---

## Fixed in this commit

The four fixes above (#1, #2, #3, #4) are landed in this commit. Specifically:

- **`apps/web/lib/autopilot-analyzer.ts`** — analyzer tool schema description rewritten to take the quote in the vendor's currency without converting; system prompt no longer mentions EUR; `quote_summary` example updated to be currency-agnostic; analyzer now loads `workspaces.base_currency` and surfaces it in the prompt.
- **`apps/web/app/api/autopilot/draft-outreach/route.ts`** — reads `workspaces.base_currency`, surfaces it + a pre-formatted `budget_target_display` to the model, system prompt updated so the AI quotes the budget verbatim.
- **`apps/web/components/autopilot/vendor-status-display.tsx`** — accepts a `base_currency` prop and uses `formatCurrency()` instead of hardcoded `€`.
- **`apps/web/app/(app)/autopilot/page.tsx`** — fetches `base_currency` and threads it through to the dashboard.
- **`apps/web/components/autopilot/autopilot-dashboard.tsx`** — passes `base_currency` to children.
- **`apps/web/components/autopilot/analyze-button.tsx`** — toast now uses currency-aware formatting.
- **`apps/web/app/api/gmail/sync/route.ts`** — after the message insert loop, calls `analyzeVendorThread()` for each vendor that got a new inbound (capped at 5 per sync, try/catched, skip already-analyzed via the analyzer's own freshness check).

---

## Deferred (documented above)

- **#5** Pub/Sub webhook real implementation. Out of scope: needs `gmail.users.watch()` cron + env vars.
- **#6** Analyzer context expansion for B2B planners. Phase 2 once admin-side autopilot exists.
- **#7** API-side workspace mode fork in `/api/autopilot/*`. Cosmetic for now; the UI splash effectively hides the entry.
- **#8** First-name extraction in draft-outreach. Replace `name.split("—")` with `intake_sessions.extracted_data.partner_a_name`. Deferred to a separate small fix.

---

## Confidence

**High** on findings #1-#4. These are deterministic, code-walkable, easily reproduced. The fix-pattern mirrors `903462f` (the Co-pilot EUR fix) for currency neutralization and is the same approach already validated in production.

**Medium** on the "Rachel-ready / Astia-ready" verdict in the report — I read the code paths but didn't drive end-to-end as Rachel through a real Gmail. A loaded-state regression pass (Rachel signed in, Gmail connected, 6 vendors with mixed status) would surface a different class of bugs that this code-walk audit can't catch.

---

## Decision support

**Pre-fix:** USD couple opens autopilot dashboard, sees `€4500` quote chips. Connects Gmail. Vendor replies. Nothing happens automatically. Has to manually click "Analyze with AI" per vendor. When she does, the AI silently converts the USD price to "rough EUR" and writes a wrong number into her budget. **Rachel-blocker.**

**Post-fix (this commit):** USD couple sees `$4500` quote chips. Connects Gmail. Vendor replies. Sync runs, autopilot analyzer auto-fires, alert lands in "Today's queue" with the right number. **Rachel-ready** at the cold-start tier, assuming Gmail OAuth works in prod (separate concern).

**Astia-ready?** Not without the admin-side autopilot. The B2B fork correctly redirects her couples away from the dashboard, but Astia herself has no surface to read her vendor inbox in-app. That's documented in the strategic pivot as a planned future feature. **Not a blocker for today's audit scope.**
