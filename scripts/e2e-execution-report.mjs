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

if (!existsSync(REPORT)) {
  emit([
    "## E2E: ⚠️ no report produced",
    "",
    `Playwright wrote no \`${REPORT}\`, so it is not possible to say whether any`,
    "test ran. Treat this check as having proven nothing.",
  ]);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(readFileSync(REPORT, "utf8"));
} catch (err) {
  emit(["## E2E: ⚠️ unreadable report", "", `\`${REPORT}\` could not be parsed: ${err.message}`]);
  process.exit(1);
}

const acc = { expected: 0, skipped: 0, unexpected: 0, flaky: 0 };
for (const suite of report.suites ?? []) countOutcomes(suite, acc);

const executed = acc.expected + acc.unexpected + acc.flaky;
const total = executed + acc.skipped;
const placeholder = clerkKeyIsPlaceholder();

if (executed === 0 && total > 0 && placeholder) {
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
  process.exit(1);
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
