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

/** The connection fields that decide whether we can post a reply for an app. */
export interface AppReplyCapability {
  platform: string;
  /** App Store Connect key pair stored on the app row. */
  has_credentials?: boolean | null;
  /** Play Console access granted to the workspace service account. */
  publisher_api_connected?: boolean | null;
}

/**
 * Can ReviewBox publish a reply to the store for this app, or does the user
 * have to go and paste it themselves?
 *
 * The two stores authenticate completely differently, and conflating them
 * broke the product's central promise for every Android customer:
 *
 *   App Store   — a per-app .p8 key pair on the app row (access_token +
 *                 refresh_token), which is what `has_credentials` reports.
 *   Google Play — nothing on the app row at all. Auth is the workspace's
 *                 service account (GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY)
 *                 once it's been invited to Play Console, which is what
 *                 `publisher_api_connected` records.
 *
 * The composer used `has_credentials` for both. For a Play app that is always
 * false — there are no tokens on the row and never will be — so no Google Play
 * customer was ever offered the "Post reply" button, however correctly they
 * completed the connection. They were shown "Copy reply" and told to paste it
 * into Play Console by hand: the exact work they bought the product to avoid.
 * The server route has posted Play replies via the service account all along;
 * only the UI refused to offer it.
 */
export function canPostRepliesViaApi(app: AppReplyCapability): boolean {
  if (app.platform === "app_store") return app.has_credentials === true;
  if (app.platform === "google_play") return app.publisher_api_connected === true;
  return false;
}
