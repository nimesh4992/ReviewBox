import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The pricing contract: every row of the feature matrix must be something a
 * customer can do today.
 *
 * That sentence is already written above `FEATURE_MATRIX` in
 * `src/app/pricing/page.tsx`, along with a list of seven rows deleted for
 * promising things the product could not keep. **Nothing enforced it.** The
 * proof is the row this file currently has to except: *"Topic clustering
 * across your reviews — Pro ✅"*, shipped on the live pricing page while there
 * is no clustering anywhere in the codebase (no `issues` table, no engine —
 * see `docs/ISSUE_INTELLIGENCE.md` §2).
 *
 * A pricing page is a contract. A rule that only exists in a comment is a
 * rule that will be broken by the next person who adds a row in a hurry.
 *
 * ── Why this reads the SOURCE rather than importing it ──────────────────────
 *
 * `FEATURE_MATRIX` is a local const inside a React Server Component. Importing
 * that file into a node-env test boots the whole Next/React surface, and
 * exporting the const purely for a test would be a change to the pricing page
 * itself — which D009 §9 reserves to the founder. Parsing the source is the
 * same technique, for the same reason, as `seo-indexing-contract.test.ts`
 * reading `middleware.ts`.
 *
 * ── The vacuous-pass guard ──────────────────────────────────────────────────
 *
 * `ci-contract.test.ts` once stopped guarding anything because its parser
 * silently matched the wrong token and every assertion passed over an empty
 * set. So the first test here asserts the parser actually found the matrix,
 * with a floor on the row count. If someone empties the matrix, renames it, or
 * reformats it beyond this parser, this file goes red rather than quiet.
 */

const PRICING_PAGE = join(process.cwd(), "src", "app", "pricing", "page.tsx");
const source = readFileSync(PRICING_PAGE, "utf-8");

/** Every `label:` inside the FEATURE_MATRIX literal, in page order. */
function parseMatrixLabels(text: string): string[] {
  const start = text.indexOf("const FEATURE_MATRIX");
  if (start === -1) return [];
  // The matrix ends at the first line that closes it at column 0.
  const end = text.indexOf("\n];", start);
  const block = end === -1 ? text.slice(start) : text.slice(start, end);
  return [...block.matchAll(/\blabel:\s*"([^"]+)"/g)].map((m) => m[1]);
}

const labels = parseMatrixLabels(source);

/**
 * label → the files that make the row true. A path here is a claim that this
 * is where a reviewer should look to check the promise, so keep it to the
 * thing that actually delivers the behaviour, not everything that touches it.
 */
const EVIDENCE: Record<string, readonly string[]> = {
  // Reviews
  "Google Play sync": ["src/services/google-play/publisher-api.ts", "src/services/review-sync.ts"],
  "App Store sync": ["src/services/app-store/connect-api.ts"],
  "Daily automatic sync": ["vercel.json", "src/app/api/sync/reviews/route.ts"],
  "Sync on demand": ["src/app/api/sync/reviews/route.ts"],

  // Replies
  "Publish replies to the store in one click": ["src/app/api/reviews/[id]/reply/route.ts"],
  "Starter reply templates": ["src/lib/templates.ts"],
  "Your own reply templates": ["src/app/api/reply-kit/templates/route.ts"],
  "AI drafts in your brand voice": ["src/app/api/reply/draft/route.ts", "src/lib/reply-composer.ts"],
  "Knowledge base context": ["src/app/api/reply-kit/knowledge-base/route.ts"],
  "Bulk reply to many reviews at once": ["src/app/api/reviews/bulk-action/route.ts"],
  "Translate reviews written in any language": ["src/app/api/reviews/[id]/translate/route.ts"],

  // Intelligence
  "Automatic sentiment tagging": ["src/lib/rules-engine.ts"],
  "Issue tags: crashes, billing, login, performance": ["src/lib/rules-engine.ts", "src/lib/tag-labels.ts"],
  "Rating spike alerts": ["src/lib/email/send-rating-spike-alert.ts"],
  "Release health tracking": ["src/lib/release-versions.ts"],
  "ASO keyword ideas mined from your reviews": ["src/app/api/aso/suggest/route.ts"],

  // Working together
  "Automation rules": ["src/app/api/automations/rules/route.ts"],
  "Slack alerts": ["src/lib/slack.ts"],
  "Multiple teammates": ["src/app/api/team/invites/route.ts"],
  "CSV export": ["src/app/api/reports/export/route.ts"],
};

/**
 * Rows that are on the live pricing page with nothing behind them.
 *
 * This is not a place to park work. Each entry is a promise a customer can pay
 * for and not receive, and the tests below make sure it cannot grow quietly and
 * cannot outlive its fix.
 */
/*
 * READY-TO-APPLY FOLLOW-UP — do not apply until the pricing page is reworded.
 *
 * The moment "Topic clustering across your reviews" becomes "Topic breakdown
 * across your reviews" on the pricing page, two tests here go red on purpose.
 * The whole fix is:
 *
 *   1. add to EVIDENCE above:
 *        "Topic breakdown across your reviews": ["src/app/api/sentiment/overview/route.ts"],
 *   2. empty KNOWN_UNBACKED below to `{}`
 *   3. change the last assertion in this file to `.toEqual([])`
 *
 * Written out here so that applying a one-word pricing fix cannot leave anyone
 * stuck on a red pipeline they did not expect and cannot read.
 */
const KNOWN_UNBACKED: Record<string, string> = {
  "Topic clustering across your reviews":
    "No clustering exists — no `issues` table, no engine (docs/ISSUE_INTELLIGENCE.md §2). " +
    "Fix is either the one-word rewording to 'Topic breakdown across your reviews' " +
    "(which /api/sentiment/overview does deliver today) or shipping II1. " +
    "D009 §9 reserves pricing-page edits to the founder, so no agent may apply either.",
};

describe("the pricing feature matrix was actually parsed", () => {
  it("finds the matrix and a plausible number of rows", () => {
    // Without this, every assertion below would pass over an empty array — the
    // exact way ci-contract.test.ts stopped guarding anything.
    expect(labels.length).toBeGreaterThanOrEqual(15);
  });

  it("finds rows from every category, so a truncated parse is caught", () => {
    expect(labels).toContain("Google Play sync"); // first category
    expect(labels).toContain("CSV export"); // last category
  });
});

describe("every pricing row is something a customer can do today", () => {
  it("has evidence, or a documented exception, for every row", () => {
    const unaccounted = labels.filter(
      (label) => !(label in EVIDENCE) && !(label in KNOWN_UNBACKED),
    );

    expect(
      unaccounted,
      `Pricing rows with nothing behind them:\n  ${unaccounted.join("\n  ")}\n\n` +
        "A row on this page is a contract. Add the file(s) that make it true to " +
        "EVIDENCE in src/pricing-contract.test.ts, or remove the row.",
    ).toEqual([]);
  });

  it("points at files that still exist", () => {
    const missing: string[] = [];
    for (const [label, paths] of Object.entries(EVIDENCE)) {
      for (const path of paths) {
        if (!existsSync(join(process.cwd(), path))) missing.push(`${label} → ${path}`);
      }
    }

    expect(
      missing,
      `Pricing rows whose implementation has moved or been deleted:\n  ${missing.join("\n  ")}\n\n` +
        "Either the feature is gone (remove the row from the pricing page) or the " +
        "path changed (update EVIDENCE).",
    ).toEqual([]);
  });
});

describe("the bookkeeping cannot rot", () => {
  it("keeps no evidence for rows that are no longer sold", () => {
    const orphaned = Object.keys(EVIDENCE).filter((label) => !labels.includes(label));
    expect(
      orphaned,
      `EVIDENCE names rows that are not on the pricing page any more: ${orphaned.join(", ")}`,
    ).toEqual([]);
  });

  it("expires an exception as soon as its row is fixed", () => {
    // Deliberate friction. When the founder rewords or removes the clustering
    // row, this fails and the fix is to DELETE that entry from KNOWN_UNBACKED —
    // otherwise the list quietly becomes a graveyard nobody reads.
    const stale = Object.keys(KNOWN_UNBACKED).filter((label) => !labels.includes(label));
    expect(
      stale,
      `These rows are fixed. Delete them from KNOWN_UNBACKED in ` +
        `src/pricing-contract.test.ts:\n  ${stale.join("\n  ")}`,
    ).toEqual([]);
  });

  it("holds exactly one known-unbacked row, and it is the clustering one", () => {
    // A second entry must be a deliberate edit to this line, not a quiet append.
    expect(Object.keys(KNOWN_UNBACKED)).toEqual(["Topic clustering across your reviews"]);
  });
});
