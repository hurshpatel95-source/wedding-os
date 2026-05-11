// Playwright config — Stabilization Sprint T1.4
//
// Smoke test suite covering the user's first hour. Default target is
// production (since that's where regressions actually surface), but
// PLAYWRIGHT_BASE_URL=http://localhost:3200 overrides for local dev.
//
// Use:
//   pnpm smoke                    → run all tests against prod
//   pnpm smoke --ui               → headed mode with the Playwright UI
//   PLAYWRIGHT_BASE_URL=http://localhost:3200 pnpm smoke → against local
//
// CI integration: GitHub Action or Railway post-deploy hook runs this
// suite. Failing tests block the deploy from being promoted (see
// docs/STABILIZATION_SPRINT.md T1.4 acceptance criteria).

import { defineConfig, devices } from "@playwright/test";

const PROD_URL = "https://wedding-os-production.up.railway.app";

export default defineConfig({
  testDir: "./tests/smoke",
  // Each test file runs in parallel; tests within a file run serially
  // so a single test's auth + state setup carries through. Keeps the
  // suite under 5 minutes even at 25+ tests.
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || PROD_URL,
    // Trace on first retry — captures DOM + network for diagnosing
    // intermittent prod failures (e.g. cold-start timeouts).
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Default action timeout — generous because cold-start API endpoints
    // can take 10-15s on Railway hobby plan.
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Don't auto-start a dev server — we want to test the deployed prod
  // build, not localhost. To run locally, start dev server separately
  // and pass PLAYWRIGHT_BASE_URL.
});
