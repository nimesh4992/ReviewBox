import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { sendWelcomeEmail } from "@/lib/email/send-welcome";
import { sendPaymentFailedEmail } from "@/lib/email/send-payment-failed";

export const dynamic = "force-dynamic";

async function syncPlanToSupabase(clerkUserId: string, plan: string) {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  await sb
    .from("workspace_members")
    .select("workspace_id")
    .eq("clerk_user_id", clerkUserId)
    .limit(1)
    .then(async ({ data }) => {
      if (!data?.length) return;
      await sb
        .from("workspaces")
        .update({ plan })
        .eq("id", data[0].workspace_id);
    });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.arrayBuffer();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      Buffer.from(rawBody),
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature verification failed";
    console.error("[stripe/webhook] Signature error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const clerk = await clerkClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const clerkUserId = session.metadata?.clerkUserId;
      const plan = session.metadata?.plan;

      if (clerkUserId && plan) {
        await clerk.users.updateUserMetadata(clerkUserId, {
          publicMetadata: { plan, paymentFailedAt: null },
        });
        await syncPlanToSupabase(clerkUserId, plan);
      }

      // Send welcome email
      if (session.customer) {
        try {
          const customer = await stripe.customers.retrieve(session.customer as string) as Stripe.Customer;
          if (customer.email) {
            const customerName = customer.name ?? customer.email.split("@")[0];
            await sendWelcomeEmail(customer.email, customerName);
          }
        } catch (err) {
          console.error("[stripe/webhook] Failed to send welcome email:", err);
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const clerkUserId = subscription.metadata?.clerkUserId;

      if (clerkUserId) {
        await clerk.users.updateUserMetadata(clerkUserId, {
          publicMetadata: { plan: "free" },
        });
        await syncPlanToSupabase(clerkUserId, "free");
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.warn("[stripe/webhook] Payment failed for invoice:", invoice.id);

      // Resolve clerkUserId via the subscription metadata
      // Note: Stripe 2026 API moved invoice.subscription → invoice.parent
      const invoiceAny = invoice as unknown as Record<string, unknown>;
      const subscriptionId =
        (invoiceAny.subscription as string | undefined) ??
        ((invoiceAny.parent as { subscription_details?: { subscription?: string } } | undefined)
          ?.subscription_details?.subscription);
      let failedClerkUserId: string | null = null;
      if (subscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          failedClerkUserId = subscription.metadata?.clerkUserId ?? null;
        } catch (err) {
          console.error("[stripe/webhook] Failed to retrieve subscription:", err);
        }
      }

      // Set paymentFailedAt in Clerk user metadata
      if (failedClerkUserId) {
        try {
          await clerk.users.updateUserMetadata(failedClerkUserId, {
            publicMetadata: { paymentFailedAt: new Date().toISOString() },
          });
        } catch (err) {
          console.error("[stripe/webhook] Failed to set paymentFailedAt:", err);
        }
      }

      // Send payment-failed email
      if (invoice.customer) {
        try {
          const customer = await stripe.customers.retrieve(invoice.customer as string) as Stripe.Customer;
          if (customer.email) {
            const customerName = customer.name ?? customer.email.split("@")[0];
            const retryDate = invoice.next_payment_attempt
              ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "a future date";
            await sendPaymentFailedEmail(customer.email, customerName, retryDate);
          }
        } catch (err) {
          console.error("[stripe/webhook] Failed to send payment-failed email:", err);
        }
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
