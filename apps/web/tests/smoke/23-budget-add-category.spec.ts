// Smoke test: /budget (loaded state) exposes an "Add a new category"
// affordance for B2C couples and clicking it reveals the form with
// category-picker + label-input.
//
// Background — the AddCategoryForm is the inline form at the bottom
// of the BudgetTree that lets couples add a top-level category
// they forgot (e.g. "Honeymoon fund"). It starts collapsed as a
// dashed-border "+ Add a new category" button; clicking it expands
// it into a form with a category Select + label Input + Add button.
// The May 8 regression class here was the form failing to mount
// when the budget tree had thousands of rows (a perf-related crash
// in the parent), or the category Select rendering empty because
// existingCategories filtering ate every available option.
//
// What this guards:
//   - The collapsed "+ Add a new category" button is rendered when
//     /budget is in loaded state
//   - Clicking it reveals the expanded form
//   - The expanded form has a category picker (combobox) + a label
//     input + a submit button
//
// What this does NOT guard:
//   - Actually adding a category — that would POST /api/budget-lines
//     and create a real row on prod. Reachability only.
//   - The empty-state path (where the BudgetTree isn't even mounted
//     and the AddCategoryForm doesn't exist). Test 06 covers that
//     branch; we skip gracefully here when /budget shows the Generate
//     form.
//   - The "amount" input — the AddCategoryForm doesn't have a
//     dedicated amount input (parents are rollup containers with no
//     estimate; per-line amounts are entered via AddLineForm under
//     each parent). The task description mentioned "amount-input"
//     but the actual UI is category + label only. Spec adapted to
//     reality.
//
// Test-data assumption: b2c-rodnj /budget MAY be in either state. We
// branch on which UI is rendered and skip if it's the empty Generate-
// baseline form.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("23 — /budget add-category affordance is reachable for B2C", () => {
  test("B2C couple — loaded /budget exposes add-category form (no save)", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/budget");
    await page.waitForLoadState("networkidle");

    // No crash.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");

    // Page header is always rendered.
    await expect(
      page.getByRole("heading", { name: /^Budget$/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Branch on state — if /budget is in empty state (Generate form
    // visible), the BudgetTree (and therefore the AddCategoryForm)
    // isn't mounted. Skip gracefully — that path is test 06's job.
    const generateButton = page.getByRole("button", {
      name: /Generate my baseline/i,
    });
    const isEmptyState = await generateButton
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (isEmptyState) {
      test.info().annotations.push({
        type: "branch",
        description:
          "B2C /budget is in empty state — AddCategoryForm only renders " +
          "inside the loaded BudgetTree, so reachability check skipped.",
      });
      return;
    }

    // Loaded path — the AddCategoryForm renders at the bottom of the
    // BudgetTree. It starts collapsed as a button with the text "Add
    // a new category". Match by accessible name.
    const collapsedTrigger = page.getByRole("button", {
      name: /Add a new category/i,
    });
    await expect(collapsedTrigger).toBeVisible({ timeout: 10_000 });

    // Click to expand. The button is replaced by an inline <form> with
    // a Select (category) + Input (label) + Add-category submit.
    await collapsedTrigger.click();

    // The expanded form has a Category combobox (Radix Select). It
    // doesn't have an explicit aria-label, but the wrapper has the
    // text "CATEGORY" as an uppercase-styled label.
    await expect(
      page.getByText(/^Category$/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // The form's category combobox.
    const categoryCombobox = page.getByRole("combobox").first();
    await expect(categoryCombobox).toBeVisible();

    // The label input is an <input> with placeholder = the default
    // category label. We don't predict the placeholder text — we
    // assert the input exists by its uppercase "LABEL (OPTIONAL)"
    // wrapper text.
    await expect(
      page.getByText(/Label \(optional\)/i),
    ).toBeVisible({ timeout: 10_000 });

    // The submit button reads "Add category" (or shows a Loader2 when
    // submitting — at-rest it's the text label).
    const submitBtn = page.getByRole("button", { name: /^Add category$/i });
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();

    // Do NOT click Submit — that POSTs /api/budget-lines and creates a
    // prod row. Cancel out (the form has an X button to collapse it).
    // Multiple "Cancel" buttons may exist (toasts etc.); use aria-label
    // "Cancel" which is set on the X button inside the form.
    const cancelXBtn = page.getByRole("button", { name: /^Cancel$/i });
    if (await cancelXBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelXBtn.click();
    }
  });
});
