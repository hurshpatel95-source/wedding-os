// Smoke test: /guests/import renders the drop-stage UI without crash.
//
// What this guards:
//   - The route loads for a B2C couple (was previously admin-gated —
//     pre-T1.5 fix; couples need to import their own guest lists)
//   - The dropzone renders with the "Drop a guest list" heading and a
//     "Pick a file" affordance — the two reachability checks
//   - The header copy says "AI" (column-mapping), not "Claude" or
//     "Anthropic" — guards the May-8 class of copy-leak regression
//     (where internal vendor names bled into user-facing strings)
//
// What this does NOT guard (deferred):
//   - Actually dropping a file. The upload pipeline hits /api/guests/
//     import which calls Sonnet for column mapping and inserts rows
//     into `guests`. Both destructive + expensive; deferred.
//   - The preview-stage Claude badges (which DO say "Claude mapped"
//     and "Claude cost $X"). Those are admin/internal-facing copy on
//     the second stage — separate concern, separate test if/when we
//     decide to scrub them. This test only asserts the DROP stage,
//     which is what every user sees on first land.
//
// Test-data assumption: none — the drop stage is the initial render
// regardless of any account state.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("14 — /guests/import renders dropzone for B2C couple", () => {
  test("B2C couple — dropzone visible, AI copy present, no Claude leak", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/guests/import");
    await page.waitForLoadState("networkidle");

    // No crash.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");

    // Page header is server-rendered and always visible. The page
    // title uses "Drop the guest list" and the eyebrow says
    // "Bulk import · AI column-mapping" — the AI keyword is here.
    await expect(
      page.getByRole("heading", { name: /Drop the guest list/i }),
    ).toBeVisible({ timeout: 10_000 });

    // The dropzone heading inside the ImportWizard client component.
    await expect(
      page.getByRole("heading", { name: /Drop a guest list/i }),
    ).toBeVisible({ timeout: 10_000 });

    // The fallback "Pick a file" button is the reachability check —
    // users can still upload even if drag-drop fails.
    await expect(
      page.getByRole("button", { name: /Pick a file/i }),
    ).toBeVisible();

    // Copy-leak guard. Re-fetch the body text AFTER the wizard has
    // hydrated (don't reuse the earlier `body` snapshot — same race-
    // condition trap that test 06 hit). The drop stage shows the
    // eyebrow "AI column-mapping" and the helper "Excel (.xlsx) or
    // CSV. We'll show a preview before anything saves." — neither
    // should mention Claude or Anthropic.
    const dropStageBody = await page.locator("body").innerText();
    expect(dropStageBody).toContain("AI");
    expect(dropStageBody).not.toContain("Claude");
    expect(dropStageBody).not.toContain("Anthropic");

    // Do NOT trigger an upload — drives a real Sonnet call + DB write.
  });
});
