#!/usr/bin/env node
/**
 * Report what the e2e suite actually DID, into the GitHub checks UI.
 *
 * A green "E2E tests (advisory)" tick means one of two very different things:
 *
 *   a) the specs ran and passed
 *   b) every spec was skipped, so the job had nothing to fail on
 *
 * For weeks it meant (b) while CLAUDE.md told every session it meant (a).
 * This repo has already had one production incident from a green check that
 * did nothing (a deploy job that skipped on a missing token and reported
 * success), so the fix is the same both times: make the check state its own
 * result in words, where a human will see it.
 *
 * Writes a summary to $GITHUB_STEP_SUMMARY and prints the same to stdout.
 *
 * Exit codes:
 *   0  tests executed (pass or fail — Playwright's own exit code decides that),
 *      or every test was skipped for the KNOWN, declared placeholder reason
 *   1  zero tests executed for an UNKNOWN reason, or the report is unreadable
 *      — i.e. the suite went vacuous in a way nobody declared
 */

import { readFileSync, appendFileSync, existsSync } from "node:fs";

const REPORT = "playwright-report/results.json";

/** Mirrors tests/e2e/clerk-env.ts — is CI pointed at a real Clerk instance? */
function clerkKeyIsPlaceholder() {
  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const secret = process.env.CLERK_SECRET_KEY ?? "";
  if (!publishable || !secret) return true;
  let decoded = "";
  try {
    decoded = Buffer.from(publishable.replace(/^pk_(test|live)_/, ""), "base64").toString("utf8");
  } catch {
    decoded = "";
  }
  const haystack = `${publishable} ${secret} ${decoded}`.toLowerCase();
  return ["placeholder", "ci-placeholder", "test-key"].some((m) => haystack.includes(m));
}

function countOutcomes(node, acc = { expected: 0, skipped: 0, unexpected: 0, flaky: 0 }) {
  if (!node || typeof node !== "object") return acc;
  if (Array.isArray(node.specs)) {
    for (const spec of node.specs) {
      for (const test of spec.tests ?? []) {
        const status = test.status ?? "unknown";
        if (status in acc) acc[status] += 1;
        else acc.unexpected += 1;
      }
    }
  }
  for (const suite of node.suites ?? []) countOutcomes(suite, acc);
  return acc;
}

function emit(lines) {
  const text = lines.join("\n");
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
  }
}

/**
 * Exit, but never fail the build while CI has no real Clerk instance.
 *
 * This step runs with `if: always()`, so its exit code decides the e2e job's
 * fate. That was harmless while the job carried a job-level
 * `continue-on-error: true`; once tolerance moved to the individual steps, an
 * exit 1 here could fail the whole workflow -- on a check the file itself names
 * "advisory", and for reasons that have nothing to do with the change under
 * test. `next dev` timing out at 120s on a loaded runner is the documented
 * historical failure mode for this exact job.
 *
 * So: with placeholder keys this step may only ever INFORM. Nothing it can
 * observe is evidence about the code, in either direction, so nothing it
 * observes should gate a merge. With real keys the check is meaningful and a
 * failure is real signal.
 */
function finish(code, placeholder) {
  if (code !== 0 && placeholder) {
    emit([
      "",
      "_Reported as advisory: CI has no real Clerk instance, so this check " +
        "cannot prove anything either way. It will start blocking once " +
        "CLERK_PUBLISHABLE_KEY_TEST and CLERK_SECRET_KEY_TEST are set._",
    ]);
    process.exit(0);
  }
  process.exit(code);
}

const placeholder = clerkKeyIsPlaceholder();

if (!existsSync(REPORT)) {
  emit([
    "## E2E: ⚠️ no report produced",
    "",
    `Playwright wrote no \`${REPORT}\`, so it is not possible to say whether any`,
    "test ran. Treat this check as having proven nothing.",
  ]);
  finish(1, placeholder);
}

let report;
try {
  report = JSON.parse(readFileSync(REPORT, "utf8"));
} catch (err) {
  emit(["## E2E: ⚠️ unreadable report", "", `\`${REPORT}\` could not be parsed: ${err.message}`]);
  finish(1, placeholder);
}

const acc = { expected: 0, skipped: 0, unexpected: 0, flaky: 0 };
for (const suite of report.suites ?? []) countOutcomes(suite, acc);

const executed = acc.expected + acc.unexpected + acc.flaky;
const total = executed + acc.skipped;

// total === 0 means Playwright never reached a single spec: a webServer that
// never became ready, a browser that would not install, a config error. That is
// an INFRASTRUCTURE failure, categorically different from "specs were collected
// and skipped".
//
// This branch did not exist, so a webServer timeout fell through to the
// vacuous-pass branch below and printed "A real Clerk key appears to be
// configured" -- while CI was running the placeholder pair. Wrong diagnosis and
// wrong exit code, on the one check whose whole job is to describe itself
// accurately.
if (total === 0) {
  const firstErrors = (report.errors ?? [])
    .slice(0, 3)
    .map((e) => "- `" + String(e.message ?? e).split("\n")[0] + "`");
  emit([
    "## E2E: 0 specs collected -- the suite never started",
    "",
    "Playwright produced a report containing no specs at all, so this is not a",
    "skip: nothing was even collected. Usual causes, likeliest first:",
    "",
    "- the dev server did not become ready inside `webServer.timeout`",
    "- `npx playwright install` failed",
    "- a config or import error aborted the run before collection",
    ...(firstErrors.length ? ["", "Playwright reported:", "", ...firstErrors] : []),
    "",
    "Read the HEAD of the test step's log, not the tail -- the actionable line",
    "scrolls off the end.",
  ]);
  finish(1, placeholder);
}

if (executed === 0 && placeholder) {
  // Known, declared, and deliberate — but it must not read as a pass.
  emit([
    "## E2E: ⏭️ 0 of " + total + " specs executed — SUITE DID NOT RUN",
    "",
    "**This check proves nothing about this change.** Every spec was skipped",
    "because CI has no real Clerk instance, so the app renders an error page",
    "for every route and even the public smoke tests cannot pass.",
    "",
    "This is deliberate (a permanently-red check gets ignored), not a fault in",
    "your PR — but do not cite this tick as evidence anything works.",
    "",
    "**To make it real:** add Clerk *development*-instance keys to GitHub →",
    "Settings → Secrets and variables → Actions, and reference them in the",
    "`e2e-tests` job. See BUG-037.",
  ]);
  process.exit(0);
}

if (executed === 0) {
  emit([
    "## E2E: ❌ 0 of " + total + " specs executed, and no declared reason",
    "",
    "A real Clerk key appears to be configured, yet nothing ran. That is the",
    "vacuous-pass failure mode this gate exists to catch — the suite is not",
    "testing anything and the job would otherwise be green.",
  ]);
  finish(1, placeholder);
}

emit([
  `## E2E: ${acc.unexpected > 0 ? "❌" : "✅"} ${executed} of ${total} specs executed`,
  "",
  `| passed | failed | flaky | skipped |`,
  `| --- | --- | --- | --- |`,
  `| ${acc.expected} | ${acc.unexpected} | ${acc.flaky} | ${acc.skipped} |`,
  "",
  acc.unexpected > 0
    ? "Failures above are real signal — the suite genuinely ran."
    : "The suite genuinely ran and passed.",
]);
process.exit(0);
