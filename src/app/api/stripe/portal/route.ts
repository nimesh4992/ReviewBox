import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress;

  if (!userEmail) {
    return NextResponse.json({ error: "No email found" }, { status: 400 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "STRIPE_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const existing = await stripe.customers.list({ email: userEmail, limit: 1 });

  if (!existing.data.length) {
    return NextResponse.json({ error: "NO_SUBSCRIPTION" }, { status: 400 });
  }

  const customerId = existing.data[0].id;

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  });

  return NextResponse.json({ url: portalSession.url }, { status: 200 });
}
