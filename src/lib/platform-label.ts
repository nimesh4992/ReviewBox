/**
 * platform-label.ts — the DB enum → what a human reads.
 *
 * `apps.platform` and `reviews.source` are stored as `google_play` /
 * `app_store`; every screen shows "Google Play" / "App Store". That mapping was
 * hand-written at each site that needed it — review-sync, the admin customer
 * page, and now the sidebar — which is the shape finding M-13 was filed for:
 * a vocabulary duplicated by hand drifts one copy at a time, and nothing fails
 * when it does.
 *
 * Note this is the SNAKE_CASE storage enum, not the kebab-case
 * `google-play` / `app-store` the store-search service speaks. Those are a
 * separate mapping with its own conversions; don't fold them together here or
 * the next reader has to work out which vocabulary a given string belongs to.
 */

import type { ReviewSource } from "@/types/review";

/** How `apps.platform` / `reviews.source` are stored. */
export type StorePlatform = "google_play" | "app_store";

const LABELS: Record<StorePlatform, ReviewSource> = {
  google_play: "Google Play",
  app_store: "App Store",
};

export function isStorePlatform(value: unknown): value is StorePlatform {
  return value === "google_play" || value === "app_store";
}

/**
 * The store's display name.
 *
 * Takes a plain string because most callers hold a value straight from the
 * database or an API response, where the type is `string`. An unrecognised
 * value returns null rather than a guess — a wrong store name is worse than
 * none, since the whole reason this exists is telling two same-named apps
 * apart.
 */
export function platformLabel(platform: string | null | undefined): ReviewSource | null {
  return isStorePlatform(platform) ? LABELS[platform] : null;
}
