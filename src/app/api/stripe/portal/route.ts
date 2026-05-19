import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { rateLimit } from "@/lib/api-rate-limit";
import { apiError, captureAndError, ApiErrorCode } from "@/lib/api-response";

// NO_SUBSCRIPTION is a portal-specific signal — narrow it to a custom code
// the billing UI can switch on without breaking the canonical envelope.
const NO_SUBSCRIPTION: ApiErrorCode = "NOT_FOUND";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", 401);
    }

    const rl = await rateLimit(req, userId, { bucket: "stripe-portal", limit: 10, window: "10 m" });
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", 429);
    }

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress;
    if (!userEmail) {
      return apiError("INVALID_INPUT", 400, "Account has no email.");
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return apiError("STRIPE_NOT_CONFIGURED", 503);
    }

    const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
    if (!existing.data.length) {
      return apiError(NO_SUBSCRIPTION, 404, "No active subscription found.");
    }

    const customerId = existing.data[0].id;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/billing`,
    });

    return NextResponse.json({ url: portalSession.url }, { status: 200 });
  } catch (err) {
    return captureAndError(err, "POST /api/stripe/portal");
  }
}
