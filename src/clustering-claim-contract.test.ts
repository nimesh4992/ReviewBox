import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The product may not tell a customer it clusters, until it clusters.
 *
 * On 2026-08-22 the Sentiment screen said **"Topics · auto-clustered"** over a
 * table of counts of eight hardcoded English regexes, offered a button labelled
 * **"Re-cluster with AI"**, and headed its results **"AI Re-cluster results"** —
 * while that button's own subtitle correctly read *"N reviews re-classified ·
 * rules engine + Gemini"*. It re-runs sentiment classification. It clusters
 * nothing, and it does not change the table above it.
 *
 * Four places claimed the same thing that does not exist (the fourth being the
 * pricing matrix, guarded separately in `pricing-contract.test.ts`). None of
 * them was a lie anyone told on purpose — "cluster" is simply the word you reach
 * for when describing a topic table, and nothing pushed back.
 *
 * **This file is temporary by design.** When II1 ships and clustering is real,
 * delete it — and the word becomes accurate everywhere at once. Until then, a
 * failure here means the product has started describing a feature it does not
 * have.
 *
 * The guard is deliberately blunt (any occurrence of "cluster", comments
 * included) because a rule with exceptions is a rule someone will file a new
 * exception under.
 */

const GUARDED_FILES = [
  "src/features/sentiment/components/sentiment-screen.tsx",
  "src/app/api/sentiment/analyze/route.ts",
  "src/hooks/use-sentiment-analysis.ts",
  // Added 2026-08-22. Not a mock in practice: `alert-preferences.tsx` seeds its
  // useState with this array, so its copy is what Settings → Alerts renders on
  // first paint, and what it keeps if the API returns nothing. The weekly-digest
  // row promised "top clusters"; the digest reports counts per issue tag.
  "src/features/settings/data/mock-alerts.ts",
] as const;

describe("no shipped surface claims clustering while there is none", () => {
  it("guards files that actually exist", () => {
    // Without this a rename would silently empty the whole suite — the vacuous
    // pass that let ci-contract.test.ts stop guarding anything for months.
    for (const file of GUARDED_FILES) {
      expect(existsSync(join(process.cwd(), file)), `${file} is missing — update GUARDED_FILES`).toBe(true);
    }
  });

  it("finds the word nowhere in the sentiment surface", () => {
    const offenders: string[] = [];

    for (const file of GUARDED_FILES) {
      const lines = readFileSync(join(process.cwd(), file), "utf-8").split("\n");
      lines.forEach((line, i) => {
        if (/cluster/i.test(line)) offenders.push(`${file}:${i + 1}  ${line.trim()}`);
      });
    }

    expect(
      offenders,
      "These say the product clusters reviews. It does not — there is no `issues` " +
        "table and no engine (docs/ISSUE_INTELLIGENCE.md §2). What this surface does " +
        "is re-run SENTIMENT classification, which is what it should say.\n\n" +
        offenders.join("\n") +
        "\n\nIf II1 has shipped and clustering is now real, delete this whole file.",
    ).toEqual([]);
  });
});

describe("the topics table still says what it is", () => {
  it("labels topics by issue tag, not as clusters", () => {
    const screen = readFileSync(
      join(process.cwd(), "src/features/sentiment/components/sentiment-screen.tsx"),
      "utf-8",
    );
    // Guards the replacement itself: deleting the honest label to dodge the
    // check above would otherwise pass silently.
    expect(screen).toContain("Topics · by issue tag");
  });
});
