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
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/stripe/webhook",
  "/api/sync/(.*)",
  "/api/demo/(.*)",
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
  "/api/onboarding(.*)",
  "/api/stripe/checkout(.*)",
  "/api/stripe/portal(.*)",
  "/api/gdpr(.*)",
  "/api/sentiment(.*)",
  "/api/aso(.*)",
  "/api/health(.*)",
  "/api/admin(.*)",
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
  const isAppHost = isProd && (hostname === APP_HOST || hostname.startsWith("app."));

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

  await auth.protect();

  const { sessionClaims } = await auth();
  const trialEndsAt = (sessionClaims?.metadata as { trialEndsAt?: string } | undefined)?.trialEndsAt;
  const plan = (sessionClaims?.metadata as { plan?: string } | undefined)?.plan ?? "free";

  // Trial expiry
  if (trialEndsAt && plan === "free") {
    const expired = new Date(trialEndsAt) < new Date();
    if (expired && !nextUrl.pathname.startsWith("/billing")) {
      const url = new URL("/billing", request.url);
      url.searchParams.set("reason", "trial-expired");
      return NextResponse.redirect(url);
    }
  }

  // Billing gate
  if (isBilledRoute(request) && (!plan || plan === "free")) {
    const billingUrl = new URL("/billing", request.url);
    billingUrl.searchParams.set("required", "1");
    return NextResponse.redirect(billingUrl);
  }

  // Payment grace period
  const paymentFailedAt = (sessionClaims?.metadata as { paymentFailedAt?: string } | undefined)?.paymentFailedAt;
  if (paymentFailedAt) {
    const graceExpired = new Date(new Date(paymentFailedAt).getTime() + 7 * 86400000) < new Date();
    if (graceExpired && !nextUrl.pathname.startsWith("/billing")) {
      const url = new URL("/billing", request.url);
      url.searchParams.set("reason", "payment-failed");
      return NextResponse.redirect(url);
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
