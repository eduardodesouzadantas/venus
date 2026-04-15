import type { ResourceType } from "@/lib/resource-control";

export type AdjustmentAction =
  | "increase_limits"
  | "reduce_limits"
  | "throttle"
  | "maintain"
  | "emergency_reduce";

export type PolicyCondition =
  | "margin_negative"
  | "margin_low"
  | "margin_healthy"
  | "margin_high"
  | "roi_low"
  | "roi_healthy"
  | "roi_high"
  | "usage_accelerating"
  | "usage_stable"
  | "usage_low"
  | "usage_critical"
  | "risk_critical"
  | "risk_attention"
  | "risk_normal";

export interface PolicyRule {
  id: string;
  name: string;
  conditions: Array<{
    metric: "margin_percent" | "roi" | "usage_pct" | "risk";
    operator: "lt" | "lte" | "gt" | "gte" | "eq" | "ne";
    value: number;
  }>;
  action: AdjustmentAction;
  factor: number;
  priority: number;
  description: string;
}

export interface TenantMetrics {
  org_id: string;
  margin_percent: number;
  margin_cents: number;
  roi: number;
  usage_pct: Record<ResourceType, number>;
  usage: Record<ResourceType, number>;
  limits: Record<ResourceType, number>;
  risk: "normal" | "attention" | "critical";
  billing_status: string | null;
  is_billing_blocked: boolean;
  has_manual_override: boolean;
}

export interface LimitAdjustment {
  org_id: string;
  resource_type: ResourceType;
  previous_limit: number;
  new_limit: number;
  factor: number;
  action: AdjustmentAction;
  reason: string;
  policy_rule_id: string;
}

export interface OptimizationJobResult {
  job_id: string;
  started_at: string;
  completed_at: string;
  tenants_processed: number;
  adjustments_applied: number;
  errors: string[];
  details: Array<{
    org_id: string;
    adjustments: LimitAdjustment[];
    success: boolean;
    error?: string;
  }>;
}