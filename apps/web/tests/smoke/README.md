# Smoke tests — Stabilization Sprint T1.4

Critical-path Playwright tests that hit production (default) or local
dev (override). Catches the regression classes that surfaced 12 times
on May 8 — silent failures, copy leaks, broken auth, broken saves.

## Running

```bash
# Against production (default)
cd apps/web
pnpm smoke

# Against local dev (start next dev first)
pnpm dev               # in one terminal
pnpm smoke:local       # in another

# Interactive UI mode (great for debugging)
pnpm smoke:ui
```

## What's covered (May 11 — 20 spec files)

| # | Test file | What it guards |
|---|---|---|
| 01 | `01-login.spec.ts` | Password sign-in works; Acquired Planner branding visible; no wedding-os leak |
| 02 | `02-dashboard-fork.spec.ts` | Dashboard renders without crashes for both B2C + B2B accounts |
| 03 | `03-autopilot-fork.spec.ts` | /autopilot renders dashboard for B2C; splash for B2B (skipped until skin flip) |
| 04 | `04-settings-saves.spec.ts` | /settings/preferences wedding-date change persists through reload (the silent-fail bug guard) |
| 05 | `05-no-legacy-leaks.spec.ts` | No "Barcelona Sept 2027", no "Sitges", no "wedding-os" title, no "Claude column-mapping" leak |
| 06 | `06-budget-baseline-gen.spec.ts` | /budget renders in either empty (Generate form) or loaded (tree) state without crashes |
| 07 | `07-plan-cost-link.spec.ts` | Task drawer Cost link section visible for B2C; hidden for B2B (T1.5 fork) |
| 08 | `08-vendors-empty-state-fork.spec.ts` | /vendors shows self-serve copy for B2C; planner-curated copy for B2B |
| 09 | `09-estimator-fork.spec.ts` | /estimator picks PlannerSeededView vs DrillDown vs Empty by data shape |
| 10 | `10-rsvp-public-site.spec.ts` | /w/<slug> public wedding site renders anonymously with RSVP affordance + no dashboard chrome leak |
| 11 | `11-onboarding-chat.spec.ts` | /onboarding renders chat header; composer textarea is reachable + enabled (no destructive send) |
| 12 | `12-vendors-find.spec.ts` | /vendors/find renders search form OR FeaturePreviewCard; region input + Search button reachable |
| 13 | `13-vendor-detail-tabs.spec.ts` | /vendors/<id> renders Overview/Pricing/Tasks/Files tabs; Pricing + Files reachable for B2C (T1.5 admin-gate fix) |
| 14 | `14-guests-import.spec.ts` | /guests/import renders dropzone for B2C; "AI" in copy, no "Claude"/"Anthropic" leak on drop stage |
| 15 | `15-public-site-render.spec.ts` | /settings/public-site renders Site editor; slug input + theme picker reachable for B2C |
| 16 | `16-payments-currency.spec.ts` | /payments shows "$" for USD workspace; no literal "EUR" / "€" leaks on B2C account |
| 17 | `17-spend-no-vat-multiplier.spec.ts` | /spend totals have no 1.21 VAT inflation; no "VAT"/"IVA"/"21%" copy on B2C account |
| 18 | `18-pricing-fork.spec.ts` | /pricing renders FullPricingPlanner for B2B (event_roles); redirects to /budget for B2C couple |
| 19 | `19-availability-default-month.spec.ts` | /availability does NOT default to legacy "September 2027" Barcelona hardcode |
| 20 | `20-settings-name-saves.spec.ts` | /settings/preferences Partner A name change persists through reload (silent-save guard, sibling to test 04) |

## Growing the suite (toward 25 tests)

The design doc (`docs/stabilization/T1.4_design.md`) lists tests 11-25.
Add as features ship — one test should be added in the same commit as
the feature it guards. Tests 11-15 shipped on the T1.4 follow-up
branch; 16-25 remain.

## Test account roster

See `apps/web/tests/smoke/auth.ts` for the `TEST_ACCOUNTS` map. All
accounts have password `Wedding2027!`. The roster matches
`docs/COMPACT-HANDOFF.md`.

## CI integration (TODO)

Not yet wired. Once a future commit adds the GitHub Action workflow
or Railway post-deploy hook, smoke failures block production
promotion. Until then, run `pnpm smoke` manually before every push.

## When tests fail

1. Read the failure output — Playwright captures the URL + selector
2. Re-run with `pnpm smoke:ui` to see the headed browser
3. Trace files land in `playwright-report/` — open with `pnpm exec playwright show-report`
4. If the failure is a real regression, FIX before merging
5. If the test is flaky (e.g. cold-start timeout), add a retry or
   adjust the timeout — but don't `.skip()` without a tracking issue
