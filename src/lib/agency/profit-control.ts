import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface ProfitMetrics {
  revenue_cents: number;
  confirmed_revenue_cents: number;
  cost_cents: number;
  margin_cents: number;
  margin_percent: number;
  period_start: string;
  period_end: string;
}

export interface ForecastMetrics {
  current_cost_cents: number;
  daily_average_cents: number;
  forecast_cost_cents: number;
  days_elapsed: number;
  days_total: number;
  period_start: string;
  period_end: string;
}

export interface ProfitAlert {
  type: string;
  severity: "critical" | "warning" | "info";
  message: string;
}

export interface TenantProfitSummary {
  org_id: string;
  period: string;
  revenue_cents: number;
  confirmed_revenue_cents: number;
  cost_cents: number;
  margin_cents: number;
  margin_percent: number;
  forecast_end_of_month_cents: number;
  daily_average_cents: number;
  alerts: ProfitAlert[];
}

const DEFAULT_RESOURCE_COSTS: Record<string, number> = {
  ai_tokens: 1,
  ai_requests: 150,
  try_on: 250,
  whatsapp_message: 2,
  whatsapp_conversation: 50,
  saved_result: 150,
  product_create: 20,
  lead_create: 8,
  email_sent: 1,
  sms_sent: 5,
};

function getCurrentPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
}

export async function calculateTenantCost(
  orgId: string,
  periodStart?: Date | null,
  periodEnd?: Date | null
): Promise<number> {
  const period = getCurrentPeriod();
  const start = periodStart || period.start;
  const end = periodEnd || period.end;

  const admin = createAdminClient();

  try {
    const { data, error } = await admin.rpc("calculate_tenant_cost", {
      p_org_id: orgId,
      p_period_start: start.toISOString().slice(0, 10),
      p_period_end: end.toISOString().slice(0, 10),
    });

    if (error || data === null) {
      console.warn("[PROFIT] cost calculation failed", { orgId, error });
      return 0;
    }

    return Number(data) || 0;
  } catch (err) {
    console.warn("[PROFIT] cost RPC error", { orgId, error: err });
    return 0;
  }
}

export async function calculateTenantProfit(
  orgId: string,
  periodStart?: Date | null,
  periodEnd?: Date | null
): Promise<ProfitMetrics> {
  const period = getCurrentPeriod();
  const start = periodStart || period.start;
  const end = periodEnd || period.end;

  const admin = createAdminClient();

  try {
    const { data, error } = await admin.rpc("calculate_tenant_profit", {
      p_org_id: orgId,
      p_period_start: start.toISOString().slice(0, 10),
      p_period_end: end.toISOString().slice(0, 10),
    });

    if (error || !data) {
      console.warn("[PROFIT] profit calculation failed", { orgId, error });
      return {
        revenue_cents: 0,
        confirmed_revenue_cents: 0,
        cost_cents: 0,
        margin_cents: 0,
        margin_percent: 0,
        period_start: start.toISOString().slice(0, 10),
        period_end: end.toISOString().slice(0, 10),
      };
    }

    return {
      revenue_cents: data.revenue_cents || 0,
      confirmed_revenue_cents: data.confirmed_revenue_cents || 0,
      cost_cents: data.cost_cents || 0,
      margin_cents: data.margin_cents || 0,
      margin_percent: Number(data.margin_percent) || 0,
      period_start: data.period_start,
      period_end: data.period_end,
    };
  } catch (err) {
    console.warn("[PROFIT] profit RPC error", { orgId, error: err });
    return {
      revenue_cents: 0,
      confirmed_revenue_cents: 0,
      cost_cents: 0,
      margin_cents: 0,
      margin_percent: 0,
      period_start: start.toISOString().slice(0, 10),
      period_end: end.toISOString().slice(0, 10),
    };
  }
}

export async function calculateTenantForecast(
  orgId: string,
  periodStart?: Date | null,
  periodEnd?: Date | null
): Promise<ForecastMetrics> {
  const period = getCurrentPeriod();
  const start = periodStart || period.start;
  const end = periodEnd || period.end;

  const admin = createAdminClient();

  try {
    const { data, error } = await admin.rpc("calculate_tenant_forecast", {
      p_org_id: orgId,
      p_period_start: start.toISOString().slice(0, 10),
      p_period_end: end.toISOString().slice(0, 10),
    });

    if (error || !data) {
      console.warn("[PROFIT] forecast calculation failed", { orgId, error });
      return {
        current_cost_cents: 0,
        daily_average_cents: 0,
        forecast_cost_cents: 0,
        days_elapsed: 0,
        days_total: 0,
        period_start: start.toISOString().slice(0, 10),
        period_end: end.toISOString().slice(0, 10),
      };
    }

    return {
      current_cost_cents: data.current_cost_cents || 0,
      daily_average_cents: data.daily_average_cents || 0,
      forecast_cost_cents: data.forecast_cost_cents || 0,
      days_elapsed: data.days_elapsed || 0,
      days_total: data.days_total || 0,
      period_start: data.period_start,
      period_end: data.period_end,
    };
  } catch (err) {
    console.warn("[PROFIT] forecast RPC error", { orgId, error: err });
    return {
      current_cost_cents: 0,
      daily_average_cents: 0,
      forecast_cost_cents: 0,
      days_elapsed: 0,
      days_total: 0,
      period_start: start.toISOString().slice(0, 10),
      period_end: end.toISOString().slice(0, 10),
    };
  }
}

export async function generateProfitAlerts(orgId: string): Promise<ProfitAlert[]> {
  const admin = createAdminClient();

  try {
    const { data, error } = await admin.rpc("generate_profit_alerts", {
      p_org_id: orgId,
    });

    if (error || !data) {
      return [];
    }

    const alerts: ProfitAlert[] = (data as any[]).map((alert: any) => ({
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
    }));

    return alerts;
  } catch (err) {
    console.warn("[PROFIT] alerts RPC error", { orgId, error: err });
    return [];
  }
}

export async function getTenantProfitSummary(
  orgId: string
): Promise<TenantProfitSummary> {
  const period = getCurrentPeriod();

  const [profit, forecast, alerts] = await Promise.all([
    calculateTenantProfit(orgId, period.start, period.end),
    calculateTenantForecast(orgId, period.start, period.end),
    generateProfitAlerts(orgId),
  ]);

  return {
    org_id: orgId,
    period: period.start.toISOString().slice(0, 10),
    revenue_cents: profit.revenue_cents,
    confirmed_revenue_cents: profit.confirmed_revenue_cents,
    cost_cents: profit.cost_cents,
    margin_cents: profit.margin_cents,
    margin_percent: profit.margin_percent,
    forecast_end_of_month_cents: forecast.forecast_cost_cents,
    daily_average_cents: forecast.daily_average_cents,
    alerts,
  };
}

export async function getAgencyProfitSummary(
  orgIds: string[]
): Promise<TenantProfitSummary[]> {
  return Promise.all(orgIds.map((orgId) => getTenantProfitSummary(orgId)));
}

export async function updateResourceCost(
  resourceType: string,
  unitCostCents: number
): Promise<boolean> {
  const admin = createAdminClient();

  const { error } = await admin.from("billing_resource_costs").upsert(
    {
      resource_type: resourceType,
      unit_cost_cents: unitCostCents,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "resource_type" }
  );

  return !error;
}

export async function addRevenueSource(
  orgId: string,
  sourceType: string,
  amountCents: number,
  periodStart: Date,
  periodEnd: Date,
  isConfirmed: boolean = false,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  const admin = createAdminClient();

  const { error } = await admin.from("billing_revenue_sources").insert({
    org_id: orgId,
    source_type: sourceType,
    amount_cents: amountCents,
    period_start: periodStart.toISOString().slice(0, 10),
    period_end: periodEnd.toISOString().slice(0, 10),
    is_confirmed: isConfirmed,
    metadata: metadata || {},
  });

  return !error;
}