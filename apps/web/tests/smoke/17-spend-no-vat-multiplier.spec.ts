// Smoke test: /spend totals don't include a 1.21 Spanish VAT multiplier.
//
// Background — pre-May-8, the SpendTracker component multiplied the
// vendor-stack forecast by `* 1.21` (Spanish IVA rate) for every
// workspace, US or otherwise. That inflated every US couple's forecast
// by 21% on first paint. The fix (recorded in a code comment at
// components/spend/spend-tracker.tsx lines 106-110) was to drop the
// multiplier entirely until tax handling moves behind a per-workspace
// workspace.tax_rate column. This test guards that the fix doesn't
// regress.
//
// What this guards:
//   - /spend renders for a B2C couple without crashing
//   - No visible numeric value on the page ends in ".21" with a pattern
//     consistent with a 1.21× inflation (e.g. forecast totals where
//     the vendor stack is round-thousand and the .21 fractional tail
//     is the VAT footprint)
//   - The literal copy strings "VAT", "IVA", and "21%" do not appear
//     anywhere in user-facing output on a B2C USD account
//
// What this does NOT guard:
//   - Deeper math correctness of the forecast — that's a unit-test
//     concern. We only check that the canonical VAT footprint is gone.
//   - The scenario builder's own line-item totals (separate code path,
//     would warrant its own test if a VAT multiplier ever sneaks back
//     into the scenario calculator).
//   - The EUR variant. B2B Hursh+Nisha workspace renders the same
//     SpendTracker but post-skin-flip we'd want to assert distinct
//     B2B behavior — skipped per the CLAUDE.md skin caveat.
//
// Test-data assumption: the b2c-rodnj account may or may not have
// vendor quotes / scenarios. If both are empty, the spend tracker
// renders $0 across the board — still valid for the no-VAT-leak
// assertion (just not a strong positive signal that the math is wired).

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("17 — /spend totals don't include the 1.21 VAT multiplier", () => {
  test("B2C couple — no 'VAT' / 'IVA' / '21%' copy, no .21-tail totals", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/spend");
    await page.waitForLoadState("networkidle");

    // No crash.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");
    expect(body).not.toContain("Couldn't find your workspace");

    // Page header always renders even with zero data.
    await expect(
      page.getByRole("heading", { name: /Spend tracker/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Re-fetch the body after the client component hydrates — the
    // SpendTracker is a "use client" component and its totals appear
    // after the initial server paint. (Same race-condition trap as
    // test 06's early snapshot.)
    const settledBody = await page.locator("body").innerText();

    // Copy-leak guards. The canonical VAT-era strings should never
    // surface on a US couple's spend page. If they ever do, either
    // (a) the workspace mis-typed its base_currency or (b) a code
    // path silently re-introduced the multiplier.
    expect(settledBody).not.toContain("VAT");
    expect(settledBody).not.toContain("IVA");
    expect(settledBody).not.toContain("21%");
    expect(settledBody).not.toContain("× 1.21");
    expect(settledBody).not.toContain("* 1.21");

    // Pattern check: extract all "$<number>" tokens from the body and
    // ensure none of them have the .21 fractional tail that's the
    // canonical 1.21× footprint. We accept the rare false positive
    // (a vendor quote that legitimately ends in .21) — the goal is
    // catching systemic inflation, not every individual line.
    //
    // Regex: $X.XX or $X,XXX.XX with optional thousand separators.
    const moneyMatches = settledBody.match(/\$[\d,]+\.\d{2}/g) ?? [];
    const dotTwentyOneTails = moneyMatches.filter((m) => m.endsWith(".21"));

    // If we see MORE than one .21-tail total it's a strong signal that
    // the multiplier is back (a single match could be coincidence; a
    // pattern across multiple stat cards is the regression).
    expect(dotTwentyOneTails.length).toBeLessThanOrEqual(1);
  });
});
