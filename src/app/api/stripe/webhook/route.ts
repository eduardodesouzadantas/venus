import { NextResponse } from "next/server";
import Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { queryWithTimeout } from "@/lib/supabase/query-timeout";
import {
  createStripeClient,
  getStripeWebhookSecret,
  resolvePlanIdFromStripePriceId,
} from "@/lib/billing/stripe";

export const runtime = "nodejs";

const GRACE_PERIOD_DAYS = parseInt(process.env.BILLING_GRACE_PERIOD_DAYS || "7", 10);

function getInvoiceFailureReason(invoice: Stripe.Invoice) {
  const typedInvoice = invoice as Stripe.Invoice & {
    last_payment_error?: { message?: string } | string | null;
  };

  if (typeof typedInvoice.last_payment_error === "string") {
    return typedInvoice.last_payment_error;
  }

  return typedInvoice.last_payment_error?.message || "payment failed";
}

async function recordPaymentEvent(row: {
  org_id: string;
  event_type: string;
  event_source: string;
  stripe_event_id: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_invoice_id?: string | null;
  stripe_price_id?: string | null;
  amount_cents?: number;
  currency?: string;
  status: string;
  payment_method?: string | null;
  failure_reason?: string | null;
  processed_at?: string | null;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("billing_payment_events").insert(row);
  if (error) {
    console.warn("[STRIPE_WEBHOOK] failed to record payment event", {
      orgId: row.org_id,
      eventType: row.event_type,
      error: error.message,
    });
  }
}

async function recordInvoice(row: {
  org_id: string;
  stripe_invoice_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
  amount_cents: number;
  amount_paid_cents: number;
  amount_due_cents: number;
  currency?: string;
  status: string;
  billing_period_from: string;
  billing_period_to: string;
  due_date: string;
  paid_at?: string | null;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("billing_invoices").upsert(row, { onConflict: "stripe_invoice_id" });
  if (error) {
    console.warn("[STRIPE_WEBHOOK] failed to record invoice", {
      orgId: row.org_id,
      invoiceId: row.stripe_invoice_id,
      error: error.message,
    });
  }
}

async function shouldEnableGracePeriod(orgId: string, billingStatus: string) {
  return billingStatus === "past_due" || billingStatus === "unpaid";
}

async function enableGracePeriod(orgId: string) {
  const graceUntil = new Date();
  graceUntil.setDate(graceUntil.getDate() + GRACE_PERIOD_DAYS);

  const admin = createAdminClient();
  const { error } = await admin
    .from("billing_subscriptions")
    .update({
      grace_period_enabled: true,
      grace_period_until: graceUntil.toISOString(),
    })
    .eq("org_id", orgId);

  if (error) {
    console.warn("[STRIPE_WEBHOOK] failed to enable grace period", {
      orgId,
      error: error.message,
    });
    return false;
  }

  return true;
}

async function disableGracePeriod(orgId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("billing_subscriptions")
    .update({
      grace_period_enabled: false,
      grace_period_until: null,
    })
    .eq("org_id", orgId);

  if (error) {
    console.warn("[STRIPE_WEBHOOK] failed to disable grace period", {
      orgId,
      error: error.message,
    });
    return false;
  }

  return true;
}

async function updateKillSwitch(orgId: string, enable: boolean) {
  const admin = createAdminClient();
  const { error } = await admin.from("orgs").update({ kill_switch: enable }).eq("id", orgId);

  if (error) {
    console.warn("[STRIPE_WEBHOOK] failed to update kill switch", {
      orgId,
      killSwitch: enable,
      error: error.message,
    });
    return false;
  }

  return true;
}

async function isGracePeriodEnabledForOrg(orgId: string): Promise<boolean> {
  const result = await queryWithTimeout(
    createAdminClient().from("billing_subscriptions").select("grace_period_enabled, grace_period_until").eq("org_id", orgId).maybeSingle(),
    { data: null, error: null }
  );

  if (!result.data) return false;
  if (!result.data.grace_period_enabled) return false;
  if (!result.data.grace_period_until) return false;

  return new Date(result.data.grace_period_until) > new Date();
}

async function upsertBillingSubscription(row: {
  org_id: string;
  billing_provider: "stripe";
  billing_status: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_price_id?: string | null;
  stripe_cancel_at_period_end?: boolean | null;
  stripe_current_period_end?: string | null;
  stripe_synced_at?: string | null;
  payment_retry_count?: number;
  last_payment_error?: string;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("billing_subscriptions").upsert(row, { onConflict: "org_id" });
  if (error) {
    console.warn("[STRIPE_WEBHOOK] failed to upsert billing subscription", {
      orgId: row.org_id,
      error: error.message,
    });
    return false;
  }

  return true;
}

async function updateOrgPlan(orgId: string, planId: string | null) {
  if (!planId) return false;

  const admin = createAdminClient();
  const { error } = await admin.from("orgs").update({ plan_id: planId }).eq("id", orgId);
  if (error) {
    console.warn("[STRIPE_WEBHOOK] failed to update org plan", {
      orgId,
      planId,
      error: error.message,
    });
    return false;
  }

  return true;
}

async function resolveOrgIdByBillingIdentifiers(input: {
  orgId?: string | null;
  subscriptionId?: string | null;
  customerId?: string | null;
  checkoutSessionId?: string | null;
}) {
  const orgId = typeof input.orgId === "string" ? input.orgId.trim() : "";
  if (orgId) return orgId;

  const admin = createAdminClient();
  const identifiers = [
    input.subscriptionId ? ["stripe_subscription_id", input.subscriptionId] : null,
    input.customerId ? ["stripe_customer_id", input.customerId] : null,
    input.checkoutSessionId ? ["stripe_checkout_session_id", input.checkoutSessionId] : null,
  ].filter(Boolean) as Array<[string, string]>;

  for (const [column, value] of identifiers) {
    const result = await queryWithTimeout(
      admin
        .from("billing_subscriptions")
        .select("org_id")
        .eq(column, value)
        .maybeSingle(),
      { data: null, error: null }
    );

    if (!result.error && result.data?.org_id) {
      return String(result.data.org_id);
    }
  }

  return null;
}

async function handleSubscriptionUpsert(subscription: Stripe.Subscription) {
  const orgId = await resolveOrgIdByBillingIdentifiers({
    orgId: subscription.metadata?.org_id || null,
    subscriptionId: subscription.id,
    customerId: typeof subscription.customer === "string" ? subscription.customer : null,
  });

  if (!orgId) {
    console.warn("[STRIPE_WEBHOOK] subscription without org_id", {
      subscriptionId: subscription.id,
      customerId: typeof subscription.customer === "string" ? subscription.customer : null,
    });
    return;
  }

  const planId = resolvePlanIdFromStripePriceId(subscription.items.data[0]?.price?.id || null);
  const billingStatus = subscription.status || "inactive";
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end
    ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
    : null;

  const wasInGracePeriod = await isGracePeriodEnabledForOrg(orgId);

  await upsertBillingSubscription({
    org_id: orgId,
    billing_provider: "stripe",
    billing_status: billingStatus,
    stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : null,
    stripe_subscription_id: subscription.id,
    stripe_checkout_session_id: null,
    stripe_price_id: subscription.items.data[0]?.price?.id || null,
    stripe_cancel_at_period_end: subscription.cancel_at_period_end || false,
    stripe_current_period_end: currentPeriodEnd,
    stripe_synced_at: new Date().toISOString(),
  });

  if (planId && (billingStatus === "active" || billingStatus === "trialing")) {
    await updateOrgPlan(orgId, planId);
    await updateKillSwitch(orgId, false);
    if (wasInGracePeriod) {
      await disableGracePeriod(orgId);
    }
    await recordPaymentEvent({
      org_id: orgId,
      event_type: "subscription_activated",
      event_source: "stripe_webhook",
      stripe_event_id: `sub_${subscription.id}_activated`,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : null,
      amount_cents: 0,
      currency: "BRL",
      status: "processed",
      processed_at: new Date().toISOString(),
    });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orgId = await resolveOrgIdByBillingIdentifiers({
    orgId: session.metadata?.org_id || session.client_reference_id || null,
    subscriptionId: typeof session.subscription === "string" ? session.subscription : null,
    customerId: typeof session.customer === "string" ? session.customer : null,
    checkoutSessionId: session.id,
  });

  if (!orgId) {
    console.warn("[STRIPE_WEBHOOK] checkout completed without org_id", {
      sessionId: session.id,
      customerId: typeof session.customer === "string" ? session.customer : null,
    });
    return;
  }

  const existingEvent = await queryWithTimeout(
    createAdminClient()
      .from("billing_payment_events")
      .select("id")
      .eq("stripe_event_id", `checkout_${session.id}`)
      .maybeSingle(),
    { data: null, error: null }
  );

  if (existingEvent.data) {
    console.log("[STRIPE_WEBHOOK] checkout event already processed, skipping", { sessionId: session.id });
    return;
  }

  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  const stripeClient = createStripeClient();
  let subscription: Stripe.Subscription | null = null;

  if (stripeClient && subscriptionId) {
    try {
      subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      console.warn("[STRIPE_WEBHOOK] failed to hydrate subscription after checkout", {
        orgId,
        subscriptionId,
        error,
      });
    }
  }

  const priceId = subscription?.items.data[0]?.price?.id || null;
  const currentPeriodEnd = subscription?.items.data[0]?.current_period_end
    ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
    : null;
  const planId = resolvePlanIdFromStripePriceId(priceId || null) || session.metadata?.plan_id || null;

  await upsertBillingSubscription({
    org_id: orgId,
    billing_provider: "stripe",
    billing_status: subscription?.status || "incomplete",
    stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
    stripe_subscription_id: subscriptionId,
    stripe_checkout_session_id: session.id,
    stripe_price_id: priceId || null,
    stripe_cancel_at_period_end: subscription?.cancel_at_period_end || false,
    stripe_current_period_end: currentPeriodEnd,
    stripe_synced_at: new Date().toISOString(),
  });

  await recordPaymentEvent({
    org_id: orgId,
    event_type: "checkout_completed",
    event_source: "stripe_webhook",
    stripe_event_id: `checkout_${session.id}`,
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
    amount_cents: session.amount_total || 0,
    currency: session.currency?.toUpperCase() || "BRL",
    status: "processed",
    processed_at: new Date().toISOString(),
  });

  if (planId && (subscription?.status === "active" || subscription?.status === "trialing" || session.payment_status === "paid")) {
    await updateOrgPlan(orgId, planId);
    await updateKillSwitch(orgId, false);
  }
}

export async function POST(request: Request) {
  const webhookSecret = getStripeWebhookSecret();
  const stripeClient = createStripeClient();

  if (!stripeClient || !webhookSecret) {
    return NextResponse.json({ received: true, configured: false }, { status: 200 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  const rawBody = await request.text();

  try {
    event = stripeClient.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.warn("[STRIPE_WEBHOOK] signature verification failed", error);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const orgId = await resolveOrgIdByBillingIdentifiers({
          orgId: invoice.metadata?.org_id || null,
          subscriptionId:
            typeof invoice.parent?.subscription_details?.subscription === "string"
              ? invoice.parent.subscription_details.subscription
              : null,
          customerId: typeof invoice.customer === "string" ? invoice.customer : null,
        });

        if (!orgId) {
          break;
        }

        const existingEvent = await queryWithTimeout(
          createAdminClient()
            .from("billing_payment_events")
            .select("id")
            .eq("stripe_event_id", `invoice_failed_${invoice.id}`)
            .maybeSingle(),
          { data: null, error: null }
        );

        if (existingEvent.data) {
          console.log("[STRIPE_WEBHOOK] invoice.payment_failed already processed", { invoiceId: invoice.id });
          break;
        }

        const subscriptionId =
          typeof invoice.parent?.subscription_details?.subscription === "string"
            ? invoice.parent.subscription_details.subscription
            : null;

        await recordPaymentEvent({
          org_id: orgId,
          event_type: "payment_failed",
          event_source: "stripe_webhook",
          stripe_event_id: `invoice_failed_${invoice.id}`,
          stripe_subscription_id: subscriptionId,
          stripe_invoice_id: invoice.id,
          stripe_customer_id: typeof invoice.customer === "string" ? invoice.customer : null,
          amount_cents: invoice.amount_due || 0,
          currency: invoice.currency?.toUpperCase() || "BRL",
          status: "failed",
          failure_reason: getInvoiceFailureReason(invoice),
        });

        const shouldGrace = await shouldEnableGracePeriod(orgId, "past_due");
        if (shouldGrace) {
          await enableGracePeriod(orgId);
        }

        await updateKillSwitch(orgId, !shouldGrace);

        await upsertBillingSubscription({
          org_id: orgId,
          billing_provider: "stripe",
          billing_status: "past_due",
          stripe_customer_id: typeof invoice.customer === "string" ? invoice.customer : null,
          stripe_subscription_id: subscriptionId,
          stripe_checkout_session_id: null,
          stripe_price_id: null,
          stripe_cancel_at_period_end: false,
          stripe_current_period_end: null,
          stripe_synced_at: new Date().toISOString(),
          payment_retry_count: 1,
          last_payment_error: getInvoiceFailureReason(invoice),
        });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.warn("[STRIPE_WEBHOOK] event handling failed", {
      type: event.type,
      error,
    });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
