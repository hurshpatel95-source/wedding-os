// Smoke test: /plan task drawer renders Cost link section for B2C and
// hides it for B2B (T1.5 fork verification).
//
// What this guards against:
//   - The Pencil → drawer flow regressing for either mode
//   - The B2C-only Cost link section being accidentally removed or
//     accidentally exposed to B2B (the T1.5 fork is THE feature that
//     differentiates the planner-served experience here)
//   - /plan failing to load tasks at all
//
// What this does NOT guard (deferred):
//   - The actual save path that auto-creates a budget line. Writing
//     to prod for a smoke test would mutate the test account's task +
//     create real budget rows every run. Deferred until staging.
//   - That the dropdown lists actual budget lines (we'd need to know
//     the account's state). Reachability is enough for now.
//
// NOTE on the B2B half: both b2b-hursh-nisha and b2c-rodnj currently
// have `acquired_planner` skin after the May 8 Astia rollback. The
// B2B path can't be validated against prod until workspace_branding
// is backfilled + skin flipped. The B2B test is `.skip()` until then.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("07 — /plan task cost-link section forks by mode", () => {
  test("B2C couple — Cost link section is visible in task drawer", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/plan");
    await page.waitForLoadState("networkidle");

    // No crash.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");

    // Find the first pencil "Edit task" button. The plan board renders
    // these on every task row.
    const firstEditBtn = page.getByRole("button", { name: /edit task/i }).first();
    await expect(firstEditBtn).toBeVisible({ timeout: 10_000 });
    await firstEditBtn.click();

    // Drawer should now be open. The Cost link section header is the
    // distinguishing element — it ONLY renders for B2C.
    await expect(
      page.getByText(/^Cost link$/i, { exact: false }),
    ).toBeVisible({ timeout: 5_000 });

    // The two cost-link inputs should both be there.
    await expect(page.getByLabel(/Estimated cost/i)).toBeVisible();
    await expect(page.getByLabel(/Linked budget line/i)).toBeVisible();

    // Do NOT save — mutating prod data on every smoke run is wrong.
  });

  // SKIPPED — both accounts currently have acquired_planner skin per
  // the May 8 Astia rollback. Until workspace_branding is backfilled
  // and one account flips to co_branded, isPlannerServed returns false
  // for both, and Cost link is visible in both. Flip back to
  // .test(...) after the skin rebackfill ships.
  test.skip("B2B planner-served couple — Cost link section is HIDDEN", async ({
    page,
  }) => {
    await signInAs(page, "b2b-hursh-nisha");
    await page.goto("/plan");
    await page.waitForLoadState("networkidle");

    const firstEditBtn = page.getByRole("button", { name: /edit task/i }).first();
    await expect(firstEditBtn).toBeVisible({ timeout: 10_000 });
    await firstEditBtn.click();

    // Cost link section should be absent for B2B (T1.5 fork).
    await expect(
      page.getByText(/^Cost link$/i, { exact: false }),
    ).toHaveCount(0);
  });
});
