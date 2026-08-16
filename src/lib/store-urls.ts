/**
 * store-urls.ts
 *
 * Turn a pasted store URL into something we can look up directly.
 *
 * Why this exists: `looksLikeStoreId()` handles a pasted *package name*
 * (`com.mmrda.mumbaione`), but docs/PRODUCT_CONTEXT.md is explicit that many
 * of our customers "do NOT know their package name". What they always have is
 * the page in front of them — the Play Console listing, or the store page in a
 * browser — so the thing they can actually paste is the URL.
 *
 * That matters most exactly when it matters most: Google Play *search* is an
 * unofficial scrape and can be refused outright from a datacenter IP, at which
 * point name search returns nothing no matter what the customer types. A
 * pasted URL skips search entirely and goes straight to the app lookup, which
 * is a different upstream endpoint.
 */

export interface ParsedStoreUrl {
  platform: "google-play" | "app-store";
  /**
   * `package` — a Google Play package name, usable as `apps.store_id` directly.
   * `trackId` — an Apple numeric track ID, which still needs an iTunes lookup
   * to become the bundle ID we store.
   */
  kind: "package" | "trackId";
  value: string;
  /** Storefront from the URL when it carries one ("/in/app/…" or `gl=IN`). */
  country: string | null;
}

/** Accept a bare host or a full URL, with or without a scheme. */
function toUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  for (const candidate of [trimmed, `https://${trimmed}`]) {
    try {
      const u = new URL(candidate);
      if (u.protocol === "http:" || u.protocol === "https:") return u;
    } catch {
      // try the next form
    }
  }
  return null;
}

function normaliseCountry(value: string | null | undefined): string | null {
  const c = (value ?? "").trim().toLowerCase();
  return /^[a-z]{2}$/.test(c) ? c : null;
}

/**
 * Extract a store identifier from a pasted store URL.
 * Returns null for anything that isn't a recognisable store link, so callers
 * can fall through to ordinary text search.
 */
export function parseStoreUrl(input: string): ParsedStoreUrl | null {
  const url = toUrl(input);
  if (!url) return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  // ── Google Play ────────────────────────────────────────────────────────────
  // https://play.google.com/store/apps/details?id=com.mmrda.mumbaione&gl=IN
  if (host === "play.google.com" || host === "play.app.goo.gl") {
    const id = url.searchParams.get("id");
    if (id && /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_-]+)+$/.test(id)) {
      return {
        platform: "google-play",
        kind: "package",
        value: id,
        country: normaliseCountry(url.searchParams.get("gl")),
      };
    }
    return null;
  }

  // ── Apple App Store ────────────────────────────────────────────────────────
  // https://apps.apple.com/in/app/mumbai-one/id6444123456
  // The numeric ID is a track ID, not the bundle ID we store — the caller
  // resolves it through the iTunes lookup endpoint.
  if (host === "apps.apple.com" || host === "itunes.apple.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    const idSegment = segments.find((s) => /^id\d+$/i.test(s));
    const fromPath = idSegment ? idSegment.slice(2) : null;
    // Some share links carry ?id= instead of /idNNNN
    const fromQuery = url.searchParams.get("id");
    const trackId = fromPath ?? (fromQuery && /^\d+$/.test(fromQuery) ? fromQuery : null);
    if (!trackId) return null;

    // The first path segment is the storefront on localized links
    // ("/in/app/…"); on "/app/…" links there is none.
    const maybeCountry = segments[0] && segments[0] !== "app" ? segments[0] : null;

    return {
      platform: "app-store",
      kind: "trackId",
      value: trackId,
      country: normaliseCountry(maybeCountry),
    };
  }

  return null;
}
