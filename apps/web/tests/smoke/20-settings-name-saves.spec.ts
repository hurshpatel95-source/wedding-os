// Smoke test: /settings/preferences couple-name change persists across
// reload (sibling to test 04, which guards the date field).
//
// Background — the May 8 silent-save regression that test 04 guards
// originally affected EVERY workspace UPDATE on /settings/preferences,
// not just the date column. Test 04 covers the date path; this test
// covers the name path (workspace.name composed from partner_a_name +
// partner_b_name in the CoupleIdentityForm). Both paths go through
// the same `/api/workspace/preferences` PATCH handler, but the React
// state + composeName() helper add their own opportunities to silently
// drop the change.
//
// What this guards:
//   - Changing the Partner A name and clicking Save actually persists
//     across a full page reload
//   - The PATCH /api/workspace/preferences { name: "..." } code path
//     correctly writes through (not blocked by RLS, not a silent 0-row
//     UPDATE)
//
// What this does NOT guard:
//   - The composeName() helper's formatting edge cases (a / b empty,
//     'and' vs '&', etc.) — unit-test territory
//   - The Partner B field independently — both inputs feed into the
//     same composeName() output and the same UPDATE, so testing one
//     transitively tests the other
//   - The other three forms on the page (big day, guests+budget,
//     currency) — those go through the same handler. Test 04 covers
//     wedding_date; the other two are deferred.
//
// Test-data assumption: b2c-rodnj account has at least Partner A set
// to something parseable. We OVERWRITE Partner A with a reversible
// timestamp-suffixed test value. This is acceptable per the prompt —
// no personal info leaks, and re-runs use a fresh timestamp so we
// don't collide with prior runs.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("20 — /settings/preferences couple-name change persists", () => {
  test("Changing Partner A name persists across reload", async ({ page }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/settings/preferences");
    await page.waitForLoadState("networkidle");

    // No crash.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");

    // Reversible test value — unique per run so we don't collide with
    // earlier test runs and stale state. Doesn't leak personal info.
    const testName = `TestCouple${Date.now()}`;

    // Find the Partner A input. The CoupleIdentityForm renders it with
    // id="partner_a_name" and label "Partner A".
    const partnerAInput = page.getByLabel(/^Partner A$/i);
    await expect(partnerAInput).toBeVisible({ timeout: 10_000 });

    // Fill it. fill() clears existing value then types.
    await partnerAInput.fill(testName);

    // Scope to the form containing the Partner A input so we click the
    // correct Save button (not the date form's Save, not the
    // guests+budget form's Save). This mirrors test 04's pattern.
    const nameForm = page.locator("form").filter({ has: partnerAInput });
    const saveBtn = nameForm.getByRole("button", { name: /save/i });
    await saveBtn.click();

    // Wait for the toast / re-render to settle. We don't assert on the
    // toast text because it's transient — just wait for the save round
    // trip to finish before reloading. (Mirrors test 04.)
    await page.waitForTimeout(2000);

    // Reload and verify the name stuck. The CoupleIdentityForm seeds
    // its inputs by parsing workspace.name with parseWorkspaceName()
    // — given input `TestCouple<ts>`, with no "&" or "'s wedding"
    // suffix the parser stores the full string as partner A (after
    // composeName wraps it as `${A}'s wedding`, the parser strips the
    // suffix back off on read).
    await page.reload();
    await page.waitForLoadState("networkidle");

    const partnerAAfter = page.getByLabel(/^Partner A$/i);
    await expect(partnerAAfter).toBeVisible({ timeout: 10_000 });
    const valueAfter = await partnerAAfter.inputValue();
    expect(valueAfter).toBe(testName);
  });
});
