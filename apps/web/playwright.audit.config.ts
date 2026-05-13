// Audit-only playwright config — overrides testDir to point at
// tests/audit/ so the one-off Co-pilot audit scripts can run. The
// main playwright.config.ts limits testDir to tests/smoke so audit
// scripts don't accidentally run on every smoke pass.
//
// Usage:
//   npx playwright test --config=playwright.audit.config.ts \
//     tests/audit/copilot-loaded-stress-test.spec.ts

import { defineConfig, devices } from "@playwright/test";

const PROD_URL = "https://wedding-os-production.up.railway.app";

export default defineConfig({
  testDir: "./tests/audit",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 15 * 60 * 1000, // 15min — 10 AI calls can take a while
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || PROD_URL,
    trace: "on-first-retry",
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
