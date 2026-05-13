// One-off Playwright config for the Co-pilot audit (Move 1).
// Mirrors playwright.config.ts but points testDir at tests/audit so
// the audit script is discoverable. Not used by `pnpm smoke`.

import { defineConfig, devices } from "@playwright/test";

const PROD_URL = "https://wedding-os-production.up.railway.app";

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 15 * 60 * 1000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || PROD_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
