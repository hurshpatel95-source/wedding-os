// Smoke test: /settings/preferences USD ↔ EUR currency toggle persists
// across reload. Sibling to test 04 (wedding-date) and test 20 (couple
// name) which guard the other two persist-through-reload paths on the
// preferences page.
//
// Background — currency on the preferences page is a CurrencyToggle
// button group (USD / EUR), NOT a dropdown. Clicking the inactive
// option fires PATCH /api/workspace/preferences { base_currency } and
// router.refresh()es. The same /api/workspace/preferences handler that
// the date and name forms POST to also handles base_currency — but the
// toggle UI is its own component (CurrencyToggle, button-based) which
// means a regression in its onClick wiring would surface independently
// of the date/name forms.
//
// What this guards:
//   - The CurrencyToggle calls PATCH /api/workspace/preferences and the
//     UPDATE actually writes through (not a silent 0-row UPDATE or a
//     no-op in the client state setter)
//   - Reload reflects the persisted value — i.e. the workspace row
//     really has base_currency = the toggled value
//
// What this does NOT guard:
//   - That every downstream page picks up the new currency immediately
//     (router.refresh() should handle that, but verifying it would
//     require visiting /budget /payments etc.)
//   - That the EUR symbol "€" actually appears anywhere on the page
//     after the toggle — pages like /payments do their own currency
//     rendering and have their own dedicated tests (16).
//
// Hard rule — the test MUST restore the original currency at the end
// so we don't permanently flip the rodnj.ops account from USD to EUR
// (or vice versa). The restore step is inside a try/finally so even
// if the mid-assertion fails we don't leak state into the next run.
//
// Test-data assumption: b2c-rodnj's workspace.base_currency is either
// "USD" or "EUR". We read whichever symbol is active on the page when
// the test starts, toggle to the other, assert persistence, then
// toggle back.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("21 — /settings/preferences currency toggle persists across reload", () => {
  test("B2C couple — toggle USD↔EUR and verify reload sticks (auto-restores)", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/settings/preferences");
    await page.waitForLoadState("networkidle");

    // No crash.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");

    // The "Currency" section is always rendered. Its heading is just
    // "Currency" — scope to that section so we don't accidentally pick
    // up other heading text like "Currency switched to..." in the toast.
    await expect(
      page.getByRole("heading", { name: /^Currency$/i }),
    ).toBeVisible({ timeout: 10_000 });

    // The CurrencyToggle renders two <button>s with the labels "US
    // Dollars" and "Euros". We click whichever ISN'T the currently
    // selected one, then reload, then verify the new one is selected,
    // then restore.
    const usdBtn = page.getByRole("button", { name: /US Dollars/i });
    const eurBtn = page.getByRole("button", { name: /Euros/i });
    await expect(usdBtn).toBeVisible({ timeout: 10_000 });
    await expect(eurBtn).toBeVisible({ timeout: 10_000 });

    // The "active" button has a stone-50 bg + stone-900 border per the
    // component. Both buttons have aria-disabled while a save is in
    // flight, but at rest both are enabled. We pick the active one by
    // looking at which has the "USD" / "EUR" uppercase-code child label
    // — that's always rendered, but only the active button has the
    // <Check /> icon. The most reliable signal is the button's
    // class attribute containing "border-stone-900" (active variant).
    const usdClass = (await usdBtn.getAttribute("class")) ?? "";
    const eurClass = (await eurBtn.getAttribute("class")) ?? "";
    const startedAsUsd = usdClass.includes("border-stone-900");
    const startedAsEur = eurClass.includes("border-stone-900");

    // Sanity — exactly one should be active. If both / neither are, the
    // component shape changed and this test needs to update.
    expect(startedAsUsd !== startedAsEur).toBe(true);

    const originalCurrency: "USD" | "EUR" = startedAsUsd ? "USD" : "EUR";
    const targetCurrency: "USD" | "EUR" = startedAsUsd ? "EUR" : "USD";

    try {
      // Click the inactive option to toggle.
      const toggleTo = targetCurrency === "USD" ? usdBtn : eurBtn;
      await toggleTo.click();

      // Wait for the PATCH + router.refresh to settle.
      await page.waitForTimeout(2000);

      // Reload — base_currency should now be persisted server-side.
      await page.reload();
      await page.waitForLoadState("networkidle");

      // After reload, the previously-inactive button should now be
      // active (carry the border-stone-900 class).
      const afterUsd = page.getByRole("button", { name: /US Dollars/i });
      const afterEur = page.getByRole("button", { name: /Euros/i });
      await expect(afterUsd).toBeVisible({ timeout: 10_000 });
      await expect(afterEur).toBeVisible({ timeout: 10_000 });

      const afterUsdClass = (await afterUsd.getAttribute("class")) ?? "";
      const afterEurClass = (await afterEur.getAttribute("class")) ?? "";
      const nowUsd = afterUsdClass.includes("border-stone-900");
      const nowEur = afterEurClass.includes("border-stone-900");

      // Exactly one is active, and it's the one we toggled TO.
      expect(nowUsd !== nowEur).toBe(true);
      if (targetCurrency === "USD") {
        expect(nowUsd).toBe(true);
      } else {
        expect(nowEur).toBe(true);
      }
    } finally {
      // Restore original currency so we don't leave the prod account
      // flipped. Inside finally so even an assertion failure above
      // still triggers the restore.
      const restoreBtn =
        originalCurrency === "USD"
          ? page.getByRole("button", { name: /US Dollars/i })
          : page.getByRole("button", { name: /Euros/i });
      // The restore button might already be active if a prior step
      // failed before the toggle landed. Check before clicking.
      const restoreClass = (await restoreBtn.getAttribute("class")) ?? "";
      if (!restoreClass.includes("border-stone-900")) {
        await restoreBtn.click();
        await page.waitForTimeout(2000);
      }
    }
  });
});
