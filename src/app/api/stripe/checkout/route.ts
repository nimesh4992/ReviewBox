import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { stripe, PRICE_IDS } from "@/lib/stripe";

type Plan = "starter" | "pro" | "team";

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { plan: Plan };
  const { plan } = body;

  if (!plan || !PRICE_IDS[plan]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "STRIPE_NOT_CONFIGURED", message: "Add Stripe test keys to .env.local to enable checkout." },
      { status: 503 },
    );
  }

  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress;

  if (!userEmail) {
    return NextResponse.json({ error: "No email found" }, { status: 400 });
  }

  // Look up or create Stripe customer
  const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
  let customerId: string;

  if (existing.data.length > 0) {
    customerId = existing.data[0].id;
  } else {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { clerkUserId: userId },
    });
    customerId = customer.id;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: userId,
    line_items: [
      {
        price: PRICE_IDS[plan],
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/dashboard?upgraded=1&plan=${plan}`,
    cancel_url: `${appUrl}/billing`,
    metadata: { clerkUserId: userId, plan },
    subscription_data: {
      metadata: { clerkUserId: userId, plan },
    },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url }, { status: 200 });
}
