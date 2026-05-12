# Strategic pivot — 2026-05-12

**Date:** 2026-05-12
**Status:** LOCKED. This doc supersedes `docs/PATH_TO_COMPLETE.md` and all prior planning docs on questions of product positioning, feature scope, and build order. If those docs conflict with this one, this one wins.
**Audience:** future Hursh + future Claude sessions. Especially the tired-hour-12 / post-compaction sessions where the temptation to drift back into "let's polish the Zola features" will resurface.

---

## Non-negotiable principles — locked

These outrank tactical efficiency, audit findings, surface polish, and any future "but it would be nice to…" instinct. If a session is about to violate one of these, STOP and re-read this doc.

1. **We are not competing with Zola.** Zola has 10 years and ~$650M in valuation polish on the couple-facing website / registry / generic-checklist surface. We will never beat them there. **Stop trying.** Their business model is registry commissions; our business model is AI-as-the-product. Different game.

2. **We are an AI wrapper for weddings.** Not a wedding-website builder with AI sprinkled on top. The AI does the work — visualizations, communications, pricing analysis, planning intelligence — and the dashboard is the side-effect (the audit trail of what the AI did, where the human edits, where the planner stays in the loop).

3. **Two verticals, one codebase:**
   - **B2B (planners):** Astia first, Brigette later, the long tail of independents after. Planner pays us; planner gives the tool to her couples as part of her service.
   - **B2C (direct couples):** Rachel-types who'd rather pay $99 once than hire a planner. Couple pays us directly.

4. **B2C couples never see a Zola-style website-builder polish surface as a primary feature.** We have a minimal `/w/<slug>` share page (already shipped, sufficient). We will not invest more in it. No registry integration, no 200-themes catalog, no advanced guest-mgmt mass features. **Cede the website-builder battle.**

5. **B2B couples (served by Astia etc.) never see a credit meter.** Whatever AI usage they generate is bundled into their planner's subscription tier. Pricing pressure is on the planner, not on the couple's experience.

6. **No new SQL migrations without Hursh activating T1.1 part 2 first.** Existing rule, still holds.

---

## What changed today

This morning we were operating from `docs/PATH_TO_COMPLETE.md` — a 5-phase plan that listed "public site preview + Open Graph + SEO," "mobile pass on guest-import depth," "vendor lifecycle visualization," and ~20 other audit-driven polish items. Most of them were Zola-parity work disguised as "Rachel-readiness."

Hursh looked at the Zola app mid-afternoon and recognized the trap: we were optimizing for a battle we can't win. The actual moat is AI — specifically AI doing wedding work for couples and planners that no one else does or will do. That's the product.

This pivot kills ~40% of the previously-planned work and replaces it with a focused AI-feature build sequence.

---

## The two-vertical model

### B2B — Planners (Astia, Brigette, future)

**The customer:** Independent wedding planner doing 8-15 weddings/year, currently using HoneyBook / Aisle Planner / Planning Pod (all mid-2010s, no AI). She wants to look more professional + handle more weddings without hiring junior staff.

**What she gets that she'd actually pay for:**

| Feature | What it does | Why it matters |
|---|---|---|
| **Contract review** | Drop vendor PDF → AI flags risky clauses, missing terms | She uses this herself + offers it to clients. Lawyer-on-demand. |
| **Vendor email autopilot** | Her Gmail inbox of vendor replies gets parsed into structured records in each couple's workspace, automatically | Eliminates the manual copy-paste-from-emails work that fills her week |
| **AI vendor matchmaking** | Given couple's vibe + budget + region, suggest from her curated stable first, then open web | Faster outreach, more couples served |
| **Day-of run sheet generator** | Natural-language inputs → minute-by-minute schedule across every vendor | Saves 3-4 hours per wedding |
| **Multi-event orchestrator** | Sangeet → mehndi → ceremony → reception with vendor reuse + timeline coordination | Switch House Philly clientele demands this. Zola can't do it. |
| **White-label couple portal** | Her clients log in to "Astia Events" branded portal with full AI suite | She controls the brand experience |

**What her couples (B2B-served) see:**
- White-label branding (Astia Events / Brigette Brand / etc.) — the skin system already supports this
- The same AI tools as B2C couples (photo→pricing, mood board, Co-pilot, AI budget, etc.)
- PLUS their planner is in the loop — Astia sees everything, drops vendor recs, owns the timeline

**Pricing model:**
Tier-based subscription paid by the planner. Couples never see a meter.

| Tier | Active couples | AI quota | Monthly |
|---|---|---|---|
| Starter | 5 | Basic AI suite | $TBD |
| Growth | 25 | Full AI suite | $TBD |
| Enterprise | Unlimited | Full + custom | $TBD |

Pricing numbers are Hursh's call. Start with Astia at a friendly number (she's the design partner). Lock pricing structure before pursuing Brigette / DSO / PE platform customers.

---

### B2C — Direct couples (Rachel, future word-of-mouth)

**The customer:** Engaged couple who'd rather use software than hire a planner. Tech-comfortable. Wants something more intelligent than a checklist app. Doesn't have $20k+ for a planner. Or wants both — uses Acquired Planner as primary, hires a day-of coordinator separately.

**What they see (the actual product surface):**

| Feature | Status | Priority |
|---|---|---|
| **AI onboarding chat** | Shipped + polished | KEEP |
| **AI Co-pilot** | Shipped, quality UNVERIFIED | TEST + IMPROVE |
| **AI budget baseline** | Shipped | KEEP |
| **AI guest-import (column mapping)** | Shipped | KEEP |
| **Photo → pricing** | Not built | **BUILD** |
| **Mood board generator** | Not built | **BUILD** |
| **AI vendor email autopilot** | Stubs exist | **COMPLETE** |
| **Plan + tasks (AI-aware)** | Shipped | KEEP |
| **Vendor mgmt** | Shipped | KEEP |
| **Payments calendar** | Shipped | KEEP |
| **Settings hub** | Shipped today | KEEP |
| **Money pages (Plan/Forecast/Actuals tabs)** | Shipped today | KEEP |

**What they DON'T see (deliberately deprioritized):**

- Fancy public wedding website builder (Zola wins; we play minimal — single `/w/<slug>` share-link page, that's it)
- Registry integration (Zola wins; we link out to whatever registry they use, no integration)
- More than 5 themes (we have 5, keep 5, never invest more)
- Theme live-preview, OG image dynamic-per-slug, slug live-validation polish, Markdown live-preview
- Generic 200-task checklist (ours is AI-personalized from the start)
- Guest mass-mgmt features (Zola wins)
- Public-site editor depth (story mode, schedule timeline editor polish, FAQ rich-text)

**Pricing model:** TBD by Hursh. Two real options:

- **A — One-time per-wedding fee** ($99 / $149 / $199). Wedding planning is high-engagement for 12-18 months then stops; sub model has churn baked in. "Pay once, plan your wedding with AI" is a clean story.
- **B — Freemium with AI usage cap.** Free to sign up, 50 AI actions/month free, $19/mo for unlimited. Wider top-of-funnel.

Recommend starting with **A** for simplicity. Reconsider when we have B2C user data.

---

## Build order — the next 2 weeks

Replaces every Phase 2 / 3 item from `PATH_TO_COMPLETE.md`. Run in sequence; each item has a clear gate before moving on.

### Move 1 — Co-pilot answer-quality stress test (1-2 hr)

**The cheapest most-important thing.** Before we build more AI features, verify the AI we have isn't garbage. The deep audit flagged Co-pilot context coverage and answer quality as unverified. The Co-pilot is the spine of the whole pivot — if it's bad, everything built on top of it is bad.

**How:** Sign in as `b2c-rodnj`, ask the prod Co-pilot 10 hard real-couple questions ("what should I do this week?", "is our photographer deposit paid?", "compare our two venues", etc.). Score each answer honestly (1-5). Document findings to `docs/copilot_audit_2026-05-12.md`. Identify what's broken.

**Gate to next:** Findings reviewed. If quality is high → move on. If low → fix prompt + context build before anything else.

### Move 2 — Photo → pricing (1-2 days)

**The most magical new feature. No competitor has this.**

**How:**
- New route `/api/visualize/photo-to-pricing` accepting an uploaded image
- Multimodal Claude (Sonnet vision) analyzes the image — identifies wedding-relevant elements (floral installation style, venue setup type, cake style, dress silhouette, etc.)
- Returns structured: `{ identified_items: [...], suggested_vendor_categories: [...], typical_price_range_usd: { low, mid, high }, similar_vendors: [...] }`
- Surface in a new `/visualize` page: upload box → AI analysis card → "show me local vendors who can do this" → links to `/vendors/find` pre-filtered
- For B2B couples, the result links to "Ask Astia to source this" — keeping the planner in the loop

**Cost model:** ~$0.02-0.05 per analysis. Caps + caching for B2C; bundled for B2B.

**Gate to next:** demo it to Hursh. If magic feeling → ship. If "meh" → iterate prompt before more features.

### Move 3 — Astia Phase 1 (4-6 hr build + Hursh provides Stripe env)

**Charge the validated B2B customer.** Every day we don't charge Astia is a day we don't know what the B2B product actually needs to be. Her usage signal is the most valuable data point we have.

**Hursh provides:** Stripe API key in Railway env.

**Claude builds:**
- New tables: `subscriptions`, `invoices`, `payment_methods` (one migration after T1.1 part 2 active)
- Stripe webhook handler
- Tier definition + per-tier feature gates (active couples limit, AI quota soft cap)
- Astia's billing settings page
- First invoice generated

**Pricing:** Hursh decides the actual dollar amounts. Suggested: Starter $99/mo, Growth $299/mo, Enterprise custom.

**Gate to next:** Astia paid first invoice.

### Move 4 — Vendor email autopilot completion (2-3 days)

**Close the loop we already started.** Stubs exist for AI-drafted outbound emails. Need to add:
- Gmail OAuth integration for inbound parsing (for B2B Astia's planner inbox)
- Inbound email parser → structured workspace records (vendor reply detection, pricing extraction, contract attachment recognition)
- Outbound draft refinement (workspace-context-aware, tone-aware per planner brand)
- The "couple just clicks send" experience

**Why critical:** This is the highest-frequency planner pain point. Astia's whole day is vendor email triage. If we automate that, she's hooked.

### Move 5 — Multi-event orchestration scaffold (2 days design + 3 days build)

**The differentiator that Zola architecturally can't replicate.**

**Design:**
- Events table (first-class events, not just JSON on pricing_scenarios)
- Per-event guest invitations (some guests come to sangeet, all come to ceremony, family-only to mehndi)
- Per-event timelines + vendor assignments
- Per-event budget allocation (sangeet vendors roll up into total)

**Build:** Migration (queues for T1.1 part 2) + new `/events` surface + integration with existing `/timeline`, `/guests`, `/vendors`, `/budget`.

**Why this matters:** Switch House Philly is a top Indian-wedding venue. Rachel might need this. Astia's clientele leans South Asian + Jewish multi-day. Brigette's circle is destination + multi-event Western. **Owning this category is real.**

**Gate to next:** Hursh + Astia review the design before build. This is the most architecturally consequential move — get it right.

---

## What we EXPLICITLY KILL — the deprecated list

These items from `PATH_TO_COMPLETE.md` and remaining audit findings are dead. Do not pursue them in any future session unless this doc is updated.

### Killed from `PATH_TO_COMPLETE.md`:
- **Phase 2.2 (Public site preview + OG + SEO depth)** — OG basics are done. The live preview iframe + slug live-validation tightening + Markdown live-preview are Zola-parity. Dead.
- **Phase 2.3 (Vendor lifecycle visualization)** — would polish a surface that already works. Dead unless a paying customer specifically asks.
- **Phase 2.4 (Mobile rendering depth pass)** — fix only what's actually broken (budget slider drag, guest-import 8-col preview at 375px). Skip the cosmetic. Most of this list is dead.
- **Phase 2.6 (Dashboard depth — activity feed)** — too generic, low-impact. Dead.

### Killed from remaining 22 deep-audit findings:
- Audit #27 (Markdown preview), #28 (slug live-validation), #30 (saved-state dirty depth), #43 (schedule date picker), #44 (sticky save bar polish) — all Zola-parity depth on public site. Dead.
- Audit #14 (mobile date input sticky save), #34 (assistant usage chip), #41 (alerts bell skeleton) — minor polish; do if they come up naturally, don't queue them.
- Audit #51 (3-step starter all-3 visible) — debatable design; current one-at-a-time is fine. Dead.
- Audit #61 (reconnecting flicker), #64 (chat auto-scroll respect), #65 (mobile autofocus) — chat polish; fix if Co-pilot stress test surfaces them, otherwise defer.

### Re-classified from "audit polish" to "still relevant":
- Audit #8 (budget slider step mid-drag) — already fixed
- Audit #17 (budget mobile slider) — yes, fix in mobile-must-do pass
- Audit #26 (guest-import 8-col table mobile) — yes, fix
- Audit #36 (multi-event support) — yes, **this is Move 5 above**
- Audit #37 (Co-pilot context expansion) — yes, depends on Move 1 findings
- Audit #62 (task re-anchor on wedding-date change) — yes, fix when convenient

---

## Architecture realities

The multi-tenant work shipped in T1.1-T1.5 (May 5-11) makes the two-vertical model cheap to operate. Most of what already exists works for both verticals:

- **Tenancy:** workspaces are org-scoped; org = planner (B2B) or "Acquired Planner platform" (B2C)
- **Skin system:** white-label branding per workspace; B2B couples see planner's brand
- **Mode resolution:** `b2c` / `b2c_acquired_style_collab` / `b2b_co_branded` / `b2b_white_label` already drive page forks
- **Write-guard pattern:** mutations are protected against silent RLS failures (T1.3)
- **Smoke suite:** 34 active tests on prod guard regressions (T1.4)

What needs to be added for the pivot:

1. **AI usage metering at the planner-tier level** (for B2B). Track AI API calls per workspace; surface usage to Astia in her billing dashboard. Hard-cap at Starter tier, soft-warn at Growth.
2. **Stripe subscription tables + webhook handler** (for B2B billing). Queued for Move 3.
3. **One-time payment flow** (for B2C). Probably Stripe Checkout pointed at a one-time price, write to workspace metadata "paid_at." Smaller than the subscription stack.
4. **Multimodal Claude API integration** (for photo→pricing). The Anthropic SDK already supports it; need a thin route handler + storage for uploaded images.

---

## Decision register — open Qs for Hursh

When you're ready, decide these (1-2 sentence each is fine):

1. **B2C pricing model** — one-time per wedding ($99/$149/$199) or freemium-with-cap ($0 + usage cap, $19/mo for unlimited)?
2. **B2B tier dollar amounts** — Starter / Growth / Enterprise. Astia's starting tier specifically.
3. **Co-pilot stress test result** — after Move 1, what bar do we need to clear before moving forward? (Suggested: ≥80% of answers score ≥4/5.)
4. **Photo→pricing scope** — start with floral installations only (highest-impact category) or go broader (any wedding object)?
5. **Multi-event scaffold timing** — build now (before Astia's first paying month) or after we have her real usage data?

---

## What to read first when resuming a session

In order of importance:

1. **This doc** (`STRATEGIC_PIVOT_2026-05-12.md`)
2. `docs/CLAUDE_PATTERNS.md` (the operating rules, still current)
3. `docs/audit_2026-05-12_DEEP_couple_usage.md` (deep audit; ~43 findings closed today, ~22 remain — most of the remainder is killed by this pivot)
4. `docs/PATH_TO_COMPLETE.md` (SUPERSEDED by this doc, kept for history)
5. `docs/OVERNIGHT_2026-05-12_summary.md` (yesterday's overnight handoff)

If a session's first action would be to start working on something killed by this doc, STOP and re-read this doc.

---

## End of pivot doc
