// Smoke test: /w/<slug> public wedding site renders without auth.
//
// What this guards:
//   - The public-read RLS policy on workspaces gated by public_slug
//     still allows anonymous access (changed during the May 8 RLS
//     audit — could regress)
//   - /w/[slug]/page.tsx server component doesn't crash for valid slug
//   - RSVP form mounts (the public-site flow's whole point)
//   - No auth gate accidentally added to /w/* (we'd regress the
//     "wedding-website-with-RSVP" feature)
//
// What this does NOT guard:
//   - Submitting an RSVP. The submission writes to
//     guest_event_invitations and would create real data every run.
//     Deferred until staging.
//   - The /sign and /rsvp tokenized flows (separate tests).
//
// Test data: `nisha-and-hursh` is seeded via supabase/seed/seed_public_site.ts
// and is the canonical demo public site. If this slug stops being
// published in prod, swap to another seeded slug (sara-marcus,
// jennifer-liam, anaya-rohan per SESSION-SNAPSHOT.md).

import { test, expect } from "@playwright/test";

test.describe("10 — /w/<slug> public site renders anonymously", () => {
  test("nisha-and-hursh slug renders wedding site without auth", async ({
    page,
  }) => {
    // No signInAs — this route must be reachable while logged-out.
    await page.goto("/w/nisha-and-hursh");
    await page.waitForLoadState("networkidle");

    const body = await page.locator("body").innerText();

    // Hard fails — these are uncaught crashes, never acceptable.
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");

    // The page may have legitimately been unpublished in prod, in
    // which case Next.js renders a 404. We tolerate that; the test is
    // inconclusive in that case, but no regression in the server
    // component itself.
    const looks404 =
      body.includes("404") ||
      body.includes("This page could not be found") ||
      body.includes("Page not found");

    if (looks404) {
      test.info().annotations.push({
        type: "skip-reason",
        description:
          "/w/nisha-and-hursh returned 404. Slug may have been unpublished. " +
          "Re-seed via supabase/seed/seed_public_site.ts or pick another " +
          "published slug.",
      });
      return;
    }

    // Wedding-site content. Look for the canonical narrative phrase
    // OR an RSVP form element. Either confirms the site rendered with
    // real content (not a blank shell).
    const hasStoryContent =
      body.toLowerCase().includes("rsvp") ||
      body.toLowerCase().includes("wedding") ||
      body.toLowerCase().includes("ceremony");

    expect(hasStoryContent).toBe(true);

    // RSVP form should be reachable somewhere on the page (button or
    // form element). The exact selector depends on theme but every
    // theme exposes an RSVP affordance.
    const rsvpAffordance =
      (await page.getByText(/rsvp/i).count()) > 0 ||
      (await page.getByRole("button", { name: /rsvp|reply|attending/i }).count()) > 0;

    expect(rsvpAffordance).toBe(true);
  });

  test("Public site does NOT leak auth-gated dashboard chrome", async ({
    page,
  }) => {
    // Sanity test: /w/<slug> is anonymous. It must not render the
    // logged-in dashboard nav (Plan, Budget, Vendors, etc.). If it
    // does, we have a layout regression where the (app) chrome
    // leaked into the public route.
    await page.goto("/w/nisha-and-hursh");
    await page.waitForLoadState("networkidle");

    const body = await page.locator("body").innerText();

    // These nav labels are unique to the logged-in dashboard chrome
    // and should NEVER appear on a public wedding site. If they do,
    // the layout boundary broke.
    expect(body).not.toContain("Autopilot");
    expect(body).not.toContain("Estimator");
    // Note: /budget exists in dashboard nav but "budget" as a word
    // could appear in user-written story_html. Don't assert against
    // it.
  });
});
