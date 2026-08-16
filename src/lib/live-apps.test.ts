import { describe, it, expect } from "vitest";

import { scopeAppIds } from "./live-apps";
import { buildCacheKeyRaw } from "./reply-cache";

describe("scopeAppIds", () => {
  const live = ["app-a", "app-b"];

  it("returns every live app when no filter is requested", () => {
    expect(scopeAppIds(live, undefined)).toEqual(["app-a", "app-b"]);
    expect(scopeAppIds(live, null)).toEqual(["app-a", "app-b"]);
    expect(scopeAppIds(live, "  ")).toEqual(["app-a", "app-b"]);
  });

  it("narrows to a requested app the workspace actually owns", () => {
    expect(scopeAppIds(live, "app-b")).toEqual(["app-b"]);
  });

  it("yields nothing — never the whole workspace — for a foreign or deleted app id", () => {
    // Widening back to all apps on a bad id is how a deleted app's data
    // leaks; an empty scope is the safe answer.
    expect(scopeAppIds(live, "someone-elses-app")).toEqual([]);
    expect(scopeAppIds([], "app-a")).toEqual([]);
  });
});

describe("reply cache key — tenant isolation", () => {
  const review = { text: "Crashes on login", rating: 1 };

  it("two workspaces with the same review text get different keys", () => {
    // The property that failed in production: short negative reviews are
    // byte-identical across apps, and a text-only key served workspace A's
    // signed draft to workspace B.
    const a = buildCacheKeyRaw(
      { workspaceId: "ws-a", appId: "app-1", systemPrompt: "p" }, review, "warm");
    const b = buildCacheKeyRaw(
      { workspaceId: "ws-b", appId: "app-1", systemPrompt: "p" }, review, "warm");
    expect(a).not.toEqual(b);
  });

  it("two apps in one workspace get different keys — the sign-off differs", () => {
    const a = buildCacheKeyRaw(
      { workspaceId: "ws", appId: "app-1", systemPrompt: "p" }, review, "warm");
    const b = buildCacheKeyRaw(
      { workspaceId: "ws", appId: "app-2", systemPrompt: "p" }, review, "warm");
    expect(a).not.toEqual(b);
  });

  it("a prompt change (brand voice, KB, char limit) misses the old entry", () => {
    const a = buildCacheKeyRaw(
      { workspaceId: "ws", appId: "app-1", systemPrompt: "old prompt" }, review, "warm");
    const b = buildCacheKeyRaw(
      { workspaceId: "ws", appId: "app-1", systemPrompt: "new prompt" }, review, "warm");
    expect(a).not.toEqual(b);
  });

  it("identical scope and review produce a stable key (cache can actually hit)", () => {
    const scope = { workspaceId: "ws", appId: null, systemPrompt: "p" };
    expect(buildCacheKeyRaw(scope, review, "warm")).toEqual(
      buildCacheKeyRaw(scope, review, "warm"),
    );
  });
});
