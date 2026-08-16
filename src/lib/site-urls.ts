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

/** Accept "tryreviewbox.com" as readily as "https://tryreviewbox.com". */
function normalize(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_MARKETING;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Where the signed-in app lives. Everything a logged-in user clicks through to
 * belongs here.
 */
export function appUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  return raw ? normalize(raw) : DEFAULT_MARKETING;
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
  const raw = process.env.NEXT_PUBLIC_MARKETING_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  return raw ? normalize(raw) : DEFAULT_MARKETING;
}
