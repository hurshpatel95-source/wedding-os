// Auth helper for smoke tests. Logs into a test account via password
// mode and asserts the dashboard is reachable. Each smoke test starts
// by calling signInAs(page, "couple-key") — returns once we're on /.

import { type Page, expect } from "@playwright/test";

/** Shared password across all test accounts. */
const PASSWORD = "Wedding2027!";

/**
 * The roster of test accounts, indexed by short keys for use in tests.
 * Each represents a real user in the production database.
 *
 * See `docs/COMPACT-HANDOFF.md` test-account roster for context.
 */
export const TEST_ACCOUNTS = {
  // B2C self-serve couples (acquired_planner skin)
  "b2c-rachel": "raachmc@aol.com",
  "b2c-kyle": "kcdevine96@gmail.com",
  "b2c-john": "j.salicandro@gmail.com",
  "b2c-rodnj": "rodnj.ops@gmail.com",

  // B2B planner-served couples (currently acquired_planner skin per rollback,
  // but workspace lives inside Astia Events org)
  "b2b-hursh-nisha": "hurshpatel95@gmail.com",
  "b2b-nisha": "nishadesai98@gmail.com",

  // Planner admins
  "admin-hursh": "hurshpatel@greenskynj.com",
  "admin-astha": "astha@astiaevents.com",
} as const;

export type TestAccountKey = keyof typeof TEST_ACCOUNTS;

/**
 * Sign in as a test account and wait for the dashboard to load.
 *
 * Uses password mode (not magic link) because magic links require
 * email-inbox access that smoke tests can't do.
 */
export async function signInAs(
  page: Page,
  account: TestAccountKey,
): Promise<void> {
  const email = TEST_ACCOUNTS[account];
  await page.goto("/login");

  // The login page defaults to magic-link mode. Click the "Use
  // password instead" toggle.
  const passwordToggle = page.getByRole("button", {
    name: /password/i,
  });
  if (await passwordToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
    await passwordToggle.click();
  }

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();

  // After auth, we should land on / (dashboard) or /onboarding
  // (for fresh accounts). Either is acceptable as "signed in."
  await page.waitForURL(
    (url) =>
      url.pathname === "/" ||
      url.pathname.startsWith("/onboarding") ||
      url.pathname.startsWith("/admin"),
    { timeout: 15_000 },
  );

  // Sanity — we shouldn't be back on /login (would mean auth failed)
  expect(page.url()).not.toContain("/login");
}

/** Convenience: sign out by clicking the nav sign-out button. */
export async function signOut(page: Page): Promise<void> {
  const signOutBtn = page.getByRole("button", { name: /sign out/i });
  if (await signOutBtn.isVisible().catch(() => false)) {
    await signOutBtn.click();
    await page.waitForURL((url) => url.pathname.includes("/login"), {
      timeout: 10_000,
    });
  }
}
