import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

/**
 * Playwright config for ReviewBox.
 *
 * E2E tests live in `tests/e2e/`. CI starts the dev server, runs
 * chromium-only headless. Locally, run `npx playwright test --ui`
 * to debug.
 */

/**
 * Load .env* the same way the app under test does.
 *
 * The skip gate in tests/e2e/clerk-env.ts asks "are we pointed at a real Clerk
 * instance?" by reading process.env. But Playwright's own process is NOT the
 * Next dev server: Next loads .env.local for itself, and nothing loaded it
 * here. So the gate saw no Clerk variables at all, concluded "placeholder", and
 * every spec skipped — locally, for a reason that had nothing to do with the
 * local environment. The suite could therefore never run on a developer machine
 * no matter what was in .env.local.
 *
 * `loadEnvConfig` is Next's own loader (@next/env, exact-pinned by next itself),
 * so the test process and the app resolve identical values with identical
 * precedence — .env.local over .env.development over .env. Re-implementing
 * dotenv parsing here would be one more thing to get subtly wrong.
 *
 * It does NOT overwrite variables already present in process.env, so CI's
 * job-level `env:` block and any explicit shell override still win. That
 * ordering matters: it is what keeps CI's placeholder keys authoritative.
 */
loadEnvConfig(process.cwd());

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
