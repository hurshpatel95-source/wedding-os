// Smoke test: /availability defaults to a sensible month, not the
// hardcoded legacy "September 2027" from Hursh's Barcelona wedding.
//
// Background — pre-May-8 the availability page had `initialMonth =
// "2027-09"` baked in as the fallback when the workspace had no
// wedding_date set. The fix (app/(app)/availability/page.tsx line 30)
// is to derive the month from workspace.wedding_date when present,
// else fall back to the legacy default. The legacy default itself is
// still arguably a leak, but the immediate regression class is the
// page silently showing "September 2027" on a workspace that's
// actually planning a 2026 wedding.
//
// What this guards:
//   - /availability renders without crashing for a B2C couple
//   - The month-header label does NOT read "September 2027" — that's
//     the canonical regression marker for the Barcelona-era hardcode
//     leaking through to a US couple
//
// What this does NOT guard:
//   - That the rendered month is specifically the workspace's
//     wedding_date month (we can't predict that from a smoke test —
//     it depends on the account's stored date)
//   - The empty-state path when the workspace has zero venues (the
//     month nav doesn't render at all in that case — we branch on
//     which UI is on the page)
//   - That the user CAN navigate to September 2027 manually (the
//     month nav still allows browsing back / forward — that's
//     correct behavior)
//
// Test-data assumption: b2c-rodnj may or may not have venues. If they
// have venues, the AvailabilityCalendar renders with its month
// header. If not, the EmptyState renders and the assertion path
// changes.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("19 — /availability default month is not legacy Sept 2027", () => {
  test("B2C couple — month header is anything except 'September 2027'", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/availability");
    await page.waitForLoadState("networkidle");

    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");

    // Page header always renders.
    await expect(
      page.getByRole("heading", { name: /Venue availability/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Branch on which state we're in: empty-state vs calendar.
    const emptyState = page.getByText(/Add a venue to start tracking dates/i);
    const isEmpty = await emptyState
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (isEmpty) {
      // Empty-state path — no month nav rendered, so the legacy date
      // can't surface here. Verify the empty-state copy is intact and
      // we're done.
      test.info().annotations.push({
        type: "branch",
        description:
          "B2C account has no venues — month-default check skipped " +
          "(EmptyState renders instead of AvailabilityCalendar).",
      });
      return;
    }

    // Calendar path — the month nav renders the month label in a
    // <div> with the font-serif class containing the visible label
    // like "September 2027" or "May 2026". Use a settled body
    // snapshot, not the early one (race-condition trap from test 06).
    const settledBody = await page.locator("body").innerText();

    // The canonical regression marker — Barcelona-era hardcode.
    expect(settledBody).not.toContain("September 2027");
  });
});
