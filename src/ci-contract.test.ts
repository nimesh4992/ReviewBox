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

import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/**
 * The Clerk publishable key the e2e job actually runs with.
 *
 * Handles both the literal form and the `${{ secrets.X || 'literal' }}` form.
 * That matters more than it looks: the old version captured the first
 * whitespace-delimited token, so once the value became an expression it
 * returned the string "${{" — which contains none of the placeholder markers,
 * so `keyIsPlaceholder()` answered FALSE and every honesty assertion below
 * passed vacuously. The guard against documentation drift had itself drifted,
 * while staying green. Resolve to the fallback literal, which is what CI runs
 * with until the secret is actually configured, and return null rather than a
 * fragment when nothing can be resolved — so the first test fails loudly
 * instead of the rest passing quietly.
 */
function ciClerkPublishableKey(): string | null {
  const yml = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
  const e2e = yml.slice(yml.indexOf("e2e-tests:"));
  const line = e2e.match(/NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:[ 	]*(.+)/);
  if (!line) return null;

  const value = line[1].trim();
  if (!value.startsWith("${{")) return value;

  // `${{ secrets.FOO || 'pk_test_...' }}` → the quoted fallback.
  const fallback = value.match(/\|\|\s*'([^']+)'/) ?? value.match(/\|\|\s*"([^"]+)"/);
  return fallback ? fallback[1] : null;
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

/**
 * The "E2E tests (advisory)" section of CLAUDE.md, and nothing else.
 *
 * Assertions about that section must be scoped TO that section. Searching the
 * whole file lets unrelated prose satisfy the pattern, which is exactly how the
 * anti-drift guard below came to pass while guarding nothing.
 */
function e2eSection(claude: string): string {
  const start = claude.search(/^#+ .*E2E tests \(advisory\)/m);
  if (start === -1) {
    throw new Error(
      'CLAUDE.md has no "E2E tests (advisory)" section. It is the recorded state ' +
        "of the only check that exercises the app as a user — if it was renamed, " +
        "update this helper; if it was deleted, restore it.",
    );
  }
  // Advance past the heading LINE, not one character — otherwise the search
  // below matches this very heading and the slice comes back empty, which would
  // make every assertion against it trivially true. That is the same shape of
  // bug this whole file exists to catch.
  const afterHeading = claude.indexOf("\n", start) + 1;
  const rest = claude.slice(afterHeading);
  const end = rest.search(/^#{1,3} /m);
  return end === -1 ? rest : rest.slice(0, end);
}

/** The `e2e-tests:` job block of ci.yml. */
function e2eJobBlock(): string {
  const yml = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
  const start = yml.indexOf("\n  e2e-tests:");
  expect(start, "ci.yml has no e2e-tests job").toBeGreaterThan(-1);
  // Skip past the `e2e-tests:` line itself, or the next-job search below
  // matches it and returns an empty block.
  const afterHeader = yml.indexOf("\n", start + 1) + 1;
  const rest = yml.slice(afterHeader);
  const end = rest.search(/^ {2}[a-z][a-z0-9-]*:$/m);
  return end === -1 ? rest : rest.slice(0, end);
}

describe("e2e execution honesty", () => {
  const key = ciClerkPublishableKey();

  it("can find the key the e2e job runs with", () => {
    expect(key).not.toBeNull();
  });

  it("keeps CLAUDE.md and the CI key in agreement, in BOTH directions", () => {
    // This used to assert `expect(claimsItRuns).toEqual([])` UNCONDITIONALLY,
    // outside its own isPlaceholder guard. That inverted it: once real Clerk
    // keys were added and the docs were honestly updated to say the suite runs,
    // the test went RED — punishing the correct end state and blocking
    // BUG-037's resolution. Meanwhile the second direction its docblock
    // advertised ("real keys but docs still say inert") was enforced by nothing.
    const isPlaceholder = keyIsPlaceholder(key!);
    const claude = readFileSync(join(ROOT, "CLAUDE.md"), "utf8");

    if (isPlaceholder) {
      const claimsItRuns = CLAIMS_IT_RUNS.filter((re) => re.test(claude));
      expect(
        claimsItRuns,
        "CLAUDE.md claims the e2e check is real signal, but CI still runs with a " +
          `placeholder Clerk key (${key}), so every spec skips. Add real Clerk ` +
          "TEST-instance keys to GitHub Actions secrets, or correct the claim. A " +
          "documented guarantee nothing enforces is how a green check came to mean nothing ran.",
      ).toEqual([]);
    } else {
      // The direction nothing used to check.
      expect(
        e2eSection(claude),
        "CI now has real Clerk keys, so the e2e section must stop describing the " +
          "suite as inert — a stale warning teaches every session to ignore a " +
          "check that is now real signal.",
      ).not.toMatch(/executes? (zero|nothing)|runs NOTHING|proves nothing/i);
    }
  });

  it("records the current state INSIDE the e2e section, not anywhere in the file", () => {
    // Was vacuous. The old assertion searched ALL of CLAUDE.md for
    // /skip|does not (currently )?(run|execute)|inert/i, a pattern satisfied by
    // unrelated prose — "(ICE-ranked, skip HUMAN-REQUIRED)" in the autopilot
    // section, and `already_running` in the sync-lock section. Mutation test:
    // deleting the ENTIRE e2e-honesty section left it green with six surviving
    // matches, so the guarantee it advertised enforced nothing at all.
    if (!keyIsPlaceholder(key!)) return;

    expect(
      e2eSection(readFileSync(join(ROOT, "CLAUDE.md"), "utf8")),
      "the e2e section must say the suite currently runs nothing in CI",
    ).toMatch(
      /skip|does not (currently )?(run|execute)|inert|runs NOTHING|executes? (zero|nothing)/i,
    );
  });

  it("puts no workflow expression in a key that forbids the secrets context", () => {
    // GitHub permits only github/needs/vars/strategy/matrix/inputs in
    // `jobs.<id>.continue-on-error` and `jobs.<id>.if`. A `secrets` reference
    // there is a workflow VALIDATION error, so NO job in the file starts —
    // build, type-check, lint, unit tests and audit all vanish. CI green is this
    // repo's only pre-merge gate, so a PR with zero checks reads as "nothing
    // red": exactly how #95 was merged having received 1 of 6 checks.
    //
    // The predecessor of this test matched only the literal "secrets." and
    // looked at continue-on-error alone, so bracket syntax slipped straight
    // through and the sibling forbidden keys were unchecked (both
    // mutation-verified). This repo needs no expression in any of these keys, so
    // the invariant is the stronger, non-evadable one: none at all.
    const yml = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
    const FORBIDDEN = ["continue-on-error", "if", "runs-on", "strategy", "name"];

    const offenders = yml
      .split("\n")
      .map((line, number) => ({ line, number: number + 1 }))
      // Job-level keys sit at exactly 4-space indent. Step-level keys are
      // deeper and/or introduced by a "- " list marker.
      .filter(({ line }) => FORBIDDEN.some((k) => new RegExp(`^ {4}${k}:`).test(line)))
      .filter(({ line }) => line.includes("${{"));

    expect(
      offenders.map((o) => `line ${o.number}: ${o.line.trim()}`),
      "job-level continue-on-error / if / runs-on / strategy / name must contain no expression",
    ).toEqual([]);
  });

  it("guards EVERY e2e spec file on the same helper, discovered not hardcoded", () => {
    // Hardcoded ["smoke", "auth-flow"], so it never saw spine-flow.spec.ts. A
    // spec that dropped the guard would fail on every run for a reason unrelated
    // to the change under test — the original problem — while this stayed green.
    const dir = join(ROOT, "tests/e2e");
    const specs = readdirSync(dir).filter((f) => f.endsWith(".spec.ts"));

    expect(specs.length, "no e2e spec files found — did testDir move?").toBeGreaterThan(0);
    for (const spec of specs) {
      // Match the CALL, not the identifier. Matching /clerkKeyIsPlaceholder/
      // alone was satisfied by the import statement, so deleting the actual
      // `test.skip(...)` line left this test green — caught by mutation M5.
      expect(
        readFileSync(join(dir, spec), "utf8"),
        `tests/e2e/${spec} must call test.skip(clerkKeyIsPlaceholder, ...) at module scope`,
      ).toMatch(/^test\.skip\(\s*clerkKeyIsPlaceholder\s*,/m);
    }
  });
});

describe("the advisory e2e job cannot fail the workflow on placeholder keys", () => {
  // Nothing covered this, and it broke. Removing the job-level
  // `continue-on-error: true` left the "Report what actually executed" step
  // (`if: always()`, no tolerance) able to red the whole workflow — on a
  // webServer timeout, with placeholder keys, while printing "A real Clerk key
  // appears to be configured". `next dev` timing out at 120s on a loaded runner
  // is the documented historical failure mode for this exact job.

  it("gates advisory-vs-blocking on BOTH Clerk secrets, not just one", () => {
    // Gating on the publishable key alone made the steps blocking while
    // scripts/e2e-execution-report.mjs still classed the run as a declared skip
    // (it treats EITHER key being a placeholder as such). A half-configured repo
    // then produced a green, blocking check that proved nothing.
    const job = e2eJobBlock();
    expect(job).toMatch(/E2E_BLOCKING:/);
    expect(job).toMatch(/secrets\.CLERK_PUBLISHABLE_KEY_TEST/);
    expect(job).toMatch(/secrets\.CLERK_SECRET_KEY_TEST/);
    // Both must appear in the E2E_BLOCKING expression itself, not merely
    // somewhere in the job.
    const blocking = job.match(/E2E_BLOCKING:.*/)?.[0] ?? "";
    expect(blocking).toMatch(/CLERK_PUBLISHABLE_KEY_TEST/);
    expect(blocking).toMatch(/CLERK_SECRET_KEY_TEST/);
  });

  it("makes every command step in the job tolerant unless E2E_BLOCKING is true", () => {
    const steps = e2eJobBlock()
      .split(/\n(?= {6}- )/)
      .filter((s) => /^\s+- /.test(s));
    const commandSteps = steps.filter((s) => /(^|\n)\s+(- )?run:/.test(s));

    expect(commandSteps.length, "no run: steps found in the e2e job").toBeGreaterThan(0);

    const unguarded = commandSteps.filter((s) => {
      if (/continue-on-error:/.test(s)) return false; // explicitly tolerant
      if (/E2E_BLOCKING/.test(s)) return false; // shell-guarded
      if (/e2e-execution-report\.mjs/.test(s)) return false; // self-gating, see finish()
      if (/^\s+- run: npm ci$/m.test(s.split("\n")[0])) return false; // install, not a test
      return true;
    });

    expect(
      unguarded.map((s) => s.trim().split("\n")[0]),
      "each run: step in the advisory e2e job must be tolerant, shell-guarded, or self-gating",
    ).toEqual([]);
  });
});

describe("e2e-execution-report.mjs exit codes (runtime)", () => {
  const SCRIPT = join(ROOT, "scripts/e2e-execution-report.mjs");
  const PLACEHOLDER = {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      "pk_test_Y2ktcGxhY2Vob2xkZXIuY2xlcmsuYWNjb3VudHMuZGV2JA==",
    CLERK_SECRET_KEY: "sk_test_ci-placeholder",
  };
  const REAL = {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from(
      "real.clerk.accounts.dev$",
    ).toString("base64")}`,
    CLERK_SECRET_KEY: "sk_test_a_real_secret",
  };

  /** Run the script in a scratch cwd holding the given Playwright report. */
  function runScript(
    report: unknown | null,
    env: Record<string, string>,
  ): { code: number; out: string } {
    const cwd = mkdtempSync(join(tmpdir(), "e2e-report-"));
    try {
      if (report !== null) {
        mkdirSync(join(cwd, "playwright-report"), { recursive: true });
        writeFileSync(join(cwd, "playwright-report/results.json"), JSON.stringify(report));
      }
      const res = spawnSync(process.execPath, [SCRIPT], {
        cwd,
        encoding: "utf8",
        env: { ...process.env, ...env, GITHUB_STEP_SUMMARY: "" },
      });
      return { code: res.status ?? -1, out: `${res.stdout ?? ""}${res.stderr ?? ""}` };
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }

  const skipped = (n: number) => ({
    suites: [
      { specs: Array.from({ length: n }, () => ({ tests: [{ status: "skipped" }] })) },
    ],
    errors: [],
  });
  const executedRun = (n: number) => ({
    suites: [
      { specs: Array.from({ length: n }, () => ({ tests: [{ status: "expected" }] })) },
    ],
    errors: [],
  });
  const webServerTimeout = {
    suites: [],
    errors: [{ message: "Error: Timed out waiting 120000ms from config.webServer." }],
  };

  it("tolerates a webServer timeout while keys are placeholders", () => {
    // The regression. `total === 0` missed the old tolerance branch
    // (`executed === 0 && total > 0 && placeholder`) and exited 1.
    expect(runScript(webServerTimeout, PLACEHOLDER).code).toBe(0);
  });

  it("names the real cause instead of blaming a Clerk key that is not configured", () => {
    const { out } = runScript(webServerTimeout, PLACEHOLDER);
    expect(out).toMatch(/never started/i);
    expect(out).not.toMatch(/A real Clerk key appears to be configured/);
  });

  it("still fails a webServer timeout once the keys are real", () => {
    expect(runScript(webServerTimeout, REAL).code).toBe(1);
  });

  it("tolerates a missing report on placeholders, and fails on real keys", () => {
    expect(runScript(null, PLACEHOLDER).code).toBe(0);
    expect(runScript(null, REAL).code).toBe(1);
  });

  it("tolerates an all-skipped run on placeholders, and catches it on real keys", () => {
    expect(runScript(skipped(20), PLACEHOLDER).code).toBe(0);
    // The vacuous pass this gate exists for: real keys, nothing executed.
    expect(runScript(skipped(20), REAL).code).toBe(1);
  });

  it("passes a genuinely executed run", () => {
    const { code, out } = runScript(executedRun(20), REAL);
    expect(code).toBe(0);
    expect(out).toMatch(/20 of 20 specs executed/);
  });
});
