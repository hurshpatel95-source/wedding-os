// Smoke test: /budget renders correctly in BOTH empty + loaded states.
//
// What this guards against:
//   - /budget 500ing for any reason (RLS read failure, render crash,
//     BudgetTree component throwing)
//   - The empty-state Generate-baseline form regressing (button gone,
//     fields missing, etc.)
//   - The loaded BudgetTree silently rendering 0 rows when the DB has
//     them (RLS-blocked SELECT)
//
// What this does NOT guard (deferred to a true E2E test once we have a
// staging env or teardown infra):
//   - The actual /api/budget-lines/generate-baseline endpoint working
//     end-to-end (Sonnet 4.6 prompt regressions, AI cost, 70-row
//     destructive insert against prod data — all reasons we don't
//     trigger Generate from a prod smoke test)
//   - The auto-create-budget-line cascade from /plan cost-link (that's
//     test 07's job, and it has the same destructiveness concern)
//
// Pattern: branches on the page state. Production data is real, so we
// don't know in advance whether the test account has lines or not.
// Either path validates a real regression class.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("06 — Budget page renders in empty + loaded states", () => {
  test("B2C couple — /budget loads, shows either Generate form or tree", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/budget");

    // First defence — page didn't crash.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");
    expect(body).not.toContain("Couldn't find your workspace");

    // Page header is always rendered regardless of state.
    await expect(
      page.getByRole("heading", { name: /^Budget$/i }),
    ).toBeVisible();

    // Branch on which state we're in.
    const generateButton = page.getByRole("button", {
      name: /Generate my baseline/i,
    });
    const isEmptyState = await generateButton
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (isEmptyState) {
      // Empty-state path — verify the form is wired correctly.
      // These three inputs (guest count, budget target, region) need
      // to exist for AI generation to work. If any is missing the
      // EmptyBudgetTree component has regressed.
      await expect(page.getByLabel(/guest count/i)).toBeVisible();
      await expect(page.getByLabel(/budget target/i)).toBeVisible();
      await expect(page.getByLabel(/region/i)).toBeVisible();

      // Button itself must be enabled (not stuck in spinner state).
      await expect(generateButton).toBeEnabled();

      // Don't actually click — generation is destructive + expensive
      // against prod. See file header for rationale.
    } else {
      // Loaded-state path — at least one canonical category label is
      // visible. Catering is always part of the baseline so it's a
      // safe assertion. (Currency-symbol check was removed because
      // `body` was snapshotted before the tree's hydration completed,
      // making the assertion racy. Currency-leak guards belong in
      // test 16 — separate concern, not this test's job.)
      const tree = page.locator("body");
      const hasCanonicalCategory =
        (await tree.getByText(/Catering/i).count()) > 0 ||
        (await tree.getByText(/Venue & space/i).count()) > 0 ||
        (await tree.getByText(/Photo & video/i).count()) > 0;

      expect(hasCanonicalCategory).toBe(true);
    }
  });
});
