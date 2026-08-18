import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every URL we put in the sitemap must declare its own canonical.
 *
 * Background — this shipped wrong and no check could see it.
 *
 * One deployment serves two hostnames. `tryreviewbox.com` is the public site;
 * `app.tryreviewbox.com` is the product, and middleware marks its public
 * routes `X-Robots-Tag: noindex`. `www.` is normalised for routing decisions
 * but never redirected, so it is a third hostname serving byte-identical HTML.
 * Add trailing slashes and query strings and one page has several addresses.
 *
 * A canonical tag is what collapses all of them onto one URL. We had exactly
 * one — on `/`. The other twenty-one indexable pages had none, so each variant
 * was free to be indexed as its own page and the ranking signals for, say, the
 * pricing page were split across however many spellings Google found. On a
 * domain with near-zero authority there is nothing to spare for that.
 *
 * Why a test and not just a fix: nothing else can catch the regression.
 * A page with no `alternates.canonical` type-checks, lints, builds, renders
 * perfectly, and passes every accessibility and contrast check. It is only
 * wrong in aggregate, months later, in a tool nobody runs on a pull request.
 * The same class of invisible-until-aggregated defect as the placeholder Clerk
 * key in `ci-contract.test.ts` and the unscoped palette in
 * `marketing-shell-contract.test.ts`.
 *
 * If you add a page to `sitemap.ts`, add `alternates: { canonical: "<path>" }`
 * to its metadata. If a page should not be canonical to itself — a paginated
 * or filtered view pointing at its parent — this test is the place to record
 * the exception, deliberately, rather than by omission.
 */

const APP_DIR = join(process.cwd(), "src", "app");

/** The literal paths passed to `url(...)` in sitemap.ts, in file order. */
function sitemapRoutes(): string[] {
  const source = readFileSync(join(APP_DIR, "sitemap.ts"), "utf-8");
  const body = source.slice(source.indexOf("export default function sitemap"));
  return [...body.matchAll(/^\s*url\("([^"]*)"/gm)].map((m) => m[1]);
}

/**
 * Read by file rather than by rendering. These are server components in a Next
 * app; standing up the router to read a metadata export would cost far more
 * than it proves, and the failure being guarded against is a missing line of
 * source, which the source shows directly.
 */
function pageSourceFor(route: string): string {
  const rel = route === "/" ? "page.tsx" : join(route.slice(1), "page.tsx");
  return readFileSync(join(APP_DIR, rel), "utf-8");
}

describe("every sitemap URL declares its own canonical", () => {
  const routes = sitemapRoutes();

  it("finds the sitemap's routes at all", () => {
    // Guards the regex above: if `url(...)` is ever refactored into another
    // shape this test would otherwise pass by examining nothing, which is the
    // silent-success failure mode CLAUDE.md calls out for the e2e job.
    expect(routes.length).toBeGreaterThan(15);
    expect(routes).toContain("/");
    expect(routes).toContain("/pricing");
  });

  it.each(routes)("%s", (route) => {
    const source = pageSourceFor(route);
    expect(source).toMatch(/alternates:\s*{[^}]*canonical:/);
    // The canonical must name this route, not merely exist. A copy-pasted
    // metadata block pointing every help article at "/help" would otherwise
    // pass, and would be worse than no canonical at all — it de-indexes the
    // pages it names.
    expect(source).toContain(`canonical: "${route}"`);
  });

  it("does not advertise URLs that redirect to the noindexed app host", () => {
    // middleware.ts sends /sign-in and /sign-up on the marketing host to
    // app.tryreviewbox.com, where every public route carries
    // `X-Robots-Tag: noindex, nofollow`.
    expect(routes).not.toContain("/sign-in");
    expect(routes).not.toContain("/sign-up");
  });
});
