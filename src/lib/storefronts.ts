/**
 * storefronts.ts
 *
 * Which country storefronts we search and scrape.
 *
 * Every store call used to be hardcoded to `country: "us"`. That silently
 * broke the product for regional apps: an India-only app (say an MMRDA
 * transit app) does not appear in US search results at all, and its reviews
 * cannot be scraped from the US storefront — so the app was unfindable during
 * onboarding, and even when added by package name its review sync came back
 * empty forever.
 *
 * So: search a small set of storefronts, remember which one the app was
 * actually found in (`apps.store_country`), and use that one for its reviews
 * and metadata from then on.
 */

/** Fallback when we don't know an app's storefront yet. */
export const DEFAULT_STOREFRONT = "us";

/**
 * Storefronts searched, in priority order. Tunable without a deploy via
 * STORE_SEARCH_COUNTRIES (comma-separated ISO-3166 alpha-2 codes).
 *
 * Kept short on purpose — each entry is one more upstream request per search
 * keystroke-batch, and the store rate-limits datacenter IPs.
 */
export function searchStorefronts(): string[] {
  const raw = process.env.STORE_SEARCH_COUNTRIES;
  const parsed = (raw ?? "us,in,gb")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c) => /^[a-z]{2}$/.test(c));
  return parsed.length ? [...new Set(parsed)] : [DEFAULT_STOREFRONT];
}

/** Normalize a stored/user-supplied country to a usable storefront code. */
export function normalizeStorefront(value: string | null | undefined): string {
  const c = (value ?? "").trim().toLowerCase();
  return /^[a-z]{2}$/.test(c) ? c : DEFAULT_STOREFRONT;
}

/**
 * Does this query look like a package name / bundle ID rather than an app
 * name? The onboarding search box explicitly invites "paste the
 * bundle/package ID", but the old implementation only ever did a text search
 * — pasting `com.mmrda.mumbaione` searched for that string as a NAME and
 * found nothing.
 *
 * Deliberately strict: at least two dot-separated segments, no whitespace.
 * A false positive is cheap (we fall through to text search) but a false
 * negative means the paste path stays broken.
 */
export function looksLikeStoreId(query: string): boolean {
  const q = query.trim();
  if (!q || /\s/.test(q)) return false;
  return /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_-]+)+$/.test(q);
}
