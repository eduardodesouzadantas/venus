import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { queryWithTimeout } from "@/lib/supabase/query-timeout";
import {
  DEFAULT_LIMITS,
  getResourceLimits,
  setResourceLimits,
  getResourceUsage,
  type ResourceType,
  type ResourceLimitRecord,
} from "@/lib/resource-control";
import { calculateTenantProfit } from "@/lib/agency/profit-control";
import { getPlanSoftCaps, type PlanTier } from "@/lib/billing/limits";
import { recordOperationalTenantEvent } from "@/lib/reliability/observability";
import { logAudit } from "@/lib/security/audit";
import { recordOptimizationAudit, type OptimizationAuditRecord } from "./audit";

import type { TenantMetrics, LimitAdjustment, OptimizationJobResult, PolicyRule } from "./types";
import { getPolicyRules, selectBestRule, applyAdjustmentAction, matchRule } from "./policy-engine";

const RESOURCE_TYPES: ResourceType[] = ["ai_tokens", "try_on", "whatsapp_message"];

const GLOBAL_MAX_LIMITS: Record<ResourceType, number> = {
  ai_tokens: 1_000_000,
  try_on: 500,
  whatsapp_message: 10_000,
  saved_result: 500,
  product: 2000,
  lead: 2000,
};

const MIN_SAFE_LIMITS: Record<ResourceType, number> = {
  ai_tokens: 1000,
  try_on: 5,
  whatsapp_message: 10,
  saved_result: 10,
  product: 10,
  lead: 10,
};

function normalizePlanTier(planId?: string | null): PlanTier {
  if (!planId) return "starter";
  const normalized = planId.toLowerCase();
  if (normalized === "freemium" || normalized === "free") return "free";
  if (normalized === "starter") return "starter";
  if (normalized === "pro" || normalized === "growth") return "growth";
  if (normalized === "scale") return "scale";
  if (normalized === "enterprise") return "enterprise";
  return "starter";
}

function calculateROI(revenueCents: number, costCents: number): number {
  if (costCents <= 0) return revenueCents > 0 ? 10 : 0;
  return revenueCents / costCents;
}

async function loadTenantMetrics(orgId: string, planId: string | null, billingBlocked: boolean): Promise<TenantMetrics> {
  const admin = createAdminClient();

  const profit = await calculateTenantProfit(orgId);
  const roi = calculateROI(profit.revenue_cents, profit.cost_cents);

  const limitRows = await getResourceLimits(orgId);
  const usageRows = await getResourceUsage(orgId, null, 30);

  const limits: Record<ResourceType, number> = {} as Record<ResourceType, number>;
  const usage: Record<ResourceType, number> = {} as Record<ResourceType, number>;
  const usagePct: Record<ResourceType, number> = {} as Record<ResourceType, number>;

  for (const resourceType of RESOURCE_TYPES) {
    const limitRow = limitRows.find((r) => r.resource_type === resourceType);
    const planCaps = getPlanSoftCaps(normalizePlanTier(planId));

    let defaultLimit: number;
    switch (resourceType) {
      case "ai_tokens":
        defaultLimit = planCaps.estimated_cost_total_cents;
        break;
      case "try_on":
        defaultLimit = Math.floor(planCaps.products * 0.1);
        break;
      case "whatsapp_message":
        defaultLimit = planCaps.whatsapp_messages;
        break;
      default:
        defaultLimit = DEFAULT_LIMITS[resourceType];
    }

    const limit = limitRow?.limit_monthly || limitRow?.limit_override || defaultLimit;
    limits[resourceType] = Math.min(limit, GLOBAL_MAX_LIMITS[resourceType]);

    const used = usageRows
      .filter((r) => r.resource_type === resourceType)
      .reduce((sum, r) => sum + r.used_count, 0);
    usage[resourceType] = used;
    usagePct[resourceType] = limits[resourceType] > 0 ? (used / limits[resourceType]) * 100 : 0;
  }

  const avgUsagePct = Object.values(usagePct).reduce((sum, v) => sum + v, 0) / RESOURCE_TYPES.length;

  let risk: "normal" | "attention" | "critical" = "normal";
  if (billingBlocked || profit.margin_percent < -10) {
    risk = "critical";
  } else if (avgUsagePct >= 95 || profit.margin_percent < 0) {
    risk = "attention";
  }

  const hasManualOverride = limitRows.some((r) => r.limit_override !== null);

  return {
    org_id: orgId,
    margin_percent: profit.margin_percent,
    margin_cents: profit.margin_cents,
    roi,
    usage_pct: usagePct,
    usage,
    limits,
    risk,
    billing_status: null,
    is_billing_blocked: billingBlocked,
    has_manual_override: hasManualOverride,
  };
}

async function loadAllTenantMetrics(): Promise<Array<{ orgId: string; planId: string | null; metrics: TenantMetrics }>> {
  const admin = createAdminClient();

  const [orgsResult, billingResult] = await Promise.all([
    queryWithTimeout(
      admin.from("orgs").select("id, plan_id, status, kill_switch").eq("status", "active"),
      { data: [], error: null }
    ),
    queryWithTimeout(
      admin.from("billing_subscriptions").select("org_id, billing_status").order("updated_at", { ascending: false }),
      { data: [], error: null }
    ),
  ]);

  const billingByOrg = new Map<string, string>();
  for (const row of billingResult.data || []) {
    if (row.org_id && !billingByOrg.has(row.org_id)) {
      billingByOrg.set(row.org_id, row.billing_status);
    }
  }

  const billingBlockedStatuses = ["past_due", "canceled", "unpaid", "incomplete_expired"];
  const results: Array<{ orgId: string; planId: string | null; metrics: TenantMetrics }> = [];

  for (const org of orgsResult.data || []) {
    const billingStatus = billingByOrg.get(org.id) || null;
    const isBillingBlocked = billingStatus ? billingBlockedStatuses.includes(billingStatus) : false;

    try {
      const metrics = await loadTenantMetrics(org.id, org.plan_id, isBillingBlocked);
      results.push({ orgId: org.id, planId: org.plan_id, metrics });
    } catch (error) {
      console.warn("[AUTO-LIMITS] Failed to load metrics for org", { orgId: org.id, error });
    }
  }

  return results;
}

function computeAdjustments(metrics: TenantMetrics, planId: string | null): LimitAdjustment[] {
  if (metrics.has_manual_override || metrics.is_billing_blocked) {
    return [];
  }

  const adjustments: LimitAdjustment[] = [];
  const rules = getPolicyRules();

  const matchedRules = rules.filter((rule) => matchRule(rule, metrics));
  const primaryRule = matchedRules[0] || null;

  if (!primaryRule) {
    return adjustments;
  }

  for (const resourceType of RESOURCE_TYPES) {
    const currentLimit = metrics.limits[resourceType];
    const usagePct = metrics.usage_pct[resourceType];

    const resourceRule =
      matchedRules.find((rule) => rule.conditions.some((c) => c.metric === "usage_pct" && c.operator === "gte")) || primaryRule;

    const newLimit = applyAdjustmentAction(
      currentLimit,
      resourceRule.action,
      resourceRule.factor,
      GLOBAL_MAX_LIMITS[resourceType],
      MIN_SAFE_LIMITS[resourceType]
    );

    if (newLimit !== currentLimit) {
      adjustments.push({
        org_id: metrics.org_id,
        resource_type: resourceType,
        previous_limit: currentLimit,
        new_limit: newLimit,
        factor: resourceRule.factor,
        action: resourceRule.action,
        reason: `${resourceRule.name}: ${resourceRule.description}`,
        policy_rule_id: resourceRule.id,
      });
    }
  }

  return adjustments;
}

async function applyAdjustments(
  adjustments: LimitAdjustment[],
  dryRun: boolean = false
): Promise<{ success: boolean; applied: number; errors: string[] }> {
  if (adjustments.length === 0) {
    return { success: true, applied: 0, errors: [] };
  }

  const byOrg = new Map<string, LimitAdjustment[]>();
  for (const adj of adjustments) {
    const existing = byOrg.get(adj.org_id) || [];
    existing.push(adj);
    byOrg.set(adj.org_id, existing);
  }

  const errors: string[] = [];
  let applied = 0;

  for (const [orgId, orgAdjustments] of byOrg) {
    const limitInputs = orgAdjustments.map((adj) => ({
      resourceType: adj.resource_type,
      monthlyLimit: adj.new_limit,
      overrideLimit: null,
    }));

    if (dryRun) {
      console.log("[AUTO-LIMITS] Dry run - would apply", { orgId, adjustments: orgAdjustments });
      applied += orgAdjustments.length;
      continue;
    }

    try {
      const result = await setResourceLimits(orgId, limitInputs, "system_auto_limits");
      if (result.length > 0) {
        applied += orgAdjustments.length;
      } else {
        errors.push(`Failed to set limits for org ${orgId}`);
      }
    } catch (error) {
      errors.push(`Error setting limits for org ${orgId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { success: errors.length === 0, applied, errors };
}

export async function runAutoLimitsJob(dryRun: boolean = false): Promise<OptimizationJobResult> {
  const jobId = `auto_limits_${new Date().toISOString().slice(0, 10)}_${Date.now()}`;
  const startedAt = new Date().toISOString();

  console.log("[AUTO-LIMITS] Starting job", { jobId, dryRun });

  const tenantData = await loadAllTenantMetrics();

  const allAdjustments: LimitAdjustment[] = [];
  const tenantMetricsMap = new Map<string, TenantMetrics>();
  const details: OptimizationJobResult["details"] = [];

  for (const { orgId, planId, metrics } of tenantData) {
    tenantMetricsMap.set(orgId, metrics);

    try {
      const adjustments = computeAdjustments(metrics, planId);
      allAdjustments.push(...adjustments);

      details.push({
        org_id: orgId,
        adjustments,
        success: adjustments.length > 0,
      });
    } catch (error) {
      details.push({
        org_id: orgId,
        adjustments: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const applyResult = await applyAdjustments(allAdjustments, dryRun);

  if (!dryRun && allAdjustments.length > 0) {
    const auditRecords: OptimizationAuditRecord[] = allAdjustments.map((adj) => {
      const metrics = tenantMetricsMap.get(adj.org_id);
      return {
        org_id: adj.org_id,
        resource_type: adj.resource_type,
        previous_limit: adj.previous_limit,
        new_limit: adj.new_limit,
        factor: adj.factor,
        action: adj.action,
        reason: adj.reason,
        policy_rule_id: adj.policy_rule_id,
        job_id: jobId,
        is_dry_run: false,
        created_by: "system_auto_limits",
        created_at: new Date().toISOString(),
        metadata: {
          tenant_metrics: metrics
            ? { margin: metrics.margin_percent, roi: metrics.roi }
            : null,
        },
      };
    });

    await recordOptimizationAudit(auditRecords).catch((err) => {
      console.warn("[AUTO-LIMITS] Audit recording failed", { error: err });
    });
  }

  const completedAt = new Date().toISOString();

  await recordOperationalTenantEvent(createAdminClient(), {
    orgId: "system",
    actorUserId: "system_auto_limits",
    eventType: "optimization.auto_limits_job",
    eventSource: "optimization",
    dedupeKeyParts: [jobId],
    payload: {
      job_id: jobId,
      dry_run: dryRun,
      tenants_processed: tenantData.length,
      adjustments_applied: applyResult.applied,
      errors: applyResult.errors,
    },
  }).catch(() => {});

  console.log("[AUTO-LIMITS] Job completed", {
    jobId,
    tenants: tenantData.length,
    adjustments: applyResult.applied,
    errors: applyResult.errors.length,
  });

  return {
    job_id: jobId,
    started_at: startedAt,
    completed_at: completedAt,
    tenants_processed: tenantData.length,
    adjustments_applied: applyResult.applied,
    errors: applyResult.errors,
    details,
  };
}

export async function getOptimizationRecommendations(orgId: string): Promise<{
  current_metrics: TenantMetrics | null;
  recommended_adjustments: LimitAdjustment[];
  active_policies: string[];
}> {
  const admin = createAdminClient();

  const [orgResult, billingResult] = await Promise.all([
    admin.from("orgs").select("id, plan_id, status, kill_switch").eq("id", orgId).maybeSingle(),
    admin.from("billing_subscriptions").select("billing_status").eq("org_id", orgId).maybeSingle(),
  ]);

  if (!orgResult.data) {
    return { current_metrics: null, recommended_adjustments: [], active_policies: [] };
  }

  const billingBlockedStatuses = ["past_due", "canceled", "unpaid", "incomplete_expired"];
  const isBillingBlocked = billingResult.data?.billing_status
    ? billingBlockedStatuses.includes(billingResult.data.billing_status)
    : false;

  const metrics = await loadTenantMetrics(orgId, orgResult.data.plan_id, isBillingBlocked);
  const adjustments = computeAdjustments(metrics, orgResult.data.plan_id);

  const rules = getPolicyRules();
  const activePolicies = rules
    .filter((rule) => matchRule(rule, metrics))
    .map((rule) => rule.id);

  return {
    current_metrics: metrics,
    recommended_adjustments: adjustments,
    active_policies: activePolicies,
  };
}
