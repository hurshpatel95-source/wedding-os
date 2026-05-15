// Smoke test: /studio/day-of-viz renders the idle stage.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("37 — /studio/day-of-viz renders idle stage for B2C couple", () => {
  test("B2C couple — page renders, input + refine button reachable", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    const response = await page.goto("/studio/day-of-viz");
    await page.waitForLoadState("networkidle");

    if (response && response.status() === 404) {
      test.skip(
        true,
        "Day-of-viz route not deployed yet — skip until ship.",
      );
      return;
    }

    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");

    await expect(
      page.getByRole("heading", { name: /^Day-of visualizer$/i }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByPlaceholder(/ceremony|cocktails|dinner|dancing/i),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByRole("button", { name: /Refine my prompt/i }),
    ).toBeVisible();

    const hydrated = await page.locator("body").innerText();
    expect(hydrated).not.toContain("Claude");
    expect(hydrated).not.toContain("Anthropic");
  });
});
