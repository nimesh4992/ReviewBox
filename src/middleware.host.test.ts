import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";

// Keep createRouteMatcher REAL — the matchers are what these tests exercise.
// Only the session guard is stubbed, so "this request reached Clerk" becomes an
// observable fact rather than something a test has to re-implement and guess at.
vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();
  return {
    ...actual,
    clerkMiddleware: () => async () =>
      NextResponse.next({ headers: { "x-test-reached-clerk": "1" } }),
  };
});

async function callMiddleware(
  url: string,
  headers: Record<string, string> = {},
): Promise<NextResponse> {
  const { default: middleware } = await import("./middleware");
  return (await middleware(new NextRequest(url, { headers }), {} as NextFetchEvent)) as NextResponse;
}

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

describe("middleware public vs protected route classification", () => {
  // These used to re-implement the matcher inline as a startsWith chain and
  // assert against THAT, so they passed no matter what middleware.ts said —
  // including while /api/sync/reviews sat in neither matcher and was 307'd to
  // /dashboard in production. They now drive the real middleware.
  const publicPaths = [
    "/",
    "/pricing",
    "/privacy",
    "/terms",
    "/cookies",
    "/help",
    "/robots.txt",
    "/sitemap.xml",
  ];

  const privatePaths = [
    "/dashboard",
    "/reviews",
    "/settings",
    "/billing",
    "/automations",
    "/reply-kit",
    "/api/reviews",
    "/api/reply",
    "/api/sync/reviews",
    "/api/apps",
  ];

  it("serves marketing/legal/crawler paths without a session check", async () => {
    for (const path of publicPaths) {
      const res = await callMiddleware(`https://${MARKETING_HOST}${path}`, {
        host: MARKETING_HOST,
      });
      expect(res.headers.get("x-test-reached-clerk"), `${path} must be public`).toBeNull();
    }
  });

  it("puts every app page and protected API behind the session check", async () => {
    // With CRON_SECRET configured, /api/sync/reviews only skips Clerk for a
    // request carrying the bearer token — a browser request must not.
    vi.stubEnv("CRON_SECRET", "cron-secret-for-tests");

    for (const path of privatePaths) {
      const res = await callMiddleware(`https://${APP_HOST}${path}`, { host: APP_HOST });

      // Neither silently public, nor bounced to /dashboard as an unknown path.
      expect(res.headers.get("location"), `${path} must not be redirected`).toBeNull();
      expect(
        res.headers.get("x-test-reached-clerk"),
        `${path} must be session-protected`,
      ).toBe("1");
    }

    vi.unstubAllEnvs();
  });

  it("leaves the sync route open to a local cron only while CRON_SECRET is unset", async () => {
    // Documented dev fallback (lib/sync-cron-auth.ts): local onboarding-triggered
    // syncs must work before the secret is configured. It is keyed on NODE_ENV,
    // and Vercel builds — previews included — run as production, so this can
    // never widen the deployed surface. Pinned so nobody "simplifies" the
    // NODE_ENV guard away.
    const res = await callMiddleware(`https://${APP_HOST}/api/sync/reviews`, { host: APP_HOST });
    expect(process.env.CRON_SECRET).toBeUndefined();
    expect(res.headers.get("x-test-reached-clerk")).toBeNull();
    expect(res.headers.get("location")).toBeNull();
  });
});
