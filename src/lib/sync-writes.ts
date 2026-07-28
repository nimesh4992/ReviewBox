/**
 * sync-writes.ts
 *
 * Decides what a review sync is allowed to write over data we already hold.
 *
 * The rule this encodes: **reply state belongs to the user, not the store.**
 *
 * A blanket upsert keyed on (app_id, external_id) rewrites every column from
 * freshly-fetched store data. That silently destroyed work:
 *
 *   - A saved AI draft (`draft_ready` + the draft text) was reset to
 *     `needs_reply` / null on the next sync.
 *   - A Draft Mode "mark as replied" (D018 — the user pasted the reply into
 *     the store console themselves) was reset the same way.
 *   - The iTunes RSS feed never reports developer replies at all, so *every*
 *     App Store review was reset to `needs_reply` on every single sync,
 *     including ones replied to through the Connect API.
 *
 * So a sync may only:
 *   1. insert reviews it has never seen, and
 *   2. promote a known review to `replied` when the store now shows a
 *      developer reply and we still think it needs one.
 *
 * It may never downgrade reply state.
 */

/** The subset of a fetched store row this module needs. */
export interface FetchedReviewRow {
  external_id:  string;
  reply_status: string;
  reply_text:   string | null;
}

/** The subset of a row we already have in the database. */
export interface KnownReview {
  id:           string;
  reply_status: string;
}

export interface SyncWritePlan<T extends FetchedReviewRow> {
  /** Reviews we have never seen — safe to insert wholesale. */
  inserts: T[];
  /**
   * Known reviews the store now shows a developer reply for, which we still
   * have as `needs_reply`. Safe to promote to `replied`.
   */
  promotions: Array<{ id: string; replyText: string | null }>;
}

/**
 * Split fetched store rows into the writes that are safe to perform.
 *
 * @param rows     Rows fetched from the store this sync.
 * @param existing external_id → what we already hold for it.
 */
export function planSyncWrites<T extends FetchedReviewRow>(
  rows: T[],
  existing: Map<string, KnownReview>,
): SyncWritePlan<T> {
  const inserts: T[] = [];
  const promotions: Array<{ id: string; replyText: string | null }> = [];

  for (const row of rows) {
    const known = existing.get(row.external_id);

    if (!known) {
      inserts.push(row);
      continue;
    }

    // Only ever move needs_reply → replied. `draft_ready` and an existing
    // `replied` are user-owned states and outrank anything inferred from the
    // store listing.
    if (row.reply_status === "replied" && known.reply_status === "needs_reply") {
      promotions.push({ id: known.id, replyText: row.reply_text });
    }
  }

  return { inserts, promotions };
}

/**
 * Merge rows from two sources into one row per review.
 *
 * Used to combine the public scrape (always available, no credentials) with
 * the official store API (optional, richer — carries developer replies and
 * device). Later sources win on conflict, so callers pass the authoritative
 * source last.
 */
export function mergeReviewRows<T extends { external_id: string }>(
  ...sources: Array<T[] | null | undefined>
): T[] {
  const merged = new Map<string, T>();
  for (const source of sources) {
    for (const row of source ?? []) merged.set(row.external_id, row);
  }
  return [...merged.values()];
}

/**
 * Does a store-API failure mean "the customer hasn't granted access", as
 * opposed to a transient hiccup? Only the former may mark an app as
 * not-connected (publisher_api_connected = false) — a 5xx or timeout must
 * not flip a connected app back to the "connect your Play Console" banner.
 */
export function isGpPermissionError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("403") ||
    lower.includes("permission") ||
    lower.includes("forbidden") ||
    lower.includes("unauthorized") ||
    lower.includes("credentials are missing")
  );
}
