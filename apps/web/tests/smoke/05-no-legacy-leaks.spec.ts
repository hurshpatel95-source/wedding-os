// Smoke test: no legacy "wedding-os" / "Barcelona Sept 2027" / "Sitges"
// strings leak into B2C user-facing pages.
//
// The May 8 audit found Hursh's personal wedding details hardcoded
// across multiple files (login subtitle, /map header, default
// availability month, root metadata, etc). These tests act as
// regression guards — if a future change re-introduces any of these,
// CI fails before deploy.

import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";

const LEAK_STRINGS = [
  "Barcelona · September 2027",
  "Sitges-area venues clustered south",
  "Barcelona Sept 2027",
  // wedding-os is OK in code paths / type imports but should not appear
  // in user-facing copy — the title check covers it.
];

test.describe("05 — Legacy copy leaks", () => {
  test("Login page title says Acquired Planner, not wedding-os", async ({
    page,
  }) => {
    await page.goto("/login");
    const title = await page.title();
    expect(title.toLowerCase()).toContain("acquired");
    expect(title.toLowerCase()).not.toContain("wedding-os");
  });

  test("/map header does not mention Sitges or Barcelona", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/map");
    const body = await page.locator("body").innerText();
    for (const leak of LEAK_STRINGS) {
      expect(body).not.toContain(leak);
    }
  });

  test("Login subtitle is generic, not Hursh's wedding context", async ({
    page,
  }) => {
    await page.goto("/login");
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Barcelona · September 2027");
  });

  test("/guests/import does not expose 'Claude' as the AI vendor", async ({
    page,
  }) => {
    await signInAs(page, "b2c-rodnj");
    await page.goto("/guests/import");
    const body = await page.locator("body").innerText();
    expect(body.toUpperCase()).not.toContain("CLAUDE COLUMN");
  });
});
