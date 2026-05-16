import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Routes that don't require auth
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/stripe/webhook", // Stripe webhooks bypass auth
  "/api/sync/(.*)",      // Vercel Cron routes — auth handled by CRON_SECRET header
  "/monitoring(.*)",     // Sentry tunnel route — must be public
]);

// Routes that require an active paid plan (free trial = grace period)
const isBilledRoute = createRouteMatcher([
  "/automations(.*)",
  "/reply-kit(.*)",
  "/api/reply(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return NextResponse.next();

  // Require sign-in for all non-public routes
  await auth.protect();

  // Trial expiry check
  const { sessionClaims } = await auth();
  const trialEndsAt = (sessionClaims?.metadata as { trialEndsAt?: string } | undefined)?.trialEndsAt;
  const plan = (sessionClaims?.metadata as { plan?: string } | undefined)?.plan ?? "free";

  if (trialEndsAt && plan === "free") {
    const expired = new Date(trialEndsAt) < new Date();
    if (expired && !isPublicRoute(request) && !request.nextUrl.pathname.startsWith("/billing")) {
      const url = new URL("/billing", request.url);
      url.searchParams.set("reason", "trial-expired");
      return NextResponse.redirect(url);
    }
  }

  // Billing gate — check plan in session claims (populated by Clerk webhook)
  if (isBilledRoute(request)) {
    // Allow if they have any paid plan or are in trial
    if (!plan || plan === "free") {
      const billingUrl = new URL("/billing", request.url);
      billingUrl.searchParams.set("required", "1");
      return NextResponse.redirect(billingUrl);
    }
  }

  // Grace period check — redirect to /billing if payment has been failed for > 7 days
  const paymentFailedAt = (sessionClaims?.metadata as { paymentFailedAt?: string } | undefined)?.paymentFailedAt;
  if (paymentFailedAt) {
    const failedDate = new Date(paymentFailedAt);
    const gracePeriodDays = 7;
    const graceExpired = new Date(failedDate.getTime() + gracePeriodDays * 86400000) < new Date();
    if (graceExpired && !isPublicRoute(request) && !request.nextUrl.pathname.startsWith("/billing")) {
      const url = new URL("/billing", request.url);
      url.searchParams.set("reason", "payment-failed");
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
