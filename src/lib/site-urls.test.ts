import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appUrl, marketingUrl } from "./site-urls";

const ORIGINAL = { app: process.env.NEXT_PUBLIC_APP_URL, marketing: process.env.NEXT_PUBLIC_MARKETING_URL };

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
    expect(marketingUrl()).toBe("https://tryreviewbox.com");
  });
});

describe("split-domain deployment", () => {
  it("keeps app links and the public identity apart", () => {
    setEnv("https://app.tryreviewbox.com", "https://tryreviewbox.com");
    expect(appUrl()).toBe("https://app.tryreviewbox.com");
    // The whole point: canonical URLs and the sitemap must not claim the
    // marketing pages live behind the app's login.
    expect(marketingUrl()).toBe("https://tryreviewbox.com");
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
    expect(marketingUrl()).toBe("http://localhost:3000");
  });

  it("falls back rather than emitting an empty origin", () => {
    setEnv("   ");
    expect(appUrl()).toBe("https://tryreviewbox.com");
  });
});

describe("nothing configured", () => {
  it("defaults both to the marketing domain", () => {
    expect(appUrl()).toBe("https://tryreviewbox.com");
    expect(marketingUrl()).toBe("https://tryreviewbox.com");
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
      expect(appUrl()).toBe("https://tryreviewbox.com");
      expect(marketingUrl()).toBe("https://tryreviewbox.com");
    });
  }

  it("does not let a bad marketing URL discard a good app URL", () => {
    setEnv("https://app.tryreviewbox.com", '"broken"');
    expect(appUrl()).toBe("https://app.tryreviewbox.com");
    // Marketing falls through to the app URL, not all the way to the default.
    expect(marketingUrl()).toBe("https://app.tryreviewbox.com");
  });

  it("still accepts every good value it accepted before", () => {
    setEnv("https://app.tryreviewbox.com", "tryreviewbox.com");
    expect(appUrl()).toBe("https://app.tryreviewbox.com");
    expect(marketingUrl()).toBe("https://tryreviewbox.com");
  });
});
