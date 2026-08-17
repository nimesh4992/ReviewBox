import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for ReviewBox.
 *
 * E2E tests live in `tests/e2e/`. CI starts the dev server, runs
 * chromium-only headless. Locally, run `npx playwright test --ui`
 * to debug.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // JSON report added so CI can tell "N tests passed" apart from "0 tests
  // ran" — a distinction the job's green tick does not make, and the reason
  // this suite silently executed nothing for weeks while being cited as
  // evidence that changes were safe (audit finding H-8).
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }], ["json", { outputFile: "playwright-report/results.json" }]]
    : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
