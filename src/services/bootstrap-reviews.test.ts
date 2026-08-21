import { describe, it, expect, vi, afterEach } from "vitest";

import { bootstrapAppStoreReviews } from "./bootstrap-reviews";

/**
 * These cover the failure mode that reading the code does not surface: the
 * App Store bootstrap used to return [] on every upstream failure, so a
 * blocked request, an Apple outage, or a wrong bundle ID all reported
 * "sync succeeded, 0 reviews" and the dashboard showed the friendly
 * "no reviews yet" empty state forever.
 */
describe("bootstrapAppStoreReviews — failures must be loud", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("throws when the iTunes lookup is refused", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    await expect(
      bootstrapAppStoreReviews("app", "ws", "com.burbn.instagram", "us"),
    ).rejects.toThrow(/iTunes lookup failed .*403/);
  });

  it("throws — naming the storefront — when the app is not on that storefront", async () => {
    // The App Store twin of the Mumbai One region-lock bug: an empty result
    // set is not "no reviews", it's "wrong storefront".
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ resultCount: 0, results: [] }),
      }),
    );

    await expect(
      bootstrapAppStoreReviews("app", "ws", "com.example.indiaonly", "in"),
    ).rejects.toThrow(/not found on the "in" App Store storefront/);
  });

  it("throws when the lookup succeeds but the review feed is refused", async () => {
    const fetchMock = vi
      .fn()
      // lookup succeeds
      .mockResolvedValueOnce({ ok: true, json: async () => ({ resultCount: 1, results: [{ trackId: 389801252 }] }) })
      // first review page refused
      .mockResolvedValueOnce({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      bootstrapAppStoreReviews("app", "ws", "com.burbn.instagram", "us"),
    ).rejects.toThrow(/review feed .*503/);
  });

  it("keeps a partial result when a LATER page fails", async () => {
    const entry = (id: string) => ({
      id: { label: id },
      author: { name: { label: "A" } },
      "im:rating": { label: "5" },
      title: { label: "t" },
      content: { label: "c" },
      updated: { label: new Date().toISOString() },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ resultCount: 1, results: [{ trackId: 1 }] }) })
      // page 1: first entry is app metadata and is skipped, so 2 reviews land
      .mockResolvedValueOnce({ ok: true, json: async () => ({ feed: { entry: [entry("meta"), entry("r1"), entry("r2")] } }) })
      // page 2 dies — we already have data, so this must NOT throw
      .mockResolvedValueOnce({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await bootstrapAppStoreReviews("app", "ws", "com.x.y", "us");
    expect(rows).toHaveLength(2);
  });

  it("passes US country through as 'US' on mapped App Store review rows", async () => {
    const entry = (id: string) => ({
      id: { label: id },
      author: { name: { label: "US User" } },
      "im:rating": { label: "5" },
      title: { label: "Great app" },
      content: { label: "Works fine in US" },
      updated: { label: new Date().toISOString() },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ resultCount: 1, results: [{ trackId: 101 }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ feed: { entry: [entry("meta"), entry("r1")] } }) });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await bootstrapAppStoreReviews("app-us", "ws-us", "com.example.usapp", "us");
    expect(rows).toHaveLength(1);
    expect(rows[0].country).toBe("US");
  });

  it("passes regional country through to mapped App Store review rows", async () => {
    const entry = (id: string) => ({
      id: { label: id },
      author: { name: { label: "Mumbai User" } },
      "im:rating": { label: "5" },
      title: { label: "Great transit app" },
      content: { label: "Very helpful for daily commute" },
      updated: { label: new Date().toISOString() },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ resultCount: 1, results: [{ trackId: 100 }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ feed: { entry: [entry("meta"), entry("r1")] } }) });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await bootstrapAppStoreReviews("app-mumbai", "ws-mumbai", "com.mmrda.mumbaione", "in");
    expect(rows).toHaveLength(1);
    expect(rows[0].country).toBe("IN");
  });

  it("explicitly defaults no-country parameter to DEFAULT_STOREFRONT ('US')", async () => {
    const entry = (id: string) => ({
      id: { label: id },
      author: { name: { label: "Default User" } },
      "im:rating": { label: "4" },
      title: { label: "Good" },
      content: { label: "Decent app" },
      updated: { label: new Date().toISOString() },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ resultCount: 1, results: [{ trackId: 102 }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ feed: { entry: [entry("meta"), entry("r1")] } }) });
    vi.stubGlobal("fetch", fetchMock);

    // Call without country parameter
    const rows = await bootstrapAppStoreReviews("app-def", "ws-def", "com.example.defapp");
    expect(rows).toHaveLength(1);
    expect(rows[0].country).toBe("US");
  });
});
