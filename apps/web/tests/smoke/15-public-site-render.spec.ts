// Smoke test: /settings/public-site renders the editor for B2C couple.
//
// What this guards:
//   - The route loads (was previously inconsistent — some workspaces
//     200, some 500 depending on null fields in `workspaces`)
//   - The URL slug input is reachable (the primary editor affordance)
//   - The theme picker affordance is reachable (multiple themes per
//     SITE_THEMES; we just need ONE button rendered to confirm the
//     picker mounted, not full theme-switching)
//   - The page header + Site editor heading are visible
//
// What this does NOT guard (deferred):
//   - Actually saving slug / theme changes. Save mutates `workspaces`
//     for the test account and would change the live /w/<slug> URL
//     on every smoke run. Deferred to staging.
//   - The full /w/<slug> render for each theme — that's a separate
//     concern; test 10 already covers the public-site anonymous load.
//
// Test-data assumption: account has a `workspaces` row (which the
// signInAs guarantees — without one, /onboarding would redirect them
// away from /settings). The slug may or may not be set; we assert the
// INPUT is present, not its value.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("15 — /settings/public-site renders editor", () => {
  test("B2C couple — slug input + theme picker reachable", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/settings/public-site");
    await page.waitForLoadState("networkidle");

    // No crash.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");

    // Server-rendered page header.
    await expect(
      page.getByRole("heading", { name: /^Site editor$/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Slug input — primary affordance. Use getByLabel since the form
    // wires Label htmlFor="slug" to <Input id="slug">.
    const slugInput = page.getByLabel(/URL slug/i);
    await expect(slugInput).toBeVisible({ timeout: 10_000 });
    await expect(slugInput).toBeEnabled();

    // Theme section heading is visible — proves the theme card mounted.
    await expect(
      page.getByRole("heading", { name: /^Theme$/i }),
    ).toBeVisible();

    // Theme picker affordance: the editor renders one <button> per
    // SITE_THEMES entry with aria-pressed. We don't need to assert the
    // exact theme — just that AT LEAST ONE theme button is reachable.
    const themeButtons = page.locator("button[aria-pressed]");
    expect(await themeButtons.count()).toBeGreaterThan(0);

    // First theme button is reachable (not disabled mid-save).
    await expect(themeButtons.first()).toBeEnabled();

    // Do NOT click save / publish — would mutate prod workspace row.
  });
});
