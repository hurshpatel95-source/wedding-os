// Smoke test: /studio/florals renders the idle stage.
//
// Same pattern as smoke 32 (mood-board). Asserts route loads, heading
// + textarea + refine button are reachable, no Claude/Anthropic leak.
// Does NOT trigger generation (would burn Anthropic budget per run).
//
// Pre-deploy 404 tolerance: same pattern as test 31/32.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("33 — /studio/florals renders idle stage for B2C couple", () => {
  test("B2C couple — page renders, input + refine button reachable", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    const response = await page.goto("/studio/florals");
    await page.waitForLoadState("networkidle");

    if (response && response.status() === 404) {
      test.skip(true, "Florals route not deployed yet — skip until ship.");
      return;
    }

    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");

    await expect(
      page.getByRole("heading", { name: /^Florals at venue$/i }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByPlaceholder(/cascading arch|dahlias|eucalyptus/i),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByRole("button", { name: /Refine my prompt/i }),
    ).toBeVisible();

    const hydrated = await page.locator("body").innerText();
    expect(hydrated).not.toContain("Claude");
    expect(hydrated).not.toContain("Anthropic");
  });
});
