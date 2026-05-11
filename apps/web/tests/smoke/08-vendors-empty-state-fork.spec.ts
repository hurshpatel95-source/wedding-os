// Smoke test: /vendors renders the right empty-state copy per mode.
//
// What this guards:
//   - /vendors loads without crashing
//   - B2C empty-state copy is the "Track every vendor you're paying" variant
//   - B2B empty-state copy is the "Your planner is curating" variant
//     (skipped until skin flip — see test 02 / test 07 for context)
//
// What this does NOT guard:
//   - The Add Vendor flow (separate test)
//   - The Vendor Grid render for an account WITH vendors. If the test
//     account has vendors loaded, the empty-state assertion is skipped
//     since the grid renders instead — but we still assert "no crash."
//
// Pattern: branches on whether the account has vendors. If yes, only
// the crash check runs. If no, the copy assertion runs.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("08 — /vendors empty-state copy forks by mode", () => {
  test("B2C couple — sees self-serve empty state when vendor list is empty", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/vendors");
    await page.waitForLoadState("networkidle");

    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");

    // Page header always renders.
    await expect(
      page.getByRole("heading", { name: /vendors/i }).first(),
    ).toBeVisible();

    // If the empty-state title is visible, verify it's the B2C variant.
    // Otherwise the grid is rendering and we skip the copy check.
    const b2cEmptyTitle = page.getByText(
      /No vendors on your list yet/i,
    );
    const isEmptyState = await b2cEmptyTitle
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (isEmptyState) {
      // Crucially: NOT the planner-curated copy. Catches a mode-fork bug.
      await expect(
        page.getByText(/Your planner is curating/i),
      ).toHaveCount(0);

      // Verify a chunk of the B2C-specific description copy appears.
      await expect(
        page.getByText(/Track every vendor you're paying/i),
      ).toBeVisible();
    }
  });

  // SKIPPED — both accounts currently render `acquired_planner` skin
  // (post-Astia rollback). Once workspace_branding is backfilled and
  // one of these flips to co_branded, isB2B(mode) === true and the
  // planner-curated copy will render. Flip back to .test(...) then.
  test.skip("B2B planner-served couple — sees planner-curated empty state", async ({
    page,
  }) => {
    await signInAs(page, "b2b-hursh-nisha");
    await page.goto("/vendors");
    await page.waitForLoadState("networkidle");

    const plannerTitle = page.getByText(/Your planner is curating vendors/i);
    const isEmptyState = await plannerTitle
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (isEmptyState) {
      // Must NOT show the B2C variant.
      await expect(
        page.getByText(/No vendors on your list yet/i),
      ).toHaveCount(0);

      await expect(
        page.getByText(/Vendors will appear here as your planner adds/i),
      ).toBeVisible();
    }
  });
});
