import Stripe from "stripe";

export type StripeBillingStatus =
  | "inactive"
  | "active"
  | "trialing"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export interface StripeCheckoutSessionInput {
  orgId: string;
  orgSlug: string;
  planId: string;
  customerEmail?: string | null;
  customerId?: string | null;
  successUrl: string;
  cancelUrl: string;
}

export interface StripeBillingSubscriptionRecord {
  org_id: string;
  billing_provider: "stripe" | null;
  billing_status: StripeBillingStatus | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_price_id?: string | null;
  stripe_cancel_at_period_end?: boolean | null;
  stripe_current_period_end?: string | null;
  stripe_synced_at?: string | null;
}

const STRIPE_PRICE_ENV_KEYS: Record<string, string[]> = {
  freemium: ["STRIPE_PRICE_ID_FREE", "STRIPE_PRICE_ID"],
  free: ["STRIPE_PRICE_ID_FREE", "STRIPE_PRICE_ID"],
  starter: ["STRIPE_PRICE_ID_STARTER", "STRIPE_PRICE_ID"],
  growth: ["STRIPE_PRICE_ID_GROWTH", "STRIPE_PRICE_ID_PRO", "STRIPE_PRICE_ID"],
  pro: ["STRIPE_PRICE_ID_PRO", "STRIPE_PRICE_ID_GROWTH", "STRIPE_PRICE_ID"],
  scale: ["STRIPE_PRICE_ID_SCALE", "STRIPE_PRICE_ID"],
  enterprise: ["STRIPE_PRICE_ID_ENTERPRISE", "STRIPE_PRICE_ID"],
};

const STRIPE_STATUS_BLOCKLIST = new Set<StripeBillingStatus>([
  "past_due",
  "unpaid",
  "canceled",
  "incomplete_expired",
  "paused",
]);

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeStripeBillingStatus(value: unknown): StripeBillingStatus | null {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) return null;
  if (normalized === "inactive") return "inactive";
  if (normalized === "active") return "active";
  if (normalized === "trialing") return "trialing";
  if (normalized === "past_due") return "past_due";
  if (normalized === "unpaid") return "unpaid";
  if (normalized === "canceled") return "canceled";
  if (normalized === "incomplete") return "incomplete";
  if (normalized === "incomplete_expired") return "incomplete_expired";
  if (normalized === "paused") return "paused";
  return null;
}

export function isStripeBillingStatusBlocking(value: unknown) {
  const status = normalizeStripeBillingStatus(value);
  return status ? STRIPE_STATUS_BLOCKLIST.has(status) : false;
}

export function getStripeSecretKey() {
  return normalize(process.env.STRIPE_SECRET_KEY);
}

export function getStripeWebhookSecret() {
  return normalize(process.env.STRIPE_WEBHOOK_SECRET);
}

export function isStripeBillingConfigured() {
  return Boolean(getStripeSecretKey());
}

export function resolveStripePriceId(planId?: string | null) {
  const normalized = normalize(planId).toLowerCase();
  const envKeys = STRIPE_PRICE_ENV_KEYS[normalized] || STRIPE_PRICE_ENV_KEYS.starter;

  for (const key of envKeys) {
    const value = normalize(process.env[key]);
    if (value) return value;
  }

  return null;
}

export function resolvePlanIdFromStripePriceId(priceId?: string | null) {
  const normalized = normalize(priceId);
  if (!normalized) return null;

  const entries = Object.entries(STRIPE_PRICE_ENV_KEYS);
  for (const [planId, envKeys] of entries) {
    for (const key of envKeys) {
      if (normalize(process.env[key]) === normalized) {
        return planId === "free" || planId === "freemium" ? "free" : planId;
      }
    }
  }

  return null;
}

export function createStripeClient() {
  const secretKey = getStripeSecretKey();
  if (!secretKey) return null;

  return new Stripe(secretKey);
}

export function buildStripeCheckoutSessionParams(input: StripeCheckoutSessionInput): Stripe.Checkout.SessionCreateParams {
  const priceId = resolveStripePriceId(input.planId);
  if (!priceId) {
    throw new Error(`Missing Stripe price for plan ${input.planId}`);
  }

  const metadata = {
    org_id: input.orgId,
    org_slug: input.orgSlug,
    plan_id: input.planId,
  };

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    client_reference_id: input.orgId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata,
    },
    metadata,
    allow_promotion_codes: false,
  };

  if (input.customerId) {
    params.customer = input.customerId;
  } else if (input.customerEmail) {
    params.customer_email = input.customerEmail;
  }

  return params;
}
