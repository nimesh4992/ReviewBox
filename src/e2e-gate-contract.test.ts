/**
 * The e2e skip gate, pinned.
 *
 * Background. "The Playwright suite executes zero specs" was read for weeks as
 * a missing-credentials problem. It was not. Discovery always worked — 24 tests
 * in 3 files — and the app works fine with NO Clerk keys, because Clerk's dev
 * SDK falls back to keyless mode and provisions a real ephemeral development
 * instance. The gate simply answered "placeholder" whenever the keys were
 * absent, so 20 genuinely-passing specs were suppressed on every developer
 * machine, and the two real bugs behind it went unexamined:
 *
 *   1. playwright.config.ts never loaded .env.local, so the gate could not see
 *      real keys even when they existed.
 *   2. clerkKeyIsPlaceholder() conflated "no keys" (keyless: app WORKS) with
 *      "placeholder keys" (invalid instance: app is broken).
 *
 * This file exists because the gate is now load-bearing in both directions. If
 * it becomes too permissive, CI goes red on every commit — including
 * documentation-only ones — which is the permanently-red check the gate was
 * written to prevent. If it becomes too strict, the suite silently reverts to
 * testing nothing while reporting a green tick.
 *
 * It also guards a closed security hole. See the app-side bypass test below.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AUTHENTICATED_E2E_AVAILABLE,
  clerkKeyIsPlaceholder,
} from "../tests/e2e/clerk-env";

const ROOT = process.cwd();

/** A publishable key that decodes to a plausible instance host. */
function realLookingKey(host = "reviewbox-ci.clerk.accounts.dev$"): string {
  return `pk_test_${Buffer.from(host, "utf8").toString("base64")}`;
}

/** The exact placeholder pair the CI workflow uses. */
function ciPlaceholderPair(): { publishable: string; secret: string } {
  const yml = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
  const e2e = yml.slice(yml.indexOf("e2e-tests:"));

  const read = (name: string): string => {
    const line = e2e.match(new RegExp(`${name}:[ \\t]*(.+)`));
    if (!line) throw new Error(`${name} not found in the e2e job`);
    const value = line[1].trim();
    if (!value.startsWith("${{")) return value;
    const fallback =
      value.match(/\|\|\s*'([^']+)'/) ?? value.match(/\|\|\s*"([^"]+)"/);
    if (!fallback) throw new Error(`${name} has no resolvable fallback literal`);
    return fallback[1];
  };

  return {
    publishable: read("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    secret: read("CLERK_SECRET_KEY"),
  };
}

describe("e2e skip gate — three states, not two", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("treats NO keys as runnable, because Clerk keyless mode gives a working app", () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    // Measured: 20 of 24 specs pass in this state. Skipping here is what made
    // the suite inert locally.
    expect(clerkKeyIsPlaceholder()).toBe(false);
  });

  it("treats the CI placeholder pair as NOT runnable", () => {
    // This is the assertion that keeps master green. CI's key decodes to
    // "ci-placeholder.clerk.accounts.dev$" — an instance that does not exist,
    // so Clerk answers "Invalid host" on every route and all 24 specs would
    // fail for a reason unrelated to any change under test.
    const { publishable, secret } = ciPlaceholderPair();
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", publishable);
    vi.stubEnv("CLERK_SECRET_KEY", secret);
    expect(clerkKeyIsPlaceholder()).toBe(true);
  });

  it("treats a HALF-configured pair as NOT runnable", () => {
    // Clerk does not fall back to keyless once either value is present, so a
    // half-configured pair is genuinely broken rather than keyless.
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", realLookingKey());
    vi.stubEnv("CLERK_SECRET_KEY", "");
    expect(clerkKeyIsPlaceholder()).toBe(true);

    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_something_real");
    expect(clerkKeyIsPlaceholder()).toBe(true);
  });

  it("treats a real-looking pair as runnable", () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", realLookingKey());
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_a_real_looking_secret");
    expect(clerkKeyIsPlaceholder()).toBe(false);
  });

  it("still catches a placeholder marker hidden in the decoded host", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      realLookingKey("ci-placeholder.clerk.accounts.dev$"),
    );
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_looks_fine");
    expect(clerkKeyIsPlaceholder()).toBe(true);
  });

  it("is not influenced by NEXT_PUBLIC_BYPASS_E2E", () => {
    // The gate answers exactly one question — are these keys real? An
    // unrelated flag must not be able to assert "yes". It used to: a
    // short-circuit returned false whenever NEXT_PUBLIC_BYPASS_E2E === "1",
    // which in CI would have un-skipped all 24 specs against a broken app.
    const { publishable, secret } = ciPlaceholderPair();
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", publishable);
    vi.stubEnv("CLERK_SECRET_KEY", secret);
    vi.stubEnv("NEXT_PUBLIC_BYPASS_E2E", "1");
    expect(clerkKeyIsPlaceholder()).toBe(true);
  });
});

describe("no app-side auth bypass may exist (SEC-005 stays closed)", () => {
  const APP_SIDE_BYPASS = /BYPASS_E2E|BYPASS_AUTH/;

  it("has no auth-bypass env var anywhere in src/", () => {
    // BYPASS_AUTH was removed as a red-severity security defect (BUGS.md
    // SEC-005 / AUD-005: "allowed auth bypass"). Three auth-flow specs and the
    // spine spec were written against a replacement — "NEXT_PUBLIC_BYPASS_E2E
    // ... makes auth.protect() return a mock userId for e2e only" — that was
    // never built. Making those specs pass by building it would reopen the
    // hole, so this test forbids it. The supported route is @clerk/testing.
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
          if (APP_SIDE_BYPASS.test(readFileSync(full, "utf8"))) {
            offenders.push(full.slice(ROOT.length + 1).replace(/\\/g, "/"));
          }
        }
      }
    };
    walk(join(ROOT, "src"));

    expect(offenders, "an app-side auth bypass reappeared in src/").toEqual([]);
  });

  it("keeps the authenticated-session specs honestly gated", () => {
    // Not "set a flag to enable" — there is nothing to enable. Anyone who
    // flips this to true must have wired a real mechanism first.
    expect(AUTHENTICATED_E2E_AVAILABLE).toBe(false);

    for (const spec of ["tests/e2e/auth-flow.spec.ts", "tests/e2e/spine-flow.spec.ts"]) {
      const src = readFileSync(join(ROOT, spec), "utf8");
      // The old skip predicate read the flag directly and told the reader that
      // setting it would enable the tests. It would not.
      expect(
        src.includes("!!process.env.NEXT_PUBLIC_BYPASS_E2E"),
        `${spec} must not gate on a flag the app never reads`,
      ).toBe(false);
      expect(src).toMatch(/AUTHENTICATED_E2E_AVAILABLE/);
    }
  });
});

describe("playwright config resolves env the same way the app does", () => {
  it("loads .env* into the test process", () => {
    // Without this the gate reads an empty process.env and can never see real
    // keys, so the suite skips on every developer machine no matter what is
    // configured. Playwright's process is not the Next dev server.
    const config = readFileSync(join(ROOT, "playwright.config.ts"), "utf8");
    expect(config).toMatch(/loadEnvConfig\(/);
    expect(config).toMatch(/@next\/env/);
  });

  it("keeps discovery pointed at the e2e directory", () => {
    const config = readFileSync(join(ROOT, "playwright.config.ts"), "utf8");
    expect(config).toMatch(/testDir:\s*["']\.\/tests\/e2e["']/);
    // A stray testMatch/grep would silently shrink the suite; discovery was
    // never the problem here and must not become one.
    expect(config).not.toMatch(/^\s*(testMatch|grep|grepInvert):/m);
  });
});
