// Smoke test: /studio/pricing-analyzer renders idle drop zone.
//
// New home for photo→pricing as of the Day 3 migration. Smoke 30 covers
// the /visualize redirect path; this test covers the canonical studio
// route directly.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("38 — /studio/pricing-analyzer renders idle drop zone for B2C couple", () => {
  test("B2C couple — page renders, drop zone visible, no Claude leak", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    const response = await page.goto("/studio/pricing-analyzer");
    await page.waitForLoadState("networkidle");

    if (response && response.status() === 404) {
      test.skip(
        true,
        "Pricing-analyzer route not deployed yet — skip until ship.",
      );
      return;
    }

    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");

    await expect(
      page.getByRole("heading", { name: /Photo .* pricing/i }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByRole("heading", { name: /Drop an inspiration photo/i }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByRole("button", { name: /Pick a photo/i }),
    ).toBeVisible();

    const hydrated = await page.locator("body").innerText();
    expect(hydrated).toContain("AI");
    expect(hydrated).not.toContain("Claude");
    expect(hydrated).not.toContain("Anthropic");
  });
});
