import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const APP_HOST    = "app.tryreviewbox.com";
const MARKETING_HOST = "tryreviewbox.com";

// All marketing/public paths — never require auth
const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing(.*)",
  "/compare(.*)",
  "/customers(.*)",
  "/about(.*)",
  "/blog(.*)",
  "/careers(.*)",
  "/changelog(.*)",
  "/contact(.*)",
  "/status(.*)",
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
  const hostname = request.headers.get("host") ?? "";
  const isProd = hostname.includes("tryreviewbox.com");
  // Exact host match only. `startsWith("app.")` would also match a spoofed host
  // like `app.tryreviewbox.com.attacker.com` (which also passes the loose
  // isProd .includes check); redirect targets here are hardcoded so match tight.
  const isAppHost = hostname === APP_HOST;

  // ── Subdomain routing (production only) ────────────────────────────────────
  if (isProd) {
    // app.tryreviewbox.com root → sign-in
    if (isAppHost && nextUrl.pathname === "/") {
      return NextResponse.redirect(new URL("/sign-in", request.url));
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
  // "trial" MUST be entitled. Onboarding stamps every new user with
  // plan: "trial", and the billed set covers /api/reply(.*) — the AI draft
  // endpoint that is the product's core value. Gating it to paid-only meant
  // every trial user was bounced off the one feature the trial exists to
  // demonstrate, with no way to pay for it (Stripe is deferred, D013).
  // Expiry of that trial is enforced by the check directly above.
  const entitledPlans = new Set(["trial", "starter", "pro", "team"]);
  if (isBilledRoute(request) && !entitledPlans.has(plan)) {
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
