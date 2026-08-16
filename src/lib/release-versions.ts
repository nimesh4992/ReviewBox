/**
 * release-versions.ts
 *
 * Groups synced reviews into release rows for the Release monitor.
 *
 * The bug this exists to prevent: the previous version keyed its Map on the
 * raw `app_version` STRING, so two apps that both shipped "2.1.0" were fused
 * into one row with one review count and one blended average — and the
 * "vs previous" delta was then computed between two unrelated products'
 * releases. Version numbers are only unique WITHIN an app, so the bucket key
 * must carry the app id.
 */

export interface ReleaseReviewRow {
  app_id: string;
  app_version: string | null;
  rating: number;
  store_created_at: string;
}

export interface VersionRow {
  /** App this release belongs to — never merge rows across apps. */
  appId: string;
  /** Display name, for workspaces with more than one app. */
  appName: string;
  version: string;
  reviewCount: number;
  avgRating: number;
  /**
   * Average-rating change vs the previous version OF THE SAME APP; null for
   * that app's oldest release.
   */
  ratingDelta: number | null;
  firstSeen: string;
}

/**
 * @param rows     Reviews to group (already scoped to live apps by the caller).
 * @param appNames app id → display name, for labelling rows.
 */
export function deriveVersions(
  rows: readonly ReleaseReviewRow[],
  appNames: ReadonlyMap<string, string> = new Map(),
): VersionRow[] {
  const byKey = new Map<
    string,
    { appId: string; version: string; ratings: number[]; firstSeen: string }
  >();

  for (const row of rows) {
    const version = row.app_version?.trim();
    if (!version || !row.app_id) continue;
    const key = `${row.app_id}|${version}`;
    const entry = byKey.get(key);
    if (entry) {
      entry.ratings.push(row.rating);
      if (row.store_created_at < entry.firstSeen) entry.firstSeen = row.store_created_at;
    } else {
      byKey.set(key, {
        appId: row.app_id,
        version,
        ratings: [row.rating],
        firstSeen: row.store_created_at,
      });
    }
  }

  const versions: VersionRow[] = [...byKey.values()]
    .map(({ appId, version, ratings, firstSeen }) => ({
      appId,
      appName: appNames.get(appId) ?? "",
      version,
      reviewCount: ratings.length,
      avgRating: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      ratingDelta: null as number | null,
      firstSeen,
    }))
    .sort((a, b) => (a.firstSeen < b.firstSeen ? -1 : 1));

  // Deltas are per-app: chain each release to the previous release of ITS OWN
  // app, not to whatever happens to precede it across the whole workspace.
  const prevByApp = new Map<string, number>();
  for (const v of versions) {
    const prev = prevByApp.get(v.appId);
    if (prev !== undefined) v.ratingDelta = v.avgRating - prev;
    prevByApp.set(v.appId, v.avgRating);
  }

  return versions.reverse(); // newest first
}
