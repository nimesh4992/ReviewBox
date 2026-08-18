import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { stripe, PRICE_IDS, hasPrice } from "@/lib/stripe";
import { rateLimit } from "@/lib/api-rate-limit";
import { apiError, captureAndError } from "@/lib/api-response";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import {
  DEFAULT_BILLING_INTERVAL,
  PAID_PLANS,
  isBillingInterval,
  type PaidPlanName,
} from "@/lib/plans";

function isPaidPlan(value: unknown): value is PaidPlanName {
  return typeof value === "string" && (PAID_PLANS as readonly string[]).includes(value);
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", 401);
    }

    // 5 checkout creations per 10 min — protects against customer-flood.
    const rl = await rateLimit(request, userId, { bucket: "stripe-checkout", limit: 5, window: "10 m" });
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", 429);
    }

    const body = (await request.json()) as { plan?: unknown; interval?: unknown };

    // Configuration is checked BEFORE the price lookup. PRICE_IDS values are
    // "" when the Stripe env vars are unset, so checking the price first meant
    // an unconfigured deployment answered every plan with "Invalid plan." —
    // a dead end with no next action, and it made the billing page's
    // STRIPE_NOT_CONFIGURED branch unreachable. That is the screen a customer
    // hits the day their trial expires.
    if (!process.env.STRIPE_SECRET_KEY) {
      return apiError("STRIPE_NOT_CONFIGURED", 503);
    }

    if (!isPaidPlan(body.plan)) {
      return apiError("INVALID_INPUT", 400, "Invalid plan.");
    }
    const plan = body.plan;

    // Absent means monthly. The interval is a late addition and an older
    // client that does not send one must keep buying what it always bought,
    // rather than being silently switched to a yearly commitment.
    if (body.interval !== undefined && !isBillingInterval(body.interval)) {
      return apiError("INVALID_INPUT", 400, "Invalid billing interval.");
    }
    const interval = body.interval ?? DEFAULT_BILLING_INTERVAL;

    // A configured plan with an UNCONFIGURED interval is its own failure, and
    // it gets its own code. Folding it into "Invalid plan." would tell a
    // customer their selection was malformed when the truth is that we have
    // not created the price yet — and it is the actionable half of the
    // message, because the fix is ours, not theirs.
    if (!hasPrice(plan, interval)) {
      return apiError(
        "INTERVAL_NOT_AVAILABLE",
        503,
        interval === "annual"
          ? "Yearly billing isn't available yet. Choose monthly, or contact us."
          : "That billing option isn't available yet.",
      );
    }

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress;
    if (!userEmail) {
      return apiError("INVALID_INPUT", 400, "Account has no email.");
    }

    // Resolve the user's workspace + look for cached Stripe customer ID
    const workspaceId = await getWorkspaceId(userId);
    const sb = getServiceClient();

    let customerId: string | null = null;
    if (workspaceId) {
      const { data: ws } = await sb
        .from("workspaces")
        .select("stripe_customer_id")
        .eq("id", workspaceId)
        .maybeSingle();
      customerId = (ws?.stripe_customer_id as string | null) ?? null;
    }

    // Fallback to email lookup if workspace doesn't have a cached customer ID
    if (!customerId) {
      const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: { clerkUserId: userId },
        });
        customerId = customer.id;
      }

      // Cache it on the workspace so we never have to scan Stripe again
      if (workspaceId && customerId) {
        await sb
          .from("workspaces")
          .update({ stripe_customer_id: customerId })
          .eq("id", workspaceId);
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: PRICE_IDS[plan][interval], quantity: 1 }],
      success_url: `${appUrl}/dashboard?upgraded=1&plan=${plan}`,
      cancel_url: `${appUrl}/billing`,
      // `plan` stays the entitlement key and `interval` rides alongside it.
      // The webhook resolves entitlements from `plan` ALONE — a monthly and a
      // yearly Pro grant identical limits — so adding an interval here must
      // not change what the customer can do, only how often they are charged.
      metadata: { clerkUserId: userId, plan, interval },
      subscription_data: {
        metadata: { clerkUserId: userId, plan, interval },
        // Export charges also require a description of the service sold; this
        // appears on the invoice.
        description: `ReviewBox ${plan[0].toUpperCase()}${plan.slice(1)} plan (${
          interval === "annual" ? "billed yearly" : "billed monthly"
        }) — app review management software subscription`,
      },
      allow_promotion_codes: true,
      // An India-registered Stripe account selling to customers abroad must
      // supply the buyer's name and billing address on the charge — without
      // them the payment is rejected outright rather than declining gracefully.
      // Collect both at checkout and write them back onto the Customer so
      // renewals carry the same details.
      billing_address_collection: "required",
      customer_update: { name: "auto", address: "auto" },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    return captureAndError(err, "POST /api/stripe/checkout");
  }
}
