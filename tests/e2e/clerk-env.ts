/**
 * Is this run pointed at a REAL Clerk instance?
 *
 * CI supplies a placeholder publishable key, so Clerk's provider rejects every
 * request with "Invalid host" and the app renders nothing — every e2e test
 * fails, including ones for pages that never touch auth (landing, pricing,
 * legal). The job has therefore been red on every PR for as long as it has
 * existed.
 *
 * A check that always fails is worse than no check: it trains everyone to
 * ignore it, so the day it fails for a real reason nobody looks. These tests
 * now SKIP with an explicit reason when the key is a placeholder, so the job
 * is green-but-honest — and goes red only when something genuinely broke.
 *
 * To actually run them: set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and
 * CLERK_SECRET_KEY in the repo's GitHub Actions secrets to a real Clerk
 * *test instance* (Clerk dashboard → API keys). Nothing else changes.
 */

const PLACEHOLDER_MARKERS = ["placeholder", "ci-placeholder", "test-key"];

export function clerkKeyIsPlaceholder(): boolean {
  // This function answers exactly one question: are the Clerk keys in this
  // process real? Nothing else may change that answer.
  //
  // It used to short-circuit to `false` when NEXT_PUBLIC_BYPASS_E2E === "1".
  // That was wrong in both directions. It let an unrelated flag assert "the
  // keys are real" when they demonstrably were not, and in CI — where the keys
  // ARE placeholders — it would have un-skipped all 24 specs against an app
  // answering "Invalid host" on every route, making the job red on every
  // commit including documentation-only ones. That is precisely the
  // permanently-red check this module was written to prevent.
  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const secret = process.env.CLERK_SECRET_KEY ?? "";

  // ── Three states, not two ─────────────────────────────────────────────────
  //
  // NO keys at all is NOT a placeholder. Clerk's Next SDK falls back to
  // "keyless mode" in development: it auto-provisions a real ephemeral Clerk
  // development instance, logs a claim URL, and the app WORKS. Treating that as
  // a placeholder is what made this suite inert on every developer machine —
  // and it is why "the e2e suite executes zero specs" was read as a missing-
  // credentials problem when it was a gate that mis-modelled reality.
  //
  // Measured from a clean .next with no Clerk keys configured:
  //   smoke.spec.ts      5 passed
  //   auth-flow.spec.ts  15 passed, 3 skipped (need an authed session)
  //   spine-flow.spec.ts 1 skipped (ditto)
  // 20 of 24 specs are real signal in this state. Skipping them was the bug.
  //
  // CI is unaffected: it sets the placeholder pair explicitly, so it lands in
  // the marker branch below and keeps skipping. src/e2e-gate-contract.test.ts
  // pins that, so this can never quietly make the CI job red on every commit.
  if (!publishable && !secret) return false;

  // A HALF-configured pair is broken, not keyless — Clerk will not fall back
  // once either value is present, so the app really is misconfigured.
  if (!publishable || !secret) return true;

  // Publishable keys embed the instance host as base64 after the prefix —
  // a placeholder decodes to something containing "placeholder".
  const decoded = (() => {
    try {
      return Buffer.from(publishable.replace(/^pk_(test|live)_/, ""), "base64").toString("utf8");
    } catch {
      return "";
    }
  })().toLowerCase();

  const haystack = `${publishable} ${secret} ${decoded}`.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => haystack.includes(marker));
}

/**
 * Can a spec drive an AUTHENTICATED browser session?
 *
 * **No — and not because a flag is unset.** Three specs in auth-flow.spec.ts
 * and one in spine-flow.spec.ts were written against a documented mechanism
 * that does not exist:
 *
 *   "these tests rely on the dev server having NEXT_PUBLIC_BYPASS_E2E=1 set,
 *    which makes `auth.protect()` return a mock userId for e2e only"
 *
 * Nothing in `src/` reads NEXT_PUBLIC_BYPASS_E2E — grep it and see. The
 * predecessor flag, BYPASS_AUTH, was deliberately REMOVED as a security defect
 * (BUGS.md SEC-005 / AUD-005, "allowed auth bypass"), and the replacement the
 * comment describes was never built. So setting the flag cannot work: the
 * browser is redirected to /sign-in by middleware before any `page.route` stub
 * is ever consulted.
 *
 * Re-adding an app-side auth bypass to make these pass would reopen a closed
 * red-severity hole, so that is not the fix. The supported route is Clerk's own
 * testing package (`@clerk/testing/playwright` — setupClerkTestingToken plus a
 * test user on a Clerk *development* instance). It is not installed, and there
 * is no Clerk instance configured here, so these specs stay honestly skipped.
 *
 * `src/e2e-gate-contract.test.ts` fails if an app-side bypass ever reappears.
 */
export const AUTHENTICATED_E2E_AVAILABLE = false;

export const AUTH_SKIP_REASON =
  "No implemented way to authenticate a Playwright session. NEXT_PUBLIC_BYPASS_E2E " +
  "is read only by these tests, never by the app, so setting it changes nothing — " +
  "middleware still redirects to /sign-in. Needs @clerk/testing plus a Clerk test " +
  "instance and test user (BUG-037). Re-adding an app-side auth bypass is NOT the " +
  "fix: that was removed as a security defect (SEC-005).";

export const SKIP_REASON =
  "No real Clerk instance configured — Clerk rejects every request with " +
  "'Invalid host', so the app renders nothing and these tests cannot say " +
  "anything about the code. Add real Clerk TEST-instance keys to GitHub " +
  "Actions secrets to enable them.";
