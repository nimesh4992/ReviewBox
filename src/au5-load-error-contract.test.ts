/**
 * AU5 — the load paths AU4 did not reach.
 *
 * Same defect class, verbatim from `load-error-contract.test.ts`: these routes
 * answer a 500 with a JSON **error envelope**, so `res.json()` RESOLVES. The
 * promise never rejects, `.catch` is unreachable for every HTTP failure, and
 * the screen renders the error as the customer's data.
 *
 * AU4 fixed ASO, Sentiment, Competitors and Reply Kit. This is the rest, found
 * by reading each site rather than by grep, and two of them are worse than a
 * misleading empty state — they are **data-loss paths**:
 *
 *   • `settings-sections.tsx` — a failed read rendered an empty support email
 *     and an empty brand voice, with an amber "Without this, AI uses a generic
 *     voice" hint beneath. Save posts whatever is in the box, so a customer who
 *     believed that hint and typed something would have overwritten their real
 *     brand voice with a guess.
 *   • `alert-preferences.tsx` — its `useState` is seeded from a *fixture file*,
 *     so a failed read left `mockAlertPreferences` on screen looking like saved
 *     settings, with Save live beneath them.
 *
 * The rest mislead without destroying: "you have no teammates" (team-members),
 * "Slack is not connected" (slack-integration), "no automation rules yet"
 * (automation-hub), "no runs yet" (run history), an empty template dropdown
 * (rule-builder), an eternal "Loading…" (invite modal).
 *
 * ── What is deliberately NOT here ────────────────────────────────────────────
 *
 * `KNOWN_BEST_EFFORT` below lists the load paths that are allowed to swallow a
 * failure, each with the reason. The sweep is not "add error handling
 * everywhere" — an analytics ping or a cache warm that renders nothing has
 * nothing to tell the customer, and a retry button for it would be noise.
 *
 * Source-reading assertions, for the same reason AU4's are: this repo's Vitest
 * runs in a Node environment with no React Testing Library by convention. A
 * weak guard on the exact shape that regressed beats no guard.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), relPath), "utf8");
}

/** Comments stripped: an explanatory comment naming a bug is not the bug. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

// ── 1 · Every fixed surface renders a failure and checks the status ──────────

interface Surface {
  file: string;
  label: string;
  /** A string the surface must still contain — the state it used to render instead. */
  failureMarker: string;
}

const FIXED: Surface[] = [
  {
    file: "src/features/settings/components/settings-sections.tsx",
    label: "Workspace defaults",
    failureMarker: "<LoadErrorState",
  },
  {
    file: "src/features/settings/components/team-members.tsx",
    label: "Team members",
    failureMarker: "<LoadErrorState",
  },
  {
    file: "src/features/settings/components/slack-integration.tsx",
    label: "Slack integration",
    failureMarker: "<LoadErrorState",
  },
  {
    file: "src/features/settings/components/alert-preferences.tsx",
    label: "Alert preferences",
    failureMarker: "<LoadErrorState",
  },
  {
    file: "src/features/automations/components/automation-hub.tsx",
    label: "Automations (rules + run history)",
    failureMarker: "<LoadErrorState",
  },
  {
    file: "src/features/reply-kit/components/ai-styles-tab.tsx",
    label: "AI reply styles",
    // Not a LoadErrorState: the picker still works, so an inline notice saying
    // the highlight is a default rather than their choice is the honest shape.
    failureMarker: "loadFailed",
  },
  {
    file: "src/features/automations/components/rule-builder-modal.tsx",
    label: "Rule builder template picker",
    failureMarker: "templatesFailed",
  },
  {
    file: "src/components/dashboard/google-play-setup-modal.tsx",
    label: "Google Play setup modal",
    failureMarker: '"error"',
  },
  {
    file: "src/components/dashboard/google-play-invite-modal.tsx",
    label: "Google Play invite modal",
    failureMarker: "emailFailed",
  },
];

describe("AU5 surfaces separate 'failed to load' from 'nothing there'", () => {
  it.each(FIXED)("$label renders a distinct failure state", ({ file, failureMarker }) => {
    expect(stripComments(read(file))).toContain(failureMarker);
  });

  it.each(FIXED)("$label checks the response status before trusting it", ({ file }) => {
    const body = stripComments(read(file));
    // `res.ok` / `r.ok` somewhere in the file is a floor, not a proof — the
    // per-surface assertions below carry the specific claims.
    expect(body).toMatch(/\.ok\b/);
  });
});

// ── 2 · The two data-loss paths, specifically ────────────────────────────────

describe("a failed read cannot be saved over", () => {
  it("workspace defaults render no form at all when the read failed", () => {
    const body = stripComments(read("src/features/settings/components/settings-sections.tsx"));

    // An EARLY RETURN, not an error banner above the inputs. Source order is
    // not enough to express that and the first version of this assertion used
    // it — a mutation that moved the failure state above the form passed
    // cleanly, which is the exact regression it claims to catch. The shape is
    // the claim: `if (load === "error") { return`.
    expect(
      body,
      "the load-failure branch must RETURN before the form renders. Rendering " +
        "it above the inputs leaves empty fields and a live Save, which is how " +
        "a customer overwrites their real brand voice with a guess.",
    ).toMatch(/if \(load === "error"\)\s*\{\s*return/);

    // …and the form must still exist below it, so deleting the form to satisfy
    // the check above is not a passing move either.
    expect(body).toContain("<Input");
    expect(body).toContain("saveField({ brandVoice }");
  });

  it("alert preferences hide Save when the read failed", () => {
    const body = stripComments(read("src/features/settings/components/alert-preferences.tsx"));
    const guard    = body.indexOf("loadFailed ?");
    const save     = body.indexOf("Save preferences");
    const branchEnd = body.indexOf("</>", guard);

    expect(guard, "no loadFailed branch in AlertPreferences").toBeGreaterThan(-1);
    expect(save, "no Save button in AlertPreferences").toBeGreaterThan(-1);
    expect(branchEnd, "the loadFailed ternary has no fragment branch").toBeGreaterThan(-1);

    // Strictly INSIDE the not-failed branch — bounded on both sides, so moving
    // Save either before the guard or after the fragment closes is caught.
    expect(
      guard < save && save < branchEnd,
      "Save must sit inside the not-failed branch. Anywhere else, a customer " +
        "can write mockAlertPreferences over their real settings.",
    ).toBe(true);
  });

  it("still seeds from the fixture, which is correct for a workspace with no rows", () => {
    // Guards the fix itself: deleting the seed to dodge the bug would take the
    // legitimate "you have never configured these" defaults with it.
    expect(read("src/features/settings/components/alert-preferences.tsx"))
      .toContain("useState<AlertPreference[]>(mockAlertPreferences)");
  });
});

describe("React Query reads reject a non-ok response", () => {
  // Without a throw, React Query caches the error envelope AS DATA: `isError`
  // never fires and `retry` never runs. This is what made team-members show
  // "you are the only person here" during an outage.
  it.each([
    { file: "src/features/settings/components/team-members.tsx", label: "team members + invites" },
    { file: "src/hooks/use-tag-labels.ts", label: "tag labels" },
  ])("$label throws instead of resolving", ({ file }) => {
    const body = stripComments(read(file));
    expect(body).toMatch(/if \(!r(es)?\.ok\) throw/);
  });

  it("team-members actually reads the error flag it now has", () => {
    const body = stripComments(read("src/features/settings/components/team-members.tsx"));
    // Destructuring `isError` and never using it is the state this file was in
    // for its mutation-vs-read asymmetry. Require more than one occurrence.
    const uses = body.match(/\bmembersFailed\b/g) ?? [];
    expect(uses.length, `membersFailed appears ${uses.length}×`).toBeGreaterThan(1);
  });

  it("tag labels keep degrading to default names rather than erroring", () => {
    // The one place in this sweep where swallowing is right: a tag under its
    // default name is fine; a tag rendered as nothing is not. Throwing was for
    // `retry`, not for an error state, and this asserts that distinction held.
    const body = read("src/hooks/use-tag-labels.ts");
    expect(body).toContain("ISSUE_TAGS.map");
    expect(body).not.toContain("LoadErrorState");
  });
});

// ── 3 · The sweep: no NEW unguarded client load path ─────────────────────────

const SRC = join(process.cwd(), "src");

/** `.ts`/`.tsx` under `src/`, tests excluded. `readdirSync`, not `fs.globSync`
 *  — CI pins Node 20, where globSync does not exist. */
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

/**
 * The exact shape that produced every bug in AU4 and AU5:
 *
 *     fetch(...).then((r) => r.json())
 *
 * A status check cannot be expressed in that arrow, so the parse is
 * unconditional by construction. Matching the shape rather than reasoning about
 * control flow keeps this guard honest — it has no opinions to be wrong about.
 */
const UNGUARDED_THEN_JSON = /\.then\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\1\.json\(\)/;

/**
 * Load paths allowed to swallow a failure, and why. Classification from the
 * AU5 sweep of 2026-08-22 (`docs/LAUNCH_READINESS_2026-08-22.md` §AU5):
 *
 *   A — best-effort by design; nothing is rendered from it
 *   C — operational; the failure belongs in telemetry, not on screen
 *
 * Anything that renders customer data is neither, and does not belong here.
 */
const KNOWN_BEST_EFFORT: Record<string, string> = {};

describe("no new unguarded load path appears", () => {
  it("finds no fetch(...).then(r => r.json()) outside the allowlist", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles()) {
      const rel = relative(process.cwd(), file).split("\\").join("/");
      if (rel in KNOWN_BEST_EFFORT) continue;
      const body = stripComments(readFileSync(file, "utf8"));
      if (UNGUARDED_THEN_JSON.test(body)) offenders.push(rel);
    }

    expect(
      offenders,
      "These parse a response without checking it. On a 500 these routes return " +
        "a JSON error envelope, so `.json()` RESOLVES and the failure renders as " +
        "the customer's data.\n\n" + offenders.join("\n") +
        "\n\nEither check `res.ok` and render a failure, or — if the call is " +
        "genuinely best-effort and renders nothing — add it to KNOWN_BEST_EFFORT " +
        "with the reason.",
    ).toEqual([]);
  });

  it("keeps no allowlist entry for a file that no longer has the shape", () => {
    const stale = Object.keys(KNOWN_BEST_EFFORT).filter((rel) => {
      let body: string;
      try { body = stripComments(read(rel)); } catch { return true; }
      return !UNGUARDED_THEN_JSON.test(body);
    });
    expect(stale, "Fixed or deleted. Remove from KNOWN_BEST_EFFORT.").toEqual([]);
  });
});
