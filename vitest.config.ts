import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // Vitest defaults to 5s. Several route tests do `await import("./route")`
    // INSIDE the test body, and this suite now transforms 80 files in
    // parallel — cumulative import time runs to ~160s on a loaded machine, so
    // a first dynamic import can alone exceed 5s. That produced failures that
    // moved run to run (3 red, then 0 red, same commit, no code change).
    //
    // A flaky red is worse than no check: CI green is this repo's only
    // pre-merge gate, and a check that cries wolf trains everyone to merge
    // past it. 20s is still far below any genuine hang.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "tests/e2e/**", "src/**/*.e2e.*"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "node_modules/",
        ".next/",
        "tests/e2e/",
        "**/*.config.*",
        "**/*.d.ts",
      ],
    },
  },
});
