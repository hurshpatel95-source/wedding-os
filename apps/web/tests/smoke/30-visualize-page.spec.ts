// Smoke test: photo→pricing route renders the idle drop-zone UI.
//
// Post-migration (AI Studio Day 3): the canonical home is
// /studio/pricing-analyzer; the legacy /visualize redirects there.
// Pre-deploy, /visualize still renders the old "Visualize" heading,
// so we accept either heading as pass.
//
// What this guards:
//   - The route loads for a B2C couple (via legacy URL — verifies the
//     redirect path works once deployed, and that the legacy still
//     works while the redirect is pending).
//   - The page heading is server-rendered (legacy: "Visualize",
//     new: "Photo → pricing").
//   - The drop affordance + "Pick a photo" button reach the user.
//   - No "Claude" / "Anthropic" copy leak.
//
// What this does NOT guard (deferred — would burn the Anthropic budget
// on every smoke run):
//   - Actually uploading an image. The endpoint
//     /api/visualize/photo-to-pricing hits Sonnet vision and costs
//     ~$0.05/call.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("30 — photo→pricing renders idle drop zone for B2C couple", () => {
  test("B2C couple — page renders, drop zone visible, no Claude leak", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/visualize");
    await page.waitForLoadState("networkidle");

    // No crash.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");

    // Either legacy ("Visualize") or post-migration ("Photo → pricing")
    // heading is fine. Until the redirect deploys, prod still shows
    // the legacy title.
    const legacyHeading = page.getByRole("heading", { name: /^Visualize$/i });
    const newHeading = page.getByRole("heading", { name: /Photo .* pricing/i });
    await Promise.any([
      legacyHeading.waitFor({ state: "visible", timeout: 10_000 }),
      newHeading.waitFor({ state: "visible", timeout: 10_000 }),
    ]);

    // The drop-zone heading (same in both legacy + new).
    await expect(
      page.getByRole("heading", { name: /Drop an inspiration photo/i }),
    ).toBeVisible({ timeout: 10_000 });

    // The "Pick a photo" fallback button.
    await expect(
      page.getByRole("button", { name: /Pick a photo/i }),
    ).toBeVisible();

    // Copy-leak guard.
    const hydrated = await page.locator("body").innerText();
    expect(hydrated).toContain("AI");
    expect(hydrated).not.toContain("Claude");
    expect(hydrated).not.toContain("Anthropic");
  });
});
