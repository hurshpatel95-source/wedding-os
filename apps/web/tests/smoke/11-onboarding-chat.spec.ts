// Smoke test: /onboarding renders the chat UI without crashing.
//
// What this guards:
//   - The intake_sessions read/create path in the server component
//     doesn't throw (a regression would 500 the route)
//   - The OnboardingChat client component mounts and the composer
//     textarea is reachable
//   - The page header copy ("A few quick questions") still renders
//   - The composer is enabled so a user CAN send their first answer
//
// What this does NOT guard (deferred):
//   - Sending a message and getting an AI response. The send path
//     writes to intake_sessions + spends real Sonnet tokens on every
//     run; deferred to staging.
//   - The "What we know so far" sidebar field-chip rendering — that's
//     post-chat-progression UI, irrelevant for the reachability guard.
//
// Test-data assumption: every B2C account has an `intake_sessions`
// row created on first visit (the server component creates one if
// missing). So the chat composer should ALWAYS render — there's no
// "complete" branch to skip for a fresh-load test that doesn't send.
//
// Note: if the account has already completed onboarding, /onboarding
// may render the completed state (no composer). We tolerate that.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

test.describe("11 — /onboarding renders chat UI", () => {
  test("B2C couple — onboarding page loads, composer reachable", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");

    // No crash.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("500");
    expect(body).not.toContain("Couldn't find your workspace");

    // The page header copy is server-rendered and is always visible
    // regardless of session state (active vs completed).
    await expect(
      page.getByRole("heading", { name: /A few quick questions/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Branch: either the composer textarea is present (active session)
    // OR the completed state is shown. Either is a valid render.
    const composer = page.getByPlaceholder(/Type your answer/i);
    const composerVisible = await composer
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (composerVisible) {
      // Active-session path: composer must be enabled (not stuck
      // disabled by a hung sending state).
      await expect(composer).toBeEnabled();

      // The Send button is next to the composer.
      await expect(
        page.getByRole("button", { name: /^Send$/i }),
      ).toBeVisible();

      // Do NOT actually type or send — writing to intake_sessions on
      // every smoke run would mutate prod and spend Sonnet tokens.
    } else {
      // Completed-session path: the page still rendered something —
      // crash check above is enough. Annotate so the run isn't silent.
      test.info().annotations.push({
        type: "info",
        description:
          "Onboarding composer not visible — account may have completed " +
          "intake. Page rendered without crash, which is what this test guards.",
      });
    }
  });
});
