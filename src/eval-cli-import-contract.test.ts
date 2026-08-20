import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The eval CLIs (`npm run eval:export`, `npm run eval:score`) load TypeScript
 * directly through Node's `--experimental-strip-types`. Node resolves neither
 * the `@/` alias nor an extensionless relative import of a `.ts` file.
 *
 * Type-only imports are erased before Node sees them, so they are safe. A
 * **value** import is not — and this is the dangerous part: `tsc` and vitest
 * both resolve `@/`, so a broken CLI stays green in CI and only fails at the
 * founder's terminal. That happened once already, on the CM1 language rework.
 *
 * These tests fail loudly instead.
 */

const CLI_DIR = "scripts/eval";

/** Files the CLIs import directly. Their imports must be Node-resolvable. */
function cliImportedSources(): string[] {
  const files = readdirSync(CLI_DIR).filter((f) => f.endsWith(".mjs"));
  const sources = new Set<string>();
  for (const file of files) {
    const text = readFileSync(join(CLI_DIR, file), "utf8");
    for (const match of text.matchAll(/from\s+"([^"]+\.ts)"/g)) {
      sources.add(match[1].replace(/^\.\.\/\.\.\//, ""));
    }
  }
  return [...sources];
}

describe("eval CLI imports", () => {
  it("finds the TypeScript modules the CLIs load", () => {
    const sources = cliImportedSources();
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) expect(source.startsWith("src/")).toBe(true);
  });

  it("imports every CLI module with an explicit .ts extension", () => {
    // Without it Node throws ERR_MODULE_NOT_FOUND at runtime.
    for (const file of readdirSync(CLI_DIR).filter((f) => f.endsWith(".mjs"))) {
      const text = readFileSync(join(CLI_DIR, file), "utf8");
      for (const match of text.matchAll(/from\s+"(\.\.[^"]+)"/g)) {
        expect(match[1]).toMatch(/\.ts$/);
      }
    }
  });

  it("uses no @/ alias in any module the CLIs load", () => {
    for (const source of cliImportedSources()) {
      const text = readFileSync(source, "utf8");
      const aliasImports = [...text.matchAll(/^import\s+(?!type\b)[^;]*?from\s+"(@\/[^"]+)"/gm)];
      expect(aliasImports.map((m) => `${source} → ${m[1]}`)).toEqual([]);
    }
  });

  it("uses no extensionless relative VALUE import in any module the CLIs load", () => {
    for (const source of cliImportedSources()) {
      const text = readFileSync(source, "utf8");
      const bad = [...text.matchAll(/^import\s+(?!type\b)[^;]*?from\s+"(\.[^"]*?)"/gm)]
        .filter((m) => !m[1].endsWith(".ts"))
        // `import { type X }` is erased too, but keep this simple and strict:
        // a relative value import must carry the extension.
        .map((m) => `${source} → ${m[1]}`);
      expect(bad).toEqual([]);
    }
  });
});
