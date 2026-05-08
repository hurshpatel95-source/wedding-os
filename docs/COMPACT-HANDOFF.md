# Compact handoff — May 8 2026

> Read this FIRST when resuming a fresh session. Then `docs/STATE-OF-THE-BUILD.md` for the full architecture map.

---

## Where we are

**14 commits this session** on top of the Wave 3 autopilot foundation. The B2C consumer surface (Kyle / John / `rodnj.ops`) was rough — most of this session was hardening it:

```
f34ba69 feat: rebuild /estimator on budget_lines + Monday-style task editor on /plan
e5ba392 docs: STATE-OF-THE-BUILD.md
66254c8 feat(onboarding): venue auto-insert + checklist auto-seed + 'anything else?'
8530032 fix: trim couple nav of legacy Astia surfaces
0263ca6 fix: scrub Astia/Astha leaks + couple-shell admin gates + nav cleanup
5356ad9 fix(onboarding): require all 9 fields before completion
b90d8a4 feat: RFP-DRAFTER — AI personalized outreach drafts
cf8b47a feat: VENDOR-FOLDERS — per-vendor files + /vendors/compare/[category]
9350104 feat: feature-status tour + KC's account provisioned
ffa1755 feat: post-merge wiring (AnalyzeButton + AlertsBell + AutopilotTodayWidget)
0f068e7 docs: snapshot Wave 3 autopilot push
[Wave 3 main feature merges: ONBOARDING-AI, BUDGET-TREE, GMAIL-CONNECTOR, VENDOR-SEARCH, THREAD-ANALYZER, AUTOPILOT-DASHBOARD, ALERTS-DIGEST, VENDOR-FOLDERS]
17595a8 Wave 3 foundation
```

All deployed. Production is live at `wedding-os-production.up.railway.app`.

---

## What works RIGHT NOW for Kyle / John / rodnj.ops

Sign in at `/login` (email + password `Wedding2027!`):
- `kcdevine96@gmail.com` (Kyle Devine)
- `j.salicandro@gmail.com` (John)
- `rodnj.ops@gmail.com` (Hursh's test couple)

What they see:
1. `/onboarding` AI chat — 9 structured fields + venue capture + "anything else?"
2. `/` dashboard with AutopilotTodayWidget + WelcomeBanner
3. `/plan` — 84-task starter checklist (auto-seeded), pencil icon → Monday-style edit drawer
4. `/budget` — AI-generated tree, sliders per line, vendor link
5. `/estimator` — real summary view (estimated / committed / paid / vs target / by category)
6. `/venues` — manual add works, auto-populated from chat with Places enrichment
7. `/vendors/find` — Google Places search returns 10 real vendors → batch add → AI drafts personalized RFPs
8. `/guests` — manual add + Excel import
9. `/availability` — editable, with empty state pointing to /venues
10. `/feature-status` — tour of every feature with live/pending markers
11. `/assistant` — workspace-aware Co-pilot
12. `/autopilot` — vendor pipeline + alerts feed
13. `/w/<slug>` public site, 5 themes
14. Onboarding nav link "Setup chat" lets them revisit the AI intake anytime

---

## Production env vars status

| Env var | Status | Effect if unset |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ Set | (everything AI works) |
| `SUPABASE_*` | ✅ Set | (DB works) |
| `GOOGLE_PLACES_API_KEY` | ✅ Set | (vendor search + venue auto-enrich work) |
| `GMAIL_OAUTH_*` | ⚠️ User configuring in Google Cloud | Couple Gmail connect → autopilot loop |
| `STRIPE_SECRET_KEY` | ❌ Not set | Payment links / online pay |
| `RESEND_API_KEY` | ❌ Not set | Real outbound email |
| `GOOGLE_OAUTH_*` (calendar) | ❌ Not set | Booking-page conflict dimming |
| `BRAVE_SEARCH_API_KEY` | ❌ Not set | Search fallback |
| `CRON_SECRET` | ❌ Not set | Daily 8 AM digest |

---

## The one blocking gotcha for Gmail OAuth

**Stay in Testing mode** in Google Cloud Console (don't publish — sensitive scope verification is weeks).

In OAuth consent screen → Test users, add the emails that will connect:
- `kcdevine96@gmail.com`
- `j.salicandro@gmail.com`
- `rodnj.ops@gmail.com`
- `hurshpatel95@gmail.com`
- Any wedding-only Gmail Kyle/John create

Test-mode refresh tokens expire every 7 days → user clicks Connect again. Acceptable for V1.

---

## Active known bugs (next session priorities)

1. **Currency: USD primary, EUR toggle** — most pages hardcode €/$. Need a `lib/format-currency.ts` reading workspace.base_currency.
2. **Login redirect for dual-role couples** — middleware sends any org_admin to /admin. Workaround: 3 test couples demoted to org_role=member. Real fix: middleware checks role too.
3. **Vendor quote PDF auto-attach from Gmail** — Gmail sync pulls thread body but not attachments. Need to extend `lib/gmail-thread-importer.ts` to download attachments to `documents` bucket per vendor.
4. **Quote history** — only stores latest `quote_eur`. If vendor sends multiple options, we lose the others.
5. **Onboarding revisit UX** — re-entering /onboarding after completion creates a new session but AI doesn't acknowledge "this is a follow-up". Should greet differently.
6. **Email preview / delivery** — when Hursh+Nisha workspace data leaks via Astia's "View as workspace" picker into a B2C couple's session, what happens? Verify isolation.

---

## How to pick up next session

1. `cd ~/Documents/wedding-os`
2. Read `docs/STATE-OF-THE-BUILD.md` for the full architecture map
3. Read this file (`docs/COMPACT-HANDOFF.md`) for fresh context
4. Sign in at https://wedding-os-production.up.railway.app/login as `hurshpatel@greenskynj.com` / `Wedding2027!` for planner-side
5. Try `rodnj.ops@gmail.com` / `Wedding2027!` for couple-side cold-start
6. Ask Hursh what's broken / what he wants next — bugs almost always come from real use, not from code review

---

## Test couple roster

| Email | Workspace | What it tests |
|---|---|---|
| `hurshpatel@greenskynj.com` | Astia | Planner shell |
| `astha@astiaevents.com` | Astia | Planner (Astha) |
| `hurshpatel95@gmail.com` | Hursh & Nisha — Barcelona 2027 | B2B-couple POV w/ rich seeded data |
| `nishadesai98@gmail.com` | (same) | Multi-user couple |
| `rodnj.ops@gmail.com` | Hursh's test wedding | **B2C cold-start** (real Gmail, can do Gmail OAuth) |
| `kcdevine96@gmail.com` | Kyle & Michelle — Newport | Real friend Kyle |
| `j.salicandro@gmail.com` | John's wedding | Real friend John |

All passwords: `Wedding2027!`. Sign-in URL: https://wedding-os-production.up.railway.app/login (toggle to "Password" mode).

---

## Briefs already sent / ready to send

**Kyle (`kcdevine96@gmail.com`)** — full brief drafted in last session, has been sent or is ready to send. Includes login + magic link + what to test first + ask-back questions.

**John (`j.salicandro@gmail.com`)** — drafted, ready to send.

Re-run magic links anytime via `pnpm db:seed-kc` (re-fires for KC; same pattern works for any test account by editing the email at the top of the script).

---

## What Hursh has been building toward

Phase 1 (now): dogfood for his own wedding + close friends Kyle / John testing as the proof points.
Phase 2: Astha (planner) reviews + becomes design partner / first paying customer.
Phase 3: Sell to other planners as Aisle Planner / Honeybook / Plannit competitor + B2C couples direct.

The B2B planner side is sales-pitch ready. The B2C consumer side is now usable but rough. Real-user feedback (Kyle / John) will surface 2x the bugs internal testing has.
