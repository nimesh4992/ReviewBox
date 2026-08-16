/**
 * `apps.last_sync_status` holds one of three kinds of value:
 *
 *   null / ""              never attempted
 *   "success"              the last sync completed
 *   "credentials_verified" the store connection was checked and works, but no
 *                          sync has run since
 *   anything else          a real failure — `needs_play_console_access`,
 *                          `google_credentials_invalid`, `package_not_found`,
 *                          `store_blocked_scraping`, … (see classifySyncError
 *                          in services/review-sync.ts)
 *
 * The dashboard decided "is this app broken?" with the inline test
 * `status && status !== "success"`, which classifies `credentials_verified` as
 * a failure. So the moment a customer finished the Google Play connection —
 * with the modal itself saying "Connection verified! You're ready to sync." —
 * the banner behind it announced "Mumbai One can't sync yet · Finish setup".
 * Reloading didn't help, because the value in the database genuinely was
 * "credentials_verified". The one action that proves the connection works was
 * the action that marked it broken.
 *
 * `/api/health/user-check` already kept its own correct list. Everything reads
 * this now, so the two can't drift apart again.
 */

/** Statuses that mean "nothing is wrong", including verified-but-not-yet-synced. */
const HEALTHY_STATUSES: ReadonlySet<string> = new Set(["success", "credentials_verified"]);

/** True when the status records an actual sync failure the user must act on. */
export function isSyncFailureStatus(status: string | null | undefined): boolean {
  if (!status) return false; // never attempted is not a failure
  return !HEALTHY_STATUSES.has(status);
}

/**
 * True when the connection has been proven to work — either a sync completed
 * or the credentials were verified directly.
 */
export function isConnectionHealthy(status: string | null | undefined): boolean {
  return !!status && HEALTHY_STATUSES.has(status);
}
