// Smoke test: /visualize renders the idle drop-zone UI without crash.
//
// What this guards (Move 2 — Photo → Pricing):
//   - The route loads for a B2C couple
//   - The "Visualize" heading is server-rendered
//   - The drop affordance + "Pick a photo" button reach the user
//   - No "Claude" / "Anthropic" copy leak — the user-facing eyebrow
//     uses "AI vision" instead, mirroring the test 14 convention.
//
// What this does NOT guard (deferred — would burn the Anthropic budget
// on every smoke run):
//   - Actually uploading an image. The endpoint
//     /api/visualize/photo-to-pricing hits Sonnet vision and costs
//     ~$0.05/call. Same trade-off as test 14 (guests-import).
//
// Test-data assumption: none — the drop stage is the initial render
// regardless of workspace state.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("30 — /visualize renders idle drop zone for B2C couple", () => {
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

    // The page title — server-rendered, always visible.
    await expect(
      page.getByRole("heading", { name: /^Visualize$/i }),
    ).toBeVisible({ timeout: 10_000 });

    // The drop-zone heading inside VisualizeStudio (client component).
    await expect(
      page.getByRole("heading", { name: /Drop an inspiration photo/i }),
    ).toBeVisible({ timeout: 10_000 });

    // The "Pick a photo" fallback button — reachability for users
    // whose browsers don't support drag-and-drop nicely.
    await expect(
      page.getByRole("button", { name: /Pick a photo/i }),
    ).toBeVisible();

    // Copy-leak guard — re-snapshot AFTER the client has hydrated.
    // Eyebrow is "AI vision · price estimator"; the word "AI" should
    // appear, but neither vendor name should leak to the user.
    const hydrated = await page.locator("body").innerText();
    expect(hydrated).toContain("AI");
    expect(hydrated).not.toContain("Claude");
    expect(hydrated).not.toContain("Anthropic");

    // Do NOT upload — would drive a real Sonnet vision call.
  });
});
