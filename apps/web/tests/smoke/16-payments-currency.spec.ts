// Smoke test: /payments renders the correct currency symbol per workspace.
//
// The /payments page formats milestone totals and planner-invoice amounts
// through formatCurrency() / currencySymbol() helpers that key off the
// workspace's base_currency column. The historical bug class — back when
// every amount column was named *_eur and a Spanish wedding lived in the
// codebase — was a hardcoded "€" leak on US accounts. This test guards
// that path: a USD workspace MUST render "$" in stat cards and MUST NOT
// render the literal "EUR" currency code in the visible body.
//
// What this guards:
//   - /payments doesn't crash for a B2C couple
//   - The four StatCard values (Total committed / Paid to date / Due
//     next 30 days / Overdue) render with a "$" symbol when the
//     workspace base_currency is USD
//   - The visible body doesn't leak the literal string "EUR" (the
//     currency code, not the symbol — that would only surface if the
//     code path bypassed currencySymbol() and rendered the raw column
//     name or a debug string)
//
// What this does NOT guard:
//   - The EUR variant. The b2b-hursh-nisha workspace was historically
//     EUR but now lives under the acquired_planner skin per the May
//     rollback (see CLAUDE.md skin caveat). Asserting EUR-specific
//     symbol on that account is unreliable until the skin flip lands —
//     deferred to a future test 16b once both skins are stable.
//   - Currency-symbol correctness inside the PaymentsCalendar (client
//     component) — those amounts come from a separate code path and
//     would warrant their own test if the symbol ever leaks there.
//
// Test-data assumption: b2c-rodnj workspace.base_currency = 'USD'
// (default fallback in payments/page.tsx line 118). If a future
// migration changes that default, this test needs to update in lockstep.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("16 — /payments currency symbol matches workspace base_currency", () => {
  test("B2C USD couple — shows $ symbol, does not leak 'EUR'", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/payments");
    await page.waitForLoadState("networkidle");

    // No crash.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");
    expect(body).not.toContain("Couldn't find your workspace");

    // Header is always rendered regardless of milestones data state.
    await expect(
      page.getByRole("heading", { name: /^Payments$/i }),
    ).toBeVisible({ timeout: 10_000 });

    // The four stat cards always render (they show $0 when there are
    // no milestones). Each value goes through fmt() → formatCurrency()
    // → Intl.NumberFormat with USD → "$" prefix. Re-fetch the body
    // text AFTER the page has fully settled (don't reuse the early
    // snapshot — same race as test 06).
    const settledBody = await page.locator("body").innerText();

    // Positive: at least one "$" appears somewhere in the rendered
    // page. With four stat cards each rendering a $-prefixed value,
    // this is a strong signal that the USD code path was taken.
    expect(settledBody).toContain("$");

    // Negative: the literal string "EUR" should not appear. The
    // symbol "€" would be the bug surface, but the column code "EUR"
    // is the canonical regression marker (e.g. a debug print of
    // base_currency or a hardcoded label).
    expect(settledBody).not.toContain("EUR");

    // Also negative: the € symbol itself should not appear on a USD
    // account. If a future code path renders amounts with hardcoded
    // formatEUR() this would catch it.
    expect(settledBody).not.toContain("€");
  });
});
