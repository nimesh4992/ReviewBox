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
  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const secret = process.env.CLERK_SECRET_KEY ?? "";

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

export const SKIP_REASON =
  "No real Clerk instance configured — Clerk rejects every request with " +
  "'Invalid host', so the app renders nothing and these tests cannot say " +
  "anything about the code. Add real Clerk TEST-instance keys to GitHub " +
  "Actions secrets to enable them.";
