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

## What's covered (May 11 starter set — 5 tests)

| # | Test file | What it guards |
|---|---|---|
| 01 | `01-login.spec.ts` | Password sign-in works; Acquired Planner branding visible; no wedding-os leak |
| 02 | `02-dashboard-fork.spec.ts` | Dashboard renders without crashes for both B2C + B2B accounts |
| 03 | `03-autopilot-fork.spec.ts` | /autopilot renders dashboard for B2C; splash for B2B (skipped until skin flip) |
| 04 | `04-settings-saves.spec.ts` | /settings/preferences wedding-date change persists through reload (the silent-fail bug guard) |
| 05 | `05-no-legacy-leaks.spec.ts` | No "Barcelona Sept 2027", no "Sitges", no "wedding-os" title, no "Claude column-mapping" leak |

## Growing the suite (toward 25 tests)

The design doc (`docs/STABILIZATION_SPRINT.md` T1.4) lists 25 target
flows. The 5 here cover the highest-stakes regressions from May 8.
Future test files should follow the same pattern: one file per
concern, descriptive `describe` block, `signInAs(page, key)` at the
top of each test, generous timeouts (15s default — Railway hobby
plan is cold-start prone).

Suggested next-to-add (highest value):
- `06-budget-baseline-gen.spec.ts` — /budget generates an AI baseline
- `07-plan-cost-link.spec.ts` — /plan task cost-link saves + auto-creates budget line (B2C only)
- `08-vendors-empty-state-fork.spec.ts` — empty state copy differs between B2C and B2B
- `09-estimator-fork.spec.ts` — B2B sees budget_estimates view; B2C sees drill-down view
- `10-rsvp-form-public-site.spec.ts` — /w/<slug> public RSVP form writes to guest_event_invitations

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
