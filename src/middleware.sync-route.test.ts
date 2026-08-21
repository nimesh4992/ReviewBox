/**
 * The sync route must be reachable on the production app host.
 *
 * P0 hardening removed `/api/sync/(.*)` from the PUBLIC matcher — correct, it
 * was a fail-open hole (docs/ROLE_AUDIT.md #6). But a path in NEITHER matcher
 * does not error, it silently stops working, and only on the real hostname:
 *
 *   if (isAppHost && !isAppRoute(request) && !isPublicRoute(request))
 *     return NextResponse.redirect(new URL("/dashboard", request.url));
 *
 * So a signed-in customer's "Sync now" gets 307'd to an HTML page and
 * `res.json()` blows up on markup — while localhost, which is not `isProd`,
 * works perfectly. This repo has shipped that exact bug five times already
 * (/api/reports/send-now, /api/import, /api/competitors, /api/auth/slack, the
 * daily-digest cron), which is why it is pinned behaviourally here rather than
 * by grepping the source.
 *
 * These drive the real `middleware` export with the real route matchers; only
 * Clerk's session check is stubbed, so "reached Clerk" is observable.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";

const CRON_SECRET = "cron-secret-for-tests";

// Keep createRouteMatcher REAL — it is the thing under test. Replace only the
// session guard, so a request that reaches Clerk is visible in the response.
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
  const req = new NextRequest(url, { headers });
  return (await middleware(req, {} as NextFetchEvent)) as NextResponse;
}

const APP = "https://app.tryreviewbox.com";

describe("middleware routing for /api/sync/reviews", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not redirect a signed-in user's sync request to the dashboard", async () => {
    const res = await callMiddleware(`${APP}/api/sync/reviews`, {
      host: "app.tryreviewbox.com",
    });

    // A 3xx here means the JSON API answered with an HTML page.
    expect(res.status, `redirected to ${res.headers.get("location")}`).toBeLessThan(300);
    expect(res.headers.get("location")).toBeNull();
  });

  it("hands a session-authenticated sync request to Clerk so auth() works in the route", async () => {
    const res = await callMiddleware(`${APP}/api/sync/reviews`, {
      host: "app.tryreviewbox.com",
    });

    // Must reach Clerk: the route calls auth() to pin the caller to their own
    // workspace. Skipping Clerk would leave userId null and 401 every user.
    expect(res.headers.get("x-test-reached-clerk")).toBe("1");
  });

  it("lets a cron request with the bearer secret bypass Clerk entirely", async () => {
    const res = await callMiddleware(`${APP}/api/sync/reviews`, {
      host: "app.tryreviewbox.com",
      authorization: `Bearer ${CRON_SECRET}`,
    });

    expect(res.status).toBeLessThan(300);
    expect(res.headers.get("x-test-reached-clerk")).toBeNull();
  });

  it("sends a cron request with the WRONG secret through Clerk, not around it", async () => {
    const res = await callMiddleware(`${APP}/api/sync/reviews`, {
      host: "app.tryreviewbox.com",
      authorization: "Bearer not-the-secret",
    });

    expect(res.headers.get("x-test-reached-clerk")).toBe("1");
  });

  it("no longer treats the sync route as blanket-public", async () => {
    // The fail-open hole this P0 change closed: a public route returns
    // NextResponse.next() without ever consulting Clerk.
    const res = await callMiddleware(`${APP}/api/sync/reviews`, {
      host: "app.tryreviewbox.com",
    });

    expect(res.headers.get("x-test-reached-clerk")).toBe("1");
  });

  it("still works on the marketing host without redirecting to the app host", async () => {
    // The marketing host redirects APP routes to app.tryreviewbox.com. That is
    // right for pages; for the cron target it must not fire before the bearer
    // check, or Vercel Cron follows a redirect and loses the Authorization
    // header (redirects strip it cross-origin).
    const res = await callMiddleware("https://tryreviewbox.com/api/sync/reviews", {
      host: "tryreviewbox.com",
      authorization: `Bearer ${CRON_SECRET}`,
    });

    expect(res.status).toBeLessThan(300);
    expect(res.headers.get("location")).toBeNull();
  });
});
