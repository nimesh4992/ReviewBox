/**
 * The two URLs this product has, and which one each caller wants.
 *
 * One Next.js deployment serves both the marketing site (`/`, `/pricing`,
 * `/terms`) and the signed-in app (`/dashboard`, `/inbox`). They may live on
 * one domain or two, and `NEXT_PUBLIC_APP_URL` was being used for both jobs:
 *
 *   - links INTO the app — invite links, "open the inbox" buttons, Stripe
 *     return URLs, the Slack OAuth redirect
 *   - the site's public identity — `metadataBase`, `sitemap.xml`, `robots.txt`
 *
 * Those pull in opposite directions the moment the app moves to a subdomain.
 * Setting `NEXT_PUBLIC_APP_URL=https://app.tryreviewbox.com` would have made
 * every canonical URL and every sitemap entry claim the marketing pages live
 * on the app subdomain, which is an SEO own-goal — telling Google the pricing
 * page is at a hostname that redirects users to a login.
 *
 * So: `appUrl()` for anything a signed-in user follows, `marketingUrl()` for
 * anything the public web sees. `NEXT_PUBLIC_MARKETING_URL` falls back to
 * `NEXT_PUBLIC_APP_URL`, so a single-domain setup needs no second variable and
 * behaves exactly as before.
 */

const DEFAULT_MARKETING = "https://tryreviewbox.com";

/**
 * Accept "tryreviewbox.com" as readily as "https://tryreviewbox.com", and
 * refuse to return anything `new URL()` would reject.
 *
 * That last part is not defensiveness for its own sake. `layout.tsx` does
 * `metadataBase: new URL(BASE_URL)` at module scope, so a malformed value here
 * throws while Next is collecting page data and **fails the entire production
 * build** — which is exactly what happened on 2026-08-16: a stray character in
 * `NEXT_PUBLIC_MARKETING_URL` produced
 *
 *     Failed to collect configuration for /_not-found
 *     TypeError: Invalid URL — input: 'https://[SENSITIVE]'
 *
 * and no deploy could go out. A typo in an environment variable should cost
 * the wrong hostname in an email footer, never the ability to ship.
 */
function normalize(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  // Parsing successfully is not enough. `new URL('https://"broken"')` does NOT
  // throw — it yields the hostname `"broken"` — so a value pasted with quotes
  // would sail through and every link we generate would point at a host that
  // does not exist. Checking the hostname shape catches the silent case as
  // well as the throwing one.
  const host = url.hostname;
  if (!host) return null;
  if (!/^[a-z0-9.-]+$/i.test(host)) return null;
  if (host !== "localhost" && !host.includes(".")) return null;

  return withScheme;
}

/** First value that survives normalisation, else the marketing default. */
function firstValid(...candidates: (string | undefined)[]): string {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const normalized = normalize(candidate);
    if (normalized) return normalized;
    console.warn(
      "[site-urls] ignoring a malformed URL environment variable; falling back. " +
        "Check NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_MARKETING_URL for stray quotes or spaces.",
    );
  }
  return DEFAULT_MARKETING;
}

/**
 * Where the signed-in app lives. Everything a logged-in user clicks through to
 * belongs here.
 */
export function appUrl(): string {
  return firstValid(process.env.NEXT_PUBLIC_APP_URL);
}

/**
 * The public marketing origin — canonical URLs, OG images, sitemap, robots,
 * and the brand images in emails (an asset served from behind auth renders as
 * a broken box in every inbox).
 *
 * Falls back to the app URL, so a deployment on a single domain is correct
 * without setting this at all.
 */
export function marketingUrl(): string {
  // Falls through to the app URL when the marketing one is unset OR unusable,
  // so one bad variable cannot take the other's correct value down with it.
  return firstValid(
    process.env.NEXT_PUBLIC_MARKETING_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  );
}
