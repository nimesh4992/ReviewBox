import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { sendPaymentFailedEmail } from "@/lib/email/send-payment-failed";
import { audit } from "@/lib/audit";
import { getServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * Mirror the plan onto `workspaces.plan`.
 *
 * THROWS on failure — deliberately. This write was previously fire-and-forget:
 * supabase-js returns `{data,error}` rather than throwing, so a rejected write
 * (RLS, a transient blip, the plan-vocabulary constraint before migration 025)
 * left the row stale with no exception, no log and no Sentry event, while the
 * handler still returned 200 and Stripe marked the event delivered forever.
 *
 * The staleness propagates: resolveByCustomer() reads `workspaces.plan` back
 * out as the fallback plan for Stripe-originated events, and feeds it into
 * Clerk's publicMetadata.plan — the actual entitlement source of truth. So a
 * silent failure here can eventually downgrade a customer who paid.
 *
 * Throwing lets the caller return 500 so Stripe retries.
 */
async function syncPlanToSupabase(clerkUserId: string, plan: string): Promise<string | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("workspace_members")
    .select("workspace_id")
    .eq("clerk_user_id", clerkUserId)
    .limit(1);
  if (!data?.length) return null;
  const workspaceId = data[0].workspace_id as string;

  const { error } = await sb.from("workspaces").update({ plan }).eq("id", workspaceId);
  if (error) {
    throw new Error(
      `syncPlanToSupabase: failed to set plan=${plan} on workspace ${workspaceId}: ${error.message}`,
    );
  }
  return workspaceId;
}

/**
 * Release the idempotency marker so Stripe's retry is actually allowed to
 * reprocess this event.
 *
 * The marker is written BEFORE processing so two concurrent deliveries of the
 * same event can't both run. That is correct for concurrency but wrong for
 * failure: without this release, an event that failed halfway was permanently
 * recorded as handled, and every subsequent retry short-circuited on the
 * duplicate check.
 */
async function releaseEventMarker(eventId: string): Promise<void> {
  try {
    const sb = getServiceClient();
    const { error } = await sb.from("webhook_events").delete().eq("id", eventId);
    if (error) {
      console.error("[stripe/webhook] could not release dedup marker:", error);
    }
  } catch (err) {
    console.error("[stripe/webhook] could not release dedup marker:", err);
  }
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

// Resolve the workspace + owner for a Stripe customer id. Used for
// subscription events (portal plan changes, dunning) that Stripe originates
// itself — those carry NO clerkUserId in subscription.metadata (only the
// checkout-created subscription does), so without this fallback past_due /
// canceled status never syncs. Relies on stripe_customer_id cached at checkout.
async function resolveByCustomer(
  customerId: string,
): Promise<{ clerkUserId: string; currentPlan: string } | null> {
  const sb = getServiceClient();
  const { data: ws } = await sb
    .from("workspaces")
    .select("id, plan")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (!ws?.id) return null;

  const { data: owner } = await sb
    .from("workspace_members")
    .select("clerk_user_id")
    .eq("workspace_id", ws.id as string)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (!owner?.clerk_user_id) return null;

  return {
    clerkUserId: owner.clerk_user_id as string,
    currentPlan: (ws.plan as string | null) ?? "starter",
  };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.arrayBuffer();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // Fail loudly + visibly rather than passing `undefined` to constructEvent
    // (which yields an opaque signature error). A misconfigured deploy must not
    // silently 400 every webhook → subscriptions would never sync.
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ received: false, error: "WEBHOOK_NOT_CONFIGURED" }, { status: 503 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      Buffer.from(rawBody),
      sig,
      webhookSecret,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature verification failed";
    console.error("[stripe/webhook] Signature error:", message);
    // Never echo internal error message back to the caller — Stripe doesn't use it
    return NextResponse.json({ received: false }, { status: 400 });
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

  try {
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

      // Prefer metadata (set at checkout); fall back to customer lookup for
      // Stripe-originated changes (portal plan change, dunning) that carry none.
      let clerkUserId: string | null = subscription.metadata?.clerkUserId ?? null;
      let basePlan: string | null = subscription.metadata?.plan ?? null;
      if (!clerkUserId && subscription.customer) {
        const resolved = await resolveByCustomer(subscription.customer as string);
        if (resolved) {
          clerkUserId = resolved.clerkUserId;
          basePlan = basePlan ?? resolved.currentPlan;
        }
      }

      if (clerkUserId) {
        const status = subscription.status;
        const activePlan = basePlan ?? "starter";
        const mappedPlan =
          status === "active" || status === "trialing"
            ? activePlan
            : status === "past_due"
              ? "past_due"
              : status === "canceled"
                ? "canceled"
                : activePlan;
        await updateUserPlan(clerkUserId, { plan: mappedPlan });
        await syncPlanToSupabase(clerkUserId, mappedPlan);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      let clerkUserId: string | null = subscription.metadata?.clerkUserId ?? null;
      if (!clerkUserId && subscription.customer) {
        const resolved = await resolveByCustomer(subscription.customer as string);
        clerkUserId = resolved?.clerkUserId ?? null;
      }

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
  } catch (err) {
    // A 200 here would tell Stripe the event is handled and it would never be
    // delivered again — which is how a transiently-failed plan write became a
    // permanently stale plan on a paying customer. Release the marker, report
    // it, and 500 so Stripe's automatic retry can genuinely retry.
    console.error(`[stripe/webhook] processing ${event.type} (${event.id}) failed:`, err);
    Sentry.captureException(err, {
      level: "error",
      tags: { route: "stripe/webhook", eventType: event.type },
      extra: { eventId: event.id },
    });
    await releaseEventMarker(event.id);
    return NextResponse.json({ received: false, error: "PROCESSING_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
