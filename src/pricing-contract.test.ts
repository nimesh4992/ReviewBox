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
 * proof was the row this file had to except when it was written: *"Topic
 * clustering across your reviews — Pro ✅"*, shipped on the live pricing page
 * while there was no clustering anywhere in the codebase (no `issues` table,
 * no engine — see `docs/ISSUE_INTELLIGENCE.md` §2). It was reworded to *"Topic
 * breakdown"* on 2026-08-22 and `KNOWN_UNBACKED` is now empty — which is the
 * state this file exists to keep.
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
  // Reworded from "Topic clustering across your reviews" on 2026-08-22. The
  // route groups every review by issue tag and reports each one's count, share,
  // 7-day trend and top reviews — a breakdown, which ships. Clustering means
  // discovering the groups from the text, which needs the `issues` table and an
  // engine that does not exist (docs/ISSUE_INTELLIGENCE.md §2). If II1 ships,
  // the row may go back to "clustering" and this comment can go.
  "Topic breakdown across your reviews": ["src/app/api/sentiment/overview/route.ts"],

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
 * Empty, and that is the point.
 *
 * It held exactly one entry until 2026-08-22: *"Topic clustering across your
 * reviews — Pro ✅"*, live on the pricing page while no clustering existed
 * anywhere in the codebase. The founder reworded it to **"Topic breakdown
 * across your reviews"**, which `/api/sentiment/overview` delivers today, and
 * the entry was deleted rather than left as a comment — the test below fails
 * if a fixed row lingers here.
 *
 * Adding an entry is a deliberate act. Each one is a promise a customer can pay
 * for and not receive, so write why it is here and what closes it.
 */
const KNOWN_UNBACKED: Record<string, string> = {};

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

describe("the page's prose makes the same promise as its matrix", () => {
  it("claims topic clustering nowhere, matrix row or body copy", () => {
    // The matrix parser only sees `label:` strings. The paragraph above the
    // table made the identical claim in lowercase prose and would have survived
    // the row being fixed — so this reads the whole file.
    //
    // Deliberately narrow: `cluster` on its own still appears in the comment
    // listing rows deleted for overclaiming ("Crash cluster detection"), and
    // that history is worth keeping.
    const offenders = source
      .split("\n")
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => /topic[\s-]*cluster/i.test(line))
      .map(([n, line]) => `src/app/pricing/page.tsx:${n}  ${line.trim()}`);

    expect(
      offenders,
      "The pricing page says the product clusters topics. It groups reviews by " +
        "a fixed issue-tag vocabulary — a breakdown, not clustering. Reword, or " +
        "ship II1 first (docs/ISSUE_INTELLIGENCE.md §2).\n\n" + offenders.join("\n"),
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

  it("holds no known-unbacked row at all", () => {
    // Every entry must be a deliberate edit to this line, not a quiet append.
    // The moment this list is non-empty, the pricing page is promising
    // something the product cannot do, and someone chose to ship it that way.
    expect(Object.keys(KNOWN_UNBACKED)).toEqual([]);
  });
});
