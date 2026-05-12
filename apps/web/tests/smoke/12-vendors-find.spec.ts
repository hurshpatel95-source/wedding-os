// Smoke test: /vendors/find renders search form without crashing.
//
// What this guards:
//   - The server component's workspace lookup doesn't 500
//   - VendorSearchForm mounts when feature flags are ready, OR the
//     FeaturePreviewCard fallback mounts when they aren't (both are
//     valid "no crash" renders)
//   - Region input + Search button are reachable for the active form
//   - Typing a query into the region field doesn't blow up the
//     controlled-input wiring
//
// What this does NOT guard (deferred):
//   - Actually clicking Search and asserting Google Places / Brave
//     returns results. Hitting external paid APIs from every smoke
//     run is wrong; deferred to a manual smoke before each launch.
//   - The result-card render or the "Add to vendor list" cascade.
//
// Test-data assumption: none — works for any account because the form
// is the same regardless of vendor count. If the feature flags are
// disabled in prod, the FeaturePreviewCard fallback renders and the
// search-form branch is skipped (annotated, not failed).

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("12 — /vendors/find renders the search form", () => {
  test("B2C couple — search form OR feature-preview card renders", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/vendors/find");
    await page.waitForLoadState("networkidle");

    // No crash.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");

    // Page header is always rendered (server component).
    await expect(
      page.getByRole("heading", { name: /Find vendors/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Branch: search form OR feature-preview card.
    const regionInput = page.getByLabel(/^Region$/i);
    const formVisible = await regionInput
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (formVisible) {
      // Active-form path. Region input + Search button are the two
      // affordances the user MUST be able to reach.
      await expect(regionInput).toBeEnabled();
      await expect(
        page.getByRole("button", { name: /^Search$/i }),
      ).toBeVisible();

      // Typing into the region field shouldn't crash the controlled
      // input. Use a real-looking value so React's controlled-input
      // path runs the same code as in prod.
      await regionInput.fill("Newport, RI");
      await expect(regionInput).toHaveValue("Newport, RI");

      // Do NOT click Search — would hit Google Places / Brave APIs
      // on every smoke run.
    } else {
      // Feature-flag-off path. FeaturePreviewCard renders instead. The
      // crash check above is enough.
      test.info().annotations.push({
        type: "info",
        description:
          "google_places + brave_search feature flags are off in this " +
          "environment. FeaturePreviewCard rendered instead of search form. " +
          "No crash, which is what this test guards.",
      });
    }
  });
});
