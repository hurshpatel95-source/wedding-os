// Smoke test: /studio hub renders the tool grid.
//
// What this guards (AI Studio Day 1):
//   - The /studio route loads for a B2C couple without 500/crash.
//   - The "Studio" heading is server-rendered.
//   - At least one tool card is visible (mood-board is "live" + always
//     shipped, so we anchor on its label).
//   - No "Claude" / "Anthropic" copy leak — same convention as other
//     AI surfaces.
//
// What this does NOT guard:
//   - Clicking a tool card → /studio/<slug>. Covered by test 32 for
//     mood-board.
//   - Actually hitting the clarify or generate endpoints — those burn
//     Anthropic + (eventually) Higgsfield budget on every smoke run.
//
// Pre-deploy 404 tolerance: same pattern as the recent smoke tests.
// On a stale prod build the route doesn't exist yet, so we tolerate
// a 404 and skip the assertions in that case.
//
// Test-data assumption: none — the hub renders for any signed-in
// workspace member.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("31 — /studio hub renders for B2C couple", () => {
  test("B2C couple — hub loads, mood-board tile reachable", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    const response = await page.goto("/studio");
    await page.waitForLoadState("networkidle");

    // Pre-deploy tolerance — if Railway hasn't redeployed yet, the
    // route 404s. We accept that and skip the assertions.
    if (response && response.status() === 404) {
      test.skip(true, "Studio route not deployed yet — skip until ship.");
      return;
    }

    // No crash.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");

    // Title — server-rendered, always visible.
    await expect(
      page.getByRole("heading", { name: /^Studio$/i }),
    ).toBeVisible({ timeout: 10_000 });

    // At least one tool card. Mood board is "live" status in the
    // registry, so its label is always shown.
    await expect(
      page.getByRole("heading", { name: /Mood board/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Verify the eyebrow via getByText (auto-waits) instead of a body
    // innerText snapshot — innerText on prod was returning only the
    // layout chrome even after the heading assertions passed, which
    // suggests a hydration / snapshot timing quirk we can't fight from
    // here. getByText is robust.
    await expect(page.getByText(/AI Studio/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // Copy-leak guard. Use getByText for the negative case too —
    // re-snapshotting body.innerText is unreliable on this surface.
    await expect(page.getByText(/Claude/i)).toHaveCount(0);
    await expect(page.getByText(/Anthropic/i)).toHaveCount(0);
  });
});
