// Smoke test: /events renders without crashing for a B2C couple
// across all three Day-1 render states.
//
// Move 5 Day 1 added /events as a new server-rendered page. The
// event_details table backing it doesn't auto-apply until T1.1 part 2
// is active, so the most likely live state once deployed is
// "migration pending" — the page renders a calm "rolling out" empty
// state. Once the migration is applied, the page auto-seeds ceremony +
// reception and renders the card grid.
//
// Smoke runs against PROD by default (see playwright.config.ts).
// Until this Day-1 branch ships to prod, /events 404s there. This
// test is deployment-tolerant: it accepts a 404 as a valid pre-deploy
// state and asserts no crash + correct landing for any other case.
// Day 2 will tighten assertions once the route is live.
//
// What this guards (post-deploy):
//   - /events server component compiles + renders for an authenticated
//     B2C couple
//   - The page is tolerant of pre-migration state (event_details table
//     missing)
//   - The page heading "Events" appears regardless of which render
//     state we land on
//   - No "Application error" / "500" / "Internal Server Error"

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("26 — /events renders for B2C couple", () => {
  test("b2c-rodnj /events renders without crash across all states", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");

    await page.goto("/events");
    await page.waitForLoadState("networkidle");

    // Sanity: not redirected to login (that would mean auth regressed).
    const url = page.url();
    expect(url).not.toMatch(/\/login(\?|$)/);

    // No crash regardless of which state we're in.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");
    expect(body.toLowerCase()).not.toContain("internal server error");

    const lower = body.toLowerCase();

    // Tolerate the pre-deploy state: prod may 404 on /events until
    // this Day-1 branch ships. The route is gated by Next's
    // app-router and the absence of the file returns the framework's
    // 404 page, which renders "We couldn't find that" / "404".
    const isPredeployNotFound =
      lower.includes("404") &&
      (lower.includes("couldn") || lower.includes("not found"));

    if (isPredeployNotFound) {
      test.info().annotations.push({
        type: "state",
        description:
          "pre-deploy — /events not yet live on prod; route 404. Tolerated until Day-1 branch ships.",
      });
      return;
    }

    // Post-deploy: the page heading "Events" should be visible
    // regardless of which of the three render states we landed on
    // (migration pending / empty workspace / loaded workspace).
    await expect(
      page.getByRole("heading", { name: /^Events$/i }),
    ).toBeVisible({ timeout: 10_000 });

    if (lower.includes("rolling out")) {
      test.info().annotations.push({
        type: "state",
        description: "migration-pending — event_details table not yet applied",
      });
    } else if (lower.includes("no events activated yet")) {
      test.info().annotations.push({
        type: "state",
        description: "empty — table exists, no detail rows seeded",
      });
    } else {
      test.info().annotations.push({
        type: "state",
        description: "loaded — at least one event_details row rendered",
      });
    }
  });
});
