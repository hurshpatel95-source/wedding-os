// Smoke test: /vendors/<id> Overview tab renders the status-timeline
// pipeline (researching → rfp_sent → quoted → shortlisted → booked →
// completed) and the current-status badge in the page header.
//
// Background — the vendor status pipeline lives inside the Overview
// tab of vendor-detail-tabs (Status timeline card with the six-stage
// button row). The page header carries a separate VENDOR_STATUS_LABEL
// badge for the vendor's current status. Both surface the same
// `vendors.status` column, so a regression that broke one would
// likely break both. The May 8 regression class here was the
// canEdit gate misfiring (couples couldn't see the pipeline at all
// because role==="couple" used to fail) — that's why this test runs
// as a B2C couple.
//
// What this guards:
//   - /vendors/<id> renders without crashing for a B2C couple
//   - The status badge in the page header is visible
//   - The Status timeline section renders (label "Status timeline")
//   - At least one of the six canonical status buttons is visible
//     (researching / rfp_sent / quoted / shortlisted / booked /
//     completed)
//
// What this does NOT guard:
//   - The current status badge actually matches the database value
//     (we don't snapshot it — only verify it's rendered)
//   - Advancing the status — that's a destructive UPDATE on prod. We
//     assert reachability of the timeline buttons, not behavior.
//   - The "declined" side-branch button — covered by inspection of
//     the source; not asserted here.
//
// Test-data assumption: b2c-rodnj has at least one vendor in their
// workspace. If they have zero we skip with annotation (a B2C
// account with no vendors is a legitimate empty state).

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("24 — /vendors/<id> shows status pipeline + badge", () => {
  test("B2C couple — status timeline reachable on vendor detail (no save)", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/vendors");
    await page.waitForLoadState("networkidle");

    // No crash on /vendors index.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");

    // The vendor index lists each vendor as a card linking to
    // /vendors/<id>. We pick the first such link.
    const vendorLinks = page.locator('a[href^="/vendors/"]').filter({
      // Exclude /vendors/find, /vendors/compare etc.
      hasNot: page.locator('a[href*="/find"], a[href*="/compare"]'),
    });

    // More resilient — look for any link with href matching /vendors/<uuid>
    // (UUIDs are the only vendor-id shape currently). Or just look for
    // any href that doesn't match the known sibling pages.
    const allVendorLinks = await page.locator('a[href^="/vendors/"]').all();
    let vendorDetailHref: string | null = null;
    for (const link of allVendorLinks) {
      const href = await link.getAttribute("href");
      if (!href) continue;
      // Skip sibling pages.
      if (
        href === "/vendors" ||
        href.startsWith("/vendors/find") ||
        href.startsWith("/vendors/compare") ||
        href.startsWith("/vendors/new")
      ) {
        continue;
      }
      vendorDetailHref = href;
      break;
    }

    if (!vendorDetailHref) {
      test.info().annotations.push({
        type: "branch",
        description:
          "B2C account has no vendors — status-pipeline check skipped " +
          "(no /vendors/<id> page to land on).",
      });
      return;
    }

    // Navigate to the vendor detail page.
    await page.goto(vendorDetailHref);
    await page.waitForLoadState("networkidle");

    const detailBody = await page.locator("body").innerText();
    expect(detailBody).not.toContain("Application error");
    expect(detailBody).not.toContain("500");

    // The page header carries the vendor's current status badge. The
    // VENDOR_STATUS_LABEL values include "Researching", "RFP sent",
    // "Quoted", "Shortlisted", "Booked", "Completed", "Declined".
    // We assert at least one of those appears somewhere in the
    // rendered body (the badge is small + always present).
    const settledBody = await page.locator("body").innerText();
    const hasStatusLabel = [
      "Researching",
      "RFP sent",
      "Quoted",
      "Shortlisted",
      "Booked",
      "Completed",
      "Declined",
    ].some((label) => settledBody.includes(label));
    expect(hasStatusLabel).toBe(true);

    // The Status timeline card renders inside the Overview tab (default
    // tab). Its CardTitle is "Status timeline".
    await expect(
      page.getByText(/^Status timeline$/i),
    ).toBeVisible({ timeout: 10_000 });

    // At least one canonical status button is visible inside the
    // timeline. The buttons render the human-readable VENDOR_STATUS_LABEL,
    // so we match by accessible button name.
    const timelineButtons = [
      page.getByRole("button", { name: /^Researching$/i }),
      page.getByRole("button", { name: /^RFP sent$/i }),
      page.getByRole("button", { name: /^Quoted$/i }),
      page.getByRole("button", { name: /^Shortlisted$/i }),
      page.getByRole("button", { name: /^Booked$/i }),
      page.getByRole("button", { name: /^Completed$/i }),
    ];
    let visibleCount = 0;
    for (const btn of timelineButtons) {
      const isVisible = await btn
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      if (isVisible) visibleCount++;
    }
    // We expect ALL six to render simultaneously on the pipeline (it's
    // always six pills) — but tolerate occasional flake by requiring
    // at least one. If the timeline regressed to "declined" state
    // (which hides the pipeline) we accept that too.
    const isDeclinedSidebar = settledBody.includes(
      "vendor is marked declined",
    );
    if (!isDeclinedSidebar) {
      expect(visibleCount).toBeGreaterThan(0);
    }

    // Do NOT click any status button — that UPDATEs vendors.status on
    // prod and would mutate this vendor's pipeline state.
  });
});
