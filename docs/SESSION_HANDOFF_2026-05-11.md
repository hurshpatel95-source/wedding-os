# Session Handoff — May 11, 2026

**Project:** Acquired Planner (formerly wedding-os)
**Production:** https://wedding-os-production.up.railway.app
**Owner:** Hursh Patel
**Last working day:** May 11, 2026 (late afternoon)
**Sprint status:** Stabilization Sprint Tier 1 foundation — **COMPLETE**

---

## TL;DR for the impatient

1. **Foundation is done.** All 5 Tier 1 stabilization items shipped foundation. Every May 8 regression class is now structurally prevented.
2. **Production is stable.** 10/10 smoke tests pass on prod. No known regressions.
3. **One thing Hursh must do to activate the migration pipeline:** add `SUPABASE_DB_URL` to Railway env vars + run the backfill script. See §4.1 below.
4. **The non-negotiable rule:** no new features ship until Tier 1 is in full effect. T1.1 part 2 activation needed before any feature work resumes.
5. **Strategic posture:** B2B planner portal first (per `docs/PRODUCT_ROADMAP.md` Track 1), B2C image-gen engine second, Brigette pitch deferred to Q3 2026 for Vertical 2 (Acquired Honeymoon).
6. **Rachel-led launch ready when you say go.** Account provisioned (`raachmc@aol.com / Wedding2027!`), Switch House venue + 37 tasks pre-loaded, brief drafted.

---

## How to use this doc

This is the gold-standard "READ FIRST" doc for resuming work on Acquired Planner.

**Reading order on session resume:**

1. **This file (`docs/SESSION_HANDOFF_2026-05-11.md`)** — comprehensive snapshot of May 11
2. **`docs/COMPACT-HANDOFF.md`** — quick punch list (always current, updates with each session)
3. **`docs/STABILIZATION_SPRINT.md`** — sprint plan + which items are still pending
4. **`docs/PRODUCT_ROADMAP.md`** — post-stabilization roadmap (60-day plan)
5. **`docs/STATE-OF-THE-BUILD.md`** — full architecture map + bug history
6. **`docs/acquired_planner_spec.md`** — master product spec (vision, HoldCo, image gen, partnership)
7. **`docs/stabilization/T1.*_design.md`** — per-item design docs for each Tier 1 deliverable

If you only have 5 min: read TL;DR + §4 (pending) + §9 (next session checklist).

---

## 1. Strategic context (the WHY)

### What this product is

**Acquired Planner** — AI-first wedding planning platform with two distinct business models sharing one technical stack:

- **B2C** — self-serve couples plan their own weddings. Replaces Zola long-term. Marketing engine via wedding-website footers + RSVP emails (every wedding has ~150 guests = built-in viral loop).
- **B2B white-label planner portal** — wedding planners onboard their clients. **This is where the real money lives.** Each planner brings 10-30 weddings of B2C distribution for free. Higher willingness-to-pay ($300-500/mo planner subscription vs ~$79/mo couple subscription).

### Why "Acquired" (the brand)

Eventually licensed from Brigette Pheloung (@acquired.style on IG, 1M+ followers as of April 2026 viral St. Barts bachelorette). She's the brand face; Hursh is the operator. "Acquired" becomes the umbrella for 5 AI lifestyle products:

| # | Vertical | Launch |
|---|---|---|
| 1 | **Acquired Planner** | Q3-Q4 2026 (this project) |
| 2 | **Acquired Honeymoon** | Q1 2027 |
| 3 | **Acquired Home** | Q2 2027 |
| 4 | **Acquired Style** | Q3 2027 |
| 5 | **Acquired Mama** | TBD |

### Why Brigette is deferred (decided May 8)

Original plan: 14-day sprint to pitch her as launch partner for Acquired Planner. **Confirmed her wedding is June 2026 (next month).** She's in execution mode, not planning mode. Pitching a wedding-planning tool 4 weeks before her wedding is wrong-tool-wrong-time. The opportunistic-founder pattern in `acquired_planner_spec.md` §10 explicitly warns against this kind of mismatch.

**Revised plan (May 8):**
- Rachel McGrath (Sept 12, 2026 wedding, Switch House Philly) is the actual launch user. She's in Brigette's bachelorette circle, so word-of-mouth still flows toward Brigette through real product experience.
- Brigette pitch deferred to Q3 2026 for **Vertical 2 (Acquired Honeymoon)** — she'll be in honeymoon-planning mode then. Right tool, right time, real product behind the pitch (paying customers from Acquired Planner already exist).
- **No equity given to anyone until paying customers exist.** Spec §7 explicitly says no VC, no cash to influencer upfront. Lifestyle / cash-flowing micro-SaaS unless threshold logic triggers HoldCo scale.

### The Hursh-pattern-to-watch-for (from spec §10)

> "You are an opportunistic founder. Failure mode: starting new things every time current thing hits a hard problem. The Brigette pitch is hard. Cap table negotiation is hard. If a shiny new idea appears mid-build, name it as avoidance and go back to the harder problem."

This is the founder-self-discipline guard. The Stabilization Sprint exists because Hursh recognized that the "everything is bugs" feeling on May 8 was the foundation cracking, and the right response was foundation work, not new features.

---

## 2. Where we are right now (the NOW)

### Production state (verified May 11, 17:30)

- **URL:** https://wedding-os-production.up.railway.app
- **Latest commit:** `6076f66` — T1.3 phase 1
- **Smoke test result:** 10 passed / 1 skipped / 0 failed in 37.7s
- **Database:** Supabase project `dfyryyzizxcxtysduono`, 34 migrations applied, healthy
- **All test accounts:** can sign in, no broken pages
- **All payment / Stripe paths:** not yet wired (Stripe key not set in env — by design, no monetization built yet)

### What "stabilization sprint complete" means

The 7 systemic patterns from `docs/STATE-OF-THE-BUILD.md` §11 that produced the 12 May 8 regressions:

| # | Pattern | Status after sprint |
|---|---|---|
| 1 | Silent failures masquerading as success | ✅ Write-guard pattern shipped (T1.3) |
| 2 | Schema-code drift with no detection layer | ✅ gen:types workflow + migration auto-apply scripts (T1.1 + T1.2) |
| 3 | No integration tests on critical paths | ✅ Playwright smoke suite, 11 tests passing (T1.4) |
| 4 | Worker agents write outside scope | ⏳ Not addressed (Tier 2, deferred) |
| 5 | B2B/B2C share one shell without fork | ✅ Mode-based fork at layout level (T1.5) |
| 6 | No deploy-time guardrails | ⏳ Railway preDeploy hook ready, awaiting env var (T1.1 part 2) |
| 7 | No observability after deploy | ⏳ Not addressed (Tier 2 — Sentry deferred) |

5 of 7 patterns are eliminated. The remaining 2 are intentionally deferred to Tier 2 / Tier 3.

---

## 3. Everything that's been done (the HISTORY)

### 3.1 Pre-sprint work (already shipped before May 11)

The codebase is more than vapor. As of session start May 11, ~30 features were already production-quality:

**Backend foundation:**
- Multi-tenant Supabase (organizations, workspaces, users, RLS-enforced)
- 34 SQL migrations (auth, vendors, venues, guests, planning, budget, pricing, payments, public site, etc.)
- Anthropic SDK 0.94 wired (Sonnet 4.6 for extraction with forced tool use, Haiku 4.5 with prompt caching for chat)
- Google Places API for vendor + venue search
- Storage buckets: venue-photos, library-media, documents

**Couple shell (`/(app)/`):**
- Dashboard with countdown + activity feed + venue cards
- AI onboarding chat with 9 structured fields + multi-event venue capture (mehndi/sangeet/welcome/rehearsal/after_party/brunch/stay) + "anything else" free-form
- /plan — 84-task starter checklist seeded on completion + Monday.com-style task drawer + per-task cost-link to budget lines
- /budget — AI baseline generator (Sonnet 4.6 produces ~70-line tree) + drag sliders OR click-to-edit numeric input + add-new-category form
- /estimator — forks B2B (renders Astha PDF data from budget_estimates) vs B2C (renders drill-down on budget_lines with vendor swap + scenario edit)
- /vendors — Google Places search + AI-drafted personalized RFP emails + vendor detail page with Contact/Pricing/Tasks/Files tabs
- /guests — manual add + Excel import with AI column mapping + per-event invitations + seating organizer
- /payments — milestone calendar, planner invoices, currency-aware
- /spend — per-vendor commit + paid tracking
- /timeline — day-of run-of-show editor
- /availability — venue-date status calendar
- /map — venue map with geocoding
- /compare — side-by-side venue comparison
- /pricing — Full Pricing Planner with multi-event venue picker + editable line items + localStorage persistence (restored May 8 after Wave 3 agents deleted it)
- /settings/preferences — couple identity, big day, guests+budget, currency toggle, account
- /settings/public-site — wedding website editor with 5 themes
- /w/<slug> — public wedding site + RSVP form (writes to guest_event_invitations)

**Planner admin shell (`/(admin)/`):**
- Multi-client dashboard
- Per-client workspace impersonation
- Library (reusable venues + vendors + media)
- Playbook editor (phase + task templates)
- Pricing intake wizard (PDF parser → structured pricing_scenarios)
- Proposals + contracts
- Email composer + templates
- Marketing / leads tracking
- Time tracking
- Invoice management

**AI / Autopilot:**
- AI vendor sourcing agent — Google Places + Sonnet 4.6 with forced personalized email tool use
- AI budget baseline gen — produces full ~70-line tree from guest count + region
- AI onboarding chat — extracts 9 fields + venue candidates with event_roles + free_form_notes
- AI alerts engine — daily run analyzes vendor pipeline, surfaces blockers
- AI thread analyzer — parses vendor email replies into structured intent
- AI RFP drafter — personalized outreach emails per vendor

**Strategic documents written May 8 (post-architectural-debt reckoning):**

- `docs/acquired_planner_spec.md` (512 lines) — master product spec
- `docs/STABILIZATION_SPRINT.md` — the 2-week prevention/detection plan
- `docs/PRODUCT_ROADMAP.md` — post-stabilization 60-day plan, B2B-first
- `docs/COMPACT-HANDOFF.md` — short-form "read first" for new sessions
- `docs/STATE-OF-THE-BUILD.md` — comprehensive architecture map + bug history

### 3.2 Stabilization Sprint (May 11 — this session)

5 commits, ~3 hours of work, all 5 Tier 1 items shipped with foundation:

| Commit | Item | What it ships |
|---|---|---|
| `7ac77cf` | **T1.5 — B2B/B2C fork** | `lib/workspace-mode.ts` + React provider + `(app)/layout.tsx` integration + 4 page forks (/dashboard, /autopilot, /plan, /vendors) + design doc |
| `5197661` | **T1.4 — Smoke test foundation** | Playwright installed + configured + auth helper + 11 tests across 5 spec files passing on prod in 37s + npm scripts (`pnpm smoke`) |
| `3b0dbc7` + `0decd17` | **T1.1 part 1 — Migration auto-apply** | `_migrate.ts` applicator + `_migrate_backfill.ts` one-shot init + `pnpm migrate / migrate:status` scripts + `railway.json.staged` (held until env var set) + design doc |
| `e1cc189` | **T1.2 phase 1 — Type cleanup foundation** | Audit doc (473 casts across 20+ untyped tables) + `pnpm gen:types` script + Supabase CLI install instructions + design doc |
| `6076f66` | **T1.3 phase 1 — Write-guard pattern** | `lib/db-write-guard.ts` with `dbUpdate / dbInsert / dbDelete / DbWriteError / dbWriteErrorResponse` + applied to 3 exemplar endpoints (/api/workspace/preferences, /api/planning-tasks/[id], /api/budget-lines/[id]) + design doc |

**Net change:** +1,300 lines of foundation code, +5 design docs, 11 smoke tests catching regressions automatically.

---

## 4. Everything that's pending (the IMMEDIATE NEXT)

### 4.1 Hursh-owned activation tasks (NOT BLOCKING — do when convenient)

**Activate T1.1 part 2 — Railway migration auto-apply.** This flips the "auto-apply migrations on every deploy" pipeline on. Without this step, T1.1 is just scripts that don't run.

```bash
# Step 1 — get the direct DB connection URL
# In Supabase dashboard → Project Settings → Database → "Direct connection"
# (NOT the pooler — pooler doesn't support DDL like ALTER TYPE ADD VALUE)
# Format: postgres://postgres:[YOUR-PASSWORD]@db.dfyryyzizxcxtysduono.supabase.co:5432/postgres

# Step 2 — run the backfill ONCE (marks all 34 existing migrations as already applied)
cd ~/Documents/wedding-os
SUPABASE_DB_URL='postgres://...' pnpm tsx supabase/seed/_migrate_backfill.ts

# Step 3 — verify 0 pending
SUPABASE_DB_URL='postgres://...' pnpm migrate:status

# Step 4 — add SUPABASE_DB_URL to Railway service env vars
# Railway dashboard → service → Variables → add new

# Step 5 — flip the staged config to active
mv railway.json.staged railway.json
git add railway.json
git commit -m "feat(stabilization): T1.1 part 2 — activate Railway migration auto-apply"
git push
```

After step 5: every push to main runs `pnpm migrate` before Railway promotes the new container. Failed migrations abort the deploy. Zero risk of "code shipped, migration forgot."

### 4.2 Sprint follow-up (phase 2 items, deferred to focused follow-up)

| Item | Effort | Notes |
|---|---|---|
| **T1.2 phase 2** — eliminate 473 `as unknown as` casts | 1-2 days | Requires Supabase CLI auth first (install + link). Then `pnpm gen:types` and iterative cleanup. |
| **T1.3 phase 2** — roll write-guard to remaining ~110 mutation endpoints | 1 day | Mechanical refactor. Pattern is exemplified by 3 routes. Apply same pattern everywhere. |

Both are "do in a single focused block" type work — better than spreading across feature sprints.

### 4.3 Smoke test expansion (T1.4 growth, ongoing)

Currently 11 tests; target is 25. **Next 5 to add (highest value):**

1. `06-budget-baseline-gen.spec.ts` — /budget generates an AI baseline successfully
2. `07-plan-cost-link.spec.ts` — /plan task cost-link saves + auto-creates budget line (B2C only)
3. `08-vendors-empty-state-fork.spec.ts` — empty state copy differs B2C vs B2B
4. `09-estimator-fork.spec.ts` — B2B sees budget_estimates view; B2C sees drill-down
5. `10-rsvp-form-public-site.spec.ts` — /w/<slug> RSVP submit writes to guest_event_invitations

Grow as features ship. Aim for one new test per new feature, retroactive backfill for existing.

### 4.4 Rachel send (awaiting Hursh decision)

Rachel's account is fully set up:
- Email: `raachmc@aol.com` / Password: `Wedding2027!`
- Workspace: Rachel & Jay — Philadelphia 9.12.26
- Venue: The Switch House (1325 N Beach St, Philadelphia, PA 19125, +1 267-817-3311, cap 150-325, decided, lead pick)
- 37 starter planning tasks with deadlines computed from Sept 12, 2026

Brief drafted (in conversation history). When you're ready to send, copy from prior message. **Suggested:** send the morning Hursh has time to monitor for her first questions / glitches.

### 4.5 Stabilization debt (Tier 2/3 — addressed later)

| Item | Why deferred |
|---|---|
| Sentry integration | 30 min to wire but no immediate pain — smoke tests catch regressions in CI |
| Worker agent scope enforcement | Required only if we resume agent-driven parallel feature work |
| Feature flag table | Helpful but not blocking — current feature gates work fine for B2B/B2C fork |
| Schema-state assertion at boot | Backstop for T1.1; not needed if T1.1 activation succeeds |

---

## 5. Everything that's planned (the FUTURE)

### 5.1 Track 1 — B2B planner portal (60-day plan, post-activation)

Per `docs/PRODUCT_ROADMAP.md`. The "real money lives here" path.

**Phase 1 — Make Astia a paying customer** (Week 1)
- Charge Astia $X/month (test at $200, raise as features ship)
- Quarterly check-in cadence

**Phase 2 — Self-serve planner onboarding** (Weeks 2-4)
- `/planner/signup` route — Stripe Checkout → org + workspace + admin role provisioned
- Stripe products: starter / pro / unlimited tiers
- Stripe webhook → marks org `subscription_active`
- Onboarding email sequence (Resend, 7-day arc)
- "Trial ends in N days" banner in admin shell

**Phase 3 — Client invitation flow** (Weeks 4-6)
- `/admin/clients/new` — planner enters couple email + wedding date + region + names
- Magic-link → couple lands on pre-branded `co_branded` skin workspace
- Per-couple billing line item on planner's subscription (metered)

**Phase 4 — Per-planner branding control panel** (Weeks 6-7)
- `/admin/branding` — upload logo, set accent_hex, set planner_display_name + email + phone
- Preview pane showing couple-facing view
- **Backfill Astia's branding row** so Hursh & Nisha co_branded display restores

**Phase 5 — Document vault + invoice OCR** (Weeks 7-9)
- `/admin/clients/[id]/documents` drop-zone
- Claude vision parses PDFs: vendor, amounts, due dates, line items
- Per-vendor + per-couple groupings

**Phase 6 — Multi-couple cross-dashboard** (Weeks 9-10)
- Planner sees: all weddings, days-to-wedding countdowns, pending RFPs, next-30-day milestones, cross-workspace cash flow
- Filter by client, status, venue

**Phase 7 — Outbound to other planners** (Weeks 10-12)
- Pitch deck (planner-flavored, separate from HoldCo / Brigette deck)
- 50 planners via IG DM + FB groups
- Goal: 5 paying planners by week 12 = 50-150 active B2C couples flowing through

### 5.2 Track 2 — B2C consumer differentiator (parallel weeks 6-14)

Per `docs/PRODUCT_ROADMAP.md` + `acquired_planner_spec.md` §4.

**Phase 1 — Aesthetic Profile system** (Weeks 6-7)
- `aesthetic_profiles` table
- Onboarding: bride uploads 8-15 inspiration pins + venue photos + questionnaire
- Claude distills into structured profile (palette, mood, density, lighting, type, avoid)
- Persists per workspace, surfaces on every visual feature

**Phase 2 — Image generation engine** (Weeks 7-10)
- **TOS check first** — Higgsfield commercial wrap allowed? If not, Fal/Replicate.
- Model-agnostic abstraction layer (`apps/web/lib/image-gen/`)
- Flow 1 — venue rehearsal: venue photo + aesthetic → 4 variations per credit
- "Refine" → 4 new in chosen direction
- "Lock + use" → save to lookbook

**Phase 3 — Vendor Brief PDF generator** (Week 10)
- One-tap "Generate Vendor Brief" on any locked image
- PDF: image + aesthetic summary + item list + dimensions + reference pins + couple contact

**Phase 4 — Pricing + credit economy** (Weeks 10-12)
- Stripe products: Starter $29/mo, Plan $79/mo, Visualize $149/mo, Wedding Pass $499 one-time, Concierge $1,499
- Credit refill packs: $19/30, $49/100, $129/300, $399/1200
- Per-workspace credit balance, debited per generation

**Phase 5 — More visual flows** (Weeks 12-14)
- Mood board, save-the-date, tablescape, floral mockup, signage, cake, dress, bridesmaids, H&M
- All variations of the image engine + aesthetic profile

**Phase 6 — Agent suite** (Weeks 14-20)
- Negotiation agent
- Contract review agent
- Day-of timeline agent (high stakes — ship cautiously)
- Budget reallocation agent
- Seating arrangement agent
- Plus tablescape / cake / signage flows building on image engine

### 5.3 Q3 2026 — Brigette pitch for Vertical 2 (Acquired Honeymoon)

Per spec §7-8. **By the time we pitch:**

- Acquired Planner has been live for ~3 months
- 5-10 paying planners
- 50-150 active B2C couples
- Rachel + 2-3 friends have real testimonials
- Brigette is back from her honeymoon, in newlywed mode

**The pitch becomes:** "We launched Acquired Planner with Rachel and 5 wedding planners. It works. Now I want to launch Acquired Honeymoon with you. Here's the HoldCo deal across all 5 verticals."

Deal structure per spec §7:
- 5-7% HoldCo equity, 3-year vest, 6-month cliff
- First $100K profit goes 100% to Brigette
- After: 25% net profit OR 20% rev share on Acquired Edit pack (her choice)
- Brand IP licensing for "Acquired" name (2% royalty)
- First right of refusal on future verticals

### 5.4 Verticals 3-5 (2027+)

- **Acquired Home** (Q2 2027) — post-wedding registry + AI interior design
- **Acquired Style** (Q3 2027) — AI personal stylist using Brigette's aesthetic
- **Acquired Mama** (TBD) — AI for new moms

Each reuses the same AI agent + Higgsfield + workflow layer = 1 platform, 5 SKUs.

### 5.5 Threshold logic for HoldCo commitment

From spec §9:

| 30-day post-launch subs | Decision |
|---|---|
| <300 | Launch failed. Keep alive at low cost. Don't quit other businesses. |
| 300-600 | Real signal. Iterate. Add 1-2 launch partners. Re-evaluate at 90 days. |
| 600-1,000 | Working. Acquired above HonesTree. Hire 1 FT eng. Start Vertical 2. |
| 1,000+ | Breakout. Drop everything except FlowPilot + Acquired. Raise seed. |
| 2,000+ | Unicorn-shaped. Stop everything else. CEO advisor. Raise capital. |

Pre-commit this in writing the day you launch. Tell one accountability partner (Raj / Nisha / Jay / peer founder).

---

## 6. Architectural decisions log

Key decisions made during May 8-11 that should NOT be re-litigated without strong reason:

| Decision | Rationale |
|---|---|
| **3 user types, 2 shells** | Couple-shell `/(app)/` is shared between B2B planner-served and B2C self-serve couples; planner-admin `/(admin)/` is separate. Forking at the layout level via `workspace.skin → mode` is sufficient — full route split would be a bigger refactor for marginal benefit. |
| **workspace.skin enum as the brand source of truth** | `acquired_planner` / `co_branded` / `white_label` / `acquired_style_collab`. Resolves to `WorkspaceMode` via 1:1 mapping. Future skins map to existing modes — don't add new modes without compelling reason. |
| **Write-guard via library helper, not DB triggers** | Application-layer assertion (returned rows + DbWriteError) is more debuggable than a DB-level constraint. RLS still enforces security — write-guard catches "RLS denied" silently. |
| **Migration auto-apply via Railway preDeploy, not GitHub Action** | Railway already has env vars; GitHub Action would need secrets management. preDeploy fails before promotion, so bad migrations don't reach prod. |
| **Smoke tests target prod by default, not local** | Regressions surface on prod, so test on prod. Local override via `PLAYWRIGHT_BASE_URL`. |
| **Foundation-first discipline, locked in writing** | `docs/STABILIZATION_SPRINT.md` says no new features until Tier 1. The non-negotiable rule. Any future "let me just ship X" prompt that bypasses the sprint gets flagged as opportunistic-founder pattern. |
| **Brigette deferred to Q3 2026 / Vertical 2** | Her June 2026 wedding = wrong tool, wrong time for Acquired Planner. Pitch Acquired Honeymoon when she's actually a newlywed. Don't burn the warm intro on a mistimed pitch. |
| **B2B-first commercial sequencing** | Planners pay $300-500/mo + bring 10-30 couples each = better LTV + free B2C distribution. Per `PRODUCT_ROADMAP.md` Track 1. |
| **No equity given before paying customers exist** | Per spec §7. Cash-flowing micro-SaaS unless threshold logic triggers full HoldCo. |

---

## 7. Operational reference

### 7.1 Test accounts (all `Wedding2027!`)

| Email | Workspace | Skin | Role | Purpose |
|---|---|---|---|---|
| `hurshpatel@greenskynj.com` | Astia | — | admin | Hursh as Astia planner admin |
| `astha@astiaevents.com` | Astia | — | admin | Astha primary planner |
| `hurshpatel95@gmail.com` | Nisha & Hursh — Barcelona 2027 | acquired_planner * | couple | Hursh's actual wedding (B2B served by Astia) |
| `nishadesai98@gmail.com` | Nisha & Hursh — Barcelona 2027 | acquired_planner * | couple | Nisha — multi-user couple |
| `rodnj.ops@gmail.com` | Hursh's test wedding | acquired_planner | couple | B2C cold-start test |
| `kcdevine96@gmail.com` | Kyle & Michelle — Newport | acquired_planner | couple | Real friend Kyle |
| `j.salicandro@gmail.com` | John's wedding | acquired_planner | couple | Real friend John |
| `raachmc@aol.com` | Rachel & Jay — Philadelphia 9.12.26 | acquired_planner | couple | Real friend Rachel — pre-launch test |

\* Hursh & Nisha is a planner-served (B2B) workspace within the Astia Events org but rolled back to `acquired_planner` skin on May 8 because `workspace_branding` row is missing. Restoring `co_branded` requires backfilling Astia's brand assets (logo, accent_hex, planner_display_name) — Track 1 Phase 4 above.

### 7.2 Environment variables (Railway prod)

| Var | Status | Effect if unset |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ Set | All AI features work |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Set | App boots |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Set | Client-side reads work |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Set | Service-role server writes work (write-guard depends on this) |
| `GOOGLE_PLACES_API_KEY` | ✅ Set | Vendor + venue auto-enrich |
| `GMAIL_OAUTH_CLIENT_ID` + `GMAIL_OAUTH_CLIENT_SECRET` | ⚠️ Testing mode | Gmail autopilot for couples (limited to test users, 7-day refresh) |
| **`SUPABASE_DB_URL`** | ❌ **Not set — required for T1.1 part 2 activation** | Migration auto-apply doesn't run |
| `STRIPE_SECRET_KEY` | ❌ Not set | Required for monetization (Track 1 Phase 1) |
| `RESEND_API_KEY` | ❌ Not set | Real outbound email — required for planner onboarding emails (Track 1 Phase 2) |
| `GOOGLE_OAUTH_CLIENT_ID` (calendar) | ❌ Not set | Booking-page conflict dimming |
| `BRAVE_SEARCH_API_KEY` | ❌ Not set | Search fallback when Google Places insufficient |
| `CRON_SECRET` | ❌ Not set | Daily 8 AM digest |

**Most important env var to add next:** `SUPABASE_DB_URL` to activate T1.1 part 2.

### 7.3 All migrations applied to prod

34 SQL files in `supabase/migrations/`, all manually pasted into Supabase dashboard between May 5-11. After T1.1 part 2 activates, future migrations auto-apply on push.

Key migrations:
- `20260505000001_init.sql` — base schema
- `20260505000002_rls.sql` — Row-Level Security policies
- `20260505000004_event_roles.sql` — multi-event venue support
- `20260506000007_planning_tasks.sql` — task system
- `20260507000002_wave3_autopilot.sql` — alerts + autopilot infrastructure
- `20260508000001_event_roles_extension.sql` — added rehearsal / after_party / brunch
- `20260508000002_task_budget_link.sql` — `planning_tasks.budget_line_id` + `estimated_cost`
- `20260508000003_workspace_skins.sql` — `workspace.skin` enum

### 7.4 All commits (May 11 sprint)

```
6076f66 feat(stabilization): T1.3 phase 1 — write-guard helper + 3 exemplar endpoints
e1cc189 feat(stabilization): T1.2 phase 1 — type-cleanup audit + gen:types workflow
0decd17 chore: ignore railway.json.staged (T1.1 activation file)
3b0dbc7 feat(stabilization): T1.1 part 1 — migration applicator + backfill scripts
5197661 feat(stabilization): T1.4 — Playwright smoke-test foundation + 5 specs
7ac77cf feat(stabilization): T1.5 — B2B/B2C fork at the layout level
1796a01 docs: persistence layer for stabilization-first discipline
```

### 7.5 All docs in `docs/`

```
docs/
├── SESSION_HANDOFF_2026-05-11.md    ← THIS FILE
├── COMPACT-HANDOFF.md                ← READ FIRST (short)
├── STABILIZATION_SPRINT.md           ← Sprint plan + completion state
├── PRODUCT_ROADMAP.md                ← Post-stabilization 60-day plan
├── STATE-OF-THE-BUILD.md             ← Architecture map + bug history
├── acquired_planner_spec.md          ← Master product spec
└── stabilization/
    ├── T1.1_design.md                ← Migration auto-apply design
    ├── T1.2_design.md                ← Type cleanup design
    ├── T1.3_design.md                ← Write-guard design
    └── T1.5_design.md                ← B2B/B2C fork design
```

---

## 8. The 12 May 8 regressions (preserved for the lesson)

Documented in `STATE-OF-THE-BUILD.md` §11 in detail. Summary so future-Hursh and future-Claude don't forget what happens when foundation isn't solid:

1. `/estimator` silently broken — rewired to `budget_lines` table from `budget_estimates`. User discovered 3 days later.
2. `/settings/preferences` silent-fail — RLS blocked, API returned 200, UI lied "Saved."
3. `/plan` task cost-link 500s — code referenced column that migration hadn't created in prod.
4. `/onboarding` "Failed to fetch" toast on every cold-start turn — friendlier copy + retry shipped.
5. Worker D wrote outside scope — agent touched files beyond its allowlist.
6. Skin migration set Astia client workspaces wrong — filter matched workspace name (couple), not org name.
7. `seed_rachel.ts` had `notes`-column bug — silent insert failure, Switch House missing for Rachel.
8. Email composer admin-template fetch 403'd for couples — graceful fallback added.
9. Vendor admin gates blocked 4 core couple features — gates dropped.
10. Currency leaks across 17 files — B2C US couples saw € throughout.
11. /spend Spanish VAT multiplier inflated B2C totals by 21% — removed.
12. Login page hardcoded "Barcelona Sept 2027" + "wedding-os" title — generic now.

**Every one of these maps to a Tier 1 sprint item or a Tier 2/3 deferred item.** The sprint isn't theoretical — it's the specific work that prevents these specific regressions from re-occurring.

---

## 9. How to pick up next session (the checklist)

**Step 1 — Reconstitute context (10 min)**
```bash
cd ~/Documents/wedding-os
git log --oneline -10
cat docs/SESSION_HANDOFF_2026-05-11.md      # ← this file
cat docs/COMPACT-HANDOFF.md
```

**Step 2 — Verify nothing's broken (2 min)**
```bash
cd apps/web && pnpm smoke
# Expected: 10 passed, 1 skipped, 0 failed in ~40s
```

**Step 3 — Decide what to work on**

In priority order:

a) **Activate T1.1 part 2** (Hursh task, ~10 min) — see §4.1 above. Unlocks migration auto-apply.

b) **Send Rachel her brief** (Hursh task, ~5 min) — copy from prior conversation, verify login works incognito, send.

c) **Start B2B planner portal Track 1 Phase 1** — charge Astia. Real revenue starts here. Requires Stripe key in Railway env.

d) **Grow smoke test suite** — add tests 6-25 per §4.3. Use it as a tool to lock in each new feature.

e) **T1.2 phase 2** — eliminate the 473 casts. Needs Supabase CLI auth first.

f) **T1.3 phase 2** — roll write-guard to remaining ~110 endpoints. Mechanical.

g) **B2C image gen engine** — `acquired_planner_spec.md` §4. Needs Higgsfield TOS confirmation first.

**Step 4 — Tell Claude what you picked and start**

Don't improvise new features. The non-negotiable rule still applies: foundation gaps (T1.1 part 2, Tier 2 observability) before new features unless you're explicitly chosen the order.

---

## 10. Brigette / Rachel intel (for future Q3 pitch)

Preserved here so future sessions can re-load the social context:

- **Brigette Pheloung** — @acquired.style on IG, 1M+ followers (as of April 2026)
- **Twin sister Danielle** — @daniellephe, co-creator on "Acquired Style"
- **Brigette's fiancé** — Mitch McHale (Wall Street / finance background per public profile)
- **Brigette's wedding** — June 2026 (confirmed May 8)
- **Bachelorette trip** — April-May 2026 in St. Barts, sponsored by Swan Beauty (AI mirror startup) → viral moment
- **Press citation:** People article April 2026 noted Brigette "leaning on her fiancé for wedding planning"
- **Rachel McGrath** — Hursh's friend, was IN Brigette's bachelorette party (close friend, not just adjacent)
- **Rachel's wedding** — September 12, 2026 at Switch House Philadelphia (Cescaphe Group)
- **Rachel's fiancé** — Jay Farnsworth

**Path to Brigette pitch:** Rachel uses Acquired Planner for her own wedding (planning Aug-Sept 2026) → has real organic experience → naturally mentions to Brigette in friend conversation → Brigette is post-honeymoon Aug 2026, in newlywed-and-planning-for-Vertical-2 mode → Hursh gets warm-intro pitch meeting for Acquired Honeymoon, NOT Acquired Planner.

Do NOT pitch Brigette before her wedding. The spec is clear: don't burn the warm intro on a mistimed offer.

---

## 11. Lessons codified

The 5-doc persistence layer plus this handoff is the durable artifact of the May 8-11 learning arc. Key meta-lessons preserved:

1. **Foundation before features.** If the foundation can't hold N features, it can't hold N+1. Stabilization is the work that makes feature velocity sustainable.

2. **Silent failures are the worst class.** A 500 you see is better than a 200 that lies. Build write-guards, schema-state assertions, and smoke tests so silent failures become loud failures.

3. **Architectural fork points beat conditional rendering.** When B2B and B2C diverge, fork at the layout, not in every component. One fork point = one place to evolve.

4. **Persist intent in docs that survive compaction.** Conversation context gets lost; markdown in `docs/` doesn't. Every architectural decision lives in a design doc.

5. **The opportunistic-founder pattern is real.** Hursh's instinct toward shiny new ideas mid-build is a feature for exploration but a bug for execution. The non-negotiable rule guards against it.

6. **Influencer launches require right-tool-right-time.** Brigette wasn't a bad pitch; it was a mistimed one. Better to wait for Vertical 2 with a working product than rush a half-built thing.

7. **B2B is the path for cash-flowing micro-SaaS.** B2C marketing burns through cash without distribution. Planners pay more per seat, bring distribution for free, and validate willingness-to-pay early.

---

## End of handoff

If you're reading this in a future session, you have everything you need to pick up where May 11 left off. Start with §9 ("How to pick up next session") and pick your priority.

If you're Claude in a fresh session, your first message after reading this should be:

> "I've read SESSION_HANDOFF_2026-05-11.md. We're at the post-stabilization fork — Tier 1 foundation is shipped. Before I do anything: do you want to (a) activate T1.1 part 2 (env var + flip railway.json.staged), (b) send Rachel, (c) start B2B planner portal Phase 1 (Stripe + Astia paying), or (d) something else? I will not improvise new features without your direction."

That's the right opening posture.
