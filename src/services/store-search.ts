/**
 * store-search.ts
 *
 * Finds apps on the public App Store and Google Play storefronts, and reads
 * their public metadata (icon, lifetime rating, lifetime review count).
 * Used by onboarding so users pick their app from real results instead of
 * typing a package name from memory.
 *
 * Two production failures shaped this file — see the notes at each fix:
 *
 * 1. Google Play search was a hand-rolled regex over the search page HTML.
 *    Google rotated the markup, the `aria-label` pattern stopped matching,
 *    and the code silently fell through to a "bare package IDs" path — so
 *    searching "Mumbai One" returned four unrelated apps listed by raw
 *    package name. Search now goes through google-play-scraper, which tracks
 *    Google's internal payloads; the HTML scrape survives only as a
 *    last-resort fallback, and never emits a row without a real app name.
 *
 * 2. Every call was hardcoded to the US storefront. Regional apps are simply
 *    absent there — an India-only app could not be found at all, and even
 *    when added by package name its reviews came back empty forever. We now
 *    search several storefronts and remember which one matched.
 */

import { Redis } from "@upstash/redis";

import gplay, { developerName } from "@/services/gplay-client";
import {
  DEFAULT_STOREFRONT,
  looksLikeStoreId,
  normalizeStorefront,
  searchStorefronts,
} from "@/lib/storefronts";
import { parseStoreUrl, type ParsedStoreUrl } from "@/lib/store-urls";

// ── Redis singleton (best-effort — null if env vars not set) ─────────────────

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!_redis) _redis = new Redis({ url, token });
  return _redis;
}

// @assumption A 6-hour-old rating is fresh enough to show as current | risk: after a rating spike the dashboard contradicts the store for up to 6 hours
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
  /** Storefront this result came from — persisted so we sync the right one */
  country: string;
}

export type StorePlatform = "app-store" | "google-play";

const APP_STORE_SEARCH_URL = "https://itunes.apple.com/search";
const APP_STORE_LOOKUP_URL = "https://itunes.apple.com/lookup";
const PLAY_STORE_SEARCH_URL = "https://play.google.com/store/search";

/**
 * Merge results from several storefronts: first occurrence of a store ID
 * wins (storefronts are passed in priority order), capped at `limit`.
 */
export function mergeStoreResults(
  groups: Array<StoreSearchResult[] | null | undefined>,
  limit: number,
): StoreSearchResult[] {
  const seen = new Set<string>();
  const out: StoreSearchResult[] = [];
  for (const group of groups) {
    for (const row of group ?? []) {
      if (!row.storeId || seen.has(row.storeId)) continue;
      seen.add(row.storeId);
      out.push(row);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// ── App Store (iTunes Search API) ────────────────────────────────────────────

interface ItunesResult {
  bundleId?: string;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  artworkUrl512?: string;
  averageUserRating?: number;
  userRatingCount?: number;
  trackViewUrl?: string;
}

interface ItunesResponse {
  resultCount: number;
  results: ItunesResult[];
}

function itunesToResult(r: ItunesResult, country: string): StoreSearchResult {
  return {
    storeId: r.bundleId!,
    name: r.trackName!,
    developer: r.artistName ?? "",
    icon: r.artworkUrl512 ?? r.artworkUrl100 ?? null,
    rating: typeof r.averageUserRating === "number" ? r.averageUserRating : null,
    url: r.trackViewUrl ?? `https://apps.apple.com/app/id${r.bundleId}`,
    country,
  };
}

async function searchAppStoreIn(
  query: string,
  limit: number,
  country: string,
): Promise<StoreSearchResult[]> {
  const params = new URLSearchParams({
    term: query,
    country,
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
    .map((r) => itunesToResult(r, country));
}

export async function searchAppStore(
  query: string,
  limit = 10,
  countries: string[] = searchStorefronts(),
): Promise<StoreSearchResult[]> {
  const settled = await Promise.allSettled(
    countries.map((c) => searchAppStoreIn(query, limit, c)),
  );

  const merged = mergeStoreResults(
    settled.map((s) => (s.status === "fulfilled" ? s.value : null)),
    limit,
  );
  if (merged.length) return merged;

  // Distinguish "no matches anywhere" from "every storefront errored" — the
  // caller turns the latter into a visible "search unavailable" hint.
  if (settled.every((s) => s.status === "rejected")) {
    throw settled[0]?.status === "rejected"
      ? (settled[0].reason as Error)
      : new Error("App Store search failed");
  }
  return [];
}

// ── Google Play (google-play-scraper, HTML scrape as fallback) ───────────────

async function searchGooglePlayIn(
  query: string,
  limit: number,
  country: string,
): Promise<StoreSearchResult[]> {
  const results = await gplay.search({
    term: query,
    num: Math.min(limit, 30),
    lang: "en",
    country,
    throttle: 10,
  });

  return (results ?? [])
    .filter((r) => r.appId && r.title)
    .map((r) => ({
      storeId: r.appId,
      name: r.title!,
      developer: developerName(r.developer),
      icon: r.icon ?? null,
      rating: typeof r.score === "number" ? r.score : null,
      url: r.url ?? `https://play.google.com/store/apps/details?id=${r.appId}`,
      country,
    }));
}

/**
 * Extract apps from a Play Store search HTML page.
 *
 * Last-resort fallback only — used when google-play-scraper itself fails
 * (library outage / upstream shape change). Exported for tests.
 *
 * Rows without a real app name are DROPPED. The previous version pushed
 * `name: storeId` for every `/store/apps/details?id=` link on the page,
 * which is how users ended up staring at a list of unrelated apps labelled
 * `com.onewaycab`, `rs.webrest.ar` … when the primary pattern broke. An
 * empty result that says "search unavailable, paste your package ID" is far
 * better than a confident list of wrong answers.
 */
export function parsePlayHtml(html: string, limit: number): StoreSearchResult[] {
  const out: StoreSearchResult[] = [];
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
      url: `https://play.google.com/store/apps/details?id=${storeId}`,
      country: DEFAULT_STOREFRONT,
    });
  }

  return out;
}

async function searchGooglePlayViaHtml(
  query: string,
  limit: number,
  country: string,
): Promise<StoreSearchResult[]> {
  const params = new URLSearchParams({ q: query, c: "apps", hl: "en", gl: country });
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

  return parsePlayHtml(await res.text(), limit).map((r) => ({ ...r, country }));
}

export async function searchGooglePlay(
  query: string,
  limit = 10,
  countries: string[] = searchStorefronts(),
): Promise<StoreSearchResult[]> {
  const settled = await Promise.allSettled(
    countries.map((c) => searchGooglePlayIn(query, limit, c)),
  );

  const merged = mergeStoreResults(
    settled.map((s) => (s.status === "fulfilled" ? s.value : null)),
    limit,
  );
  if (merged.length) return merged;

  // Nothing came back. Only call that a genuine "no matches" when EVERY
  // storefront answered cleanly — if any of them errored, the empty result is
  // unexplained and the HTML fallback below is still worth a try. Returning []
  // as soon as one storefront happened to succeed-empty meant a partly-blocked
  // search was reported to the customer as "your app doesn't exist".
  if (settled.every((s) => s.status === "fulfilled")) return [];

  for (const s of settled) {
    if (s.status === "rejected") {
      console.warn(
        "[store-search] gplay search failed:",
        s.reason instanceof Error ? s.reason.message : s.reason,
      );
    }
  }

  // Every storefront errored — try the raw page once before giving up.
  return searchGooglePlayViaHtml(query, limit, countries[0] ?? DEFAULT_STOREFRONT);
}

// ── Pasted-URL resolution ────────────────────────────────────────────────────

/**
 * Turn a parsed store URL into a single search result.
 *
 * Google Play URLs carry the package name directly, so this is just a metadata
 * lookup. Apple URLs carry a numeric *track* ID, but `apps.store_id` holds the
 * *bundle* ID — so that needs one iTunes lookup to translate before we can
 * store it.
 */
async function resolvePastedStoreUrl(
  parsed: ParsedStoreUrl,
): Promise<StoreSearchResult | null> {
  if (parsed.kind === "package") {
    const meta = parsed.country
      ? await fetchAppMetadata("google-play", parsed.value, parsed.country)
      : await findAppAcrossStorefronts("google-play", parsed.value);
    if (!meta) return null;
    return {
      storeId:   meta.storeId,
      name:      meta.name,
      developer: meta.developer,
      icon:      meta.icon,
      rating:    meta.rating,
      url:       `https://play.google.com/store/apps/details?id=${meta.storeId}`,
      country:   meta.country,
    };
  }

  // Apple: numeric track ID → bundle ID.
  const country = parsed.country ?? DEFAULT_STOREFRONT;
  const res = await fetch(
    `${APP_STORE_LOOKUP_URL}?id=${encodeURIComponent(parsed.value)}&country=${country}`,
    {
      headers: { "User-Agent": "ReviewBox/1.0 (+https://tryreviewbox.com)" },
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!res.ok) throw new Error(`iTunes lookup failed: ${res.status}`);

  const json = (await res.json()) as ItunesResponse;
  const hit = json.results?.[0];
  if (!hit?.bundleId || !hit.trackName) return null;

  return itunesToResult(hit, country);
}

// ── Unified entry point ──────────────────────────────────────────────────────

export async function searchStore(
  platform: StorePlatform,
  query: string,
  limit = 10,
): Promise<StoreSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // A pasted store URL resolves directly, before any text search.
  //
  // This is the escape hatch when name search is unavailable: Google Play
  // search is an unofficial scrape and can be refused outright from a
  // datacenter IP, in which case NO app name will ever return a result. The
  // app lookup behind a URL is a different endpoint and can still work. It is
  // also the path our ICP can actually follow — PRODUCT_CONTEXT says they
  // often don't know their package name, but they always have the store page.
  const parsedUrl = parseStoreUrl(trimmed);
  if (parsedUrl && parsedUrl.platform === platform) {
    try {
      const resolved = await resolvePastedStoreUrl(parsedUrl);
      if (resolved) return [resolved];
    } catch {
      // Fall through to text search — a failed lookup is not fatal.
    }
  }

  // The search box tells users they can paste a bundle/package ID, but a
  // pasted ID is not an app NAME and text search finds nothing for it. Look
  // it up directly across storefronts first.
  if (looksLikeStoreId(trimmed)) {
    try {
      const meta = await findAppAcrossStorefronts(platform, trimmed);
      if (meta) {
        return [
          {
            storeId: meta.storeId,
            name: meta.name,
            developer: meta.developer,
            icon: meta.icon,
            rating: meta.rating,
            url:
              platform === "google-play"
                ? `https://play.google.com/store/apps/details?id=${meta.storeId}`
                : `https://apps.apple.com/app/${meta.storeId}`,
            country: meta.country,
          },
        ];
      }
    } catch {
      // Fall through to text search — a failed direct lookup is not fatal.
    }
  }

  if (platform === "app-store") return searchAppStore(trimmed, limit);
  return searchGooglePlay(trimmed, limit);
}

// ── Single-app metadata (icon, lifetime rating, lifetime review count) ───────
//
// Used after a user picks their app to populate apps.icon_url +
// apps.lifetime_rating + apps.lifetime_review_count.
//
// Cached in Redis for 6 hours, keyed by storeId AND country, so onboarding
// search → onboarding complete → sync share one scrape rather than hitting
// the store three times for one app.

export interface AppMetadata {
  storeId: string;
  name: string;
  developer: string;
  icon: string | null;
  /** Lifetime average rating (matches what users see on the store) */
  rating: number | null;
  /** Lifetime review count (matches what users see on the store) */
  reviewCount: number | null;
  /** Storefront this metadata came from */
  country: string;
}

async function readCache(key: string): Promise<AppMetadata | null> {
  try {
    const redis = getRedis();
    if (redis) return await redis.get<AppMetadata>(key);
  } catch {
    // Redis unavailable — proceed uncached
  }
  return null;
}

async function writeCache(key: string, value: AppMetadata): Promise<void> {
  try {
    const redis = getRedis();
    if (redis) await redis.setex(key, META_TTL, value);
  } catch {
    // best-effort — a cache miss is fine
  }
}

/** Fetch a Google Play app's metadata from its listing. */
export async function fetchGooglePlayMetadata(
  packageName: string,
  country: string = DEFAULT_STOREFRONT,
): Promise<AppMetadata | null> {
  const store = normalizeStorefront(country);
  const cacheKey = `meta:gplay:${store}:${packageName}`;
  const cached = await readCache(cacheKey);
  if (cached) return cached;

  // Primary: the maintained scraper library.
  try {
    const app = await gplay.app({ appId: packageName, lang: "en", country: store });
    if (app?.appId) {
      const result: AppMetadata = {
        storeId: packageName,
        name: app.title ?? packageName,
        developer: developerName(app.developer),
        icon: app.icon ?? null,
        rating: typeof app.score === "number" ? app.score : null,
        reviewCount:
          typeof app.ratings === "number"
            ? app.ratings
            : typeof app.reviews === "number"
              ? app.reviews
              : null,
        country: store,
      };
      await writeCache(cacheKey, result);
      return result;
    }
  } catch {
    // Fall through to the raw listing scrape.
  }

  const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}&hl=en&gl=${store}`;
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

    // A listing page that yields no name AND no rating is almost certainly a
    // "not available in this country" page — report it as a miss so the
    // caller keeps looking in other storefronts.
    if (!nameMatch && !ratingMatch) return null;

    const result: AppMetadata = {
      storeId: packageName,
      name: nameMatch ? nameMatch[1].trim() : packageName,
      developer: "",
      icon: iconMatch ? iconMatch[0] : null,
      rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
      reviewCount: countMatch ? parseInt(countMatch[1].replace(/,/g, ""), 10) : null,
      country: store,
    };

    await writeCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

/** Fetch an App Store app's metadata via iTunes Lookup. */
export async function fetchAppStoreMetadata(
  bundleId: string,
  country: string = DEFAULT_STOREFRONT,
): Promise<AppMetadata | null> {
  const store = normalizeStorefront(country);
  const cacheKey = `meta:appstore:${store}:${bundleId}`;
  const cached = await readCache(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(bundleId)}&country=${store}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "ReviewBox/1.0 (+https://tryreviewbox.com)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ItunesResponse;
    const r = json.results?.[0];
    if (!r) return null;

    const result: AppMetadata = {
      storeId: bundleId,
      name: r.trackName ?? bundleId,
      developer: r.artistName ?? "",
      icon: r.artworkUrl512 ?? r.artworkUrl100 ?? null,
      rating: typeof r.averageUserRating === "number" ? r.averageUserRating : null,
      reviewCount: typeof r.userRatingCount === "number" ? r.userRatingCount : null,
      country: store,
    };

    await writeCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

/** Dispatch metadata fetch by platform. */
export async function fetchAppMetadata(
  platform: StorePlatform,
  storeId: string,
  country: string = DEFAULT_STOREFRONT,
): Promise<AppMetadata | null> {
  if (platform === "app-store") return fetchAppStoreMetadata(storeId, country);
  return fetchGooglePlayMetadata(storeId, country);
}

/**
 * Find an app in whichever storefront actually carries it.
 *
 * Regional apps are absent from the US storefront entirely, so a single
 * US lookup returns null and the app looks nonexistent. Tries storefronts in
 * priority order and reports which one matched, so we can persist it on the
 * app row and sync the right country from then on.
 */
export async function findAppAcrossStorefronts(
  platform: StorePlatform,
  storeId: string,
  countries: string[] = searchStorefronts(),
): Promise<AppMetadata | null> {
  for (const country of countries) {
    const meta = await fetchAppMetadata(platform, storeId, country);
    // A hit with neither a rating nor a real name is a placeholder page;
    // keep looking rather than locking the app to a dead storefront.
    if (meta && (meta.rating !== null || meta.name !== storeId)) return meta;
  }
  return null;
}

/**
 * Metadata for an app we're about to persist.
 *
 * `preferred` is the storefront the client observed at search time — cheap to
 * confirm, and it avoids probing every storefront again. Falls back to a full
 * probe when it's absent or turns out to be wrong.
 */
export async function resolveAppMetadata(
  platform: StorePlatform,
  storeId: string,
  preferred?: string | null,
): Promise<AppMetadata | null> {
  if (preferred) {
    const meta = await fetchAppMetadata(platform, storeId, normalizeStorefront(preferred));
    if (meta && (meta.rating !== null || meta.name !== storeId)) return meta;
  }
  return findAppAcrossStorefronts(platform, storeId);
}
