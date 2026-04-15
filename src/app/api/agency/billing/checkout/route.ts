import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { queryWithTimeout } from "@/lib/supabase/query-timeout";
import { resolveAgencySession } from "@/lib/agency";
import {
  buildStripeCheckoutSessionParams,
  createStripeClient,
  isStripeBillingConfigured,
  resolveStripePriceId,
} from "@/lib/billing/stripe";

export const runtime = "nodejs";

async function readInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null) as { orgId?: string; planId?: string } | null;
    return {
      orgId: typeof body?.orgId === "string" ? body.orgId.trim() : "",
      planId: typeof body?.planId === "string" ? body.planId.trim() : "",
    };
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return { orgId: "", planId: "" };
  }

  return {
    orgId: String(formData.get("orgId") || "").trim(),
    planId: String(formData.get("planId") || "").trim(),
  };
}

async function persistPendingCheckout(input: {
  orgId: string;
  checkoutSessionId: string;
  priceId: string;
  customerId?: string | null;
  planId: string;
}) {
  const admin = createAdminClient();
  const today = new Date().toISOString();

  const { error } = await admin.from("billing_subscriptions").upsert(
    {
      org_id: input.orgId,
      billing_provider: "stripe",
      billing_status: "incomplete",
      stripe_customer_id: input.customerId || null,
      stripe_subscription_id: null,
      stripe_checkout_session_id: input.checkoutSessionId,
      stripe_price_id: input.priceId,
      stripe_cancel_at_period_end: false,
      stripe_current_period_end: null,
      stripe_synced_at: today,
    },
    { onConflict: "org_id" }
  );

  if (error) {
    console.warn("[BILLING] failed to persist pending checkout session", {
      orgId: input.orgId,
      error: error.message,
    });
  }
}

export async function POST(request: Request) {
  try {
    const session = await resolveAgencySession();
    const { orgId, planId } = await readInput(request);

    if (!orgId) {
      return NextResponse.redirect(new URL("/agency/billing?error=missing_org", request.url), 303);
    }

    const admin = createAdminClient();
    const { data: org, error } = await queryWithTimeout(
      admin
        .from("orgs")
        .select("id, slug, name, plan_id, status, kill_switch")
        .eq("id", orgId)
        .maybeSingle(),
      { data: null, error: null }
    );

    if (error || !org) {
      return NextResponse.redirect(new URL("/agency/billing?error=org_not_found", request.url), 303);
    }

    const stripeClient = createStripeClient();
    const priceId = resolveStripePriceId(planId || org.plan_id);
    if (!stripeClient || !priceId || !isStripeBillingConfigured()) {
      return NextResponse.redirect(new URL("/agency/billing?stripe=unavailable", request.url), 303);
    }

    const existingBilling = await queryWithTimeout(
      admin
        .from("billing_subscriptions")
        .select("stripe_customer_id")
        .eq("org_id", org.id)
        .maybeSingle(),
      { data: null, error: null }
    );

    const successUrl = new URL(`/agency/billing?org=${encodeURIComponent(org.id)}&checkout=success`, request.url).toString();
    const cancelUrl = new URL(`/agency/billing?org=${encodeURIComponent(org.id)}&checkout=cancel`, request.url).toString();

    const checkoutSession = await stripeClient.checkout.sessions.create(
      buildStripeCheckoutSessionParams({
        orgId: org.id,
        orgSlug: org.slug,
        planId: planId || org.plan_id || "starter",
        customerId: existingBilling.data?.stripe_customer_id || null,
        customerEmail: session.user.email || null,
        successUrl,
        cancelUrl,
      })
    );

    await persistPendingCheckout({
      orgId: org.id,
      checkoutSessionId: checkoutSession.id,
      priceId,
      customerId: existingBilling.data?.stripe_customer_id || null,
      planId: planId || org.plan_id || "starter",
    });

    if (checkoutSession.url) {
      return NextResponse.redirect(checkoutSession.url, 303);
    }

    return NextResponse.redirect(new URL("/agency/billing?error=checkout_missing_url", request.url), 303);
  } catch (error) {
    console.warn("[BILLING] checkout session failed", error);
    return NextResponse.redirect(new URL("/agency/billing?error=checkout_failed", request.url), 303);
  }
}
