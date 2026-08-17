/**
 * A failure must never be able to render as an empty state.
 *
 * This is the AU4 bug class, and it is worth a contract test rather than a
 * comment because it is invisible in review: the code that produces it looks
 * completely reasonable. `data` is undefined on error, `data?.items ?? []` is
 * a sensible-looking default, and the empty branch below it was written for
 * the genuinely-empty case. Nothing in the diff says "this lies to the
 * customer during an outage".
 *
 * What made it expensive is the copy those screens fell through to. They
 * didn't say "nothing here" — they said:
 *
 *   - "No gaps found — all top phrases are already tracked."   (ASO)
 *   - "No keywords tracked yet. Add your first keyword"        (ASO)
 *   - "Tags appear here once reviews are synced and enriched." (Sentiment)
 *   - "Add competitor · coming soon"                           (Competitors)
 *   - "No templates yet. Create your first one above."         (Reply Kit)
 *   - "No entries yet. Add your first one above."              (Reply Kit)
 *
 * Each is a confident factual claim about the customer's own data, made on a
 * request that never came back. Two of them invite the customer to rebuild a
 * library they still have, and one announces that a shipped feature doesn't
 * exist yet.
 *
 * These are source-reading assertions, which are weaker than rendering the
 * components — but this repo's Vitest runs in a Node environment with no
 * React Testing Library by convention, and a weak guard on the exact shape
 * that regressed beats no guard. The specific thing each assertion defends is
 * named, so a future reader can tell whether a failure is a real regression or
 * just a rename.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), relPath), "utf8");
}

/** Comments stripped: an explanatory comment naming a bug is not the bug. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

/** Screens whose data comes from React Query — the error signal is `isError`. */
const QUERY_SCREENS = [
  {
    file: "src/features/aso/components/aso-screen.tsx",
    label: "ASO",
    // Both panels on this screen had the defect independently.
    errorFlags: ["isError", "kwError"],
  },
  {
    file: "src/features/sentiment/components/sentiment-screen.tsx",
    label: "Sentiment",
    errorFlags: ["isError"],
  },
  {
    file: "src/features/competitors/components/competitors-screen.tsx",
    label: "Competitors",
    errorFlags: ["isError"],
  },
];

/**
 * Screens that fetch by hand. Their root cause was subtler and is asserted
 * separately below — see the `r.ok` test.
 */
const RAW_FETCH_SCREENS = [
  { file: "src/features/reply-kit/components/templates-tab.tsx", label: "Reply Kit templates" },
  { file: "src/features/reply-kit/components/knowledge-base-tab.tsx", label: "Reply Kit knowledge base" },
];

describe("screens distinguish 'failed to load' from 'no data'", () => {
  it.each([...QUERY_SCREENS, ...RAW_FETCH_SCREENS])(
    "$label renders a load-failure state",
    ({ file }) => {
      expect(stripComments(read(file))).toContain("<LoadErrorState");
    },
  );

  it.each(QUERY_SCREENS)("$label reads the query's error flag", ({ file, errorFlags }) => {
    const body = stripComments(read(file));
    for (const flag of errorFlags) {
      // Used, not merely destructured — `const { isError } = useQuery(...)`
      // that nothing reads is exactly the state these screens were in.
      const uses = body.match(new RegExp(`\\b${flag}\\b`, "g")) ?? [];
      expect(uses.length, `${flag} appears ${uses.length}× in ${file}`).toBeGreaterThan(1);
    }
  });
});

describe("hand-rolled fetches check the status before parsing", () => {
  // THE root cause in Reply Kit, and the reason the pre-existing `.catch` was
  // dead code rather than merely incomplete: a 500 from these routes returns a
  // JSON error envelope, so `res.json()` RESOLVES. Without an `r.ok` check the
  // promise never rejects, `.catch` never runs, `data.templates` is undefined,
  // and `?? []` renders the outage as an empty library.
  it.each(RAW_FETCH_SCREENS)("$label rejects a non-ok response", ({ file }) => {
    const body = stripComments(read(file));

    // Scope to the load effect: the mutation handlers already checked res.ok,
    // which is precisely why the load path's omission went unnoticed.
    const start = body.indexOf("useEffect(");
    expect(start, `no useEffect in ${file}`).toBeGreaterThan(-1);
    const effect = body.slice(start, body.indexOf("}, [", start));

    expect(effect).toMatch(/\.ok\b/);
    expect(effect).toMatch(/\bthrow\b/);
  });
});

describe("LoadErrorState says the data is safe", () => {
  // The component's whole job is preventing a destructive misreading: a
  // customer who believes their templates are gone will recreate them. If
  // this reassurance is ever edited out, the shared component stops paying
  // for itself.
  const src = read("src/components/load-error-state.tsx");

  it("tells the customer nothing was lost", () => {
    expect(src).toMatch(/Nothing has been lost/);
  });

  it("is announced to screen readers", () => {
    expect(src).toContain('role="alert"');
  });
});
