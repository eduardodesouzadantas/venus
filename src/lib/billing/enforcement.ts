import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgBillingSummary } from "@/lib/billing";
import {
  createOperationalEventDedupeKey,
  formatOperationalReason,
  recordOperationalTenantEvent,
} from "@/lib/reliability/observability";
import {
  isStripeBillingStatusBlocking,
  normalizeStripeBillingStatus,
} from "@/lib/billing/stripe";

export type HardCapOperation =
  | "saved_result_generation"
  | "ai_recommendation_generation"
  | "catalog_product_creation"
  | "whatsapp_handoff_sync";

export type HardCapMetric =
  | "saved_results"
  | "estimated_cost_today"
  | "estimated_cost_total"
  | "products"
  | "whatsapp_messages"
  | "billing_status";

export interface HardCapDecision {
  allowed: boolean;
  operation: HardCapOperation;
  metric: HardCapMetric | null;
  usage: number | null;
  cap: number | null;
  usage_pct: number | null;
  plan_id: string | null;
  message: string | null;
}

export interface HardCapEnforcementInput {
  orgId: string;
  operation: HardCapOperation;
  actorUserId?: string | null;
  eventSource?: string | null;
  metadata?: Record<string, unknown>;
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatPercent(usage: number | null, cap: number | null) {
  if (usage === null || cap === null || cap <= 0) return null;
  return (usage / cap) * 100;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function blockDecision(
  operation: HardCapOperation,
  metric: HardCapMetric,
  usage: number,
  cap: number,
  planId: string | null,
  message: string
): HardCapDecision {
  return {
    allowed: false,
    operation,
    metric,
    usage,
    cap,
    usage_pct: formatPercent(usage, cap),
    plan_id: planId,
    message,
  };
}

function allowDecision(operation: HardCapOperation, planId: string | null): HardCapDecision {
  return {
    allowed: true,
    operation,
    metric: null,
    usage: null,
    cap: null,
    usage_pct: null,
    plan_id: planId,
    message: null,
  };
}

function isBillingEnforcementBypassed() {
  if (process.env.BILLING_ENFORCEMENT_DISABLED === "true") {
    return true;
  }

  const vercelEnv = (process.env.VERCEL_ENV || "").toLowerCase();
  if (vercelEnv && vercelEnv !== "production") {
    return true;
  }

  const nodeEnv = (process.env.NODE_ENV || "").toLowerCase();
  if (nodeEnv === "development" || nodeEnv === "test") {
    return true;
  }

  return false;
}

function evaluateHardCap(summary: Awaited<ReturnType<typeof getOrgBillingSummary>>, operation: HardCapOperation): HardCapDecision {
  if (!summary) {
    return {
      allowed: true,
      operation,
      metric: null,
      usage: null,
      cap: null,
      usage_pct: null,
      plan_id: null,
      message: null,
    };
  }

  const planId = summary.plan_id || null;
  const caps = summary.plan_soft_caps;
  const billingStatus = normalizeStripeBillingStatus(summary.billing_status);

  if (billingStatus && isStripeBillingStatusBlocking(billingStatus)) {
    return blockDecision(
      operation,
      "billing_status",
      1,
      1,
      planId,
      `A assinatura Stripe está ${billingStatus} e bloqueia esta operação.`
    );
  }

  if (operation === "saved_result_generation" || operation === "ai_recommendation_generation") {
    if (summary.total_saved_results >= caps.saved_results) {
      return blockDecision(
        operation,
        "saved_results",
        summary.total_saved_results,
        caps.saved_results,
        planId,
        `O plano ${planId || "atual"} atingiu o limite de saved results (${summary.total_saved_results}/${caps.saved_results}).`
      );
    }

    if (summary.estimated_cost_today_cents >= caps.estimated_cost_today_cents) {
      return blockDecision(
        operation,
        "estimated_cost_today",
        summary.estimated_cost_today_cents,
        caps.estimated_cost_today_cents,
        planId,
        `O plano ${planId || "atual"} atingiu o teto de custo diário (${formatCurrency(summary.estimated_cost_today_cents)} / ${formatCurrency(caps.estimated_cost_today_cents)}).`
      );
    }

    if (summary.estimated_cost_total_cents >= caps.estimated_cost_total_cents) {
      return blockDecision(
        operation,
        "estimated_cost_total",
        summary.estimated_cost_total_cents,
        caps.estimated_cost_total_cents,
        planId,
        `O plano ${planId || "atual"} atingiu o teto de custo acumulado (${formatCurrency(summary.estimated_cost_total_cents)} / ${formatCurrency(caps.estimated_cost_total_cents)}).`
      );
    }
  }

  if (operation === "catalog_product_creation") {
    if (summary.total_products >= caps.products) {
      return blockDecision(
        operation,
        "products",
        summary.total_products,
        caps.products,
        planId,
        `O plano ${planId || "atual"} atingiu o limite de produtos (${summary.total_products}/${caps.products}).`
      );
    }
  }

  if (operation === "whatsapp_handoff_sync") {
    if ((summary.total_whatsapp_messages || 0) >= caps.whatsapp_messages) {
      return blockDecision(
        operation,
        "whatsapp_messages",
        summary.total_whatsapp_messages || 0,
        caps.whatsapp_messages,
        planId,
        `O plano ${planId || "atual"} atingiu o limite de mensagens do WhatsApp (${summary.total_whatsapp_messages || 0}/${caps.whatsapp_messages}).`
      );
    }

    if (summary.estimated_cost_today_cents >= caps.estimated_cost_today_cents) {
      return blockDecision(
        operation,
        "estimated_cost_today",
        summary.estimated_cost_today_cents,
        caps.estimated_cost_today_cents,
        planId,
        `O plano ${planId || "atual"} atingiu o teto de custo diário (${formatCurrency(summary.estimated_cost_today_cents)} / ${formatCurrency(caps.estimated_cost_today_cents)}).`
      );
    }

    if (summary.estimated_cost_total_cents >= caps.estimated_cost_total_cents) {
      return blockDecision(
        operation,
        "estimated_cost_total",
        summary.estimated_cost_total_cents,
        caps.estimated_cost_total_cents,
        planId,
        `O plano ${planId || "atual"} atingiu o teto de custo acumulado (${formatCurrency(summary.estimated_cost_total_cents)} / ${formatCurrency(caps.estimated_cost_total_cents)}).`
      );
    }
  }

  return allowDecision(operation, planId);
}

async function recordHardCapBlock(
  input: HardCapEnforcementInput,
  decision: HardCapDecision
) {
  const admin = createAdminClient();
  await recordOperationalTenantEvent(admin, {
    orgId: input.orgId,
    actorUserId: input.actorUserId || null,
    eventType: "billing.hard_cap_blocked",
    eventSource: input.eventSource || "billing_guard",
    dedupeKey: createOperationalEventDedupeKey([
      "billing.hard_cap_blocked",
      input.orgId,
      decision.operation,
      decision.metric || "unknown",
      new Date().toISOString().slice(0, 10),
      Date.now().toString(),
    ]),
    payload: {
      org_id: input.orgId,
      operation: decision.operation,
      metric: decision.metric,
      reason_code: formatOperationalReason("hard_cap", decision.metric || "unknown"),
      usage: decision.usage,
      cap: decision.cap,
      usage_pct: decision.usage_pct,
      plan_id: decision.plan_id,
      message: decision.message,
      ...input.metadata,
    },
  });
}

export async function enforceOrgHardCap(input: HardCapEnforcementInput): Promise<HardCapDecision> {
  const orgId = normalize(input.orgId);
  if (!orgId) {
    return {
      allowed: true,
      operation: input.operation,
      metric: null,
      usage: null,
      cap: null,
      usage_pct: null,
      plan_id: null,
      message: null,
    };
  }

  if (isBillingEnforcementBypassed()) {
    const summary = await getOrgBillingSummary(orgId);
    const decision = allowDecision(input.operation, summary?.plan_id || null);
    console.warn("[BILLING] hard cap bypassed for non-production environment", {
      orgId,
      operation: input.operation,
      planId: decision.plan_id,
      billingEnforcementDisabled: process.env.BILLING_ENFORCEMENT_DISABLED === "true",
      vercelEnv: process.env.VERCEL_ENV || null,
      nodeEnv: process.env.NODE_ENV || null,
    });
    return decision;
  }

  const summary = await getOrgBillingSummary(orgId);
  const decision = evaluateHardCap(summary, input.operation);

  if (!decision.allowed) {
    await recordHardCapBlock(
      {
        ...input,
        orgId,
      },
      decision
    );
  }

  return decision;
}
