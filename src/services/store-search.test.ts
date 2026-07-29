import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// google-play-scraper is mocked: these tests must never touch the network,
// and the library is the primary Play Store path.
const gplaySearch = vi.fn();
const gplayApp    = vi.fn();

vi.mock("@/services/gplay-client", () => ({
  default: {
    search: (opts: unknown) => gplaySearch(opts),
    app:    (opts: unknown) => gplayApp(opts),
    reviews: vi.fn(),
    sort: { NEWEST: 2, RATING: 3, HELPFULNESS: 1 },
  },
  developerName: (v: unknown) =>
    typeof v === "string" ? v : ((v as { devId?: string })?.devId ?? ""),
}));

import {
  mergeStoreResults,
  parsePlayHtml,
  searchAppStore,
  searchGooglePlay,
  searchStore,
  type StoreSearchResult,
} from "./store-search";
import { looksLikeStoreId, normalizeStorefront } from "@/lib/storefronts";

const originalFetch = global.fetch;

function itunesResponse(results: unknown[]) {
  return {
    ok: true,
    json: async () => ({ resultCount: results.length, results }),
  } as unknown as Response;
}

beforeEach(() => {
  gplaySearch.mockReset();
  gplayApp.mockReset();
  process.env.STORE_SEARCH_COUNTRIES = "us,in";
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  delete process.env.STORE_SEARCH_COUNTRIES;
});

describe("looksLikeStoreId", () => {
  it("recognizes pasted package names and bundle IDs", () => {
    // The search box invites "paste the bundle/package ID" — before this,
    // pasting one searched for it as a NAME and found nothing.
    expect(looksLikeStoreId("com.mmrda.mumbaione")).toBe(true);
    expect(looksLikeStoreId("com.whatsapp")).toBe(true);
    expect(looksLikeStoreId("  com.spotify.music  ")).toBe(true);
  });

  it("does not mistake app names for IDs", () => {
    expect(looksLikeStoreId("Mumbai One")).toBe(false);
    expect(looksLikeStoreId("Spotify")).toBe(false);
    expect(looksLikeStoreId("uber eats")).toBe(false);
    expect(looksLikeStoreId("")).toBe(false);
  });
});

describe("normalizeStorefront", () => {
  it("accepts two-letter codes and falls back to us", () => {
    expect(normalizeStorefront("IN")).toBe("in");
    expect(normalizeStorefront(null)).toBe("us");
    expect(normalizeStorefront("not-a-country")).toBe("us");
  });
});

describe("mergeStoreResults", () => {
  const row = (storeId: string, country = "us"): StoreSearchResult => ({
    storeId, name: storeId, developer: "", icon: null, rating: null,
    url: "", country,
  });

  it("keeps the first storefront's copy of a duplicate app", () => {
    const merged = mergeStoreResults(
      [[row("com.a", "us")], [row("com.a", "in"), row("com.b", "in")]],
      10,
    );
    expect(merged.map((r) => [r.storeId, r.country])).toEqual([
      ["com.a", "us"],
      ["com.b", "in"],
    ]);
  });

  it("respects the limit and tolerates null groups", () => {
    expect(
      mergeStoreResults([null, [row("com.a"), row("com.b")], undefined], 1),
    ).toHaveLength(1);
  });
});

describe("searchGooglePlay", () => {
  it("returns library results and records the storefront they came from", async () => {
    gplaySearch.mockImplementation(async ({ country }: { country: string }) =>
      country === "in"
        ? [{
            appId: "com.mmrda.mumbaione",
            title: "Mumbai One",
            developer: "MMRDA",
            icon: "https://i/1.png",
            score: 4.2,
          }]
        : [],
    );

    const results = await searchGooglePlay("Mumbai One", 10);

    expect(results).toHaveLength(1);
    expect(results[0].storeId).toBe("com.mmrda.mumbaione");
    expect(results[0].name).toBe("Mumbai One");
    expect(results[0].developer).toBe("MMRDA");
    // A region-locked app is absent from the US storefront — finding it at all
    // requires searching others, and the country must be reported so reviews
    // are later scraped from the right one.
    expect(results[0].country).toBe("in");
  });

  it("returns empty (not garbage) when the library finds nothing", async () => {
    gplaySearch.mockResolvedValue([]);
    global.fetch = vi.fn() as unknown as typeof fetch;

    expect(await searchGooglePlay("zzzzz", 10)).toEqual([]);
    // A successful-but-empty search must NOT fall through to HTML scraping.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("falls back to the HTML scrape only when every storefront errors", async () => {
    gplaySearch.mockRejectedValue(new Error("upstream 503"));
    global.fetch = vi.fn(async () => ({
      ok: true,
      text: async () =>
        '<a href="/store/apps/details?id=com.real.app" aria-label="Real App"></a>',
    })) as unknown as typeof fetch;

    const results = await searchGooglePlay("real", 10);
    expect(results.map((r) => r.name)).toEqual(["Real App"]);
  });

  it("throws when the library and the HTML fallback both fail", async () => {
    gplaySearch.mockRejectedValue(new Error("upstream 503"));
    global.fetch = vi.fn(async () => ({ ok: false, status: 429 })) as unknown as typeof fetch;

    // The route turns this into { searchFailed: true }, which tells the user
    // to paste their package ID — honest, unlike a list of wrong apps.
    await expect(searchGooglePlay("real", 10)).rejects.toThrow(/429/);
  });
});

describe("parsePlayHtml", () => {
  it("never emits a row without a real app name", () => {
    // THE bug this file exists to prevent: the old fallback pushed
    // `name: storeId` for every app link on the page, so a broken pattern
    // showed users "com.onewaycab", "rs.webrest.ar" … as search results.
    const html = `
      <a href="/store/apps/details?id=com.onewaycab"></a>
      <a href="/store/apps/details?id=com.ixigo.train.ixitrain"></a>
    `;
    expect(parsePlayHtml(html, 10)).toEqual([]);
  });

  it("deduplicates repeated package names", () => {
    const html = `
      <a href="/store/apps/details?id=com.a" aria-label="App A"></a>
      <a href="/store/apps/details?id=com.a" aria-label="App A"></a>
    `;
    expect(parsePlayHtml(html, 10)).toHaveLength(1);
  });
});

describe("searchAppStore", () => {
  it("maps iTunes results and merges across storefronts", async () => {
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      const country = new URL(String(url)).searchParams.get("country");
      return itunesResponse(
        country === "in"
          ? [{
              bundleId: "com.mmrda.one",
              trackName: "Mumbai One",
              artistName: "MMRDA",
              averageUserRating: 4.1,
            }]
          : [],
      );
    }) as unknown as typeof fetch;

    const results = await searchAppStore("Mumbai One", 10);
    expect(results).toHaveLength(1);
    expect(results[0].storeId).toBe("com.mmrda.one");
    expect(results[0].country).toBe("in");
  });

  it("drops rows missing bundleId or trackName", async () => {
    global.fetch = vi.fn(async () =>
      itunesResponse([
        { trackName: "No bundle" },
        { bundleId: "com.ok", trackName: "Fine" },
      ]),
    ) as unknown as typeof fetch;

    const results = await searchAppStore("x", 10);
    expect(results.map((r) => r.storeId)).toEqual(["com.ok"]);
  });

  it("throws only when every storefront errors", async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 503 })) as unknown as typeof fetch;
    await expect(searchAppStore("x", 10)).rejects.toThrow(/503/);
  });
});

describe("searchStore (unified)", () => {
  it("returns empty for a blank query without hitting upstream", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    expect(await searchStore("google-play", "   ")).toEqual([]);
    expect(gplaySearch).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("looks a pasted package ID up directly instead of text-searching it", async () => {
    gplayApp.mockImplementation(async ({ country }: { country: string }) => {
      if (country !== "in") throw new Error("404 not found in this storefront");
      return {
        appId: "com.mmrda.mumbaione",
        title: "Mumbai One",
        developer: { devId: "MMRDA" },
        score: 4.2,
        ratings: 1500,
      };
    });

    const results = await searchStore("google-play", "com.mmrda.mumbaione");

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Mumbai One");
    expect(results[0].country).toBe("in");
    // Direct hit — no text search needed.
    expect(gplaySearch).not.toHaveBeenCalled();
  });

  it("falls back to text search when a package-shaped query resolves to nothing", async () => {
    gplayApp.mockRejectedValue(new Error("404"));
    global.fetch = vi.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch;
    gplaySearch.mockResolvedValue([
      { appId: "com.other.app", title: "Other App", developer: "Dev" },
    ]);

    const results = await searchStore("google-play", "com.unknown.app");
    expect(results.map((r) => r.storeId)).toEqual(["com.other.app"]);
  });
});
