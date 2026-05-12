// Smoke test: /pricing forks correctly between B2B planner-served and
// B2C self-serve workspaces.
//
// /pricing has a three-branch fork (see app/(app)/pricing/page.tsx):
//   1. Workspace has venues with event_roles → render
//      <FullPricingPlanner> (planner-served B2B path, e.g. Hursh+Nisha
//      workspace seeded by Astia)
//   2. Workspace has no event_roles AND user role === 'couple' →
//      redirect("/budget") (B2C self-serve path)
//   3. Workspace has no event_roles AND user role === 'admin' →
//      <ScenarioStudio> (legacy admin view)
//
// This test guards branches 1 + 2. Branch 3 is an admin-only path
// covered separately.
//
// What this guards:
//   - B2B account → /pricing renders the FullPricingPlanner header
//     ("Full pricing" + "Side-by-side, every event · venue + line items")
//   - B2C account → /pricing redirects to /budget (URL changes; no
//     pricing UI ever paints)
//
// What this does NOT guard:
//   - Interaction inside the FullPricingPlanner (venue swap, line-item
//     edits, scenario save) — destructive against prod, deferred to
//     staging.
//   - The admin/ScenarioStudio branch — would need an admin account
//     whose workspace has no event_roles, which is a contrived state.
//
// Test-data assumption: b2b-hursh-nisha workspace has at least one
// venue with event_roles populated (per the Astia PDF import). If a
// future migration clears event_roles, this test would mis-detect the
// fork — update in lockstep.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("18 — /pricing forks B2B → planner vs B2C → /budget", () => {
  test("B2B planner-served couple — sees FullPricingPlanner", async ({
    page,
  }) => {
    await signInAs(page, "b2b-hursh-nisha");
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");

    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");

    // We should still be on /pricing (no redirect happened).
    expect(page.url()).toContain("/pricing");

    // The planner-served branch renders the "Full pricing" header
    // with the planner-specific eyebrow that mentions venue + line
    // items. B2C's empty-state would never have this eyebrow even if
    // it somehow rendered the page.
    await expect(
      page.getByRole("heading", { name: /Full pricing/i }),
    ).toBeVisible({ timeout: 10_000 });

    // The FullPricingPlanner-specific eyebrow disambiguates from the
    // admin ScenarioStudio branch (which uses "Side-by-side, every
    // event" without the "venue + line items" suffix). innerText()
    // returns the visually rendered text — the eyebrow is styled with
    // CSS `text-transform: uppercase` so we case-insensitive match.
    const settledBody = await page.locator("body").innerText();
    expect(settledBody.toLowerCase()).toContain("venue + line items");
  });

  test("B2C self-serve couple — /pricing redirects to /budget", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");

    // The redirect happens server-side, so by the time waitForLoadState
    // settles we should already be on /budget.
    expect(page.url()).toContain("/budget");
    expect(page.url()).not.toContain("/pricing");

    // Sanity — /budget renders its own header (already covered by
    // test 06, but worth asserting here as the redirect target proof).
    await expect(
      page.getByRole("heading", { name: /^Budget$/i }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
