/**
 * Does the e2e suite actually run, and does the documentation say so honestly?
 *
 * This runs in the BLOCKING unit-tests job, not the advisory e2e one — on
 * purpose. The thing it guards is precisely that the advisory job can be green
 * while executing nothing.
 *
 * Background (audit finding H-8). Three sources disagreed about the same fact:
 *
 *   - CLAUDE.md said "This check now passes, and a failure is a real signal
 *     about your change. Treat it as one."
 *   - ci.yml's own comment said "All 20 specs fail... needs credentials that
 *     resolve to a real Clerk instance."
 *   - The actual behaviour was neither: every spec is SKIPPED, because CI's
 *     publishable key decodes to "ci-placeholder.clerk.accounts.dev$" and the
 *     spec files call `test.skip(clerkKeyIsPlaceholder, ...)` at module scope.
 *
 * Skipping is the right call — a permanently-red check trains everyone to
 * ignore it, which is worse than no check. The defect was the claim, not the
 * skip. This repo has already had one production incident from a green check
 * that deployed nothing, so a green check that *tests* nothing must at least
 * be documented as such.
 *
 * These tests fail if the documentation and the pipeline drift apart again, in
 * either direction:
 *   - CI gets real Clerk keys but the docs still say the suite is inert
 *   - the docs claim the suite runs while CI still uses a placeholder
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/** The Clerk publishable key the e2e job actually runs with. */
function ciClerkPublishableKey(): string | null {
  const yml = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
  const e2e = yml.slice(yml.indexOf("e2e-tests:"));
  const match = e2e.match(/NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:\s*(\S+)/);
  return match ? match[1] : null;
}

/**
 * Mirrors clerkKeyIsPlaceholder() from ./clerk-env, but reads the key from the
 * workflow file rather than the environment — this test process is not the CI
 * job, so process.env carries the developer's own values, not the job's.
 */
function keyIsPlaceholder(key: string): boolean {
  const decoded = (() => {
    try {
      return Buffer.from(key.replace(/^pk_(test|live)_/, ""), "base64").toString("utf8");
    } catch {
      return "";
    }
  })().toLowerCase();
  const haystack = `${key} ${decoded}`.toLowerCase();
  return ["placeholder", "ci-placeholder", "test-key"].some((m) => haystack.includes(m));
}

/** Sentences that would only be true if the suite genuinely executed. */
const CLAIMS_IT_RUNS = [
  /this check now passes, and a failure is a real signal/i,
  /the e2e (suite|tests?) (now )?(actually )?runs?/i,
];

describe("e2e execution honesty", () => {
  const key = ciClerkPublishableKey();

  it("can find the key the e2e job runs with", () => {
    expect(key).not.toBeNull();
  });

  it("CLAUDE.md does not claim the suite runs while CI uses a placeholder key", () => {
    const isPlaceholder = keyIsPlaceholder(key!);
    const claude = readFileSync(join(ROOT, "CLAUDE.md"), "utf8");
    const claimsItRuns = CLAIMS_IT_RUNS.filter((re) => re.test(claude));

    if (isPlaceholder && claimsItRuns.length > 0) {
      throw new Error(
        "CLAUDE.md claims the e2e check is a real signal, but the CI job still " +
          `runs with a placeholder Clerk key (${key}), so every spec is skipped. ` +
          "Either add real Clerk TEST-instance keys to GitHub Actions secrets, " +
          "or correct the claim. A documented guarantee that nothing enforces " +
          "is how a green check came to mean 'nothing ran'.",
      );
    }
    expect(claimsItRuns).toEqual([]);
  });

  it("records the current state so a change to it is a visible diff", () => {
    // Not an assertion about which state is correct — just that whichever it
    // is, it is written down where the next session will read it.
    const isPlaceholder = keyIsPlaceholder(key!);
    const claude = readFileSync(join(ROOT, "CLAUDE.md"), "utf8");

    if (isPlaceholder) {
      // The docs must say, somewhere, that the suite does not currently run.
      expect(claude).toMatch(/skip|does not (currently )?(run|execute)|inert/i);
    }
  });

  it("both spec files still guard on the same helper", () => {
    // If one spec stopped skipping, it would fail on every run for a reason
    // unrelated to the change under test — the original problem.
    for (const spec of ["tests/e2e/smoke.spec.ts", "tests/e2e/auth-flow.spec.ts"]) {
      const src = readFileSync(join(ROOT, spec), "utf8");
      expect(src).toMatch(/clerkKeyIsPlaceholder/);
    }
  });
});
