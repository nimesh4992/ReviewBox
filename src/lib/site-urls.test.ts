import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appUrl, marketingUrl } from "./site-urls";

const ORIGINAL = { app: process.env.NEXT_PUBLIC_APP_URL, marketing: process.env.NEXT_PUBLIC_MARKETING_URL };

/**
 * `www.` is the canonical marketing origin as of 2026-08-18. Vercel 308s the
 * apex to www and Google has indexed www, so a canonical naming the apex points
 * at a redirect. `marketingUrl()` now normalises to this; `appUrl()` does not,
 * because it answers a different question — where the product lives.
 */
const CANONICAL = "https://www.tryreviewbox.com";

function setEnv(app?: string, marketing?: string) {
  if (app === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = app;
  if (marketing === undefined) delete process.env.NEXT_PUBLIC_MARKETING_URL;
  else process.env.NEXT_PUBLIC_MARKETING_URL = marketing;
}

beforeEach(() => setEnv(undefined, undefined));
afterEach(() => setEnv(ORIGINAL.app, ORIGINAL.marketing));

describe("single-domain deployment", () => {
  it("uses the one URL for both jobs, with no second variable needed", () => {
    setEnv("https://tryreviewbox.com");
    expect(appUrl()).toBe("https://tryreviewbox.com");
    // Upgraded to www: this value becomes every canonical tag, and the apex
    // redirects. The app URL is left exactly as configured.
    expect(marketingUrl()).toBe(CANONICAL);
  });
});

describe("split-domain deployment", () => {
  it("keeps app links and the public identity apart", () => {
    setEnv("https://app.tryreviewbox.com", "https://tryreviewbox.com");
    expect(appUrl()).toBe("https://app.tryreviewbox.com");
    // The whole point: canonical URLs and the sitemap must not claim the
    // marketing pages live behind the app's login.
    expect(marketingUrl()).toBe(CANONICAL);
  });

  it("accepts the canonical www value unchanged", () => {
    setEnv("https://app.tryreviewbox.com", CANONICAL);
    expect(marketingUrl()).toBe(CANONICAL);
  });
});

describe("normalisation", () => {
  it("accepts a bare hostname", () => {
    setEnv("app.tryreviewbox.com");
    expect(appUrl()).toBe("https://app.tryreviewbox.com");
  });

  it("strips trailing slashes so callers can concatenate paths safely", () => {
    setEnv("https://tryreviewbox.com///");
    expect(appUrl()).toBe("https://tryreviewbox.com");
  });

  it("leaves a localhost URL and its scheme alone", () => {
    setEnv("http://localhost:3000");
    expect(appUrl()).toBe("http://localhost:3000");
    // Canonicalisation is scoped to the two production hostnames by exact
    // match, so local development is untouched.
    expect(marketingUrl()).toBe("http://localhost:3000");
  });

  it("leaves preview and unrelated hostnames alone", () => {
    setEnv("https://reviewbox-git-master-amnexweb.vercel.app");
    expect(marketingUrl()).toBe("https://reviewbox-git-master-amnexweb.vercel.app");
  });

  it("falls back rather than emitting an empty origin", () => {
    setEnv("   ");
    expect(appUrl()).toBe(CANONICAL);
  });
});

describe("nothing configured", () => {
  it("defaults both to the marketing domain", () => {
    expect(appUrl()).toBe(CANONICAL);
    expect(marketingUrl()).toBe(CANONICAL);
  });
});

describe("the marketing origin is never the app host", () => {
  /**
   * `marketingUrl()` falls back to NEXT_PUBLIC_APP_URL, which in production is
   * app.tryreviewbox.com — a host whose entire robots.txt is `Disallow: /`.
   * Left unguarded, forgetting NEXT_PUBLIC_MARKETING_URL in Vercel would point
   * every canonical tag, sitemap entry and og:url at a hostname Google is
   * forbidden to crawl, asking it to drop the marketing site outright.
   *
   * This is the exact own-goal `site-urls.ts`'s header comment warns about, and
   * it was reachable through the fallback that same comment describes.
   */
  it("refuses the app host even when it is the only value configured", () => {
    setEnv("https://app.tryreviewbox.com");
    expect(appUrl()).toBe("https://app.tryreviewbox.com");
    expect(marketingUrl()).toBe(CANONICAL);
  });

  it("refuses the app host set explicitly as the marketing URL", () => {
    setEnv("https://app.tryreviewbox.com", "https://app.tryreviewbox.com");
    expect(marketingUrl()).toBe(CANONICAL);
  });
});

describe("malformed values never reach new URL()", () => {
  // layout.tsx does `metadataBase: new URL(BASE_URL)` at module scope. A value
  // that throws there fails "Collecting page data" and kills the whole
  // production build — which is precisely what a stray pair of quotes in
  // NEXT_PUBLIC_MARKETING_URL did on 2026-08-16.
  const junk = [
    '"https://tryreviewbox.com"',   // pasted with quotes
    "https://tryreviewbox.com, https://app.tryreviewbox.com", // two values in one
    "https://",                      // scheme, no host
    "http://",
    "://tryreviewbox.com",
    "https:// tryreviewbox.com",     // space inside
  ];

  for (const value of junk) {
    it(`falls back rather than throwing for ${JSON.stringify(value)}`, () => {
      setEnv(value, value);
      expect(() => new URL(appUrl())).not.toThrow();
      expect(() => new URL(marketingUrl())).not.toThrow();
      expect(appUrl()).toBe(CANONICAL);
      expect(marketingUrl()).toBe(CANONICAL);
    });
  }

  it("does not let a bad marketing URL discard a good app URL", () => {
    setEnv("https://app.tryreviewbox.com", '"broken"');
    expect(appUrl()).toBe("https://app.tryreviewbox.com");
    // Marketing falls through to the app URL — and is then corrected, because
    // the app host must never become the site's public identity.
    expect(marketingUrl()).toBe(CANONICAL);
  });

  it("still accepts every good value it accepted before", () => {
    setEnv("https://app.tryreviewbox.com", "tryreviewbox.com");
    expect(appUrl()).toBe("https://app.tryreviewbox.com");
    expect(marketingUrl()).toBe(CANONICAL);
  });
});
