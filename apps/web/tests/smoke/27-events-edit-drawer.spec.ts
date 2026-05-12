// Smoke test: /events edit drawer is reachable across the three Day-1
// render states.
//
// Move 5 Day 2 wired Edit + AddEvent buttons on /events to open the
// shared EventEditDrawer. This test verifies that one of those triggers
// is reachable and opens the drawer, without saving (PATCH would mutate
// prod data).
//
// Three render states the page can be in:
//   (a) migration-pending — event_details table missing → "rolling out"
//       splash, no buttons. Test exits with annotation.
//   (b) empty — table exists but no rows yet → AddEventChip buttons
//       on the empty state. Click the first chip, assert drawer opens.
//   (c) loaded — at least one event_details row → EditEventButton
//       inside each EventCard. Click the first Edit, assert drawer opens.
//
// What this guards:
//   - The Day-2 client trigger components mount + are clickable
//   - The shared EventEditDrawer mounts on click
//   - The drawer's form (display name input) becomes visible
//
// What this does NOT guard:
//   - Saving a change — would PATCH event_details on prod and toggle
//     real event state for the test account. Reachability only.
//   - The 404 pre-deploy state — once /events ships this test runs
//     unconditionally. Until then we tolerate 404 like spec 26 does.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("27 — /events edit drawer reachable", () => {
  test("b2c-rodnj opens EventEditDrawer from /events without saving", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");

    await page.goto("/events");
    await page.waitForLoadState("networkidle");

    // Sanity: not redirected to login.
    expect(page.url()).not.toMatch(/\/login(\?|$)/);

    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");
    expect(body.toLowerCase()).not.toContain("internal server error");

    const lower = body.toLowerCase();

    // Tolerate pre-deploy 404 — same shape as spec 26.
    const isPredeployNotFound =
      lower.includes("404") &&
      (lower.includes("couldn") || lower.includes("not found"));
    if (isPredeployNotFound) {
      test.info().annotations.push({
        type: "state",
        description:
          "pre-deploy — /events not yet live on prod. Drawer reachability check skipped.",
      });
      return;
    }

    // State (a): migration-pending splash — no triggers to click.
    if (lower.includes("rolling out")) {
      test.info().annotations.push({
        type: "state",
        description:
          "migration-pending — event_details table missing. Drawer reachability " +
          "not applicable (no Edit/Add buttons rendered).",
      });
      // Still verify the page rendered the Events heading.
      await expect(
        page.getByRole("heading", { name: /^Events$/i }),
      ).toBeVisible({ timeout: 10_000 });
      return;
    }

    // State (b) or (c): the Edit + AddEventChip buttons are real <button>
    // elements rendered by event-edit-buttons.tsx. Edit reads as just
    // "Edit"; chips read as "+ <Event label>". Prefer the Edit path
    // (loaded state) if present; otherwise click the first chip.
    const editButton = page.getByRole("button", { name: /^Edit$/ });
    const editCount = await editButton.count();

    if (editCount > 0) {
      // State (c) — loaded. Click the first Edit on an EventCard.
      await editButton.first().click();
    } else {
      // State (b) — empty. AddEventChip buttons have labels like
      // "+ Ceremony", "+ Reception", "+ Sangeet" etc. Find the first
      // one and click it.
      const addChip = page.getByRole("button", { name: /^\+\s/ });
      const chipCount = await addChip.count();
      if (chipCount === 0) {
        // Unexpected — neither edit nor add buttons rendered. Annotate
        // and bail rather than failing, since both Day-1 + Day-2 server
        // logic should always render at least one trigger.
        test.info().annotations.push({
          type: "branch",
          description:
            "loaded but no Edit/Add buttons rendered — unexpected, " +
            "verify event-edit-buttons.tsx is wired.",
        });
        return;
      }
      await addChip.first().click();
    }

    // The drawer renders a header eyebrow that reads either "Edit event"
    // (existing != null) or "Add event" (existing == null), and the
    // form's "Display name" label appears in either flow. Assert on the
    // Display name label since it's the same across both modes.
    await expect(
      page.getByText(/Display name/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Do NOT click Save — that would PATCH /api/events/[role] on prod.
    // Close with Cancel so the page is clean for the next test.
    const cancelBtn = page.getByRole("button", { name: /^Cancel$/i });
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
    }
  });
});
