import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { newIncident, ratingSpike, urgentReview } from "@/lib/slack";

/**
 * Nothing that identifies or quotes a reviewer may leave for Slack.
 *
 * **Why this file exists.** A Slack Incoming Webhook posts into a channel owned
 * by a company that is not on `/sub-processors`. Until 2026-08-22 the
 * urgent-review alert sent the reviewer's display name and the first 120
 * characters of their review body — and `/dpa` §3 classifies review content and
 * author handles as personal data. Ten processors were disclosed; the eleventh
 * was receiving the most sensitive payload of any of them.
 *
 * The remediation was to make the alert **metadata only**: rating, our own issue
 * tags, app version, the day it was posted, and a link. That is enough to decide
 * whether to open ReviewBox and not enough to read the review in Slack.
 *
 * A comment saying so would not survive the next refactor. These three guards
 * do:
 *
 *   1. **Behavioural** — build every payload with sentinel values and prove the
 *      sentinels do not appear in the JSON that would be POSTed.
 *   2. **Signature** — `urgentReview()` must not accept `author` or `text`, so
 *      the compiler rejects a caller that tries.
 *   3. **Inventory** — every file that sends to Slack is listed below with what
 *      it sends. A new sender fails this test until someone writes that line,
 *      which is the moment to ask whether it carries personal data.
 */

// ── 1 · Behavioural ──────────────────────────────────────────────────────────

/**
 * Strings that must never reach Slack. Distinctive enough that a substring
 * match cannot collide with markup, emoji or a field label.
 */
const REVIEWER_NAME = "Priya-Sentinel-Author";
const REVIEW_BODY   = "paise-cut-jaate-sentinel-body-text";
const REVIEWER_MAIL = "reviewer-sentinel@example.com";

describe("no payload builder leaks reviewer identity or review text", () => {
  it("urgentReview sends metadata only", () => {
    const payload = urgentReview({
      rating:     1,
      appName:    "Acme",
      issueTags:  ["billing", "crash"],
      appVersion: "1.5",
      createdAt:  "2026-08-22T10:31:00.000Z",
      reviewUrl:  "https://app.tryreviewbox.com/reviews",
    });

    const wire = JSON.stringify(payload);
    expect(wire).not.toContain(REVIEWER_NAME);
    expect(wire).not.toContain(REVIEW_BODY);
    expect(wire).not.toContain(REVIEWER_MAIL);

    // …and the metadata that makes it actionable is still there.
    expect(wire).toContain("Acme");
    expect(wire).toContain("★☆☆☆☆");
    expect(wire).toContain("billing");
    expect(wire).toContain("1.5");
    expect(wire).toContain("2026-08-22");
    expect(wire).toContain("https://app.tryreviewbox.com/reviews");
  });

  it("urgentReview ignores reviewer fields even if a caller forces them past the compiler", () => {
    // A caller could reach for `as never` or spread an AppReview. The builder
    // destructures a fixed set of keys, so extras are dropped rather than
    // interpolated — this asserts that, rather than assuming it.
    const forced = {
      rating:    1,
      appName:   "Acme",
      reviewUrl: "https://app.tryreviewbox.com/reviews",
      author:    REVIEWER_NAME,
      text:      REVIEW_BODY,
      email:     REVIEWER_MAIL,
    } as unknown as Parameters<typeof urgentReview>[0];

    const wire = JSON.stringify(urgentReview(forced));
    expect(wire).not.toContain(REVIEWER_NAME);
    expect(wire).not.toContain(REVIEW_BODY);
    expect(wire).not.toContain(REVIEWER_MAIL);
  });

  it("ratingSpike sends aggregate counts only", () => {
    const wire = JSON.stringify(
      ratingSpike({ appName: "Acme", avgRating: 1.5, reviewCount: 12, appVersion: "5.42" }),
    );
    expect(wire).not.toContain(REVIEWER_NAME);
    expect(wire).not.toContain(REVIEW_BODY);
    expect(wire).toContain("12");
  });

  it("newIncident carries the operator's own title, not review text", () => {
    // Incidents are created only by an authenticated user typing a title
    // (`POST /api/incidents`); nothing auto-generates one from review bodies.
    const wire = JSON.stringify(
      newIncident({
        title:    "Checkout failing on 1.5",
        severity: "critical",
        appName:  "Acme",
        appUrl:   "https://app.tryreviewbox.com/incidents/abc",
      }),
    );
    expect(wire).not.toContain(REVIEWER_NAME);
    expect(wire).not.toContain(REVIEW_BODY);
    expect(wire).toContain("Checkout failing on 1.5");
  });
});

// ── 2 · Signature ────────────────────────────────────────────────────────────

const SLACK_LIB = join(process.cwd(), "src", "lib", "slack.ts");

/**
 * Blank out comments while keeping line breaks, so the scanner reads code and
 * not the prose above it. `supabase-count-contract.test.ts` learned this the
 * hard way: its first version reported its own explanatory header.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (c) => c.replace(/[^\n]/g, " "));
}

describe("urgentReview's signature forbids reviewer fields", () => {
  it("declares neither author nor a free-text body parameter", () => {
    const code = stripComments(readFileSync(SLACK_LIB, "utf-8"));
    const start = code.indexOf("export function urgentReview(params: {");
    expect(start, "urgentReview(params: {…}) not found — was it renamed?").toBeGreaterThan(-1);

    const signature = code.slice(start, code.indexOf("}", start));
    expect(signature).not.toMatch(/\bauthor\b/);
    expect(signature).not.toMatch(/\breviewText\b|\bsnippet\b|\bbody\b/);
    // `text:` would be the review body — the payload's own fallback string is
    // built inside the function, never accepted from the caller.
    expect(signature).not.toMatch(/^\s*text\s*[?]?:/m);
  });
});

// ── 3 · Inventory ────────────────────────────────────────────────────────────

const SRC = join(process.cwd(), "src");

/** Every `.ts`/`.tsx` under `src/`, excluding tests. `readdirSync`, not
 *  `fs.globSync`: CI pins Node 20, where globSync does not exist. */
function sourceFiles(dir: string = SRC): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { found.push(...sourceFiles(full)); continue; }
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    found.push(full);
  }
  return found;
}

const SEND_CALL = /\b(?:sendSlackNotification|notifySlack|dedupAndNotifySlack|notifyUrgentReview|notifyRatingSpike)\s*\(/;

/**
 * Known senders, and what each one puts on the wire. Reviewed 2026-08-22 by
 * reading each call site.
 *
 * **Adding a file here is a decision, not paperwork.** Write what the payload
 * contains, and if it contains anything a reviewer wrote or anything that
 * identifies them, that belongs in ReviewBox behind the link — not in a Slack
 * channel we do not control the retention of.
 */
const KNOWN_SLACK_SENDERS: Record<string, string> = {
  "src/lib/slack.ts":
    "The library itself — notifySlack/dedupAndNotifySlack call the sender.",
  "src/services/review-sync.ts":
    "Urgent-review alert (rating, our issue tags, app version, posting day, link) " +
    "and rating-spike alert (app name, version, count). No author, no review text.",
  "src/app/api/incidents/route.ts":
    "New-incident alert: the title an authenticated user typed, severity, app name, link.",
  "src/app/api/incidents/[id]/route.ts":
    "Incident status change: stored incident title, severity, new status, link.",
  "src/app/api/reports/weekly-digest/route.ts":
    "Weekly digest: app name, review count, average rating, unreplied/urgent counts, " +
    "top issue tag. Aggregates only.",
  "src/app/api/reports/unreplied-alert/route.ts":
    "48h-unreplied nudge: app names and counts. Aggregates only.",
  "src/app/api/settings/slack/test/route.ts":
    "Static 'ReviewBox connected' confirmation. No customer data at all.",
};

describe("every Slack sender is inventoried", () => {
  it("has no un-triaged call site", () => {
    const senders = sourceFiles()
      .filter((f) => SEND_CALL.test(stripComments(readFileSync(f, "utf-8"))))
      .map((f) => relative(process.cwd(), f).split("\\").join("/"))
      .sort();

    const unknown = senders.filter((f) => !(f in KNOWN_SLACK_SENDERS));
    expect(
      unknown,
      "New file sends to Slack. Add it to KNOWN_SLACK_SENDERS with what its " +
        "payload contains — and check it carries no reviewer name or review text.",
    ).toEqual([]);
  });

  it("lists no sender that has since stopped sending", () => {
    const senders = new Set(
      sourceFiles()
        .filter((f) => SEND_CALL.test(stripComments(readFileSync(f, "utf-8"))))
        .map((f) => relative(process.cwd(), f).split("\\").join("/")),
    );
    const stale = Object.keys(KNOWN_SLACK_SENDERS).filter((f) => !senders.has(f));
    expect(stale, "Inventory lists files that no longer send to Slack.").toEqual([]);
  });
});
