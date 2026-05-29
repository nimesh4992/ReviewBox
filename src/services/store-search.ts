/**
 * store-search.ts
 *
 * Searches the public App Store and Google Play storefronts for apps by name.
 * Used by the onboarding flow so users can pick their app from a real list
 * instead of having to look up their package name or bundle ID manually.
 *
 * App Store: iTunes Search API (https://itunes.apple.com/search) — public, no auth.
 * Google Play: HTML scrape of play.google.com/store/search — fragile but works.
 */

import { Redis } from "@upstash/redis";

// ── Redis singleton (best-effort — null if env vars not set) ─────────────────

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!_redis) _redis = new Redis({ url, token });
  return _redis;
}

const META_TTL = 6 * 60 * 60; // 6 hours in seconds

export interface StoreSearchResult {
  /** Bundle ID (App Store) or package name (Google Play) — what we store in apps.store_id */
  storeId: string;
  /** Display name shown on the store */
  name: string;
  /** Developer / publisher name */
  developer: string;
  /** Icon URL (display only — never persisted) */
  icon: string | null;
  /** Star rating if visible (display only) */
  rating: number | null;
  /** Direct store URL for the listing */
  url: string;
}

const APP_STORE_SEARCH_URL = "https://itunes.apple.com/search";
const PLAY_STORE_SEARCH_URL = "https://play.google.com/store/search";

// ── App Store (iTunes Search API) ────────────────────────────────────────────

interface ItunesResult {
  bundleId?: string;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  artworkUrl512?: string;
  averageUserRating?: number;
  trackViewUrl?: string;
}

interface ItunesResponse {
  resultCount: number;
  results: ItunesResult[];
}

export async function searchAppStore(query: string, limit = 10): Promise<StoreSearchResult[]> {
  const params = new URLSearchParams({
    term: query,
    country: "us",
    entity: "software",
    limit: String(Math.min(limit, 25)),
  });

  const res = await fetch(`${APP_STORE_SEARCH_URL}?${params.toString()}`, {
    headers: { "User-Agent": "ReviewBox/1.0 (+https://tryreviewbox.com)" },
    // iTunes search occasionally rate-limits — fail fast rather than hanging
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`App Store search failed: ${res.status}`);
  }

  const json = (await res.json()) as ItunesResponse;
  return (json.results ?? [])
    .filter((r) => r.bundleId && r.trackName)
    .map((r) => ({
      storeId: r.bundleId!,
      name: r.trackName!,
      developer: r.artistName ?? "",
      icon: r.artworkUrl512 ?? r.artworkUrl100 ?? null,
      rating: typeof r.averageUserRating === "number" ? r.averageUserRating : null,
      url: r.trackViewUrl ?? `https://apps.apple.com/app/id${r.bundleId}`,
    }));
}

// ── Google Play (HTML scrape) ────────────────────────────────────────────────
//
// There's no public Play Store search API. We fetch the search results page
// and extract entries from the embedded data. Google rotates the markup so
// this needs occasional maintenance — the pattern matched here is stable as
// of late 2025 but could change. The route handler degrades gracefully if
// scraping fails.

interface ScrapedPlayResult {
  storeId: string;
  name: string;
  developer: string;
  icon: string | null;
  rating: number | null;
}

/**
 * Extract apps from a Play Store search HTML page.
 *
 * Google embeds search results as anchors with aria-label="NAME". For
 * icon + rating we look at the surrounding markup near each anchor. The
 * Play Store HTML rotates often — if a pattern stops matching, the row
 * falls back to "name only" instead of disappearing.
 */
function parsePlayHtml(html: string, limit: number): ScrapedPlayResult[] {
  const out: ScrapedPlayResult[] = [];
  const seen = new Set<string>();

  const anchorRegex =
    /href="\/store\/apps\/details\?id=([a-zA-Z0-9._]+)(?:&[^"]*)?"\s+aria-label="([^"]+)"/g;
  let match;
  while ((match = anchorRegex.exec(html)) !== null && out.length < limit) {
    const storeId = match[1];
    const name = match[2];
    if (seen.has(storeId)) continue;
    seen.add(storeId);

    // Look at a window of ~3KB around this match for icon + rating.
    const windowStart = Math.max(0, match.index - 1500);
    const windowEnd   = Math.min(html.length, match.index + 1500);
    const ctx = html.slice(windowStart, windowEnd);

    const iconMatch = ctx.match(
      /https:\/\/play-lh\.googleusercontent\.com\/[A-Za-z0-9_\-=/]+(?:=w\d+(?:-h\d+)?(?:-[a-z0-9-]+)*)?/,
    );
    const ratingMatch =
      ctx.match(/aria-label="Rated (\d(?:\.\d)?) stars/i) ??
      ctx.match(/>(\d\.\d)<\/span>\s*<span[^>]*>star/i);

    out.push({
      storeId,
      name,
      developer: "",
      icon: iconMatch ? iconMatch[0] : null,
      rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
    });
  }

  // Fallback: just package IDs (in case aria-label changes)
  if (out.length === 0) {
    const idRegex = /\/store\/apps\/details\?id=([a-zA-Z0-9._]+)/g;
    while ((match = idRegex.exec(html)) !== null && out.length < limit) {
      const storeId = match[1];
      if (seen.has(storeId)) continue;
      seen.add(storeId);
      out.push({ storeId, name: storeId, developer: "", icon: null, rating: null });
    }
  }

  return out;
}

export async function searchGooglePlay(query: string, limit = 10): Promise<StoreSearchResult[]> {
  const params = new URLSearchParams({ q: query, c: "apps", hl: "en" });
  const res = await fetch(`${PLAY_STORE_SEARCH_URL}?${params.toString()}`, {
    headers: {
      // Google blocks requests with no/empty UA. Mimic a real browser.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(7000),
  });

  if (!res.ok) {
    throw new Error(`Google Play search failed: ${res.status}`);
  }

  const html = await res.text();
  const parsed = parsePlayHtml(html, limit);
  return parsed.map((p) => ({
    storeId: p.storeId,
    name: p.name,
    developer: p.developer,
    icon: p.icon,
    rating: p.rating,
    url: `https://play.google.com/store/apps/details?id=${p.storeId}`,
  }));
}

// ── Unified entry point ──────────────────────────────────────────────────────

export type StorePlatform = "app-store" | "google-play";

export async function searchStore(
  platform: StorePlatform,
  query: string,
  limit = 10,
): Promise<StoreSearchResult[]> {
  if (!query.trim()) return [];
  if (platform === "app-store") return searchAppStore(query, limit);
  return searchGooglePlay(query, limit);
}

// ── Single-app metadata (icon, lifetime rating, lifetime review count) ───────
//
// Used after a user picks their app to populate apps.icon_url +
// apps.lifetime_rating + apps.lifetime_review_count. Search results don't
// always have the lifetime count — need to fetch the detail page once.
//
// Results are cached in Redis for 6 hours so:
//   1. Onboarding search → onboarding/complete → sync route all hit the same
//      cache entry rather than scraping Play Store / iTunes 3× for one app.
//   2. Daily sync cron gets a fresh scrape (cache expired after 6h) without
//      hammering the store on every manual "Sync now" click.
//
// Cache is best-effort: if Redis is unavailable the scrape runs uncached.

export interface AppMetadata {
  storeId: string;
  name: string;
  developer: string;
  icon: string | null;
  /** Lifetime average rating (matches what users see on the store) */
  rating: number | null;
  /** Lifetime review count (matches what users see on the store) */
  reviewCount: number | null;
}

/** Fetch a Google Play app's metadata from its detail page. */
export async function fetchGooglePlayMetadata(
  packageName: string,
): Promise<AppMetadata | null> {
  const cacheKey = `meta:gplay:${packageName}`;
  try {
    const redis = getRedis();
    if (redis) {
      const cached = await redis.get<AppMetadata>(cacheKey);
      if (cached) return cached;
    }
  } catch {
    // Redis unavailable — proceed uncached
  }

  const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}&hl=en`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const nameMatch =
      html.match(/<title[^>]*>([^<]+?)\s*-\s*Apps on Google Play<\/title>/i) ??
      html.match(/itemprop="name"[^>]*>([^<]+)</i);

    const iconMatch = html.match(
      /https:\/\/play-lh\.googleusercontent\.com\/[A-Za-z0-9_\-=/]+=w(\d+)-h(\d+)/,
    );

    const ratingMatch =
      html.match(/"ratingValue":\s*"?(\d(?:\.\d)?)"?/i) ??
      html.match(/aria-label="(?:Average rating|Rated)\s+(\d(?:\.\d)?)/i);

    const countMatch =
      html.match(/"ratingCount":\s*"?(\d+)"?/i) ??
      html.match(/(\d[\d,]*)\s+reviews?\s*<\//i);

    const result: AppMetadata = {
      storeId: packageName,
      name: nameMatch ? nameMatch[1].trim() : packageName,
      developer: "",
      icon: iconMatch ? iconMatch[0] : null,
      rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
      reviewCount: countMatch ? parseInt(countMatch[1].replace(/,/g, ""), 10) : null,
    };

    try {
      const redis = getRedis();
      if (redis) await redis.setex(cacheKey, META_TTL, result);
    } catch {
      // best-effort — cache miss is fine
    }

    return result;
  } catch {
    return null;
  }
}

/** Fetch an App Store app's metadata via iTunes Lookup. */
export async function fetchAppStoreMetadata(
  bundleId: string,
): Promise<AppMetadata | null> {
  const cacheKey = `meta:appstore:${bundleId}`;
  try {
    const redis = getRedis();
    if (redis) {
      const cached = await redis.get<AppMetadata>(cacheKey);
      if (cached) return cached;
    }
  } catch {
    // Redis unavailable — proceed uncached
  }

  try {
    const url = `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(bundleId)}&country=us`;
    const res = await fetch(url, {
      headers: { "User-Agent": "ReviewBox/1.0 (+https://tryreviewbox.com)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      resultCount: number;
      results: Array<{
        bundleId?: string;
        trackName?: string;
        artistName?: string;
        artworkUrl100?: string;
        artworkUrl512?: string;
        averageUserRating?: number;
        userRatingCount?: number;
      }>;
    };
    const r = json.results?.[0];
    if (!r) return null;

    const result: AppMetadata = {
      storeId: bundleId,
      name: r.trackName ?? bundleId,
      developer: r.artistName ?? "",
      icon: r.artworkUrl512 ?? r.artworkUrl100 ?? null,
      rating: typeof r.averageUserRating === "number" ? r.averageUserRating : null,
      reviewCount: typeof r.userRatingCount === "number" ? r.userRatingCount : null,
    };

    try {
      const redis = getRedis();
      if (redis) await redis.setex(cacheKey, META_TTL, result);
    } catch {
      // best-effort — cache miss is fine
    }

    return result;
  } catch {
    return null;
  }
}

/** Dispatch metadata fetch by platform. */
export async function fetchAppMetadata(
  platform: StorePlatform,
  storeId: string,
): Promise<AppMetadata | null> {
  if (platform === "app-store") return fetchAppStoreMetadata(storeId);
  return fetchGooglePlayMetadata(storeId);
}
