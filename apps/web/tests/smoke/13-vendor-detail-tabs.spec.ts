// Smoke test: /vendors/<id> renders all 4 tabs and a B2C couple can
// reach Pricing + Files (the T1.5 admin-gate fix).
//
// Background — T1.5 fork: pre-T1.5 the Pricing + Files tabs were
// admin-only. The May 8 fix made them visible to couples (B2C
// self-serve users need to track quoted prices and upload their own
// contracts / quote PDFs). This test catches a regression where the
// admin-gate gets reintroduced and the tabs disappear for couples.
//
// What this guards:
//   - /vendors/<id> doesn't 500
//   - All 4 TabsTrigger labels render: Overview / Pricing / Tasks /
//     Files (the canonical order in VendorDetailTabs)
//   - Clicking Pricing + Files tabs activates them (proves they're
//     reachable for a B2C role, not gated out)
//
// What this does NOT guard (deferred):
//   - Quote submission, file upload, task create — all destructive
//     writes against prod data, deferred to staging.
//
// Test-data assumption: the account has at least ONE vendor in
// /vendors. If the vendor list is empty we annotate + return without
// failing. (This account currently has empty-state per test 08; if
// that's still true at run time, the test will skip itself.)

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("13 — /vendors/<id> tabs render + are reachable for B2C", () => {
  test("B2C couple — all 4 tabs visible, Pricing + Files reachable", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/vendors");
    await page.waitForLoadState("networkidle");

    // No crash on /vendors itself.
    const vendorsBody = await page.locator("body").innerText();
    expect(vendorsBody).not.toContain("Application error");
    expect(vendorsBody).not.toContain("500");

    // The vendor cards are anchor tags linking to /vendors/<uuid>.
    // Use a CSS attribute selector that explicitly excludes the
    // /vendors/find + /vendors/compare nav links (those exist on
    // every render and would otherwise match `a[href^="/vendors/"]`).
    // Pull all candidate hrefs and pick the first one that looks like
    // a vendor UUID, not a known sub-route.
    const allLinks = await page
      .locator('a[href^="/vendors/"]')
      .evaluateAll((els) =>
        (els as HTMLAnchorElement[]).map((el) => el.getAttribute("href") || ""),
      );
    const vendorHref = allLinks.find(
      (h) =>
        h.startsWith("/vendors/") &&
        h !== "/vendors/find" &&
        !h.startsWith("/vendors/compare") &&
        !h.startsWith("/vendors/find/"),
    );

    if (!vendorHref) {
      test.info().annotations.push({
        type: "skip-reason",
        description:
          "B2C account has no vendors in /vendors. Detail-page tab " +
          "assertions skipped. Add a vendor via the UI to enable this test.",
      });
      return;
    }

    await page.goto(vendorHref);

    // Wait for the detail page to settle.
    await page.waitForURL(/\/vendors\/[^/]+$/, { timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    const detailBody = await page.locator("body").innerText();
    expect(detailBody).not.toContain("Application error");
    expect(detailBody).not.toContain("500");

    // All 4 tab triggers visible. Use role=tab to target the actual
    // TabsTrigger, not stray "Pricing" or "Files" text elsewhere.
    const overviewTab = page.getByRole("tab", { name: /^Overview$/i });
    const pricingTab = page.getByRole("tab", { name: /^Pricing$/i });
    const tasksTab = page.getByRole("tab", { name: /^Tasks/i });
    const filesTab = page.getByRole("tab", { name: /^Files/i });

    await expect(overviewTab).toBeVisible({ timeout: 10_000 });
    await expect(pricingTab).toBeVisible();
    await expect(tasksTab).toBeVisible();
    await expect(filesTab).toBeVisible();

    // The T1.5 admin-gate fix: B2C couple MUST be able to click into
    // Pricing + Files. A regression that re-adds the admin gate would
    // either hide these triggers entirely or make them no-ops.
    await pricingTab.click();
    await expect(pricingTab).toHaveAttribute("data-state", "active");

    await filesTab.click();
    await expect(filesTab).toHaveAttribute("data-state", "active");
  });
});
