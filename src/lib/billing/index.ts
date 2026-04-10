import "server-only";

import { listAgencyOrgRows } from "@/lib/agency";
import { normalizeAgencyTimeRange, resolveAgencyTimeRangeWindow, type AgencyTimeRange } from "@/lib/agency/time-range";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgencyOrgRow } from "@/lib/agency";
import {
  buildOrgSoftCapSummary,
  type OrgAlertStatus,
  type OrgSoftCapSummary,
  type PlanSoftCaps,
} from "@/lib/billing/limits";

export interface BillingCategorySnapshot {
  count: number;
  estimated_cost_cents: number;
}

export interface OrgUsageSummary {
  usage_date: string | null;
  ai_tokens: number;
  ai_requests: number;
  messages_sent: number;
  events_count: number;
  revenue_cents: number;
  cost_cents: number;
  leads: number;
  tenant_events_count: number;
  last_activity_at: string | null;
  usage_source: "today" | "latest" | "none";
}

export interface OrgBillingSummary extends OrgUsageSummary {
  estimated_cost_today_cents: number;
  estimated_cost_total_cents: number;
  estimated_ai_cost_today_cents: number;
  estimated_ai_cost_total_cents: number;
  estimated_catalog_cost_today_cents: number;
  estimated_catalog_cost_total_cents: number;
  estimated_crm_cost_today_cents: number;
  estimated_crm_cost_total_cents: number;
  estimated_whatsapp_cost_today_cents: number;
  estimated_whatsapp_cost_total_cents: number;
  estimated_event_overhead_today_cents: number;
  estimated_event_overhead_total_cents: number;
  usage_health: "low" | "medium" | "high";
  billing_risk: "low" | "medium" | "high";
  plan_budget_daily_cents: number;
  plan_budget_monthly_cents: number;
  breakdown_today: Record<string, BillingCategorySnapshot>;
  breakdown_total: Record<string, BillingCategorySnapshot>;
  plan_soft_caps: PlanSoftCaps;
  soft_cap_summary: OrgSoftCapSummary;
  plan_soft_cap_status: OrgAlertStatus;
  plan_soft_cap_message: string;
}

export interface AgencyBillingRow extends AgencyOrgRow, OrgBillingSummary {}

export interface AgencyBillingFilters {
  range?: AgencyTimeRange | null;
  orgId?: string | null;
}

const CATEGORY_COSTS = {
  ai_result_generation: 150,
  catalog_product_created: 20,
  leads_created: 8,
  whatsapp_messages: 2,
  whatsapp_conversations: 5,
  tenant_events: 1,
} as const;

const PLAN_BUDGETS = {
  free: { daily: 100, monthly: 1_000 },
  starter: { daily: 300, monthly: 9_000 },
  growth: { daily: 1_000, monthly: 30_000 },
  scale: { daily: 2_500, monthly: 75_000 },
  enterprise: { daily: 6_000, monthly: 200_000 },
} as const;

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sameUtcDay(value?: string | null, day?: string) {
  if (!value || !day) return false;
  return value.slice(0, 10) === day;
}

function getPlanBudget(planId?: string | null) {
  const normalized = normalize(planId).toLowerCase();
  if (normalized === "freemium") return PLAN_BUDGETS.free;
  if (normalized === "free") return PLAN_BUDGETS.free;
  if (normalized === "growth") return PLAN_BUDGETS.growth;
  if (normalized === "pro") return PLAN_BUDGETS.growth;
  if (normalized === "scale") return PLAN_BUDGETS.scale;
  if (normalized === "enterprise") return PLAN_BUDGETS.enterprise;
  return PLAN_BUDGETS.starter;
}

function costSnapshot(count: number, unitCents: number): BillingCategorySnapshot {
  return {
    count,
    estimated_cost_cents: count * unitCents,
  };
}

function sumBreakdown(breakdown: Record<string, BillingCategorySnapshot>) {
  return Object.values(breakdown).reduce((sum, item) => sum + item.estimated_cost_cents, 0);
}

function countMapIncrement(map: Map<string, number>, key: string, nextValue = 1) {
  map.set(key, (map.get(key) || 0) + nextValue);
}

function latestMapUpdate(map: Map<string, string | null>, key: string, value?: string | null) {
  if (!value) return;
  const current = map.get(key);
  if (!current || value > current) {
    map.set(key, value);
  }
}

function inRange(value: string | null | undefined, dateFrom: string | null) {
  if (!dateFrom || !value) return true;
  return value >= dateFrom;
}

async function listAgencyBillingRowsWithFilters(filters: AgencyBillingFilters): Promise<AgencyBillingRow[]> {
  const allOrgRows = await listAgencyOrgRows();
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const range = normalizeAgencyTimeRange(filters.range, "all");
  const rangeWindow = resolveAgencyTimeRangeWindow(range);
  const dateFrom = rangeWindow.dateFrom;

  const orgRows = filters.orgId ? allOrgRows.filter((org) => org.id === normalize(filters.orgId)) : allOrgRows;
  const orgById = new Map(orgRows.map((org) => [org.id, org]));
  const orgBySlug = new Map(orgRows.map((org) => [normalize(org.slug), org]));

  const [
    productsResult,
    leadsResult,
    savedResultsResult,
    tenantEventsResult,
    whatsappConversationsResult,
    whatsappMessagesResult,
  ] = await Promise.all([
    admin.from("products").select("org_id, created_at").order("created_at", { ascending: false }).limit(50),
    admin.from("leads").select("org_id, created_at, updated_at, last_interaction_at").order("created_at", { ascending: false }).limit(50),
    admin.from("saved_results").select("org_id, created_at").order("created_at", { ascending: false }).limit(50),
    admin.from("tenant_events").select("org_id, created_at").order("created_at", { ascending: false }).limit(50),
    admin.from("whatsapp_conversations").select("org_slug, created_at").order("created_at", { ascending: false }).limit(50),
    admin.from("whatsapp_messages").select("org_slug, created_at").order("created_at", { ascending: false }).limit(50),
  ]);

  if (productsResult.error) throw new Error(`Failed to load billing products: ${productsResult.error.message}`);
  if (leadsResult.error) throw new Error(`Failed to load billing leads: ${leadsResult.error.message}`);
  if (savedResultsResult.error) throw new Error(`Failed to load billing saved results: ${savedResultsResult.error.message}`);
  if (tenantEventsResult.error) throw new Error(`Failed to load billing tenant events: ${tenantEventsResult.error.message}`);

  const whatsappConversationsAvailable = !whatsappConversationsResult.error;
  const whatsappMessagesAvailable = !whatsappMessagesResult.error;

  const totalEventsByOrgId = new Map<string, number>();
  const totalProductsByOrgId = new Map<string, number>();
  const totalLeadsByOrgId = new Map<string, number>();
  const totalSavedResultsByOrgId = new Map<string, number>();
  const totalWhatsappConversationsByOrgId = new Map<string, number>();
  const totalWhatsappMessagesByOrgId = new Map<string, number>();
  const todayEventsByOrgId = new Map<string, number>();
  const todayProductsByOrgId = new Map<string, number>();
  const todayLeadsByOrgId = new Map<string, number>();
  const todaySavedResultsByOrgId = new Map<string, number>();
  const todayWhatsappConversationsByOrgId = new Map<string, number>();
  const todayWhatsappMessagesByOrgId = new Map<string, number>();
  const lastActivityByOrgId = new Map<string, string | null>();

  for (const row of (tenantEventsResult.data || []) as Array<{ org_id: string | null; created_at: string | null }>) {
    if (!row.org_id || !orgById.has(row.org_id)) continue;
    if (!inRange(row.created_at, dateFrom)) continue;
    countMapIncrement(totalEventsByOrgId, row.org_id);
    if (sameUtcDay(row.created_at, today)) {
      countMapIncrement(todayEventsByOrgId, row.org_id);
    }
    latestMapUpdate(lastActivityByOrgId, row.org_id, row.created_at);
  }

  for (const row of (productsResult.data || []) as Array<{ org_id: string | null; created_at: string | null }>) {
    if (!row.org_id || !orgById.has(row.org_id)) continue;
    if (!inRange(row.created_at, dateFrom)) continue;
    countMapIncrement(totalProductsByOrgId, row.org_id);
    if (sameUtcDay(row.created_at, today)) {
      countMapIncrement(todayProductsByOrgId, row.org_id);
    }
    latestMapUpdate(lastActivityByOrgId, row.org_id, row.created_at);
  }

  for (const row of (leadsResult.data || []) as Array<{ org_id: string | null; created_at: string | null; updated_at: string | null; last_interaction_at: string | null }>) {
    if (!row.org_id || !orgById.has(row.org_id)) continue;
    if (!inRange(row.created_at, dateFrom)) continue;
    countMapIncrement(totalLeadsByOrgId, row.org_id);
    if (sameUtcDay(row.created_at, today)) {
      countMapIncrement(todayLeadsByOrgId, row.org_id);
    }
    latestMapUpdate(lastActivityByOrgId, row.org_id, row.last_interaction_at || row.updated_at || row.created_at);
  }

  for (const row of (savedResultsResult.data || []) as Array<{ org_id: string | null; created_at: string | null }>) {
    if (!row.org_id || !orgById.has(row.org_id)) continue;
    if (!inRange(row.created_at, dateFrom)) continue;
    countMapIncrement(totalSavedResultsByOrgId, row.org_id);
    if (sameUtcDay(row.created_at, today)) {
      countMapIncrement(todaySavedResultsByOrgId, row.org_id);
    }
    latestMapUpdate(lastActivityByOrgId, row.org_id, row.created_at);
  }

  if (whatsappConversationsAvailable) {
    for (const row of (whatsappConversationsResult.data || []) as Array<{ org_slug: string | null; created_at: string | null }>) {
      const org = row.org_slug ? orgBySlug.get(normalize(row.org_slug)) : null;
      if (!org) continue;
      if (!inRange(row.created_at, dateFrom)) continue;
      countMapIncrement(totalWhatsappConversationsByOrgId, org.id);
      if (sameUtcDay(row.created_at, today)) {
        countMapIncrement(todayWhatsappConversationsByOrgId, org.id);
      }
      latestMapUpdate(lastActivityByOrgId, org.id, row.created_at);
    }
  }

  if (whatsappMessagesAvailable) {
    for (const row of (whatsappMessagesResult.data || []) as Array<{ org_slug: string | null; created_at: string | null }>) {
      const org = row.org_slug ? orgBySlug.get(normalize(row.org_slug)) : null;
      if (!org) continue;
      if (!inRange(row.created_at, dateFrom)) continue;
      countMapIncrement(totalWhatsappMessagesByOrgId, org.id);
      if (sameUtcDay(row.created_at, today)) {
        countMapIncrement(todayWhatsappMessagesByOrgId, org.id);
      }
      latestMapUpdate(lastActivityByOrgId, org.id, row.created_at);
    }
  }

  return orgRows.map((org) => {
    const usage = org.usage_today || null;
    const totalEvents = totalEventsByOrgId.get(org.id) || 0;
    const totalProducts = totalProductsByOrgId.get(org.id) || 0;
    const totalLeads = totalLeadsByOrgId.get(org.id) || 0;
    const totalSavedResults = totalSavedResultsByOrgId.get(org.id) || 0;
    const totalWhatsappConversations = totalWhatsappConversationsByOrgId.get(org.id) || 0;
    const totalWhatsappMessages = totalWhatsappMessagesByOrgId.get(org.id) || 0;
    const todayEvents = todayEventsByOrgId.get(org.id) || 0;
    const todayProducts = todayProductsByOrgId.get(org.id) || 0;
    const todayLeads = todayLeadsByOrgId.get(org.id) || 0;
    const todaySavedResults = todaySavedResultsByOrgId.get(org.id) || 0;
    const todayWhatsappConversations = todayWhatsappConversationsByOrgId.get(org.id) || 0;
    const todayWhatsappMessages = todayWhatsappMessagesByOrgId.get(org.id) || 0;

    const totalBreakdown = {
      ai_result_generation: costSnapshot(totalSavedResults, CATEGORY_COSTS.ai_result_generation),
      catalog_product_created: costSnapshot(totalProducts, CATEGORY_COSTS.catalog_product_created),
      leads_created: costSnapshot(totalLeads, CATEGORY_COSTS.leads_created),
      whatsapp_messages: costSnapshot(totalWhatsappMessages, CATEGORY_COSTS.whatsapp_messages),
      whatsapp_conversations: costSnapshot(totalWhatsappConversations, CATEGORY_COSTS.whatsapp_conversations),
      tenant_events: costSnapshot(totalEvents, CATEGORY_COSTS.tenant_events),
    };

    const todayBreakdown = {
      ai_result_generation: costSnapshot(todaySavedResults, CATEGORY_COSTS.ai_result_generation),
      catalog_product_created: costSnapshot(todayProducts, CATEGORY_COSTS.catalog_product_created),
      leads_created: costSnapshot(todayLeads, CATEGORY_COSTS.leads_created),
      whatsapp_messages: costSnapshot(todayWhatsappMessages, CATEGORY_COSTS.whatsapp_messages),
      whatsapp_conversations: costSnapshot(todayWhatsappConversations, CATEGORY_COSTS.whatsapp_conversations),
      tenant_events: costSnapshot(todayEvents, CATEGORY_COSTS.tenant_events),
    };

    const estimatedCostToday = sumBreakdown(todayBreakdown);
    const estimatedCostTotal = sumBreakdown(totalBreakdown);
    const planBudget = getPlanBudget(org.plan_id);
    const lastActivityAt = latestMapValue(lastActivityByOrgId, org.id) || org.last_activity_at || org.updated_at || org.created_at || null;
    const softCapSummary = buildOrgSoftCapSummary({
      plan_id: org.plan_id,
      saved_results: totalSavedResults,
      leads: totalLeads,
      products: totalProducts,
      whatsapp_messages: totalWhatsappMessages,
      estimated_cost_today_cents: estimatedCostToday,
      estimated_cost_total_cents: estimatedCostTotal,
    });

    return {
      ...org,
      usage_date: usage?.usage_date || null,
      ai_tokens: usage?.ai_tokens || 0,
      ai_requests: usage?.ai_requests || 0,
      messages_sent: usage?.messages_sent || 0,
      events_count: usage?.events_count || 0,
      revenue_cents: usage?.revenue_cents || 0,
      cost_cents: usage?.cost_cents || 0,
      leads: usage?.leads || 0,
      tenant_events_count: totalEvents,
      last_activity_at: lastActivityAt,
      usage_source: org.usage_source,
      total_products: totalProducts,
      total_leads: totalLeads,
      total_saved_results: totalSavedResults,
      total_whatsapp_conversations: whatsappConversationsAvailable ? totalWhatsappConversations : null,
      total_whatsapp_messages: whatsappMessagesAvailable ? totalWhatsappMessages : null,
      estimated_cost_today_cents: estimatedCostToday,
      estimated_cost_total_cents: estimatedCostTotal,
      estimated_ai_cost_today_cents: todayBreakdown.ai_result_generation.estimated_cost_cents,
      estimated_ai_cost_total_cents: totalBreakdown.ai_result_generation.estimated_cost_cents,
      estimated_catalog_cost_today_cents: todayBreakdown.catalog_product_created.estimated_cost_cents,
      estimated_catalog_cost_total_cents: totalBreakdown.catalog_product_created.estimated_cost_cents,
      estimated_crm_cost_today_cents: todayBreakdown.leads_created.estimated_cost_cents,
      estimated_crm_cost_total_cents: totalBreakdown.leads_created.estimated_cost_cents,
      estimated_whatsapp_cost_today_cents: todayBreakdown.whatsapp_messages.estimated_cost_cents + todayBreakdown.whatsapp_conversations.estimated_cost_cents,
      estimated_whatsapp_cost_total_cents: totalBreakdown.whatsapp_messages.estimated_cost_cents + totalBreakdown.whatsapp_conversations.estimated_cost_cents,
      estimated_event_overhead_today_cents: todayBreakdown.tenant_events.estimated_cost_cents,
      estimated_event_overhead_total_cents: totalBreakdown.tenant_events.estimated_cost_cents,
      usage_health: softCapSummary.usage_health,
      billing_risk: softCapSummary.billing_risk,
      plan_budget_daily_cents: planBudget.daily,
      plan_budget_monthly_cents: planBudget.monthly,
      breakdown_today: todayBreakdown,
      breakdown_total: totalBreakdown,
      plan_soft_caps: softCapSummary.plan_soft_caps,
      soft_cap_summary: softCapSummary,
      plan_soft_cap_status: softCapSummary.overall_status,
      plan_soft_cap_message: softCapSummary.top_alerts[0]?.message || "Sem alertas",
    } satisfies AgencyBillingRow;
  }).sort((left, right) => {
    const byCost = right.estimated_cost_today_cents - left.estimated_cost_today_cents;
    if (byCost !== 0) return byCost;
    const leftActivity = left.last_activity_at ? new Date(left.last_activity_at).getTime() : 0;
    const rightActivity = right.last_activity_at ? new Date(right.last_activity_at).getTime() : 0;
    return rightActivity - leftActivity;
  });
}

function latestMapValue(map: Map<string, string | null>, key: string) {
  return map.get(key) || null;
}

export async function listAgencyBillingRows(filters: AgencyBillingFilters = {}): Promise<AgencyBillingRow[]> {
  return listAgencyBillingRowsWithFilters(filters);
}

export async function getOrgUsageSummary(orgId: string): Promise<OrgUsageSummary | null> {
  const rows = await listAgencyBillingRows();
  const row = rows.find((item) => item.id === normalize(orgId));
  if (!row) return null;

  return {
    usage_date: row.usage_date,
    ai_tokens: row.ai_tokens,
    ai_requests: row.ai_requests,
    messages_sent: row.messages_sent,
    events_count: row.events_count,
    revenue_cents: row.revenue_cents,
    cost_cents: row.cost_cents,
    leads: row.leads,
    tenant_events_count: row.tenant_events_count,
    last_activity_at: row.last_activity_at,
    usage_source: row.usage_source,
  };
}

export async function getOrgBillingSummary(orgId: string): Promise<AgencyBillingRow | null> {
  const rows = await listAgencyBillingRows();
  return rows.find((item) => item.id === normalize(orgId)) || null;
}
