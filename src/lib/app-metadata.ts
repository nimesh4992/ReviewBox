/**
 * app-metadata.ts
 *
 * Pure decisions for the sync's store-metadata refresh: what to write to the
 * `apps` row from a scrape result, and when a persisted storefront should be
 * abandoned and re-probed.
 *
 * Extracted from review-sync.ts so both are unit-testable. The behaviour they
 * encode fixed a real production failure: `apps.lifetime_rating` stayed null
 * for a region-locked app, so the dashboard silently fell back to a 30-day
 * average of synced reviews (2.53) while the Play listing showed the store's
 * own all-time rating (3.1) — spec AC-6, "shown numbers match the store".
 */

import type { AppMetadata } from "@/services/store-search";

/**
 * Columns the sync may refresh from a scrape result. Null/empty fields are
 * omitted rather than written, so a partial scrape can never null out data a
 * previous sync already captured.
 */
export function buildMetadataUpdate(meta: AppMetadata): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  if (meta.rating !== null) update.lifetime_rating = meta.rating;
  if (meta.reviewCount !== null) update.lifetime_review_count = meta.reviewCount;
  if (meta.icon) update.icon_url = meta.icon;
  if (meta.developer) update.developer = meta.developer;
  return update;
}

/**
 * Should the sync ignore the persisted storefront and probe them all again?
 *
 * A persisted `store_country` is a hint, not a life sentence. Two ways it goes
 * stale:
 *   - it was recorded wrong (every row that predates multi-storefront support
 *     was effectively pinned to "us"), or
 *   - the storefront stopped carrying the app.
 *
 * In both cases the known-country fetch returns null — or a placeholder page
 * with neither a rating nor a review count — on every sync, forever. Nothing
 * was ever re-probed, so `lifetime_rating` could never heal.
 *
 * `known == null` never re-probes: the caller already ran the full probe.
 * A result carrying a review count of 0 is a real listing (a brand-new app
 * with no ratings yet), not a placeholder — no re-probe.
 */
export function needsStorefrontReprobe(
  known: string | null,
  meta: AppMetadata | null,
): boolean {
  if (!known) return false;
  if (!meta) return true;
  return meta.rating === null && meta.reviewCount === null;
}
