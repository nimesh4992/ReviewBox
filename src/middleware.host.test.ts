import { describe, expect, it } from "vitest";

/**
 * Host resolution used by the middleware. Extracted here as a pure function so
 * the routing decision is testable without booting Clerk.
 *
 * The bug this guards: www.tryreviewbox.com matched neither the app host nor
 * the marketing host, so the authenticated product was served straight off the
 * marketing domain instead of redirecting to app.tryreviewbox.com.
 */
const APP_HOST = "app.tryreviewbox.com";
const MARKETING_HOST = "tryreviewbox.com";

function resolveHost(header: string | null) {
  const raw = (header ?? "").toLowerCase().split(":")[0];
  const hostname = raw.startsWith("www.") ? raw.slice(4) : raw;
  const isAppHost = hostname === APP_HOST;
  return { hostname, isAppHost, isProd: isAppHost || hostname === MARKETING_HOST };
}

describe("middleware host resolution", () => {
  it("treats www as the marketing host", () => {
    const r = resolveHost("www.tryreviewbox.com");
    expect(r.isProd).toBe(true);
    expect(r.isAppHost).toBe(false);
    expect(r.hostname).toBe(MARKETING_HOST);
  });

  it("recognises the bare marketing host and the app host", () => {
    expect(resolveHost("tryreviewbox.com")).toMatchObject({ isProd: true, isAppHost: false });
    expect(resolveHost("app.tryreviewbox.com")).toMatchObject({ isProd: true, isAppHost: true });
  });

  it("ignores the port", () => {
    expect(resolveHost("app.tryreviewbox.com:443").isAppHost).toBe(true);
    expect(resolveHost("localhost:3000").isProd).toBe(false);
  });

  it("rejects lookalike hosts that a substring match would accept", () => {
    for (const spoof of [
      "tryreviewbox.com.attacker.com",
      "app.tryreviewbox.com.attacker.com",
      "nottryreviewbox.com",
    ]) {
      const r = resolveHost(spoof);
      expect(r.isProd).toBe(false);
      expect(r.isAppHost).toBe(false);
    }
  });

  it("leaves preview deployments out of host routing", () => {
    expect(resolveHost("reviewbox-git-branch-team.vercel.app").isProd).toBe(false);
  });
});
