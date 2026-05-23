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
 * Looks for app rows in the embedded JSON blob (AF_initDataCallback) and falls
 * back to scanning for `/store/apps/details?id=` links if that fails.
 */
function parsePlayHtml(html: string, limit: number): ScrapedPlayResult[] {
  const out: ScrapedPlayResult[] = [];
  const seen = new Set<string>();

  // Primary: extract package names + names from anchor tags. Play renders
  // <a href="/store/apps/details?id=PACKAGE" aria-label="NAME">.
  const anchorRegex =
    /href="\/store\/apps\/details\?id=([a-zA-Z0-9._]+)(?:&[^"]*)?"\s+aria-label="([^"]+)"/g;
  let match;
  while ((match = anchorRegex.exec(html)) !== null && out.length < limit) {
    const storeId = match[1];
    const name = match[2];
    if (seen.has(storeId)) continue;
    seen.add(storeId);
    out.push({ storeId, name, developer: "", icon: null, rating: null });
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
