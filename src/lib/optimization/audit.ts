import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface OptimizationAuditRecord {
  id?: number;
  org_id: string;
  resource_type: string;
  previous_limit: number;
  new_limit: number;
  factor: number;
  action: string;
  reason: string;
  policy_rule_id: string;
  job_id: string;
  is_dry_run?: boolean;
  created_by: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface OptimizationAuditFilter {
  orgId?: string;
  resourceType?: string;
  jobId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export async function recordOptimizationAudit(
  records: OptimizationAuditRecord[]
): Promise<boolean> {
  if (records.length === 0) return true;

  const admin = createAdminClient();

  const { error } = await admin.from("optimization_audit").insert(
    records.map((record) => ({
      org_id: record.org_id,
      resource_type: record.resource_type,
      previous_limit: record.previous_limit,
      new_limit: record.new_limit,
      factor: record.factor,
      action: record.action,
      reason: record.reason,
      policy_rule_id: record.policy_rule_id,
      job_id: record.job_id,
      is_dry_run: record.is_dry_run ?? false,
      created_by: record.created_by,
      created_at: record.created_at,
      metadata: record.metadata || {},
    }))
  );

  if (error) {
    console.error("[OPTIMIZATION_AUDIT] Failed to record audit", { error: error.message });
    return false;
  }

  return true;
}

export async function queryOptimizationAudit(
  filter: OptimizationAuditFilter = {}
): Promise<OptimizationAuditRecord[]> {
  const admin = createAdminClient();

  let query = admin
    .from("optimization_audit")
    .select("*")
    .order("created_at", { ascending: false });

  if (filter.orgId) {
    query = query.eq("org_id", filter.orgId);
  }

  if (filter.resourceType) {
    query = query.eq("resource_type", filter.resourceType);
  }

  if (filter.jobId) {
    query = query.eq("job_id", filter.jobId);
  }

  if (filter.startDate) {
    query = query.gte("created_at", filter.startDate);
  }

  if (filter.endDate) {
    query = query.lte("created_at", filter.endDate);
  }

  if (filter.limit) {
    query = query.limit(filter.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[OPTIMIZATION_AUDIT] Query failed", { error: error.message });
    return [];
  }

  return (data || []) as OptimizationAuditRecord[];
}

export async function getOptimizationStats(
  orgId?: string,
  days: number = 30
): Promise<{
  total_adjustments: number;
  avg_limit_change_pct: number;
  by_action: Record<string, number>;
  by_resource_type: Record<string, number>;
}> {
  const admin = createAdminClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = admin
    .from("optimization_audit")
    .select("action, resource_type, previous_limit, new_limit")
    .gte("created_at", startDate.toISOString());

  if (orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return {
      total_adjustments: 0,
      avg_limit_change_pct: 0,
      by_action: {},
      by_resource_type: {},
    };
  }

  const byAction: Record<string, number> = {};
  const byResourceType: Record<string, number> = {};
  let totalPctChange = 0;
  let countWithChange = 0;

  for (const row of data) {
    byAction[row.action] = (byAction[row.action] || 0) + 1;
    byResourceType[row.resource_type] = (byResourceType[row.resource_type] || 0) + 1;

    if (row.previous_limit > 0) {
      const pctChange = ((row.new_limit - row.previous_limit) / row.previous_limit) * 100;
      totalPctChange += pctChange;
      countWithChange++;
    }
  }

  return {
    total_adjustments: data.length,
    avg_limit_change_pct: countWithChange > 0 ? totalPctChange / countWithChange : 0,
    by_action: byAction,
    by_resource_type: byResourceType,
  };
}

export async function getOrgOptimizationHistory(
  orgId: string,
  limit: number = 10
): Promise<Array<{
  date: string;
  changes: number;
  net_change_pct: number;
}>> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("optimization_audit")
    .select("created_at, previous_limit, new_limit")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit * 3);

  if (error || !data) {
    return [];
  }

  const byDate = new Map<string, { changes: number; netPct: number }>();

  for (const row of data) {
    const date = row.created_at.slice(0, 10);
    const existing = byDate.get(date) || { changes: 0, netPct: 0 };
    existing.changes++;
    if (row.previous_limit > 0) {
      existing.netPct += ((row.new_limit - row.previous_limit) / row.previous_limit) * 100;
    }
    byDate.set(date, existing);
  }

  return Array.from(byDate.entries())
    .map(([date, stats]) => ({
      date,
      changes: stats.changes,
      net_change_pct: stats.netPct,
    }))
    .slice(0, limit);
}