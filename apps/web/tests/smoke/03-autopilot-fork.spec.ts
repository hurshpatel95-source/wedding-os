// Smoke test: T1.5 /autopilot fork.
//
// For B2B planner-served couples, /autopilot short-circuits with a
// "your planner handles this" splash. For B2C couples, the full
// autopilot dashboard loads.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("03 — /autopilot fork on workspace mode", () => {
  test("B2C autopilot loads the dashboard", async ({ page }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/autopilot");

    const body = await page.locator("body").innerText();
    // The dashboard should NOT show the planner-handles-this splash
    expect(body).not.toContain("Your planner runs this for you");
    // It should show some autopilot UI (might be empty state but the
    // page renders without redirecting)
    expect(page.url()).toContain("/autopilot");
  });

  test("B2B planner-served couple sees splash instead of dashboard", async ({
    page,
  }) => {
    // SKIPPED until workspace skin flipped to co_branded.
    // When skin is acquired_planner (current rollback state), Hursh & Nisha
    // sees the same B2C autopilot dashboard. The fork only fires on
    // co_branded / white_label skins.
    test.skip(
      true,
      "Astia clients are on acquired_planner skin until branding backfilled — fork won't fire yet",
    );
    await signInAs(page, "b2b-hursh-nisha");
    await page.goto("/autopilot");
    const body = await page.locator("body").innerText();
    expect(body).toContain("Your planner runs this for you");
  });
});
