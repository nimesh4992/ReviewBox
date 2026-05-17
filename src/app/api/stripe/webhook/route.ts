import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { sendPaymentFailedEmail } from "@/lib/email/send-payment-failed";

export const dynamic = "force-dynamic";

async function syncPlanToSupabase(clerkUserId: string, plan: string) {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data } = await sb
    .from("workspace_members")
    .select("workspace_id")
    .eq("clerk_user_id", clerkUserId)
    .limit(1);
  if (!data?.length) return;
  await sb.from("workspaces").update({ plan }).eq("id", data[0].workspace_id);
}

async function updateUserPlan(
  clerkUserId: string,
  patch: { plan?: string; trialEndsAt?: string | null; paymentFailedAt?: string | null },
) {
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(clerkUserId);
  await clerk.users.updateUserMetadata(clerkUserId, {
    publicMetadata: {
      ...user.publicMetadata,
      ...patch,
    },
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
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature verification failed";
    console.error("[stripe/webhook] Signature error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const clerkUserId = session.metadata?.clerkUserId ?? session.client_reference_id;
      const plan = session.metadata?.plan;

      if (clerkUserId && plan) {
        // Trial → paid: set plan, clear trial expiry, clear payment-failed flag
        await updateUserPlan(clerkUserId, {
          plan,
          trialEndsAt: null,
          paymentFailedAt: null,
        });
        await syncPlanToSupabase(clerkUserId, plan);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const clerkUserId = subscription.metadata?.clerkUserId;
      const plan = subscription.metadata?.plan;

      if (clerkUserId && plan) {
        const status = subscription.status;
        const mappedPlan =
          status === "active" || status === "trialing"
            ? plan
            : status === "past_due"
              ? "past_due"
              : status === "canceled"
                ? "canceled"
                : plan;
        await updateUserPlan(clerkUserId, { plan: mappedPlan });
        await syncPlanToSupabase(clerkUserId, mappedPlan);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const clerkUserId = subscription.metadata?.clerkUserId;

      if (clerkUserId) {
        await updateUserPlan(clerkUserId, { plan: "canceled" });
        await syncPlanToSupabase(clerkUserId, "canceled");
      }
      break;
    }

    case "invoice.payment_succeeded": {
      // Payment recovered — clear the failure flag if it was set
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceAny = invoice as unknown as Record<string, unknown>;
      const subscriptionId =
        (invoiceAny.subscription as string | undefined) ??
        ((invoiceAny.parent as { subscription_details?: { subscription?: string } } | undefined)
          ?.subscription_details?.subscription);

      if (subscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const clerkUserId = sub.metadata?.clerkUserId;
          if (clerkUserId) {
            await updateUserPlan(clerkUserId, { paymentFailedAt: null });
          }
        } catch (err) {
          console.error("[stripe/webhook] payment_succeeded recovery:", err);
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.warn("[stripe/webhook] Payment failed for invoice:", invoice.id);

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

      if (failedClerkUserId) {
        try {
          await updateUserPlan(failedClerkUserId, {
            paymentFailedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error("[stripe/webhook] Failed to set paymentFailedAt:", err);
        }
      }

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
