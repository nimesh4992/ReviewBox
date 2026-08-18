import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  APP_HOST_ROBOTS_TXT,
  CRAWLER_FILE_PATHS,
  MARKETING_ONLY_PREFIXES,
  isCrawlerFilePath,
  isMarketingOnlyPath,
} from "@/lib/seo-routes";

/**
 * The indexing contract: which hostname serves which page, to whom.
 *
 * Why a test rather than trusting the code — the defect this guards was
 * invisible to every other check. `/robots.txt` and `/sitemap.xml` were missing
 * from middleware's public-route matcher, so `auth.protect()` served Googlebot
 * a 404 on both files. That type-checked, linted, built, and rendered perfectly
 * for a signed-in human clicking around the site. It was only wrong for a
 * visitor nobody tests as: one with no session. Same family as the placeholder
 * Clerk key in `ci-contract.test.ts` and the missing canonicals in
 * `canonical-contract.test.ts` — correct in every part, wrong in the assembly.
 *
 * Two of these read middleware's SOURCE. That is deliberate. Importing
 * `middleware.ts` boots Clerk, and re-implementing its matcher here would be a
 * copy that can agree with itself while disagreeing with production — which is
 * precisely the failure being guarded against.
 */

const SRC = join(process.cwd(), "src");
const middlewareSource = readFileSync(join(SRC, "middleware.ts"), "utf-8");
const sitemapSource = readFileSync(join(SRC, "app", "sitemap.ts"), "utf-8");

describe("crawler files are reachable without a session", () => {
  it("names robots.txt, sitemap.xml and opengraph-image", () => {
    // Guards the constant itself: a later edit that empties or renames these
    // would otherwise leave every assertion below passing vacuously.
    expect(CRAWLER_FILE_PATHS).toContain("/robots.txt");
    expect(CRAWLER_FILE_PATHS).toContain("/sitemap.xml");
    expect(CRAWLER_FILE_PATHS).toContain("/opengraph-image");
  });

  it("wires those paths into the middleware public-route matcher", () => {
    // The paths must be spread into isPublicRoute, not merely exist in
    // seo-routes.ts. Without this line they fall through to auth.protect().
    expect(middlewareSource).toContain("CRAWLER_FILE_PATHS");
    expect(middlewareSource).toMatch(/\.\.\.CRAWLER_FILE_PATHS/);

    const publicMatcher = middlewareSource.slice(
      middlewareSource.indexOf("const isPublicRoute"),
      middlewareSource.indexOf("const isAppRoute"),
    );
    expect(publicMatcher).toMatch(/\.\.\.CRAWLER_FILE_PATHS/);
  });

  it("does not let the matcher's extension list swallow .txt or .xml", () => {
    // The other half of the original bug. Even listed as public routes, these
    // would never reach a handler if the matcher excluded their extensions —
    // and the exclusion list is a single dense regex nobody re-reads.
    const matcher = middlewareSource.slice(middlewareSource.indexOf("export const config"));
    expect(matcher).not.toMatch(/\btxt\b/);
    expect(matcher).not.toMatch(/\bxml\b/);
  });

  it("matches only the exact crawler paths", () => {
    expect(isCrawlerFilePath("/robots.txt")).toBe(true);
    expect(isCrawlerFilePath("/dashboard")).toBe(false);
    // Not a prefix match: /robots.txt.bak must not inherit public access.
    expect(isCrawlerFilePath("/robots.txt.bak")).toBe(false);
  });
});

describe("the app host tells crawlers to stay out", () => {
  it("disallows everything and advertises no sitemap", () => {
    expect(APP_HOST_ROBOTS_TXT).toMatch(/^User-agent: \*$/m);
    expect(APP_HOST_ROBOTS_TXT).toMatch(/^Disallow: \/$/m);
    // A sitemap on a fully-disallowed host is at best noise, and at worst
    // advertises URLs we just said not to crawl.
    expect(APP_HOST_ROBOTS_TXT).not.toMatch(/Sitemap:/i);
  });

  it("serves that body from middleware before the public-route branch", () => {
    // Ordering is load-bearing. /robots.txt is public on BOTH hosts now, so if
    // this branch ran after the isPublicRoute check the app host would be
    // served the marketing robots.txt — an `Allow: /` over the whole signed-in
    // product, which is worse than the 404 this replaced.
    // Anchor on the branch CONDITION, not on the constant's name. Matching
    // "APP_HOST_ROBOTS_TXT" would find the import statement at the top of the
    // file, which sits before everything — so the assertion would hold no
    // matter where the branch actually lived. Caught by mutation-testing this
    // very check: moving the branch left it green.
    const robotsBranch = middlewareSource.indexOf('nextUrl.pathname === "/robots.txt"');
    const publicBranch = middlewareSource.indexOf("if (isPublicRoute(request))");

    expect(robotsBranch).toBeGreaterThan(-1);
    expect(publicBranch).toBeGreaterThan(-1);
    expect(robotsBranch).toBeLessThan(publicBranch);

    // And the branch must be gated on the app host, or the marketing site
    // would serve `Disallow: /` over itself.
    expect(middlewareSource).toMatch(
      /isAppHost && nextUrl\.pathname === "\/robots\.txt"/,
    );
  });
});

describe("marketing content is canonical to the marketing host", () => {
  it("redirects marketing pages off the app host, permanently", () => {
    expect(middlewareSource).toContain("isMarketingOnlyPath");
    // 301, not the NextResponse default of 307. A temporary redirect does not
    // consolidate ranking signals onto the destination.
    expect(middlewareSource).toMatch(/isMarketingOnlyPath[\s\S]{0,400}?301/);
  });

  it("sends them to www, not the apex, to avoid a second hop", () => {
    expect(middlewareSource).toContain('MARKETING_ORIGIN = "https://www.tryreviewbox.com"');
  });

  it("covers every indexable page in the sitemap", () => {
    // The real regression risk: someone adds a marketing page, lists it in the
    // sitemap, and forgets this list — so the app host keeps serving a
    // duplicate of a page we are actively trying to rank.
    const routes = [...sitemapSource.matchAll(/^\s*url\("([^"]*)"/gm)].map((m) => m[1]);
    expect(routes.length).toBeGreaterThan(15);

    for (const route of routes) {
      // "/" is excluded by design — the app host's root is its own front door
      // and middleware sends it to /sign-in.
      if (route === "/") continue;
      expect(
        isMarketingOnlyPath(route),
        `${route} is in the sitemap but not in MARKETING_ONLY_PREFIXES, so ` +
          `app.tryreviewbox.com${route} still serves a duplicate of it`,
      ).toBe(true);
    }
  });

  it("keeps the app host's own pages off the redirect list", () => {
    // Redirecting these to the marketing site would break sign-in, break
    // Stripe's webhook, and bounce Vercel's cron calls.
    for (const path of [
      "/",
      "/sign-in",
      "/sign-up",
      "/invite/abc123",
      "/dashboard",
      "/settings",
      "/api/stripe/webhook",
      "/api/cron/trial-nudge",
      "/monitoring",
      "/robots.txt",
    ]) {
      expect(isMarketingOnlyPath(path), `${path} must not be redirected`).toBe(false);
    }
  });

  it("matches on path segments, not bare string prefixes", () => {
    expect(isMarketingOnlyPath("/help")).toBe(true);
    expect(isMarketingOnlyPath("/help/ai-replies")).toBe(true);
    // "/helpdesk".startsWith("/help") is true — the bug this shape avoids.
    expect(isMarketingOnlyPath("/helpdesk")).toBe(false);
    expect(isMarketingOnlyPath("/pricing-internal")).toBe(false);
  });

  it("lists no duplicates", () => {
    expect(new Set(MARKETING_ONLY_PREFIXES).size).toBe(MARKETING_ONLY_PREFIXES.length);
  });

  it.each(MARKETING_ONLY_PREFIXES)("%s is also a public route", (prefix) => {
    // The failure this catches is the one that cost this site its robots.txt
    // and sitemap for months: a path in NEITHER middleware matcher does not
    // error, it just falls through to auth.protect() and 404s — but only for
    // visitors with no session. Every developer is signed in, so the page looks
    // perfect right up until Googlebot asks for it.
    //
    // A marketing page can be added to the sitemap, given a canonical, listed
    // here for the app-host redirect, and still be invisible to the entire
    // internet. Nothing but this assertion connects the two lists.
    const publicMatcher = middlewareSource.slice(
      middlewareSource.indexOf("const isPublicRoute"),
      middlewareSource.indexOf("const isAppRoute"),
    );
    expect(
      publicMatcher.includes(`"${prefix}(`) || publicMatcher.includes(`"${prefix}"`),
      `${prefix} is redirected to the marketing host but is not a public route, ` +
        `so signed-out visitors and Googlebot get a 404 instead of the page`,
    ).toBe(true);
  });
});

describe("the signed-in product declares itself unindexable", () => {
  it("does not inherit index,follow from the root layout", () => {
    // The root layout applies to EVERY page including /dashboard. Asserting
    // `index: true` there put the markup in direct conflict with the
    // X-Robots-Tag header middleware sets on the same response.
    const rootLayout = readFileSync(join(SRC, "app", "layout.tsx"), "utf-8");
    const metadataBlock = rootLayout.slice(
      rootLayout.indexOf("export const metadata"),
      rootLayout.indexOf("export default function RootLayout"),
    );
    expect(metadataBlock).not.toMatch(/robots:\s*{/);
  });

  it("marks the (app) and /admin trees noindex in their own markup", () => {
    // Not just via the host header: preview URLs and the apex serve these same
    // routes with no such header.
    for (const layout of [join("(app)", "layout.tsx"), join("admin", "layout.tsx")]) {
      const source = readFileSync(join(SRC, "app", layout), "utf-8");
      expect(source, `${layout} must declare robots metadata`).toMatch(/robots:\s*{/);
      expect(source).toMatch(/index:\s*false/);
      expect(source).toMatch(/follow:\s*false/);
    }
  });
});
