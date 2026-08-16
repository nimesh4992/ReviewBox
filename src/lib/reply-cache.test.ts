import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The cache key is the whole security property here, so it is tested through
 * the public API with a fake Redis rather than by exporting the key builder —
 * a test that reached past `getCachedReply` could pass while the real call
 * path still shared a namespace.
 */
const store = new Map<string, string>();
const seenKeys: string[] = [];

vi.mock("@upstash/redis", () => ({
  Redis: class {
    async get<T>(key: string): Promise<T | null> {
      seenKeys.push(key);
      return (store.get(key) as T) ?? null;
    }
    async setex(key: string, _ttl: number, value: string): Promise<void> {
      seenKeys.push(key);
      store.set(key, value);
    }
    async del(key: string): Promise<void> {
      seenKeys.push(key);
      store.delete(key);
    }
  },
}));

const REVIEW = { text: "The app keeps crashing on launch", rating: 1 };

beforeEach(() => {
  store.clear();
  seenKeys.length = 0;
  process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
  vi.resetModules();
});

afterEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe("reply cache tenant isolation", () => {
  it("does not serve one workspace's cached reply to another", async () => {
    const { getCachedReply, setCachedReply } = await import("./reply-cache");

    // Workspace A generates a draft. In production this text is built from A's
    // brand voice and knowledge-base entries.
    await setCachedReply("workspace-a", REVIEW, "professional", "Sorry — our internal KB says fix ships Tuesday.");

    // Workspace B hits the identical review text, rating and tone. Same app,
    // or just the same boilerplate 1-star wording — both are common.
    const leaked = await getCachedReply("workspace-b", REVIEW, "professional");

    expect(leaked).toBeNull();
  });

  it("still serves the same workspace its own cached reply", async () => {
    const { getCachedReply, setCachedReply } = await import("./reply-cache");
    await setCachedReply("workspace-a", REVIEW, "professional", "cached draft");
    expect(await getCachedReply("workspace-a", REVIEW, "professional")).toBe("cached draft");
  });

  it("puts the workspace in the key where a human can see it", async () => {
    const { setCachedReply } = await import("./reply-cache");
    await setCachedReply("workspace-a", REVIEW, "professional", "x");
    expect(seenKeys[0]).toContain("workspace-a");
  });

  it("keeps tone and rating part of the key", async () => {
    const { getCachedReply, setCachedReply } = await import("./reply-cache");
    await setCachedReply("workspace-a", REVIEW, "professional", "formal");
    expect(await getCachedReply("workspace-a", REVIEW, "casual")).toBeNull();
    expect(await getCachedReply("workspace-a", { ...REVIEW, rating: 5 }, "professional")).toBeNull();
  });

  it("invalidation only clears the caller's own entry", async () => {
    const { getCachedReply, setCachedReply, invalidateCachedReply } = await import("./reply-cache");
    await setCachedReply("workspace-a", REVIEW, "professional", "a");
    await setCachedReply("workspace-b", REVIEW, "professional", "b");

    await invalidateCachedReply("workspace-a", REVIEW, "professional");

    expect(await getCachedReply("workspace-a", REVIEW, "professional")).toBeNull();
    expect(await getCachedReply("workspace-b", REVIEW, "professional")).toBe("b");
  });
});
