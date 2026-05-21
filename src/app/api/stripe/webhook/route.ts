import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { sendPaymentFailedEmail } from "@/lib/email/send-payment-failed";
import { audit } from "@/lib/audit";
import { getServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function syncPlanToSupabase(clerkUserId: string, plan: string): Promise<string | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("workspace_members")
    .select("workspace_id")
    .eq("clerk_user_id", clerkUserId)
    .limit(1);
  if (!data?.length) return null;
  const workspaceId = data[0].workspace_id as string;
  await sb.from("workspaces").update({ plan }).eq("id", workspaceId);
  return workspaceId;
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

  // ── Idempotency: ack duplicates without re-processing ────────────────────────
  {
    const sb = getServiceClient();
    const { error: insertError } = await sb
      .from("webhook_events")
      .insert({ id: event.id, source: "stripe", type: event.type });

    if (insertError) {
      // 23505 = unique_violation — we've already processed this event
      if (insertError.code === "23505") {
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
      }
      // Any other failure: log but don't block — better to double-process
      // than to miss the event entirely
      console.error("[stripe/webhook] dedup insert failed:", insertError);
    }
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
        const workspaceId = await syncPlanToSupabase(clerkUserId, plan);
        await audit({
          workspaceId,
          actorUserId: clerkUserId,
          action: "billing.upgrade",
          targetType: "subscription",
          targetId: session.subscription as string | undefined,
          payload: { plan, stripeSessionId: session.id, amountTotal: session.amount_total },
        });
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
        const workspaceId = await syncPlanToSupabase(clerkUserId, "canceled");
        await audit({
          workspaceId,
          actorUserId: clerkUserId,
          action: "billing.cancel",
          targetType: "subscription",
          targetId: subscription.id,
          payload: { canceledAt: new Date().toISOString() },
        });
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
          await audit({
            workspaceId: null,
            actorUserId: failedClerkUserId,
            action: "billing.payment_failed",
            targetType: "subscription",
            targetId: subscriptionId,
            payload: { invoiceId: invoice.id, retryAt: invoice.next_payment_attempt },
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
