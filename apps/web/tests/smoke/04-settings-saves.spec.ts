// Smoke test: /settings/preferences saves writes actually persist.
//
// This is the May 8 regression class — the silent-failure bug where
// the UI toasted "Saved." but the DB UPDATE affected 0 rows because
// RLS blocked it. Fixed via service-role bypass + write-guard.
// Regression of this would be catastrophic since it's the page where
// every couple goes to fix their wedding details.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("04 — Settings preferences saves actually persist", () => {
  test("Changing wedding date persists across reload", async ({ page }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/settings/preferences");

    // Pick a date in 2027 (any valid future date works; we just need
    // to verify it persists)
    const testDate = "2027-08-21";

    // Find the wedding-date input. It's a <input type="date"> so it'll
    // be the date input on this page.
    const dateInput = page.locator('input[type="date"]').first();
    await dateInput.fill(testDate);

    // The Big Day form has its own Save button. Click it.
    // We scope to the form containing the date input to avoid clicking
    // a different section's Save.
    const dateForm = dateInput.locator(
      'xpath=ancestor::form | xpath=ancestor::div[contains(@class,"card")]',
    );
    const saveBtn = page
      .locator("form")
      .filter({ has: dateInput })
      .getByRole("button", { name: /save/i });
    await saveBtn.click();

    // Wait for toast or button to settle
    await page.waitForTimeout(2000);

    // Reload and verify the date stuck
    await page.reload();
    await page.waitForLoadState("networkidle");

    const dateInputAfter = page.locator('input[type="date"]').first();
    const valueAfter = await dateInputAfter.inputValue();
    expect(valueAfter).toBe(testDate);
  });
});
