/**
 * Which paths crawlers may reach, and which hostname each page belongs to.
 *
 * Background — this shipped wrong and stayed wrong for months.
 *
 * `src/app/robots.ts` and `src/app/sitemap.ts` were written carefully, kept in
 * sync with the route tree, and guarded by `canonical-contract.test.ts`. None
 * of it reached Google. Neither `/robots.txt` nor `/sitemap.xml` was listed in
 * middleware's `isPublicRoute`, and neither `.txt` nor `.xml` appears in the
 * middleware matcher's extension-exclusion list — so both fell through to
 * `auth.protect()` and answered a signed-out visitor with a 404. Verified in
 * production on 2026-08-18:
 *
 *     GET https://www.tryreviewbox.com/robots.txt
 *     → 404, x-clerk-auth-reason: protect-rewrite, session-token-and-uat-missing
 *
 * Googlebot is always a signed-out visitor, so the site had no robots.txt and
 * no readable sitemap on any hostname. Absent robots.txt means "crawl
 * everything", which is how three deleted pages (`/customers`, `/status`,
 * `/compare`) were still ranking after removal — Google found them by link and
 * was never handed a sitemap saying otherwise.
 *
 * The class of defect matters more than the instance: every individual file was
 * correct. The bug lived in the gap between them, where nothing rendered, typed
 * or linted. `seo-indexing-contract.test.ts` is what closes that gap — it
 * asserts these constants are actually wired into the middleware source.
 */

/**
 * Files a crawler fetches directly, which must never be behind auth.
 *
 * `/opengraph-image` is included because it is fetched unauthenticated by every
 * social unfurler (Slack, X, LinkedIn) as well as Google; a 404 there means
 * every shared link renders as a bare grey box.
 */
export const CRAWLER_FILE_PATHS = [
  "/robots.txt",
  "/sitemap.xml",
  "/opengraph-image",
] as const;

export function isCrawlerFilePath(pathname: string): boolean {
  return (CRAWLER_FILE_PATHS as readonly string[]).includes(pathname);
}

/**
 * Marketing content: pages whose canonical home is the marketing host.
 *
 * One deployment serves both hostnames, so every one of these also renders on
 * `app.tryreviewbox.com`, where it is a byte-identical duplicate of the page
 * the marketing host is trying to rank. Middleware 301s them back.
 *
 * Deliberately NOT here:
 *   - `/`            — the app host's root is its front door; middleware already
 *                      sends it to /sign-in, and that behaviour is intentional.
 *   - `/sign-in`, `/sign-up`, `/invite`
 *                    — these belong to the app host. The marketing host sends
 *                      them the other way.
 *   - `/api/*`       — machine callers (Stripe webhooks, Vercel cron) hit
 *                      whichever host they were configured with. Redirecting a
 *                      POST webhook would drop its body.
 *   - `/monitoring`  — Sentry's tunnel route, same reasoning as /api.
 *
 * An entry here must also be a public route in middleware, or the redirect is
 * unreachable behind `auth.protect()`. The contract test asserts both.
 */
export const MARKETING_ONLY_PREFIXES = [
  "/pricing",
  "/about",
  "/blog",
  "/changelog",
  "/contact",
  "/faq",
  "/help",
  "/privacy",
  "/terms",
  "/dpa",
  "/cookies",
  "/acceptable-use",
  "/refund",
  "/refund-policy",
  "/grievance",
  "/sub-processors",
  "/security",
] as const;

/**
 * Prefix match on a path SEGMENT, never a bare `startsWith`.
 *
 * `"/help-me".startsWith("/help")` is true, and a future `/refunds-explained`
 * would be captured by `/refund`. Matching `=== prefix || startsWith(prefix +
 * "/")` keeps `/help/ai-replies` in and `/helpdesk` out.
 */
export function isMarketingOnlyPath(pathname: string): boolean {
  return (MARKETING_ONLY_PREFIXES as readonly string[]).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * The app host's robots.txt, served from middleware rather than `robots.ts`.
 *
 * `robots.ts` is a single static metadata route with no knowledge of the host
 * it is answering, and Next pre-renders it at build time — so both hostnames
 * would be served one cached body. Whichever one that turned out to be, one
 * host would be wrong, and the failure is invisible: robots.txt 200s either
 * way. Middleware sees the Host header on every request and cannot be cached
 * across hosts, so the app host's answer is generated where the question is
 * actually known.
 *
 * No `Sitemap:` line: the sitemap describes the marketing host, and pointing at
 * it from a fully-disallowed host is at best noise.
 *
 * Safe to disallow wholesale only because nothing on this host is indexed —
 * Semrush shows zero ranking URLs on app.tryreviewbox.com. Where pages ARE
 * already indexed, `Disallow` is the wrong tool: it blocks the crawl, so Google
 * never sees the `noindex` telling it to drop them, and the stale URLs sit in
 * the index as "Indexed, though blocked by robots.txt". Deindex first, block
 * afterwards.
 */
export const APP_HOST_ROBOTS_TXT = "User-agent: *\nDisallow: /\n";
