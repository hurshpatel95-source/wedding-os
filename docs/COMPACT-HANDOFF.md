# READ THIS FIRST — Compact Handoff

**Last updated:** May 11, 2026 (sprint completion)
**Project:** Acquired Planner (formerly wedding-os)
**Owner:** Hursh
**Production:** https://wedding-os-production.up.railway.app

---

## 🟢 SPRINT STATUS — ALL TIER 1 FOUNDATION SHIPPED

As of `6076f66` (May 11), the Stabilization Sprint's 5 Tier 1 items are foundation-shipped. The 7 systemic patterns from May 8 are addressed (5 fully eliminated, 2 deferred to Tier 2/3). Smoke tests pass 10/10 on prod.

**For full handoff see `docs/SESSION_HANDOFF_2026-05-11.md`** — the comprehensive snapshot of everything done / pending / planned.

---

## ⚠️ ONE NON-NEGOTIABLE RULE STILL APPLIES

**Do NOT improvise new features without explicit Hursh direction.**

Before resuming feature work, finish:
1. **T1.1 part 2 activation** — add `SUPABASE_DB_URL` to Railway env + run backfill (see §4.1 of SESSION_HANDOFF). Without this, migrations remain manual and the May 8 class of bug can return.
2. **Smoke test verification** — run `pnpm smoke` from `apps/web/` and confirm 10/10 passing before any push.

If a future Hursh-prompt asks for a new feature without the activation step done — point at this doc, name it as the opportunistic-founder pattern (`acquired_planner_spec.md` §10), and unblock the foundation first.

---

## What this product is

**Acquired Planner** — AI-first wedding planning platform. Two distinct businesses sharing one platform:

1. **B2C** (couples plan their own weddings) — replaces Zola long-term. Marketing engine via wedding-website footers + RSVP emails.
2. **B2B white-label planner portal** — wedding planners onboard their clients into a branded version. **This is where the real money lives.** Each planner brings 10-30 weddings of B2C distribution.

Full product spec: `docs/acquired_planner_spec.md` (master doc — vision, HoldCo, partnership, launch plan, 5-vertical roadmap).

---

## Where the build is right now (as of May 8, 2026)

### ✅ Working in production

- Multi-tenant Supabase (couples, planners, organizations, workspaces)
- Couple shell (B2C): /, /onboarding, /plan, /budget, /estimator, /vendors, /vendors/find, /guests, /payments, /spend, /timeline, /availability, /map, /settings/preferences, /settings/public-site, /pricing, /w/<slug>
- Planner admin shell (B2B): /admin/* with multi-client management (Astia uses this for 4 active client weddings)
- AI vendor sourcing via Google Places + AI-drafted personalized RFP emails
- AI budget baseline generation (Sonnet 4.6, ~70 line items per workspace)
- Multi-event onboarding chat (mehndi/sangeet/welcome/rehearsal/after_party/brunch/stay)
- Public wedding sites with 5 themes + RSVP form (per-event invitations)
- Plan ↔ Budget ↔ Estimator linkage (planning_tasks.budget_line_id + estimated_cost)
- Workspace skin system (acquired_planner / co_branded / white_label / acquired_style_collab)
- Estimator B2B/B2C fork (reads budget_estimates for planner-served, budget_lines for B2C)
- Full Pricing Planner with editable line items + localStorage persistence (B2B)
- Currency-aware throughout (USD primary, EUR for European weddings)
- 8 test accounts provisioned (see roster below)

### ⚠️ Known issues (NOT to fix mid-stabilization — these inform the sprint)

See `docs/STATE-OF-THE-BUILD.md` "Known regressions" for full list. Highlights:
- /onboarding "Failed to fetch" toast on first message (cold start) — has retry now but still surfaces
- Workspace branding rows missing for Astia clients → co_branded fallback looks generic
- Schema-code drift: migrations like `planning_tasks.budget_line_id` must be pasted into Supabase manually
- Multiple cast-the-types places where DB drift is invisible
- Worker agents have written outside their stated scope (Worker D, Wave 3 agents)

---

## The strategic pivot we made May 8

**Acquired / Brigette Pheloung partnership is DEFERRED.** Brigette's wedding is June 2026 (next month) — too late in her planning cycle to use a planning product. Approaching her for a wedding-tool launch 4 weeks before her wedding is wrong-tool-wrong-time.

**What we do instead (per `docs/PRODUCT_ROADMAP.md`):**

1. **Rachel-led B2C launch** (Rachel McGrath, Sept 12 2026 wedding at Switch House Philly) — already provisioned, awaiting send
2. **B2B planner portal first** — Astia is the design partner + first paying customer. Sell to other planners via founder-led outbound. Higher willingness-to-pay ($300-500/mo per planner) and each planner brings 10-30 weddings of B2C distribution for free.
3. **Brigette pitch deferred to Q3 2026** — for **Vertical 2 (Acquired Honeymoon)**, not for Acquired Planner. She'll be in honeymoon-planning mode then. Right tool, right time, real product behind the pitch instead of vapor.

NO equity is given to anyone until the stabilization sprint is complete and a real working product is in production with paying customers.

---

## The two-track plan AFTER stabilization

### Track 1 — B2B white-label planner portal (priority)
- Self-serve `/planner/signup`
- Client invitation flow (planner → couple)
- Per-planner branding control panel (workspace_skin already supports this)
- Stripe subscription billing for planners
- Multi-couple cross-dashboard for planner
- Document vault + invoice OCR (planner drops PDF, AI parses, surfaces per-vendor + per-couple)
- WhatsApp integration (longer tail)

### Track 2 — B2C consumer differentiator (secondary)
- Aesthetic Profile system (the unlock)
- Image generation engine (Higgsfield TOS dependent — see spec §4-5)
- Vendor Brief PDF generator
- Mood board flow
- Save-the-date / invitation suite
- Stripe + tiered pricing + credit economy (Starter $29, Plan $79, Visualize $149)
- Negotiation / contract review / day-of timeline agents (v1.1)

Full spec details: `docs/acquired_planner_spec.md`

---

## Test account roster

All passwords: `Wedding2027!`. Sign-in URL: https://wedding-os-production.up.railway.app/login

| Email | Workspace | Skin | Role |
|---|---|---|---|
| `hurshpatel@greenskynj.com` | Astia | n/a (admin) | Planner — Hursh as Astia admin |
| `astha@astiaevents.com` | Astia | n/a (admin) | Planner — Astha primary |
| `hurshpatel95@gmail.com` | Nisha & Hursh — Barcelona 2027 | acquired_planner * | Couple — Hursh's actual wedding |
| `nishadesai98@gmail.com` | Nisha & Hursh — Barcelona 2027 | acquired_planner * | Couple — Nisha (multi-user) |
| `rodnj.ops@gmail.com` | Hursh's test wedding | acquired_planner | B2C cold-start test |
| `kcdevine96@gmail.com` | Kyle & Michelle — Newport | acquired_planner | Real friend Kyle |
| `j.salicandro@gmail.com` | John's wedding | acquired_planner | Real friend John |
| `raachmc@aol.com` | Rachel & Jay — Philadelphia 9.12.26 | acquired_planner | Real friend Rachel — pre-launch test |

\* Hursh & Nisha is a planner-served (B2B) workspace within Astia Events org. Currently set to `acquired_planner` skin because workspace_branding row is missing — restoring `co_branded` requires backfilling Astia's brand assets (logo, accent_hex, planner_display_name).

---

## Production env vars status

| Var | Status | Effect if unset |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ Set | All AI features work |
| `SUPABASE_*` | ✅ Set | DB works |
| `GOOGLE_PLACES_API_KEY` | ✅ Set | Vendor + venue auto-enrich |
| `GMAIL_OAUTH_*` | ⚠️ Test mode | Couple Gmail autopilot — only works for Gmail accts, not AOL |
| `STRIPE_SECRET_KEY` | ❌ Not set | Payment links / online pay (blocking B2B billing) |
| `RESEND_API_KEY` | ❌ Not set | Real outbound email |
| `GOOGLE_OAUTH_*` (calendar) | ❌ Not set | Booking-page conflict dimming |
| `BRAVE_SEARCH_API_KEY` | ❌ Not set | Search fallback |
| `CRON_SECRET` | ❌ Not set | Daily 8 AM digest |

---

## How to pick up next session

1. `cd ~/Documents/wedding-os`
2. **Read this doc** (`docs/COMPACT-HANDOFF.md`) — confirms the non-negotiable rule
3. **Read `docs/STABILIZATION_SPRINT.md`** — the actual sprint plan
4. **Read `docs/STATE-OF-THE-BUILD.md`** — full architecture + known issues
5. **Read `docs/PRODUCT_ROADMAP.md`** — the B2B-first 60-day plan post-stabilization
6. **Read `docs/acquired_planner_spec.md`** — the master product spec (vision, HoldCo, image gen engine, partnership)
7. Sign in to production as `hurshpatel95@gmail.com` to verify your portal looks right
8. Sign in as `rodnj.ops@gmail.com` to verify B2C cold-start is clean
9. Ask Hursh which Stabilization Sprint Tier 1 item to pick up — DO NOT improvise new features

---

## Recent commit history

**Stabilization Sprint (May 11):**
```
6076f66  feat(stabilization): T1.3 phase 1 — write-guard helper + 3 exemplar endpoints
e1cc189  feat(stabilization): T1.2 phase 1 — type-cleanup audit + gen:types workflow
0decd17  chore: ignore railway.json.staged (T1.1 activation file)
3b0dbc7  feat(stabilization): T1.1 part 1 — migration applicator + backfill scripts
5197661  feat(stabilization): T1.4 — Playwright smoke-test foundation + 5 specs
7ac77cf  feat(stabilization): T1.5 — B2B/B2C fork at the layout level
1796a01  docs: persistence layer for stabilization-first discipline
```

**Pre-sprint polish (May 8):**
```
3e4dc73  feat: restore Full Pricing Planner with editable line items per event
b9323f0  fix: root metadata wedding-os→Acquired Planner + force Railway redeploy
c08d5f7  fix: cosmetic polish (login title, claude leak, vendors empty CTA, onboarding toast)
cd0d73f  fix: restore Astia-PDF /estimator view + settings RLS bypass
108012a  seed: provision Rachel McGrath + Jay Farnsworth (Sept 12 2026, Switchhouse Philly)
3ab122c  feat: white-label workspace skin system (Acquired Planner default)
bf0681d  fix(b2c): unlock vendor detail for couples + drop EUR/VAT leaks
90af70c  feat(rsvp): public RSVP form + per-event guest badges + recent-RSVPs widget
d2a4c94  feat(polish): meaningful empty states + cross-page UX cleanup (15 files)
6f548b2  feat(settings): full preferences page — names + date + region + guests + budget + currency
cf7af28  fix: 5 cold-start audit P0/P1s couples saw immediately
ac84463  feat: tie /plan tasks to /budget lines + show on /estimator
c1265bc  feat: estimator drill-down/scenario + onboarding multi-event venues
062638e  feat: USD currency primary + EUR toggle, budget number-entry + add-category
```

---

## End of file
