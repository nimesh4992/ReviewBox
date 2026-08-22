/**
 * A destructive action must say what it destroys, before it destroys it.
 *
 * LT3, open in the backlog since 2026-08-16 and asked twice: *is app deletion
 * recoverable?* Read against the code on 2026-08-22, the answer is **no, and
 * the two halves are not symmetrical**:
 *
 *   • `DELETE /api/apps/[id]` soft-deletes the app row (`deleted_at`) and
 *     **hard-deletes its reviews** (`.delete()`), sanctioned by D015. The audit
 *     entry records how many rows went; the rows themselves are gone.
 *   • Reconnecting does not undo it. Google Play's API serves roughly the last
 *     week (`/help/review-history`), so an app removed after six months of
 *     syncing comes back with a week of history.
 *   • Deleting the whole **workspace** has a 30-day grace period
 *     (`danger-zone.tsx`). The more destructive of the two actions had the
 *     weaker warning: a one-line `confirm()` reading "This will delete all
 *     synced reviews", which a reader can easily take to mean "and re-syncing
 *     will fetch them again".
 *
 * Whether app deletion *should* become recoverable is the founder's call and is
 * still open. This file only holds the line that the copy must not understate
 * what already happens.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const APP_CONNECTIONS = "src/features/settings/components/app-connections.tsx";
const APP_DELETE_ROUTE = "src/app/api/apps/[id]/route.ts";
const DANGER_ZONE = "src/components/settings/danger-zone.tsx";

describe("removing an app warns that the reviews are gone for good", () => {
  const source = read(APP_CONNECTIONS);

  it("says the deletion is permanent", () => {
    expect(source).toMatch(/permanently deletes/i);
    expect(source).toMatch(/cannot be undone/i);
  });

  it("says reconnecting will not restore the history", () => {
    // The specific misreading the old copy invited.
    expect(source).toMatch(/[Rr]econnecting later will not bring them back/);
  });

  it("points at the export before the point of no return", () => {
    expect(source).toMatch(/Export from Reports first/i);
  });

  it("still gates the delete behind a confirmation", () => {
    // Guards the fix itself: rewriting the string is worthless if the prompt
    // it feeds is removed.
    expect(source).toMatch(/if \(!confirm\(warning\)\) return;/);
  });
});

describe("the warning matches what the route actually does", () => {
  // If the route ever gains a soft delete for reviews, this copy becomes a
  // scarier claim than the truth — which is its own kind of wrong, and this
  // test is where a reader will find out.
  it("reviews are still hard-deleted, which is what the copy claims", () => {
    const route = read(APP_DELETE_ROUTE);
    expect(route).toMatch(/\.from\("reviews"\)\s*\n?\s*\.delete\(/);
  });

  it("the app row is still only soft-deleted", () => {
    const route = read(APP_DELETE_ROUTE);
    expect(route).toMatch(/\.from\("apps"\)[\s\S]{0,120}deleted_at:/);
  });

  it("workspace deletion still has the grace period this one lacks", () => {
    // The asymmetry is the reason the app warning has to be this explicit. If
    // workspace deletion ever loses its grace period, that reasoning changes.
    expect(read(DANGER_ZONE)).toMatch(/30 days/);
  });
});
