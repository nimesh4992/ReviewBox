/**
 * bootstrap-reviews.ts
 *
 * Fetches up to 50 public reviews for a newly added app using free public
 * APIs — no Play Console credentials required. Called once on first sync so
 * users see real data immediately after onboarding.
 *
 * Google Play: google-play-scraper (public Play Store pages)
 * App Store:   iTunes RSS feed (public, no auth)
 *
 * After bootstrap the normal Publisher API sync takes over for ongoing
 * incremental updates.
 */

import { buildEnrichedRow } from "@/lib/review-mapper";
import gplay from "@/services/gplay-client";
import { DEFAULT_STOREFRONT, normalizeStorefront } from "@/lib/storefronts";

// 200 reviews covers ~14 days for most apps (D016).
// Public scrapers only — no credentials required.
const BOOTSTRAP_LIMIT = 200;

/**
 * Coerce an arbitrary date value to an ISO string without throwing.
 * `new Date(bad).toISOString()` throws `RangeError: Invalid time value` on an
 * unparseable input, which would abort the whole .map() and fail bootstrap for
 * the app. Falls back to "now" on any invalid date.
 */
function safeIso(value: Date | string | null | undefined): string {
  const d = value instanceof Date ? value : new Date(value ?? "");
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// ── Google Play ───────────────────────────────────────────────────────────────

/**
 * Retry a flaky operation with exponential backoff. Used because
 * google-play-scraper hits Play Store HTML pages which occasionally
 * return 503 (rate-limit) or empty payloads. A 3x retry recovers
 * from ~95% of these transient failures.
 */
async function withRetry<T>(
  label: string,
  op: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts) break;
      const delay = 800 * Math.pow(2, attempt - 1); // 800ms, 1.6s, 3.2s
      console.warn(
        `[bootstrap] ${label} attempt ${attempt} failed, retrying in ${delay}ms:`,
        err instanceof Error ? err.message : err,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function bootstrapGooglePlayReviews(
  appId: string,
  workspaceId: string,
  packageName: string,
  country: string = DEFAULT_STOREFRONT,
): Promise<ReturnType<typeof buildEnrichedRow>[]> {
  // Storefront matters: a region-locked app has NO reviews on the US
  // storefront, so the old hardcoded "us" returned an empty list forever
  // and the dashboard stayed blank no matter how often sync ran.
  const store = normalizeStorefront(country);
  const { data } = await withRetry(`gplay ${packageName} (${store})`, () =>
    gplay.reviews({
      appId: packageName,
      lang: "en",
      country: store,
      sort: gplay.sort.NEWEST,
      num: BOOTSTRAP_LIMIT, // 200 — covers ~14 days
    }),
  );

  return data.map((r) =>
    buildEnrichedRow(
      appId,
      workspaceId,
      r.id,
      "google_play",
      r.userName || "Anonymous",
      r.score,
      r.text || "",
      r.version ?? null,
      null,
      null,
      safeIso(r.date),
      !!r.replyText,
      r.replyText ?? null,
    ),
  );
}

// ── App Store ─────────────────────────────────────────────────────────────────

interface ItunesLookupResult {
  resultCount: number;
  results: Array<{ trackId?: number }>;
}

interface ItunesRssEntry {
  id:                { label: string };
  author:            { name: { label: string } };
  "im:rating":       { label: string };
  "im:version"?:     { label: string };
  title:             { label: string };
  content:           { label: string };
  updated:           { label: string };
}

interface ItunesRssFeed {
  feed: { entry?: ItunesRssEntry[] };
}

async function resolveItunesTrackId(
  bundleId: string,
  country: string,
): Promise<number | null> {
  const res = await fetch(
    `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(bundleId)}&country=${country}`,
    { signal: AbortSignal.timeout(5000) },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as ItunesLookupResult;
  return json.results?.[0]?.trackId ?? null;
}

export async function bootstrapAppStoreReviews(
  appId: string,
  workspaceId: string,
  bundleId: string,
  country: string = DEFAULT_STOREFRONT,
): Promise<ReturnType<typeof buildEnrichedRow>[]> {
  const store = normalizeStorefront(country);
  const trackId = await resolveItunesTrackId(bundleId, store);
  if (!trackId) return [];

  const rows: ReturnType<typeof buildEnrichedRow>[] = [];

  // iTunes RSS returns 10 reviews per page, up to page 15 = 150 reviews (~14 days).
  for (let page = 1; page <= 15 && rows.length < BOOTSTRAP_LIMIT; page++) {
    // The country segment is required — the default feed is US-only.
    const url = `https://itunes.apple.com/${store}/rss/customerreviews/page=${page}/id=${trackId}/sortBy=mostRecent/json`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) break;
      const json = (await res.json()) as ItunesRssFeed;

      // First entry on page 1 is app metadata, not a review — skip it.
      const entries = (json.feed?.entry ?? []).slice(page === 1 ? 1 : 0);
      if (!entries.length) break;

      for (const e of entries) {
        const externalId = e.id?.label;
        if (!externalId) continue; // no stable ID — skip rather than generate a random one

        // Missing/blank rating → NaN; buildEnrichedRow validates and falls back
        // to neutral (3) rather than fabricating it here or writing NaN.
        const rating = parseInt(e["im:rating"]?.label ?? "", 10);
        const text = [e.title?.label, e.content?.label].filter(Boolean).join("\n\n");
        const createdAt = safeIso(e.updated?.label);

        rows.push(
          buildEnrichedRow(
            appId,
            workspaceId,
            externalId,
            "app_store",
            e.author?.name?.label || "Anonymous",
            rating,
            text,
            e["im:version"]?.label ?? null,
            null,
            null,
            createdAt,
            false,
            null,
          ),
        );
      }
    } catch {
      break;
    }
  }

  return rows.slice(0, BOOTSTRAP_LIMIT);
}

// ── Unified dispatcher ────────────────────────────────────────────────────────

export async function bootstrapReviews(
  platform: "google_play" | "app_store",
  appId: string,
  workspaceId: string,
  storeId: string,
  country: string = DEFAULT_STOREFRONT,
): Promise<ReturnType<typeof buildEnrichedRow>[]> {
  if (platform === "google_play") {
    return bootstrapGooglePlayReviews(appId, workspaceId, storeId, country);
  }
  return bootstrapAppStoreReviews(appId, workspaceId, storeId, country);
}
