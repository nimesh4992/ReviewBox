/**
 * Decides whether the sync route can skip Clerk middleware because it will
 * authenticate itself as a cron request. Keep this aligned with the route's
 * development fallback: local cron work is allowed without a configured key,
 * while production fails closed.
 */
export function canBypassClerkForSyncCron(
  authorization: string | null,
  cronSecret: string | undefined,
  nodeEnv: string | undefined,
): boolean {
  if (!cronSecret) return nodeEnv !== "production";
  return authorization === `Bearer ${cronSecret}`;
}
