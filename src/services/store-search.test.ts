import { afterEach, describe, expect, it, vi } from "vitest";

import { searchAppStore, searchGooglePlay, searchStore } from "./store-search";

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("searchAppStore", () => {
  it("maps iTunes results to StoreSearchResult", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        resultCount: 1,
        results: [
          {
            bundleId: "com.spotify.music",
            trackName: "Spotify",
            artistName: "Spotify",
            artworkUrl100: "http://x/icon100.png",
            artworkUrl512: "http://x/icon512.png",
            averageUserRating: 4.7,
            trackViewUrl: "https://apps.apple.com/spotify",
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const out = await searchAppStore("spotify");
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      storeId: "com.spotify.music",
      name: "Spotify",
      developer: "Spotify",
      icon: "http://x/icon512.png", // prefers 512 over 100
      rating: 4.7,
      url: "https://apps.apple.com/spotify",
    });
  });

  it("filters results that are missing bundleId or trackName", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        resultCount: 2,
        results: [
          { bundleId: "com.ok", trackName: "Good" },
          { trackName: "No bundle id" },
          { bundleId: "com.no.name" },
        ],
      }),
    }) as unknown as typeof fetch;

    const out = await searchAppStore("test");
    expect(out).toHaveLength(1);
    expect(out[0].storeId).toBe("com.ok");
  });

  it("throws when the upstream returns non-200", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as unknown as typeof fetch;

    await expect(searchAppStore("test")).rejects.toThrow(/App Store search failed: 503/);
  });

  it("caps the limit at 25 (iTunes API maximum)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resultCount: 0, results: [] }),
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    await searchAppStore("test", 100);
    const calledUrl = (fetchMock as unknown as { mock: { calls: [string][] } }).mock.calls[0][0];
    expect(calledUrl).toMatch(/limit=25/);
  });
});

describe("searchGooglePlay", () => {
  it("extracts package names from aria-label anchors", async () => {
    const html = `
      <html>
        <a href="/store/apps/details?id=com.spotify.music&hl=en" aria-label="Spotify">Spotify</a>
        <a href="/store/apps/details?id=com.notion.android&hl=en" aria-label="Notion">Notion</a>
      </html>
    `;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => html,
    }) as unknown as typeof fetch;

    const out = await searchGooglePlay("music");
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out[0].storeId).toBe("com.spotify.music");
    expect(out[0].name).toBe("Spotify");
    expect(out[0].url).toContain("com.spotify.music");
  });

  it("deduplicates results with the same package name", async () => {
    const html = `
      <a href="/store/apps/details?id=com.same" aria-label="Same">First</a>
      <a href="/store/apps/details?id=com.same" aria-label="Same">Second</a>
    `;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => html,
    }) as unknown as typeof fetch;

    const out = await searchGooglePlay("test");
    expect(out).toHaveLength(1);
  });

  it("falls back to bare IDs when no aria-labels present", async () => {
    const html = `
      <div><a href="/store/apps/details?id=com.fallback">link</a></div>
    `;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => html,
    }) as unknown as typeof fetch;

    const out = await searchGooglePlay("test");
    expect(out).toHaveLength(1);
    expect(out[0].storeId).toBe("com.fallback");
    // Fallback uses storeId as name
    expect(out[0].name).toBe("com.fallback");
  });

  it("throws when upstream returns non-200", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    }) as unknown as typeof fetch;

    await expect(searchGooglePlay("test")).rejects.toThrow(/Google Play search failed: 429/);
  });

  it("returns an empty array when HTML has no matching apps", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<html><body>no apps here</body></html>",
    }) as unknown as typeof fetch;

    const out = await searchGooglePlay("nothingxyz");
    expect(out).toEqual([]);
  });
});

describe("searchStore (unified)", () => {
  it("returns empty array for blank query without hitting upstream", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const out = await searchStore("app-store", "   ");
    expect(out).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dispatches to App Store search", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resultCount: 0, results: [] }),
    }) as unknown as typeof fetch;

    await searchStore("app-store", "spotify");
    const calledUrl = (global.fetch as unknown as { mock: { calls: [string][] } }).mock.calls[0][0];
    expect(calledUrl).toContain("itunes.apple.com");
  });

  it("dispatches to Google Play search", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<html></html>",
    }) as unknown as typeof fetch;

    await searchStore("google-play", "spotify");
    const calledUrl = (global.fetch as unknown as { mock: { calls: [string][] } }).mock.calls[0][0];
    expect(calledUrl).toContain("play.google.com");
  });
});
