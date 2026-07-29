import { expect, test } from "@playwright/test";
import { clerkKeyIsPlaceholder, SKIP_REASON } from "./clerk-env";

/**
 * Smoke tests — the bare minimum that proves the site boots and
 * the critical pages render. If any of these fail, the deploy is
 * fundamentally broken and the PR is blocked.
 *
 * Add new smoke tests sparingly. Each one runs on every PR.
 */

// Without a real Clerk instance the app renders nothing and every
// assertion below fails for the same irrelevant reason — skip honestly
// rather than shipping a permanently-red check nobody reads.
test.skip(clerkKeyIsPlaceholder, SKIP_REASON);

test.describe("smoke", () => {
  test("landing page loads with hero CTA", async ({ page }) => {
    await page.goto("/");

    // Brand name appears
    await expect(page.getByText(/ReviewBox/i).first()).toBeVisible();

    // Primary CTA links to sign-up
    const cta = page.getByRole("link", { name: /start free|get started/i }).first();
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute("href");
    expect(href).toContain("sign-up");
  });

  test("sign-in page loads", async ({ page }) => {
    await page.goto("/sign-in");
    // Clerk renders its own form; we just check the page didn't crash
    await expect(page).toHaveTitle(/sign in|reviewbox/i);
  });

  test("pricing page loads with three plans", async ({ page }) => {
    await page.goto("/pricing");
    // The three plan names should appear somewhere
    await expect(page.locator("body")).toContainText(/starter/i);
    await expect(page.locator("body")).toContainText(/pro/i);
    await expect(page.locator("body")).toContainText(/team/i);
  });

  test("legal pages exist and don't 404", async ({ page }) => {
    for (const path of ["/privacy", "/terms", "/cookies", "/dpa"]) {
      const response = await page.goto(path);
      expect(response?.status(), `Expected ${path} to return 200`).toBeLessThan(400);
    }
  });

  test("help center root page renders", async ({ page }) => {
    await page.goto("/help");
    await expect(page.locator("body")).toContainText(/help|getting started|guide/i);
  });
});
