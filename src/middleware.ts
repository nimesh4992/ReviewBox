import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isEntitledPlan } from "@/lib/plans";
import {
  APP_HOST_ROBOTS_TXT,
  CRAWLER_FILE_PATHS,
  isMarketingOnlyPath,
} from "@/lib/seo-routes";

const APP_HOST    = "app.tryreviewbox.com";
const MARKETING_HOST = "tryreviewbox.com";

/**
 * Where to SEND traffic bound for the marketing site — always `www.`.
 *
 * Distinct from MARKETING_HOST above, which is only ever compared against, and
 * which the host normalisation below strips `www.` from so both spellings match
 * one branch. This constant is the opposite job: the single canonical origin.
 *
 * `www.` is canonical because it is what Vercel already serves — the apex
 * 308s to www — and what Google has indexed (all nine ranking URLs are on www).
 * Redirecting to the apex instead would mean app → apex → www, and a redirect
 * chain sheds link equity at every hop.
 */
const MARKETING_ORIGIN = "https://www.tryreviewbox.com";

// All marketing/public paths — never require auth
const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing(.*)",
  // Product pages. A marketing page missing from this list is served to every
  // signed-out visitor — Googlebot included — as a 404, which is precisely how
  // robots.txt and sitemap.xml were lost for months. `seo-indexing-contract`
  // now asserts every MARKETING_ONLY_PREFIXES entry appears here.
  "/app-review-management(.*)",
  "/alternatives(.*)",
  "/vs(.*)",
  "/about(.*)",
  "/blog(.*)",
  "/changelog(.*)",
  "/contact(.*)",
  "/faq(.*)",
  "/help(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/dpa(.*)",
  // Every legal page must be reachable without an account. These were missing
  // from the matcher, so anonymous visitors — and Stripe's account reviewer,
  // and Googlebot — hit an auth wall on the Cookie Policy, the AUP and the
  // Refund Policy, while sitemap.ts advertised all three.
  "/cookies(.*)",
  "/acceptable-use(.*)",
  "/refund(.*)",
  "/refund-policy(.*)",
  "/grievance(.*)",
  "/sub-processors(.*)",
  "/security(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/invite(.*)",
  "/api/stripe/webhook",
  "/api/sync/(.*)",
  "/api/reports/weekly-digest",
  "/api/reports/unreplied-alert",
  // Every cron target must be listed. daily-digest was added later and missed,
  // so on the app host middleware redirected it before its own fail-closed
  // CRON_SECRET check could run — the job was scheduled in vercel.json and
  // silently never executed. A route absent from BOTH matchers is the failure
  // mode to watch for here; it does not error, it just stops working.
  "/api/reports/daily-digest",
  // Cron routes authenticate themselves via CRON_SECRET (machine calls, no
  // Clerk session) — they must be public so auth.protect() doesn't reject
  // them, exactly like the two report crons above. Previously unmatched, so on
  // the prod app host trial-nudge was redirected to /dashboard before its
  // secret check ever ran (docs/ROLE_AUDIT.md P0-5).
  "/api/cron/(.*)",
  // `(.*)` not `/(.*)`: the old pattern required a trailing segment, so the
  // bare /api/health that uptime monitors poll fell through to the app matcher
  // and got bounced to sign-in. /api/health/user-check under this prefix
  // authenticates itself with CRON_SECRET and fails closed, same as the crons.
  "/api/health(.*)",
  "/api/demo/(.*)",
  "/api/auth/clear-onboarded-cookie",
  "/monitoring(.*)",
  // robots.txt, sitemap.xml, opengraph-image. Absent from this list until
  // 2026-08-18, and because neither `.txt` nor `.xml` is in the matcher's
  // extension exclusion below, both fell through to auth.protect() and served
  // Googlebot a 404 — see lib/seo-routes.ts for the production evidence.
  //
  // Spread from the shared constant rather than retyped: the contract test
  // reads this file and asserts the import is present, so a future edit cannot
  // quietly drop one of the three back behind the auth wall.
  ...CRAWLER_FILE_PATHS,
]);

// App-only paths (authenticated product)
const isAppRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/reviews(.*)",
  "/inbox(.*)",
  "/incidents(.*)",
  "/releases(.*)",
  "/automations(.*)",
  "/reply-kit(.*)",
  "/sentiment(.*)",
  "/competitors(.*)",
  "/aso(.*)",
  "/reports(.*)",
  "/settings(.*)",
  "/billing(.*)",
  "/onboarding(.*)",
  "/account-deleted(.*)",
  "/admin(.*)",
  "/api/onboarding(.*)",
  "/api/apps(.*)",
  "/api/reviews(.*)",
  "/api/reply(.*)",
  "/api/tags(.*)",
  "/api/dashboard(.*)",
  "/api/incidents(.*)",
  "/api/automations(.*)",
  "/api/reply-kit(.*)",
  "/api/settings(.*)",
  "/api/support(.*)",
  "/api/onboarding(.*)",
  "/api/account(.*)",
  "/api/team(.*)",
  "/api/stripe/checkout(.*)",
  "/api/stripe/portal(.*)",
  "/api/gdpr(.*)",
  "/api/sentiment(.*)",
  "/api/aso(.*)",
  "/api/google-play(.*)",
  "/api/reports/export(.*)",
  // send-now is user-triggered (the Reports screen's "Send now" buttons) and
  // was in neither matcher, so on app.tryreviewbox.com the fall-through
  // redirected the POST to the /dashboard HTML page and res.json() blew up.
  // Same class as the import/competitors/slack gap fixed below.
  "/api/reports/send-now(.*)",
  "/api/health(.*)",
  "/api/admin(.*)",
  "/api/debug(.*)",
  // User-triggered API routes that were in neither matcher, so on the prod app
  // host they were redirected to /dashboard before auth.protect() ran — making
  // AppFollow import, the Competitors add/remove flow, and Slack OAuth appear
  // silently broken in production (docs/ROLE_AUDIT.md P0-5). Each still runs
  // its own auth() check.
  "/api/import(.*)",
  "/api/competitors(.*)",
  "/api/auth/slack(.*)",
]);

// Routes that require an active paid plan
const isBilledRoute = createRouteMatcher([
  "/automations(.*)",
  "/reply-kit(.*)",
  "/api/reply(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  const { nextUrl } = request;
  // Normalize before comparing: strip the port, lowercase, and treat a leading
  // "www." as the bare domain. Without this, www.tryreviewbox.com matched
  // NEITHER host branch below — so the authenticated product was served
  // directly from the marketing domain instead of redirecting to the app
  // subdomain, and Clerk's session cookie could go missing across the
  // www/non-www boundary, leaving sign-in unable to see an existing session.
  const rawHost = (request.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const hostname = rawHost.startsWith("www.") ? rawHost.slice(4) : rawHost;

  // Exact match against the two known hosts. `includes("tryreviewbox.com")`
  // would also pass a spoofed host like tryreviewbox.com.attacker.com, and
  // `startsWith("app.")` would pass app.tryreviewbox.com.attacker.com. Preview
  // deployments (*.vercel.app) match neither and correctly skip host routing.
  const isAppHost = hostname === APP_HOST;
  const isProd = isAppHost || hostname === MARKETING_HOST;

  // ── Subdomain routing (production only) ────────────────────────────────────
  if (isProd) {
    // The app host answers its own robots.txt, disallowing everything.
    //
    // This must run before the isPublicRoute branch below. /robots.txt is now
    // public on both hosts, so without this the app host would be served the
    // MARKETING robots.txt — an `Allow: /` inviting Google to crawl the whole
    // signed-in product. Making the path public and leaving it host-blind is
    // strictly worse than the 404 it replaced.
    if (isAppHost && nextUrl.pathname === "/robots.txt") {
      return new NextResponse(APP_HOST_ROBOTS_TXT, {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          // Same lifetime Google assumes for a robots.txt it cannot re-fetch.
          "cache-control": "public, max-age=86400",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }

    // app.tryreviewbox.com root → sign-in
    if (isAppHost && nextUrl.pathname === "/") {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    // Marketing content served from the app host → 301 to its canonical home.
    //
    // These pages are public routes, so they rendered in full on
    // app.tryreviewbox.com — a byte-identical duplicate of the page the
    // marketing host is trying to rank. The noindex header kept them out of the
    // index but threw away any link equity pointing at them; a 301 passes it on
    // instead.
    //
    // 301, not the NextResponse default of 307: these are GET-only content
    // pages, and 301 is the status search engines consolidate ranking signals
    // across. Nothing here accepts a POST, so the method-rewriting difference
    // between 301 and 308 cannot bite.
    if (isAppHost && isMarketingOnlyPath(nextUrl.pathname)) {
      return NextResponse.redirect(
        new URL(nextUrl.pathname + nextUrl.search, MARKETING_ORIGIN),
        301,
      );
    }

    // app subdomain: unknown (non-app, non-public) path → dashboard
    if (isAppHost && !isAppRoute(request) && !isPublicRoute(request)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Marketing domain: sign-in/sign-up → redirect to app subdomain
    if (!isAppHost && hostname === MARKETING_HOST &&
        (nextUrl.pathname.startsWith("/sign-in") || nextUrl.pathname.startsWith("/sign-up"))) {
      const appUrl = new URL(nextUrl.pathname + nextUrl.search, `https://${APP_HOST}`);
      return NextResponse.redirect(appUrl);
    }

    // Marketing domain: app path → redirect to app subdomain
    if (!isAppHost && hostname === MARKETING_HOST && isAppRoute(request)) {
      const appUrl = new URL(nextUrl.pathname + nextUrl.search, `https://${APP_HOST}`);
      return NextResponse.redirect(appUrl);
    }
  }

  // ── Auth guard ─────────────────────────────────────────────────────────────
  if (isPublicRoute(request)) {
    const res = NextResponse.next();
    // Tell crawlers not to index the app subdomain
    if (isAppHost) res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  const { sessionClaims } = await auth.protect();
  const metadata = (sessionClaims?.metadata ?? {}) as {
    plan?: string;
    trialEndsAt?: string;
    paymentFailedAt?: string;
    accountDeletedAt?: string;
  };
  const plan = metadata.plan ?? "trial";
  const trialEndsAt = metadata.trialEndsAt;
  const accountDeletedAt = metadata.accountDeletedAt;

  // Account scheduled for deletion — let restore endpoint and the
  // restore page through; block everything else.
  if (accountDeletedAt) {
    const isRestorePath =
      nextUrl.pathname === "/account-deleted" ||
      nextUrl.pathname === "/api/account/restore" ||
      nextUrl.pathname === "/api/account/cancel"; // allow re-confirming cancel
    if (!isRestorePath) {
      return NextResponse.redirect(new URL("/account-deleted", request.url));
    }
  }

  // NOTE: There is NO onboarding-state check in middleware. Reading the
  // `onboarded` flag from Clerk's session JWT causes infinite redirect loops
  // when the JWT is stale (Clerk caches metadata up to 60s after we update
  // it server-side). Onboarding routing is handled at the PAGE level:
  //   - Signed-in user with no workspace → dashboard renders an empty-state
  //     CTA pointing to /onboarding.
  //   - User on /onboarding who already has a workspace → onboarding page
  //     redirects to /dashboard via useEffect.
  // Both checks read fresh state from /api/onboarding/state (DB-authoritative),
  // never from the JWT.

  // Redirecting an API request to an HTML page is never useful: fetch() follows
  // the 307, POSTs to a page route, and the caller's res.json() blows up on
  // markup. API callers get a machine-readable 402 in the same shape as
  // apiError() so the UI can show a real message.
  const isApiRequest = nextUrl.pathname.startsWith("/api/");
  const billingBlock = (
    code: string,
    message: string,
    query: Record<string, string>,
  ): NextResponse => {
    if (isApiRequest) {
      return NextResponse.json({ error: code, message }, { status: 402 });
    }
    const url = new URL("/billing", request.url);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    return NextResponse.redirect(url);
  };

  // Trial expiry (only while plan === "trial")
  if (plan === "trial" && trialEndsAt) {
    const expired = new Date(trialEndsAt) < new Date();
    if (expired && !nextUrl.pathname.startsWith("/billing")) {
      return billingBlock("TRIAL_EXPIRED", "Your trial has ended. Choose a plan to continue.", { reason: "trial-expired" });
    }
  }

  // Entitlement gate for billed routes.
  //
  // The set itself lives in lib/plans.ts (ENTITLED_PLANS), typed against the
  // plan vocabulary, so adding or renaming a tier can't silently leave this
  // gate behind. It used to be a bare string literal Set here — the one
  // untyped copy that, if missed when a tier was added, would lock a paying
  // customer out of every billed route with nothing in CI to catch it.
  if (isBilledRoute(request) && !isEntitledPlan(plan)) {
    return billingBlock("PLAN_REQUIRED", "This feature requires an active plan.", { required: "1" });
  }

  // Payment grace period
  const paymentFailedAt = metadata.paymentFailedAt;
  if (paymentFailedAt) {
    const graceExpired = new Date(new Date(paymentFailedAt).getTime() + 7 * 86400000) < new Date();
    if (graceExpired && !nextUrl.pathname.startsWith("/billing")) {
      return billingBlock("PAYMENT_FAILED", "Your last payment failed. Update your billing details to continue.", { reason: "payment-failed" });
    }
  }

  const res = NextResponse.next();
  if (isAppHost) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
