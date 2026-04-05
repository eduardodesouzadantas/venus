import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgBillingSummary } from "@/lib/billing";

export type HardCapOperation = "saved_result_generation" | "catalog_product_creation";

export type HardCapMetric = "saved_results" | "estimated_cost_today" | "estimated_cost_total" | "products";

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

  if (operation === "saved_result_generation") {
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

  return allowDecision(operation, planId);
}

async function recordHardCapBlock(
  input: HardCapEnforcementInput,
  decision: HardCapDecision
) {
  const admin = createAdminClient();
  const dateSuffix = new Date().toISOString().slice(0, 10);
  const dedupeKey = `hard_cap:${input.orgId}:${decision.operation}:${decision.metric || "unknown"}:${dateSuffix}:${Date.now()}`;

  const { error } = await admin.from("tenant_events").insert({
    org_id: input.orgId,
    actor_user_id: input.actorUserId || null,
    event_type: "billing.hard_cap_blocked",
    event_source: input.eventSource || "billing_guard",
    dedupe_key: dedupeKey,
    payload: {
      org_id: input.orgId,
      operation: decision.operation,
      metric: decision.metric,
      usage: decision.usage,
      cap: decision.cap,
      usage_pct: decision.usage_pct,
      plan_id: decision.plan_id,
      message: decision.message,
      ...input.metadata,
    },
  });

  if (error) {
    console.warn("[BILLING] failed to audit hard cap block", error);
  }
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
