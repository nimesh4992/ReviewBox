import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { stripe, PRICE_IDS } from "@/lib/stripe";
import { rateLimit } from "@/lib/api-rate-limit";
import { apiError, captureAndError } from "@/lib/api-response";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";

type Plan = "starter" | "pro" | "team";

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

    const body = (await request.json()) as { plan: Plan };
    const { plan } = body;

    if (!plan || !PRICE_IDS[plan]) {
      return apiError("INVALID_INPUT", 400, "Invalid plan.");
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return apiError("STRIPE_NOT_CONFIGURED", 503);
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
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${appUrl}/dashboard?upgraded=1&plan=${plan}`,
      cancel_url: `${appUrl}/billing`,
      metadata: { clerkUserId: userId, plan },
      subscription_data: { metadata: { clerkUserId: userId, plan } },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    return captureAndError(err, "POST /api/stripe/checkout");
  }
}
