// Smoke test: /plan pencil icon opens the per-task edit drawer and the
// status select inside the drawer is reachable.
//
// Background — the TaskEditDrawer is the Monday.com-style side panel
// that opens when a couple clicks the pencil icon on any task row.
// It exposes title / phase / status / owner / category / due date /
// description / cost-link / notes fields. The May 8 regression class
// here was the drawer failing to mount because of a client-only
// component breaking under SSR, or the status select being wired to
// the wrong setter (the drawer has its own `status` state distinct
// from the row's quick-status select). This test verifies the drawer
// opens and the status <select> inside it is reachable.
//
// What this guards:
//   - The pencil icon button on each task row exists and is clickable
//   - Clicking it opens the drawer (the drawer's "Edit task" eyebrow
//     becomes visible)
//   - The drawer's Status native <select> element is reachable and
//     contains the canonical TaskStatus options
//
// What this does NOT guard:
//   - Actually saving a status change — that would PATCH planning_tasks
//     on prod and flip a real task's status. Reachability only.
//   - The cost-link section's behavior (B2C-only) — that's test 07's
//     job (which already covers the fork).
//   - The drawer's other fields (title / phase / owner / etc.) — those
//     all use the same Field wrapper, so verifying one select transitively
//     gives us confidence the others render.
//
// Test-data assumption: b2c-rodnj has at least one task in their /plan
// (true after onboarding generates the starter template — fresh
// workspaces always have ≥ N starter tasks). If the account has zero
// tasks the test branches to skip with annotation.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("22 — /plan pencil icon opens task edit drawer with status select", () => {
  test("B2C couple — drawer opens, status select reachable (no save)", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/plan");
    await page.waitForLoadState("networkidle");

    // No crash.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");

    // Each task row renders a pencil-icon button with title="Edit task".
    // The buttons are inside the TaskRow component (plan-board.tsx
    // line 542 area). Match by accessible name (title attribute).
    const editButtons = page.getByRole("button", { name: /Edit task/i });

    const editCount = await editButtons.count();
    if (editCount === 0) {
      // No tasks on this workspace — skip with annotation. The /plan
      // empty state is its own thing; not what we're testing here.
      test.info().annotations.push({
        type: "branch",
        description:
          "B2C account has no /plan tasks — drawer reachability check " +
          "skipped (would need to seed a task first).",
      });
      return;
    }

    // Click the first pencil. This sets editOpen=true on that row and
    // mounts the TaskEditDrawer overlay.
    await editButtons.first().click();

    // The drawer renders an eyebrow that reads "Edit task" (uppercase
    // styled via CSS). Its header h2 carries the original task title.
    // We assert on the eyebrow since the title varies per account.
    await expect(
      page.getByText(/^Edit task$/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // The drawer has a Status native <select>. The Field label wrapper
    // renders "Status" as an uppercase-styled span next to the select.
    // We find the select by its proximity to the Status label using a
    // role + label pattern — Playwright treats <select> as combobox.
    //
    // The native <select> elements in the drawer don't have an explicit
    // label association (the Field wraps them in a <label>) so the
    // accessible-name comes from the wrapping <label>'s text content.
    // Two combobox elements get matched: Phase and Status. We pick the
    // one whose accessible name includes "Status".
    const statusSelect = page.getByRole("combobox", { name: /Status/i });

    // The Field component uses a <label> wrapping a <select>, so the
    // implicit label is "STATUS" + the hint. getByRole + name regex
    // matches on the full accessible label content.
    await expect(statusSelect).toBeVisible({ timeout: 10_000 });

    // It must contain the canonical status options so we know the
    // select is wired to STATUS_OPTIONS, not some empty/regressed list.
    // Reading the option list off the native select is reliable — no
    // need to open the dropdown (which would be a custom Radix UI for
    // the row's quick-status, but the drawer uses a native <select>).
    const statusOptionValues = await statusSelect
      .locator("option")
      .allTextContents();
    expect(statusOptionValues).toEqual(
      expect.arrayContaining(["Not started", "In progress", "Done"]),
    );

    // Do NOT click Save changes — that PATCHes planning_tasks on prod.
    // Close the drawer with Cancel so we leave the page clean.
    const cancelBtn = page.getByRole("button", { name: /^Cancel$/i });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();
  });
});
