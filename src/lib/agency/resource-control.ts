import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { queryWithTimeout } from "@/lib/supabase/query-timeout";
import {
  DEFAULT_LIMITS,
  getResourceLimits,
  setResourceLimits,
  type ResourceLimitRecord,
  type ResourceType,
} from "@/lib/resource-control";
import { isStripeBillingStatusBlocking, normalizeStripeBillingStatus, type StripeBillingStatus } from "@/lib/billing/stripe";
import { logAudit } from "@/lib/security/audit";
import { recordOperationalTenantEvent } from "@/lib/reliability/observability";
import type { TenantRecord } from "@/lib/tenant/core";

export type AgencyResourceControlRisk = "normal" | "attention" | "critical";
export type AgencyResourceControlStatus = AgencyResourceControlRisk | "no_data";
export type AgencyResourceControlLimitSource = "override" | "contract" | "seed" | "default";

export interface AgencyResourceControlUsageRow {
  org_id: string | null;
  usage_date: string | null;
  ai_tokens: number | null;
  messages_sent: number | null;
  revenue_cents: number | null;
  cost_cents: number | null;
  leads: number | null;
  tryon_calls: number | null;
  updated_at: string | null;
}

export interface AgencyResourceControlBillingRow {
  org_id: string;
  billing_status: string | null;
  billing_provider: string | null;
  stripe_current_period_end: string | null;
  stripe_synced_at: string | null;
  updated_at: string | null;
}

export interface AgencyResourceControlSnapshot {
  ai_tokens: number | null;
  tryons: number | null;
  messages: number | null;
  revenue_cents: number | null;
  cost_cents: number | null;
  leads: number | null;
  row_count: number;
  last_updated_at: string | null;
}

export interface AgencyResourceControlResource {
  resource_type: ResourceType;
  label: string;
  unit: string;
  used_monthly: number | null;
  monthly_limit: number | null;
  override_limit: number | null;
  effective_limit: number | null;
  usage_pct: number | null;
  projected_monthly_usage: number | null;
  limit_source: AgencyResourceControlLimitSource;
  status: AgencyResourceControlStatus;
  reason: string;
}

export interface AgencyResourceControlRow extends TenantRecord {
  billing_status: StripeBillingStatus | null;
  billing_status_label: string;
  billing_blocked: boolean;
  billing_provider: string | null;
  period_start: string;
  period_end: string;
  days_elapsed: number;
  usage_month: AgencyResourceControlSnapshot;
  resources: AgencyResourceControlResource[];
  risk: AgencyResourceControlRisk;
  alerts: string[];
  projected_spend_cents: number | null;
  margin_estimate_cents: number | null;
  margin_note: string;
  projection_note: string;
}

export interface AgencyResourceControlUpdateInput {
  orgId: string;
  actorUserId: string;
  reason: string;
  resources: Array<{
    resourceType: ResourceType;
    monthlyLimit: number;
    overrideLimit: number | null;
  }>;
}

export interface AgencyResourceControlFieldDefinition {
  resourceType: ResourceType;
  label: string;
  monthlyFieldName: string;
  overrideFieldName: string;
}

interface ResourceDefinition {
  resourceType: ResourceType;
  label: string;
  unit: string;
  usageKey: keyof AgencyResourceControlSnapshot;
  defaultLimit: number;
}

interface AgencyResourceControlBuildInput {
  orgs: TenantRecord[];
  usageRows: AgencyResourceControlUsageRow[];
  limitRows: ResourceLimitRecord[];
  billingRows: AgencyResourceControlBillingRow[];
  referenceDate?: Date;
}

const RESOURCE_DEFINITIONS: ResourceDefinition[] = [
  {
    resourceType: "ai_tokens",
    label: "Tokens IA",
    unit: "tokens",
    usageKey: "ai_tokens",
    defaultLimit: DEFAULT_LIMITS.ai_tokens,
  },
  {
    resourceType: "try_on",
    label: "Try-ons",
    unit: "uso",
    usageKey: "tryons",
    defaultLimit: DEFAULT_LIMITS.try_on,
  },
  {
    resourceType: "whatsapp_message",
    label: "Mensagens",
    unit: "mensagens",
    usageKey: "messages",
    defaultLimit: DEFAULT_LIMITS.whatsapp_message,
  },
];

export const RESOURCE_CONTROL_FIELD_DEFINITIONS: AgencyResourceControlFieldDefinition[] = [
  {
    resourceType: "ai_tokens",
    label: "Tokens IA",
    monthlyFieldName: "monthly_tokens_limit",
    overrideFieldName: "tokens_override",
  },
  {
    resourceType: "try_on",
    label: "Try-ons",
    monthlyFieldName: "monthly_tryons_limit",
    overrideFieldName: "tryons_override",
  },
  {
    resourceType: "whatsapp_message",
    label: "Mensagens",
    monthlyFieldName: "monthly_messages_limit",
    overrideFieldName: "messages_override",
  },
];

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPositiveNumber(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.trunc(parsed);
}

function monthStart(referenceDate: Date) {
  return new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
}

function monthEnd(referenceDate: Date) {
  return new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 0));
}

function utcDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function daysInMonth(referenceDate: Date) {
  return new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 0)).getUTCDate();
}

function daysElapsedInMonth(referenceDate: Date) {
  return referenceDate.getUTCDate();
}

function emptyUsageSnapshot(lastUpdatedAt: string | null = null): AgencyResourceControlSnapshot {
  return {
    ai_tokens: null,
    tryons: null,
    messages: null,
    revenue_cents: null,
    cost_cents: null,
    leads: null,
    row_count: 0,
    last_updated_at: lastUpdatedAt,
  };
}

function aggregateUsage(rows: AgencyResourceControlUsageRow[]) {
  const byOrg = new Map<string, AgencyResourceControlSnapshot>();

  for (const row of rows) {
    const orgId = normalize(row.org_id);
    if (!orgId) continue;

    const current = byOrg.get(orgId) || emptyUsageSnapshot();

    current.ai_tokens = (current.ai_tokens || 0) + toNumber(row.ai_tokens);
    current.tryons = (current.tryons || 0) + toNumber(row.tryon_calls);
    current.messages = (current.messages || 0) + toNumber(row.messages_sent);
    current.revenue_cents = (current.revenue_cents || 0) + toNumber(row.revenue_cents);
    current.cost_cents = (current.cost_cents || 0) + toNumber(row.cost_cents);
    current.leads = (current.leads || 0) + toNumber(row.leads);
    current.row_count += 1;

    const updatedAt = normalize(row.updated_at);
    if (updatedAt && (!current.last_updated_at || updatedAt > current.last_updated_at)) {
      current.last_updated_at = updatedAt;
    }

    byOrg.set(orgId, current);
  }

  return byOrg;
}

function orgLimitSeed(org: TenantRecord, resourceType: ResourceType) {
  const limits = org.limits && typeof org.limits === "object" ? (org.limits as Record<string, unknown>) : {};

  if (resourceType === "ai_tokens") {
    return toPositiveNumber(limits.ai_tokens_monthly) || DEFAULT_LIMITS.ai_tokens;
  }

  if (resourceType === "try_on") {
    return toPositiveNumber(limits.tryon_monthly) || toPositiveNumber(limits.try_on_monthly) || DEFAULT_LIMITS.try_on;
  }

  const monthlyMessages = toPositiveNumber(limits.whatsapp_messages_monthly);
  if (monthlyMessages) {
    return monthlyMessages;
  }

  const dailyMessages = toPositiveNumber(limits.whatsapp_messages_daily);
  if (dailyMessages) {
    return dailyMessages * 30;
  }

  return DEFAULT_LIMITS.whatsapp_message;
}

function billingStatusLabel(status: StripeBillingStatus | null) {
  if (!status) return "sem base";
  if (status === "active") return "ativo";
  if (status === "trialing") return "trial";
  if (isStripeBillingStatusBlocking(status)) return `bloqueado (${status})`;
  return status;
}

function billingIsBlocked(status: StripeBillingStatus | null) {
  return status ? isStripeBillingStatusBlocking(status) : false;
}

function riskRank(value: AgencyResourceControlStatus) {
  switch (value) {
    case "critical":
      return 3;
    case "attention":
      return 2;
    case "normal":
      return 1;
    default:
      return 0;
  }
}

function limitSource(
  limitRow: ResourceLimitRecord | null,
  monthlyLimit: number,
  overrideLimit: number | null,
  seedValue: number
): AgencyResourceControlLimitSource {
  if (overrideLimit !== null) return "override";
  if (limitRow) return "contract";
  if (monthlyLimit !== seedValue) return "seed";
  return "default";
}

function buildResource(
  org: TenantRecord,
  definition: ResourceDefinition,
  usage: AgencyResourceControlSnapshot,
  limitRow: ResourceLimitRecord | null,
  billingBlocked: boolean,
  daysElapsed: number,
  daysTotal: number
): AgencyResourceControlResource {
  const seedLimit = orgLimitSeed(org, definition.resourceType);
  const monthlyLimit = limitRow?.limit_monthly && limitRow.limit_monthly > 0 ? limitRow.limit_monthly : seedLimit;
  const overrideLimit = limitRow?.limit_override && limitRow.limit_override > 0 ? limitRow.limit_override : null;
  const effectiveLimit = overrideLimit || monthlyLimit || null;
  const usedMonthlyRaw = usage[definition.usageKey];
  const usedMonthly =
    typeof usedMonthlyRaw === "number"
      ? usedMonthlyRaw
      : usedMonthlyRaw === null || usedMonthlyRaw === undefined
        ? null
        : Number(usedMonthlyRaw);
  const usagePct = usedMonthly !== null && effectiveLimit ? Math.round((Number(usedMonthly) / Number(effectiveLimit)) * 100) : null;
  const projectedMonthlyUsage =
    usedMonthly !== null && daysElapsed > 0 ? Math.round((Number(usedMonthly) / Math.max(1, daysElapsed)) * daysTotal) : null;

  let status: AgencyResourceControlStatus = usedMonthly === null ? "no_data" : "normal";
  let reason = usedMonthly === null ? "Sem base para calcular" : "Dentro do teto";

  if (usedMonthly !== null) {
    if (org.kill_switch || org.status !== "active" || billingBlocked) {
      status = "critical";
      if (org.kill_switch) {
        reason = "Kill switch ativo";
      } else if (org.status !== "active") {
        reason = `Status ${org.status}`;
      } else {
        reason = "Pagamento nao ativo";
      }
    } else if (usagePct !== null && usagePct >= 100) {
      status = "critical";
      reason = "Ruptura operacional";
    } else if (usagePct !== null && usagePct >= 80) {
      status = "attention";
      reason = "Acima de 80% do teto";
    } else if (projectedMonthlyUsage !== null && effectiveLimit && projectedMonthlyUsage >= effectiveLimit) {
      status = "attention";
      reason = "Projecao do mes acima do teto";
    }
  }

  return {
    resource_type: definition.resourceType,
    label: definition.label,
    unit: definition.unit,
    used_monthly: usedMonthly,
    monthly_limit: monthlyLimit,
    override_limit: overrideLimit,
    effective_limit: effectiveLimit,
    usage_pct: usagePct,
    projected_monthly_usage: projectedMonthlyUsage,
    limit_source: limitSource(limitRow, monthlyLimit, overrideLimit, seedLimit),
    status,
    reason,
  };
}

function buildAlerts(row: AgencyResourceControlRow) {
  const alerts: string[] = [];
  const usedTokens = row.usage_month.ai_tokens || 0;
  const usedTryons = row.usage_month.tryons || 0;
  const usedMessages = row.usage_month.messages || 0;

  if (row.billing_blocked && (usedTokens > 0 || usedTryons > 0 || usedMessages > 0)) {
    alerts.push("Consumo alto sem pagamento ativo");
  }

  if (row.kill_switch) {
    alerts.push("Loja bloqueada pelo kill switch");
  } else if (row.status !== "active") {
    alerts.push(`Loja em status ${row.status}`);
  }

  for (const resource of row.resources) {
    if (resource.status === "critical") {
      alerts.push(`${resource.label} em ruptura`);
    } else if (resource.status === "attention") {
      alerts.push(`${resource.label} acima de 80%`);
    }
  }

  if (row.margin_estimate_cents !== null && row.margin_estimate_cents < 0) {
    alerts.push("Margem estimada negativa");
  }

  if (!alerts.length) {
    alerts.push("Operacao normal");
  }

  return alerts;
}

function classifyOverallRisk(row: AgencyResourceControlRow): AgencyResourceControlRisk {
  if (row.kill_switch || row.status !== "active" || row.billing_blocked) {
    return "critical";
  }

  if (row.resources.some((resource) => resource.status === "critical")) {
    return "critical";
  }

  if (row.resources.some((resource) => resource.status === "attention")) {
    return "attention";
  }

  if (row.margin_estimate_cents !== null && row.margin_estimate_cents < 0) {
    return "attention";
  }

  return "normal";
}

function sortRows(rows: AgencyResourceControlRow[]) {
  return [...rows]
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const riskDelta = riskRank(right.row.risk) - riskRank(left.row.risk);
      if (riskDelta !== 0) return riskDelta;

      const leftUsage = Math.max(...left.row.resources.map((resource) => resource.usage_pct || 0), 0);
      const rightUsage = Math.max(...right.row.resources.map((resource) => resource.usage_pct || 0), 0);
      if (rightUsage !== leftUsage) return rightUsage - leftUsage;

      return left.index - right.index;
    })
    .map(({ row }) => row);
}

export function canAccessAgencyResourceControl(role?: string | null) {
  return typeof role === "string" && role.trim().startsWith("agency_");
}

export function buildAgencyResourceControlRows(input: AgencyResourceControlBuildInput): AgencyResourceControlRow[] {
  const referenceDate = input.referenceDate || new Date();
  const monthStartDate = monthStart(referenceDate);
  const monthEndDate = monthEnd(referenceDate);
  const daysElapsed = daysElapsedInMonth(referenceDate);
  const daysTotal = daysInMonth(referenceDate);

  const usageByOrg = aggregateUsage(input.usageRows);
  const orgIds = new Set(input.orgs.map((org) => org.id));
  const limitsByOrg = new Map<string, Map<ResourceType, ResourceLimitRecord>>();
  const billingByOrg = new Map<string, AgencyResourceControlBillingRow>();

  for (const limitRow of input.limitRows) {
    if (!orgIds.has(limitRow.org_id)) continue;
    const current = limitsByOrg.get(limitRow.org_id) || new Map<ResourceType, ResourceLimitRecord>();
    current.set(limitRow.resource_type, limitRow);
    limitsByOrg.set(limitRow.org_id, current);
  }

  for (const row of input.billingRows) {
    if (!orgIds.has(row.org_id)) continue;
    billingByOrg.set(row.org_id, row);
  }

  const rows = input.orgs.map((org) => {
    const usage = usageByOrg.get(org.id) || emptyUsageSnapshot(org.updated_at || org.created_at || null);
    const limitByType = limitsByOrg.get(org.id) || new Map<ResourceType, ResourceLimitRecord>();
    const billingRow = billingByOrg.get(org.id) || null;
    const billingStatus = billingRow ? normalizeStripeBillingStatus(billingRow.billing_status) : null;
    const billingBlocked = billingIsBlocked(billingStatus);

    const row: AgencyResourceControlRow = {
      ...org,
      billing_status: billingStatus,
      billing_status_label: billingStatusLabel(billingStatus),
      billing_blocked: billingBlocked,
      billing_provider: billingRow?.billing_provider || null,
      period_start: utcDate(monthStartDate),
      period_end: utcDate(monthEndDate),
      days_elapsed: daysElapsed,
      usage_month: usage,
      resources: RESOURCE_DEFINITIONS.map((definition) =>
        buildResource(
          org,
          definition,
          usage,
          limitByType.get(definition.resourceType) || null,
          billingBlocked,
          daysElapsed,
          daysTotal
        )
      ),
      risk: "normal",
      alerts: [],
      projected_spend_cents:
        usage.row_count > 0 && daysElapsed > 0 && usage.cost_cents !== null
          ? Math.round((usage.cost_cents / Math.max(1, daysElapsed)) * daysTotal)
          : null,
      margin_estimate_cents:
        usage.revenue_cents !== null || usage.cost_cents !== null
          ? (usage.revenue_cents || 0) - (usage.cost_cents || 0)
          : null,
      margin_note:
        usage.revenue_cents !== null || usage.cost_cents !== null
          ? "Receita menos custo observado no periodo"
          : "Sem dados suficientes para margem",
      projection_note:
        usage.row_count > 0
          ? daysElapsed >= 7
            ? "Projecao baseada no ritmo do mes"
            : "Projecao conservadora com pouca base"
          : "Sem dados suficientes para projetar",
    };

    row.risk = classifyOverallRisk(row);
    row.alerts = buildAlerts(row);
    return row;
  });

  return sortRows(rows);
}

export async function loadAgencyResourceControlRows(referenceDate = new Date()) {
  const admin = createAdminClient();
  const start = monthStart(referenceDate).toISOString().slice(0, 10);

  const [orgsResult, usageResult, limitsResult, billingResult] = await Promise.all([
    queryWithTimeout(
      admin.from("orgs").select("id, slug, name, status, kill_switch, plan_id, limits, created_at, updated_at").order("created_at", { ascending: false }),
      { data: [], error: null }
    ),
    queryWithTimeout(
      admin
        .from("org_usage_daily")
        .select("org_id, usage_date, ai_tokens, messages_sent, revenue_cents, cost_cents, leads, tryon_calls, updated_at")
        .gte("usage_date", start)
        .order("usage_date", { ascending: false }),
      { data: [], error: null }
    ),
    queryWithTimeout(
      admin
        .from("org_resource_limits")
        .select("org_id, resource_type, limit_monthly, limit_override, created_by_user_id, created_at, updated_at")
        .order("updated_at", { ascending: false }),
      { data: [], error: null }
    ),
    queryWithTimeout(
      admin
        .from("billing_subscriptions")
        .select("org_id, billing_provider, billing_status, stripe_current_period_end, stripe_synced_at, updated_at")
        .order("updated_at", { ascending: false }),
      { data: [], error: null }
    ),
  ]);

  const orgs = (orgsResult.data || []) as TenantRecord[];
  if (!orgs.length) {
    return [];
  }

  return buildAgencyResourceControlRows({
    orgs,
    usageRows: (usageResult.data || []) as AgencyResourceControlUsageRow[],
    limitRows: (limitsResult.data || []) as ResourceLimitRecord[],
    billingRows: (billingResult.data || []) as AgencyResourceControlBillingRow[],
    referenceDate,
  });
}

export async function updateAgencyResourceControlLimits(input: AgencyResourceControlUpdateInput) {
  const normalizedOrgId = normalize(input.orgId);
  const normalizedReason = normalize(input.reason);
  const normalizedActorUserId = normalize(input.actorUserId);

  if (!normalizedOrgId) {
    throw new Error("Missing orgId");
  }

  if (!normalizedActorUserId) {
    throw new Error("Missing actorUserId");
  }

  if (!normalizedReason) {
    throw new Error("Missing reason");
  }

  const admin = createAdminClient();
  const { data: org, error: orgError } = await admin
    .from("orgs")
    .select("id, slug, name, status, kill_switch, plan_id, limits, created_at, updated_at")
    .eq("id", normalizedOrgId)
    .maybeSingle();

  if (orgError) {
    throw new Error(`Failed to load org: ${orgError.message}`);
  }

  if (!org) {
    throw new Error("Org not found");
  }

  const previousRows = await getResourceLimits(normalizedOrgId);
  const previousByType = previousRows.reduce<Record<string, Record<string, number | null>>>((acc, row) => {
    acc[row.resource_type] = {
      monthly_limit: row.limit_monthly,
      override_limit: row.limit_override,
    };
    return acc;
  }, {});

  const nextRows = await setResourceLimits(
    normalizedOrgId,
    input.resources.map((resource) => ({
      resourceType: resource.resourceType,
      monthlyLimit: resource.monthlyLimit,
      overrideLimit: resource.overrideLimit,
    })),
    normalizedActorUserId
  );

  if (!nextRows.length) {
    throw new Error("Failed to update resource limits");
  }

  const nextByType = nextRows.reduce<Record<string, Record<string, number | null>>>((acc, row) => {
    acc[row.resource_type] = {
      monthly_limit: row.limit_monthly,
      override_limit: row.limit_override,
    };
    return acc;
  }, {});

  await Promise.all([
    logAudit({
      orgId: normalizedOrgId,
      userId: normalizedActorUserId,
      action: "resource_limit_update",
      resourceType: "org_resource_limits",
      resourceId: normalizedOrgId,
      metadata: {
        reason: normalizedReason,
        org_slug: org.slug,
        plan_id: org.plan_id,
        previous: previousByType,
        next: nextByType,
      },
      status: "success",
    }).catch((error) => {
      console.warn("[RESOURCE_CONTROL] security audit failed", {
        orgId: normalizedOrgId,
        error: error instanceof Error ? error.message : String(error),
      });
    }),
    recordOperationalTenantEvent(admin, {
      orgId: normalizedOrgId,
      actorUserId: normalizedActorUserId,
      eventType: "agency.resource_limit_updated",
      eventSource: "agency",
      dedupeKeyParts: [
        normalizedOrgId,
        normalizedActorUserId,
        normalizedReason,
        ...input.resources.map((resource) => `${resource.resourceType}:${resource.monthlyLimit}:${resource.overrideLimit ?? "null"}`),
      ],
      payload: {
        org_id: normalizedOrgId,
        org_slug: org.slug,
        reason: normalizedReason,
        previous: previousByType,
        next: nextByType,
      },
    }).catch((error) => {
      console.warn("[RESOURCE_CONTROL] tenant event failed", {
        orgId: normalizedOrgId,
        error: error instanceof Error ? error.message : String(error),
      });
    }),
  ]);

  return {
    org,
    previousByType,
    nextByType,
    resources: nextRows,
  };
}
