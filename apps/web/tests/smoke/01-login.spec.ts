// Smoke test: login flow.
//
// Validates the most critical path — a couple can sign in with password.
// If this breaks, nothing else works. Runs first; failure fast-fails
// the rest of the suite.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("01 — Login flow", () => {
  test("B2C couple signs in with password", async ({ page }) => {
    await signInAs(page, "b2c-rodnj");

    // After sign-in we should be on the dashboard, not bounced back to login.
    expect(page.url()).not.toContain("/login");

    // Acquired Planner branding should be visible somewhere
    // (currently in the nav header or page title).
    const html = await page.content();
    expect(html.toLowerCase()).toContain("acquired planner");
  });

  test("Login page does not show legacy wedding-os branding", async ({
    page,
  }) => {
    await page.goto("/login");
    const title = await page.title();
    expect(title.toLowerCase()).toContain("acquired");
    expect(title.toLowerCase()).not.toContain("wedding-os");

    // The card subtitle should not mention "Barcelona September 2027"
    // (Hursh's personal wedding date that leaked to all couples).
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Barcelona · September 2027");
  });
});
