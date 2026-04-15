import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type ResourceType =
  | "ai_tokens"
  | "try_on"
  | "whatsapp_message"
  | "saved_result"
  | "product"
  | "lead";

export interface ResourceCheckResult {
  allowed: boolean;
  resource_type: string;
  amount: number;
  used: number;
  limit: number;
  remaining: number;
  limit_source: "default" | "override";
  usage_period: string;
}

export interface ResourceConsumeResult {
  success: boolean;
  error?: string;
  resource_type: string;
  amount: number;
  used: number;
  limit: number;
  remaining: number;
}

export interface ResourceLimitRecord {
  org_id: string;
  resource_type: ResourceType;
  limit_monthly: number;
  limit_override: number | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResourceLimitInput {
  resourceType: ResourceType;
  monthlyLimit: number;
  overrideLimit?: number | null;
}

export const DEFAULT_LIMITS: Record<ResourceType, number> = {
  ai_tokens: 250000,
  try_on: 50,
  whatsapp_message: 1000,
  saved_result: 100,
  product: 500,
  lead: 500,
};

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLimitValue(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.trunc(parsed));
}

export async function canConsumeResource(
  orgId: string,
  resourceType: ResourceType,
  amount: number = 1
): Promise<ResourceCheckResult> {
  const admin = createAdminClient();

  try {
    const { data, error } = await admin.rpc("can_consume_resource", {
      p_org_id: orgId,
      p_resource_type: resourceType,
      p_amount: amount,
    });

    if (error || !data) {
      console.warn("[RESOURCE] can_consume check failed", { orgId, resourceType, error });
      return {
        allowed: true,
        resource_type: resourceType,
        amount,
        used: 0,
        limit: DEFAULT_LIMITS[resourceType] || 1000,
        remaining: DEFAULT_LIMITS[resourceType] || 1000,
        limit_source: "default",
        usage_period: new Date().toISOString().slice(0, 10),
      };
    }

    return data;
  } catch (err) {
    console.warn("[RESOURCE] can_consume error", { orgId, resourceType, error: err });
    return {
      allowed: true,
      resource_type: resourceType,
      amount,
      used: 0,
      limit: DEFAULT_LIMITS[resourceType] || 1000,
      remaining: DEFAULT_LIMITS[resourceType] || 1000,
      limit_source: "default",
      usage_period: new Date().toISOString().slice(0, 10),
    };
  }
}

export async function consumeResource(
  orgId: string,
  resourceType: ResourceType,
  amount: number = 1
): Promise<ResourceConsumeResult> {
  const admin = createAdminClient();

  try {
    const { data, error } = await admin.rpc("consume_resource", {
      p_org_id: orgId,
      p_resource_type: resourceType,
      p_amount: amount,
    });

    if (error || !data) {
      console.warn("[RESOURCE] consume failed", { orgId, resourceType, error });
      return {
        success: false,
        error: error?.message || "consume_failed",
        resource_type: resourceType,
        amount,
        used: 0,
        limit: DEFAULT_LIMITS[resourceType] || 1000,
        remaining: DEFAULT_LIMITS[resourceType] || 1000,
      };
    }

    if (!data.success && data.error === "limit_exceeded") {
      await triggerLimitExceeded(orgId, resourceType, data);
    }

    return data;
  } catch (err) {
    console.warn("[RESOURCE] consume error", { orgId, resourceType, error: err });
    return {
      success: false,
      error: String(err),
      resource_type: resourceType,
      amount,
      used: 0,
      limit: DEFAULT_LIMITS[resourceType] || 1000,
      remaining: DEFAULT_LIMITS[resourceType] || 1000,
    };
  }
}

async function triggerLimitExceeded(
  orgId: string,
  resourceType: string,
  data: Record<string, unknown>
) {
  const admin = createAdminClient();

  const { error: alertError } = await admin.from("tenant_events").insert({
    org_id: orgId,
    event_type: "resource.limit_exceeded",
    event_source: "resource_control",
    dedupe_key: `resource_limit_${orgId}_${resourceType}_${new Date().toISOString().slice(0, 10)}`,
    payload: {
      org_id: orgId,
      resource_type: resourceType,
      used: data.used,
      limit: data.limit,
      remaining: data.remaining,
    },
  });

  if (!alertError) {
    console.warn("[RESOURCE] limit exceeded", { orgId, resourceType, used: data.used, limit: data.limit });
  }
}

export async function setResourceLimit(
  orgId: string,
  resourceType: ResourceType,
  limitOverride: number,
  createdByUserId?: string | null
): Promise<boolean> {
  const updated = await setResourceLimits(
    orgId,
    [
      {
        resourceType,
        monthlyLimit: limitOverride,
        overrideLimit: null,
      },
    ],
    createdByUserId
  );

  return updated.length > 0;
}

export async function setResourceLimits(
  orgId: string,
  limits: ResourceLimitInput[],
  createdByUserId?: string | null
): Promise<ResourceLimitRecord[]> {
  const admin = createAdminClient();

  const normalizedOrgId = normalize(orgId);
  const now = new Date().toISOString();
  const rows = limits
    .map((limit) => ({
      org_id: normalizedOrgId,
      resource_type: limit.resourceType,
      limit_monthly: normalizeLimitValue(limit.monthlyLimit),
      limit_override:
        limit.overrideLimit === null || limit.overrideLimit === undefined
          ? null
          : normalizeLimitValue(limit.overrideLimit),
      created_by_user_id: createdByUserId || null,
      updated_at: now,
    }))
    .filter((row) => row.org_id && row.resource_type);

  if (!rows.length) {
    return [];
  }

  const { data, error } = await admin
    .from("org_resource_limits")
    .upsert(rows, { onConflict: "org_id,resource_type" })
    .select("org_id, resource_type, limit_monthly, limit_override, created_by_user_id, created_at, updated_at");

  if (error) {
    return [];
  }

  return (data || []) as ResourceLimitRecord[];
}

export async function getResourceLimits(
  orgId: string,
  resourceType?: ResourceType | null
): Promise<ResourceLimitRecord[]> {
  const admin = createAdminClient();
  const normalizedOrgId = normalize(orgId);

  let query = admin
    .from("org_resource_limits")
    .select("org_id, resource_type, limit_monthly, limit_override, created_by_user_id, created_at, updated_at")
    .eq("org_id", normalizedOrgId);

  if (resourceType) {
    query = query.eq("resource_type", resourceType);
  }

  const { data, error } = await query.order("updated_at", { ascending: false });

  if (error) {
    return [];
  }

  return (data || []) as ResourceLimitRecord[];
}

export async function getResourceUsage(
  orgId: string,
  resourceType?: ResourceType | null,
  days?: number | null
): Promise<{ org_id: string; resource_type: string; usage_period: string; used_count: number }[]> {
  const admin = createAdminClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (days || 30));

  let query = admin
    .from("org_resource_usage")
    .select("org_id, resource_type, usage_period, used_count")
    .eq("org_id", orgId)
    .gte("usage_period", cutoffDate.toISOString().slice(0, 10));

  if (resourceType) {
    query = query.eq("resource_type", resourceType);
  }

  const { data, error } = await query.order("usage_period", { ascending: false });

  if (error) {
    return [];
  }

  return data || [];
}

export async function getResourceAudit(
  orgId: string,
  resourceType?: ResourceType | null,
  limit: number = 50
): Promise<{ resource_type: string; amount: number; action: string; result: string; created_at: string }[]> {
  const admin = createAdminClient();

  let query = admin
    .from("org_resource_audit")
    .select("resource_type, amount, action, result, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (resourceType) {
    query = query.eq("resource_type", resourceType);
  }

  const { data, error } = await query;

  if (error) {
    return [];
  }

  return data || [];
}
