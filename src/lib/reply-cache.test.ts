import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * `buildCacheKeyRaw` is covered directly elsewhere. These tests go through the
 * public API with a fake Redis instead, because that is the layer the leak
 * actually lived at: a test that reached past `getCachedReply` could pass
 * while the real call path still shared a namespace, and the guards that skip
 * the cache entirely (no workspace, no Redis config) are invisible to a test
 * of the key builder alone.
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

const SCOPE_A = { workspaceId: "workspace-a", appId: "app-1", systemPrompt: "You are Acme." };
const SCOPE_B = { workspaceId: "workspace-b", appId: "app-1", systemPrompt: "You are Beta." };

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
    await setCachedReply(SCOPE_A, REVIEW, "professional", "Sorry — our internal KB says fix ships Tuesday.");

    // Workspace B hits the identical review text, rating and tone. Same app,
    // or just the same boilerplate 1-star wording — both are common.
    const leaked = await getCachedReply(SCOPE_B, REVIEW, "professional");

    expect(leaked).toBeNull();
  });

  it("isolates tenants even when the system prompt is byte-identical", async () => {
    // The prompt is in the key too, so a differing prompt would mask a missing
    // workspace check. Hold it equal and the workspace must still separate them.
    const { getCachedReply, setCachedReply } = await import("./reply-cache");
    const sharedPrompt = { appId: "app-1", systemPrompt: "You are a support agent." };

    await setCachedReply({ workspaceId: "workspace-a", ...sharedPrompt }, REVIEW, "professional", "A's draft");

    expect(
      await getCachedReply({ workspaceId: "workspace-b", ...sharedPrompt }, REVIEW, "professional"),
    ).toBeNull();
  });

  it("still serves the same workspace its own cached reply", async () => {
    const { getCachedReply, setCachedReply } = await import("./reply-cache");
    await setCachedReply(SCOPE_A, REVIEW, "professional", "cached draft");
    expect(await getCachedReply(SCOPE_A, REVIEW, "professional")).toBe("cached draft");
  });

  it("never touches Redis when there is no workspace to scope to", async () => {
    // A shared "anon" bucket is the exact leak this module was rewritten to
    // close, so a caller without a workspace must not read or write at all.
    const { getCachedReply, setCachedReply } = await import("./reply-cache");
    const anon = { workspaceId: null, appId: null, systemPrompt: "You are Acme." };

    await setCachedReply(anon, REVIEW, "professional", "should never be stored");
    expect(await getCachedReply(anon, REVIEW, "professional")).toBeNull();
    expect(seenKeys).toHaveLength(0);
    expect(store.size).toBe(0);
  });

  it("keeps tone and rating part of the key", async () => {
    const { getCachedReply, setCachedReply } = await import("./reply-cache");
    await setCachedReply(SCOPE_A, REVIEW, "professional", "formal");
    expect(await getCachedReply(SCOPE_A, REVIEW, "casual")).toBeNull();
    expect(await getCachedReply(SCOPE_A, { ...REVIEW, rating: 5 }, "professional")).toBeNull();
  });

  it("invalidation only clears the caller's own entry", async () => {
    const { getCachedReply, setCachedReply, invalidateCachedReply } = await import("./reply-cache");
    await setCachedReply(SCOPE_A, REVIEW, "professional", "a");
    await setCachedReply(SCOPE_B, REVIEW, "professional", "b");

    await invalidateCachedReply(SCOPE_A, REVIEW, "professional");

    expect(await getCachedReply(SCOPE_A, REVIEW, "professional")).toBeNull();
    expect(await getCachedReply(SCOPE_B, REVIEW, "professional")).toBe("b");
  });
});
