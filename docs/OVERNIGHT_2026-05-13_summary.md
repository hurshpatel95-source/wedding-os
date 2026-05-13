# Overnight summary — 2026-05-13 (Hursh's wake-up doc)

**Session:** 2026-05-13 (continuing from `OVERNIGHT_2026-05-12_summary.md`)
**Mode:** autonomous — pivot + execute, work / test / merge / push / repeat
**Final state:** `fa2b408` on origin/main. **11 commits today.** Suite green on prod (39 pass / 3 skip / 0 fail).
**Most important file to read first:** `docs/STRATEGIC_PIVOT_2026-05-12.md` — the operating model. Everything below executes against it.

---

## TL;DR

Yesterday we built a lot of Zola-parity polish. You saw the Zola app mid-afternoon, recognized the trap, and we pivoted: **AI wrapper for weddings, two-vertical model, kill Zola-parity work.** That pivot was committed as a locked operating doc (`STRATEGIC_PIVOT_2026-05-12.md`).

**Today executed 4 of the 5 moves from the pivot:**
- ✅ Move 1 — Co-pilot stress test + fixes (3.2/5 → 4.9/5)
- ✅ Move 2 — Photo → Pricing (the magical new feature) shipped end-to-end
- ⏳ Move 3 — Astia Phase 1 (blocked on Stripe env from you)
- ✅ Move 4 — Autopilot audit + 4 critical EUR-leak fixes
- ✅ Move 5 — Multi-event orchestration (3-day scaffold) shipped

**What's now live on prod that wasn't yesterday:**
- `/events` — multi-event hub (sangeet/mehndi/ceremony/reception/etc.)
- `/visualize` — drop a Pinterest photo, get AI pricing analysis + vendor matches
- `/settings` — proper settings hub
- Nav trimmed to 8 primaries + "More" dropdown
- Money pages unified via `<MoneyTabs>` strip
- Co-pilot doesn't leak currency / hardcoded venue names / 73 tasks / Astha
- Autopilot doesn't silently FX-convert vendor quotes (was writing wrong amounts into budget_lines)
- Public site hero handles null wedding_date without falling back to "September 2027"
- 30+ deep-audit polish items closed across the day
- 42 smoke tests on prod (39 active, was 22 yesterday morning)

**The product is materially closer to "AI planner you'd actually trust" than yesterday.** The remaining blockers are all on you (Stripe env, T1.1 part 2 activation, Astia pricing call).

---

## What shipped today — chronological

| Hash | Move | What |
|---|---|---|
| `bb85ecd` | Pivot | `docs/STRATEGIC_PIVOT_2026-05-12.md` — locked operating doc |
| `ad7ab61` | M5 design | `docs/move5_multi_event_design.md` — Option A sidecar + nav swap + 6 open Qs |
| `4e182c3` | M5 Day 1 | event_details schema + /events page (feature-flag protected) |
| `572773f` | M5 Day 2 | EventEditDrawer + /guests, /timeline, /budget integrations + dashboard upcoming-event tile |
| `9d14e92` | M5 Day 3 | Co-pilot events_summary injection + nav swap + onboarding multi-event signal + 3 smoke tests |
| `f970045` | M1 audit | Co-pilot stress test — 3.2/5 avg, doesn't meet ship-bar |
| `903462f` | M1 fixes | Co-pilot: dropped EUR leak (now reads workspaces.base_currency), routes map injection, "cite real task titles" instruction |
| `6ba00c5` | M1 re-audit | Re-audit doc: **4.9/5** — bar met, cleared for Move 2 |
| `40a7df3` | M2 | **Photo → Pricing** — multimodal Sonnet 4.5 endpoint + /visualize UI + nav addition |
| `82af2a1` | M4 audit | Autopilot audit + 4 critical fixes (EUR leak in analyzer, draft-outreach budget leak, hardcoded € in UI chips, Gmail sync didn't trigger analyzer) |
| `fa2b408` | M2 follow-up | `/vendors/find?category=` pre-select wired so photo→pricing CTAs actually pre-filter |

**Smoke vs prod (final run on `fa2b408`):** 39 passed / 3 skipped / 0 failed in 3.8 min.

---

## The single most important thing closed today

**Move 4 autopilot EUR conversion bug.** The thread analyzer literally instructed Claude: *"give an approximate EUR equivalent for non-EUR quotes."* US vendor quotes were being silently FX-guessed and written into `vendors.quote_eur` + auto-rolled into `budget_lines.amount_committed`. Rachel would have seen wrong dollar amounts in her budget without knowing why.

Same EUR leak class also fixed in Co-pilot (Move 1) and confirmed absent in photo→pricing (Move 2 built it with currency awareness from the start).

If you read one thing today, read `docs/autopilot_audit_2026-05-13.md` — it has 9 findings of which 4 are fixed and 5 are deferred (most of those are B2B planner-side autopilot which is Phase 2).

---

## What you actually have now

### B2C product surface (Rachel can use this cleanly)

- `/` Dashboard with action widgets (Due this week / Deposits / RSVPs / Unanswered questions) + welcome banner with 3-step starter list + next-upcoming-event tile + autopilot today widget
- `/onboarding` AI chat (warmer first message, reconnecting indicator, mobile progress bar, friendly errors)
- `/plan` Tasks with cost-link to /budget
- `/budget` AI baseline + MoneyTabs strip with Plan/Forecast/Actuals
- `/estimator`, `/spend` reached as MoneyTabs (still own pages)
- `/payments` with proper empty state + B2C "what's next" card
- `/vendors` with vendor pipeline status
- `/vendors/find` AI-assisted search with `?category=` pre-select
- `/guests` with `?event=` per-event filter tabs
- `/guests/import` AI column mapping
- `/guests/seating` floor plans (per event_role)
- `/timeline` run-of-show (per event_role)
- `/events` **NEW** multi-event hub (sangeet/mehndi/ceremony/reception/etc.)
- `/visualize` **NEW** photo→pricing
- `/assistant` Co-pilot (now properly currency-aware, route-aware, cites real task titles)
- `/settings` hub + `/settings/preferences` + `/settings/public-site` + `/settings/gmail`
- `/w/<slug>` public wedding site (minimal — we explicitly do NOT compete with Zola here)

### B2B planner shell (Astia has this; needs Stripe to charge)

- `/admin` planner dashboard
- `/admin/clients/*` per-client workspaces
- White-label branding via skin system
- Autopilot vendor inbox parsing (works for couple's Gmail today; planner-inbox autopilot is Phase 2)

### What Zola can't do that we do

- AI Co-pilot with workspace context (currency-aware, route-aware, real task names)
- AI onboarding chat that pre-populates the dashboard
- AI baseline budget generation from intake
- Photo → pricing (multimodal vision)
- Multi-event support (sangeet/mehndi/ceremony/reception/brunch/after-party as first-class)
- AI vendor email autopilot (drafts outbound, parses inbound, auto-updates pipeline)
- AI guest-import column mapping
- Planner ↔ couple shared workspace with proper role separation

### What we explicitly do NOT do (and won't)

Per the pivot doc:
- Fancy public wedding website builder (Zola wins)
- Registry integration (Zola wins)
- More than 5 themes
- Generic 200-task checklist (ours is AI-personalized)
- Guest mass-mgmt features (Zola wins)
- OG image dynamic-per-slug, theme live preview, slug live validation depth, Markdown live preview, audit-2 deep polish — all dead per `STRATEGIC_PIVOT_2026-05-12.md`

---

## What's blocked on you

| Item | What's needed | Time | Unblocks |
|---|---|---|---|
| **T1.1 part 2 activation** | 3 commands at your Mac (walkthrough earlier in our conversation). Activates the migration auto-applier. | ~10 min | Move 5 goes fully live (event_details table currently sits queued); future migrations auto-apply on push |
| **Stripe API key in Railway env** | Drop the key into Railway → wedding-os service → Variables | ~3 min | Move 3 (Astia Phase 1 — charge her) becomes buildable in 4-6 hr after env is in |
| **Astia tier pricing decision** | Decide $X/mo for Starter / Growth / Enterprise (suggested $99 / $299 / custom) | ~5 min thought | Move 3 |
| **Supabase CLI auth** | `npx supabase login` against the project | ~5 min | T1.2 phase 2 (eliminate 473 type casts) |
| **Rachel send** | Copy-paste from `docs/rachel_onboarding_brief.md` | ~5 min | Real B2C user feedback flowing |

---

## Decision register — open Qs from Move 5 design

You confirmed defaults yesterday. For reference (these are now LOCKED, not open):

1. ✅ Option A sidecar table — shipped
2. ✅ Replace /timeline with /events in nav — shipped
3. ✅ Auto-enable ceremony + reception on first /events visit — shipped
4. ✅ Ceremony date stays canonical for `workspaces.wedding_date` — shipped
5. ✅ Budget lines with `event_role=null` are "shared / unallocated" — shipped
6. ✅ B2B planner cross-couple multi-event view deferred to Phase 2 — documented

---

## What I want to flag for your review

### 1. Co-pilot is now at 4.9/5 cold-start

But cold-start is the easy case. The audit doc flagged that a **loaded-state re-audit** (workspace with 6 vendors / 1 venue / 80 guests / real budget data / payment milestones) is the real test. It's not done. Worth doing before Astia goes live in production.

Time: ~1 hr, same script in `apps/web/tests/audit/copilot-stress-test.spec.ts` runnable as `npx playwright test --config=tests/audit/playwright.audit.config.ts copilot-stress-test`.

### 2. Photo → Pricing has an in-memory daily cap

Per-workspace, 50 analyses/day, ~$2.50/day ceiling. Resets on Railway deploy. **Not persistence-backed.** If someone hammers it across deploys, no enforcement. Worth adding a persistence-backed cap before Rachel sees it. Time: ~30 min (one table + the same `ai-quota.ts` pattern that autopilot uses).

### 3. The event_details migration is queued but NOT applied

`supabase/migrations/20260512100000_event_details.sql` sits ready. Until T1.1 part 2 activates OR you paste it manually into Supabase dashboard SQL editor, `/events` renders the "rolling out" empty state instead of the real grid. Code is tolerant — won't crash — but the feature isn't reachable until the table exists.

### 4. Autopilot deferred items (from `docs/autopilot_audit_2026-05-13.md`)

- Gmail Pub/Sub webhook is a logging stub (real-time push not wired; sync-time auto-trigger is the practical path today)
- B2B planner-side autopilot (Astia's planner-inbox autopilot)
- API-level workspace-mode fork (UI splash already hides B2B; defense-in-depth not added)
- First-name extraction fragile in email greetings

None are blockers; all are flagged for a future move.

### 5. Strategic check-in

We executed 4 of 5 moves from the pivot doc today. The product is materially better positioned. **But the real signal is when Rachel + Astia actually use this.** Until then everything is hypothesis.

If you want my read: ship Astia Phase 1 (Stripe + charge her) next, then send Rachel. The two streams of user feedback will tell us what to build next — better than another self-audit can.

---

## What I'd do next session (in priority order)

1. **Activate T1.1 part 2** (you, 10 min) — unblocks event_details migration + future migrations
2. **Add Stripe env + decide Astia pricing** (you, 5 min) — unblocks Move 3
3. **Build Move 3 — Astia Phase 1** (me, 4-6 hr) — the validated B2B customer starts paying
4. **Co-pilot loaded-state re-audit** (me, 1 hr) — verify Co-pilot quality with real workspace data
5. **Photo→Pricing daily cap persistence** (me, 30 min) — pre-Rachel hardening
6. **Send Rachel** (you, 5 min) — real signal flowing

After Move 3 + Rachel: real-user feedback will dictate Phase 2 priorities. Probably involves B2B planner-side autopilot (Astia's inbox), Gmail Pub/Sub webhook completion, the deferred audit items, and whatever Rachel actually trips on.

---

## Files you should glance at when you wake up (in order)

1. **`docs/OVERNIGHT_2026-05-13_summary.md`** (this doc)
2. **`docs/STRATEGIC_PIVOT_2026-05-12.md`** — operating model (unchanged today; still LOCKED)
3. `docs/copilot_audit_2026-05-13_after_fixes.md` — 4.9/5 re-audit result
4. `docs/autopilot_audit_2026-05-13.md` — 9 findings, 4 fixed, 5 deferred
5. `docs/move5_multi_event_design.md` — the multi-event architecture
6. `docs/CLAUDE_PATTERNS.md` — operating rules (still current; multi-event note added on Move 5 Day 3)

---

## Smoke suite inventory (42 specs, 39 active)

| Range | Domain |
|---|---|
| 01-05 | Login, dashboard fork, autopilot fork, settings saves, legacy leaks |
| 06-10 | Budget, plan cost-link, vendors fork, estimator fork, public site |
| 11-15 | Onboarding, vendors/find, vendor tabs, guests import, public-site editor |
| 16-20 | Payments currency, spend VAT, pricing fork, availability month, settings name |
| 21-25 | Currency toggle, task drawer, budget add-cat, vendor status, admin impersonation |
| 26-29 | **NEW today** — events page, events edit drawer, /guests event filter, /timeline event filter |
| 30 | **NEW today** — /visualize page |

Plus `apps/web/tests/audit/copilot-stress-test.spec.ts` — the Co-pilot quality re-audit (one-off, not run on every smoke).

---

## End of summary

Working tree clean. Latest on main: `fa2b408`. Smoke 39/3/0. Welcome back.

When you're ready, tell me what to do next. My default if you say "go": Move 3 (Astia Phase 1) once you've dropped the Stripe env. Or counter-direct.
