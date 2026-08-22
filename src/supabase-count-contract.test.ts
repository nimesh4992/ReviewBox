import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { join } from "node:path";

/**
 * A count query must be built straight off `.from()`.
 *
 * supabase-js has two `select` methods and they are not interchangeable:
 *
 *   PostgrestQueryBuilder.select(columns, { count, head })   ← from .from()
 *   PostgrestTransformBuilder.select(columns?)               ← once a select applied
 *
 * The second takes **columns only**. Pass it `{ count: "exact", head: true }` and
 * the options are silently discarded: no count header, no HEAD request, and
 * `result.count` comes back **null**.
 *
 * On 2026-08-22 that produced a customer-visible lie. `/api/sentiment/overview`
 * built its positive-review count by chaining onto a `base()` helper that had
 * already called `.select("*")`, so the count was null, `count ?? 0` turned the
 * unknown into a zero, and the Sentiment page reported **"Positive share 0%"**
 * directly beside a rating distribution showing **41% five-star**. Measured
 * against the database the same day: 64 reviews in the window, 32 positive.
 * The true figure was **50%**.
 *
 * Nothing caught it. TypeScript could not, because the helper was cast to `any`
 * (deliberately, so `.eq()` stayed available) and an `any` swallows the arity
 * error that would otherwise have been a compile failure on line one.
 *
 * So the guard lives here instead: no `.select(..., { count })` may sit on a
 * chain that already selected.
 */

const API_DIR = join(process.cwd(), "src", "app", "api");

function sourceFiles(): string[] {
  return globSync("**/*.ts", { cwd: API_DIR }).map((f) => join(API_DIR, f));
}

/**
 * Blank out comments, keeping every byte offset and line break in place.
 *
 * Necessary, and found the hard way: this file's own header explains the bug by
 * quoting `.select("id", { count: … })`, and the first version of the scanner
 * duly reported itself. A guard that reads prose as code cries wolf on the
 * document that explains it.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (comment) =>
    comment.replace(/[^\n]/g, " "),
  );
}

/**
 * Is this `.select(…{count…})` the first select of its chain?
 *
 * Looks back at the code preceding the call: if `.from(` appears with no
 * `.select(` between it and here, the chain is still a PostgrestQueryBuilder and
 * the options will be honoured.
 */
function isChainedOntoAnExistingSelect(code: string, matchStart: number): boolean {
  const before = code.slice(Math.max(0, matchStart - 400), matchStart);
  const afterFrom = before.split(".from(");
  if (afterFrom.length < 2) return true; // no .from() nearby — not a direct query build
  return afterFrom[afterFrom.length - 1].includes(".select(");
}

describe("count queries are built where the options are honoured", () => {
  it("scans a non-empty set of API route files", () => {
    // Vacuous-pass guard: a moved directory would otherwise make every
    // assertion below pass over an empty list.
    expect(sourceFiles().length).toBeGreaterThan(30);
  });

  it("never chains { count } onto a builder that already selected", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles()) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const match of code.matchAll(/\.select\([^)]*\{\s*count:/g)) {
        if (isChainedOntoAnExistingSelect(code, match.index ?? 0)) {
          const line = code.slice(0, match.index).split("\n").length;
          offenders.push(`${file.replace(process.cwd() + "/", "")}:${line}`);
        }
      }
    }

    expect(
      offenders,
      "These pass { count } to PostgrestTransformBuilder.select(), which takes " +
        "columns only and drops it — the query returns rows and `count` is null. " +
        "Build the count query straight off `.from()` instead.\n\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});
