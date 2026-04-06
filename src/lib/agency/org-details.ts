import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createEmptyLeadStatusCounts, extractLeadSignalsFromSavedResultPayload, isLeadStatus, type LeadStatus } from "@/lib/leads";
import { listAgencyBillingRows, type AgencyBillingRow } from "@/lib/billing";
import { getOrgGuidanceSummary } from "@/lib/billing/guidance";
import { getOrgPlaybookSummary, type OrgActionPlaybook } from "@/lib/billing/playbooks";
import { resolveAgencyTimeRangeWindow, type AgencyTimeRange } from "@/lib/agency/time-range";
import { listPlaybookQueueItems, type AgencyPlaybookQueueItem } from "@/lib/agency/playbook-queue";
import { collectOperationalSignalSummary, type OperationalSignalSummary } from "@/lib/agency/operational-signals";
import { buildOperationalAgingSummary, type AgencyAgingSummary } from "@/lib/agency/aging-summary";

export interface AgencyOrgLeadRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  intent_score: number | null;
  whatsapp_key: string | null;
  next_follow_up_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_interaction_at: string | null;
}

export interface AgencyOrgLeadSummary {
  total: number;
  by_status: Record<LeadStatus, number>;
  followup_overdue: number;
  followup_today: number;
  followup_upcoming: number;
  followup_without: number;
}

export interface AgencyOrgProductRow {
  id: string;
  name: string;
  category: string;
  style: string | null;
  primary_color: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AgencyOrgSavedResultRow {
  id: string;
  user_name: string | null;
  user_email: string | null;
  created_at: string | null;
  updated_at: string | null;
  org_id: string | null;
  tenant_org_id: string | null;
  tenant_org_slug: string | null;
  tenant_source: string | null;
  intent_score: number | null;
  has_tenant_context: boolean;
}

export interface AgencyOrgEventRow {
  id: string;
  event_type: string;
  event_source: string | null;
  created_at: string | null;
  payload_summary: string | null;
  payload: Record<string, unknown> | null;
}

export interface AgencyOrgWhatsAppConversationRow {
  id: string;
  status: string;
  priority: string;
  last_message: string | null;
  unread_count: number | null;
  user_name: string | null;
  user_phone: string | null;
  created_at: string | null;
  last_updated: string | null;
}

export interface AgencyOrgUsageRow {
  usage_date: string;
  ai_tokens: number;
  ai_requests: number;
  messages_sent: number;
  events_count: number;
  revenue_cents: number;
  cost_cents: number;
  leads: number;
  updated_at: string | null;
}

export interface AgencyOrgBillingDetail {
  summary: AgencyBillingRow | null;
  recent_usage_rows: AgencyOrgUsageRow[];
}

export interface AgencyOrgWhatsAppSummary {
  recent_conversations_count: number | null;
  recent_messages_count: number | null;
  latest_whatsapp_activity_at: string | null;
  available: boolean;
  recent_conversations: AgencyOrgWhatsAppConversationRow[];
  historical: AgencyOrgWhatsAppHistoricalSummary | null;
}

export interface AgencyOrgWhatsAppHistoricalSummary {
  total_conversations_count: number | null;
  total_messages_count: number | null;
  first_activity_at: string | null;
  last_activity_at: string | null;
}

export interface AgencyOrgDetail {
  org: AgencyBillingRow;
  guidance: ReturnType<typeof getOrgGuidanceSummary>;
  playbook: OrgActionPlaybook;
  billing: AgencyOrgBillingDetail;
  lead_summary: AgencyOrgLeadSummary;
  aging_summary: AgencyAgingSummary;
  operational_summary: OperationalSignalSummary;
  leads: AgencyOrgLeadRow[];
  products: AgencyOrgProductRow[];
  saved_results: AgencyOrgSavedResultRow[];
  whatsapp: AgencyOrgWhatsAppSummary;
  events: AgencyOrgEventRow[];
  playbook_queue: AgencyPlaybookQueueItem[];
}

export interface AgencyOrgExportSummary {
  org_id: string;
  org_name: string;
  org_slug: string;
  status: string;
  plan_id: string | null;
  kill_switch: boolean;
  total_members: number;
  total_products: number;
  total_leads: number;
  total_saved_results: number;
  recent_whatsapp_conversations_count: number | null;
  recent_whatsapp_messages_count: number | null;
  historical_whatsapp_conversations_count: number | null;
  historical_whatsapp_messages_count: number | null;
  historical_whatsapp_first_activity_at: string | null;
  historical_whatsapp_last_activity_at: string | null;
  usage_date: string | null;
  last_activity_at: string | null;
  estimated_cost_today_cents: number;
  estimated_cost_total_cents: number;
  usage_health: string | null;
  billing_risk: string | null;
  overall_status: string | null;
  guidance_level: string | null;
  recommended_action: string | null;
  suggested_plan_if_any: string | null;
  playbook_title: string | null;
  playbook_summary: string | null;
  recent_events_count: number;
  recent_queue_count: number;
  recent_leads_count: number;
  recent_products_count: number;
  recent_saved_results_count: number;
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableString(value: unknown) {
  const normalized = normalize(value);
  return normalized || null;
}

function toNullableDate(value: unknown) {
  const normalized = normalize(value);
  return normalized || null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function rangeWindow(range: AgencyTimeRange) {
  return resolveAgencyTimeRangeWindow(range);
}

function dateKey(value: Date) {
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function getLeadSummary(leads: AgencyOrgLeadRow[]): AgencyOrgLeadSummary {
  const by_status: Record<LeadStatus, number> = {
    ...createEmptyLeadStatusCounts(),
  };

  const now = new Date();
  const todayKey = dateKey(now);

  let followup_overdue = 0;
  let followup_today = 0;
  let followup_upcoming = 0;
  let followup_without = 0;

  for (const lead of leads) {
    const status = lead.status as LeadStatus;
    if (isLeadStatus(status)) {
      by_status[status] = (by_status[status] || 0) + 1;
    }

    if (!lead.next_follow_up_at) {
      followup_without += 1;
      continue;
    }

    const followUpAt = new Date(lead.next_follow_up_at);
    if (Number.isNaN(followUpAt.getTime())) {
      followup_without += 1;
      continue;
    }

    const followUpKey = dateKey(followUpAt);
    if (followUpAt.getTime() < now.getTime()) {
      followup_overdue += 1;
    } else if (followUpKey === todayKey) {
      followup_today += 1;
    } else {
      followup_upcoming += 1;
    }
  }

  return {
    total: leads.length,
    by_status,
    followup_overdue,
    followup_today,
    followup_upcoming,
    followup_without,
  };
}

function summarizePayload(payload: unknown) {
  const record = asRecord(payload);
  const tenant = asRecord(record.tenant);
  const reasonCode = toNullableString(record.reason_code);
  const durationMs = typeof record.duration_ms === "number"
    ? record.duration_ms
    : typeof record.duration_ms === "string"
      ? Number(record.duration_ms)
      : null;
  const generationDurationMs = typeof record.generation_duration_ms === "number"
    ? record.generation_duration_ms
    : typeof record.generation_duration_ms === "string"
      ? Number(record.generation_duration_ms)
      : null;
  const persistDurationMs = typeof record.persist_duration_ms === "number"
    ? record.persist_duration_ms
    : typeof record.persist_duration_ms === "string"
      ? Number(record.persist_duration_ms)
      : null;
  const waitDurationMs = typeof record.wait_duration_ms === "number"
    ? record.wait_duration_ms
    : typeof record.wait_duration_ms === "string"
      ? Number(record.wait_duration_ms)
      : null;
  const hasDurationMs = typeof durationMs === "number" && Number.isFinite(durationMs);
  const hasGenerationDurationMs = typeof generationDurationMs === "number" && Number.isFinite(generationDurationMs);
  const hasPersistDurationMs = typeof persistDurationMs === "number" && Number.isFinite(persistDurationMs);
  const hasWaitDurationMs = typeof waitDurationMs === "number" && Number.isFinite(waitDurationMs);
  const parts = [
    tenant.orgSlug ? `tenant=${tenant.orgSlug}` : "",
    tenant.source ? `source=${tenant.source}` : "",
    record.org_slug ? `org_slug=${record.org_slug}` : "",
    record.lead_id ? `lead_id=${record.lead_id}` : "",
    record.saved_result_id ? `saved_result_id=${record.saved_result_id}` : "",
    record.reservation_key ? `reservation_key=${record.reservation_key}` : "",
    record.result_source ? `result_source=${record.result_source}` : "",
    record.operation ? `operation=${record.operation}` : "",
    record.metric ? `metric=${record.metric}` : "",
    record.status ? `status=${record.status}` : "",
    record.failure_stage ? `failure_stage=${record.failure_stage}` : "",
    reasonCode ? `reason=${reasonCode}` : "",
    hasDurationMs ? `duration=${durationMs}ms` : "",
    hasGenerationDurationMs ? `generation=${generationDurationMs}ms` : "",
    hasPersistDurationMs ? `persist=${persistDurationMs}ms` : "",
    hasWaitDurationMs ? `wait=${waitDurationMs}ms` : "",
    record.product_id ? `product_id=${record.product_id}` : "",
    record.action ? `action=${record.action}` : "",
  ].filter(Boolean);

  return parts.length ? parts.join(" | ") : null;
}

async function resolveAgencyOrgRow(orgId: string) {
  const rows = await listAgencyBillingRows();
  return rows.find((row) => row.id === normalize(orgId)) || null;
}

export async function getAgencyOrgBillingDetail(orgId: string, range: AgencyTimeRange = "all"): Promise<AgencyOrgBillingDetail | null> {
  const org = await resolveAgencyOrgRow(orgId);
  if (!org) {
    return null;
  }

  const admin = createAdminClient();
  const window = rangeWindow(range);
  const query = admin
    .from("org_usage_daily")
    .select("usage_date, ai_tokens, ai_requests, messages_sent, events_count, revenue_cents, cost_cents, leads, updated_at")
    .eq("org_id", org.id)
    .order("usage_date", { ascending: false })
    .limit(7);

  if (window.dateFrom) {
    query.gte("usage_date", window.dateFrom);
  }

  const { data, error } = await query;

  if (error) {
    return {
      summary: org,
      recent_usage_rows: [],
    };
  }

  return {
    summary: org,
    recent_usage_rows: (data || []).map((row) => ({
      usage_date: normalize(row.usage_date),
      ai_tokens: toNumber(row.ai_tokens),
      ai_requests: toNumber(row.ai_requests),
      messages_sent: toNumber(row.messages_sent),
      events_count: toNumber(row.events_count),
      revenue_cents: toNumber(row.revenue_cents),
      cost_cents: toNumber(row.cost_cents),
      leads: toNumber(row.leads),
      updated_at: toNullableString(row.updated_at),
    })),
  };
}

export async function getAgencyOrgLeadRows(orgId: string, range: AgencyTimeRange = "all"): Promise<AgencyOrgLeadRow[]> {
  const admin = createAdminClient();
  const window = rangeWindow(range);
  const query = admin
    .from("leads")
    .select("id, name, email, phone, source, status, intent_score, whatsapp_key, next_follow_up_at, created_at, updated_at, last_interaction_at")
    .eq("org_id", normalize(orgId))
    .order("last_interaction_at", { ascending: false, nullsFirst: false })
    .limit(20);

  if (window.dateFrom) {
    query.gte("created_at", `${window.dateFrom}T00:00:00`);
  }

  const result = await query;

  if (result.error) {
    return [];
  }

  return (result.data || []).map((row) => ({
    id: normalize(row.id),
    name: toNullableString(row.name),
    email: toNullableString(row.email),
    phone: toNullableString(row.phone),
    source: toNullableString(row.source),
    status: normalize(row.status) || "new",
    intent_score: typeof row.intent_score === "number" ? row.intent_score : row.intent_score === null ? null : Number(row.intent_score) || null,
    whatsapp_key: toNullableString(row.whatsapp_key),
    next_follow_up_at: toNullableDate(row.next_follow_up_at),
    created_at: toNullableDate(row.created_at),
    updated_at: toNullableDate(row.updated_at),
    last_interaction_at: toNullableDate(row.last_interaction_at),
  }));
}

export async function getAgencyOrgProductRows(orgId: string, range: AgencyTimeRange = "all"): Promise<AgencyOrgProductRow[]> {
  const admin = createAdminClient();
  const window = rangeWindow(range);
  const query = admin
    .from("products")
    .select("id, name, category, style, primary_color, created_at, updated_at")
    .eq("org_id", normalize(orgId))
    .order("created_at", { ascending: false })
    .limit(20);

  if (window.dateFrom) {
    query.gte("created_at", `${window.dateFrom}T00:00:00`);
  }

  const result = await query;

  if (result.error) {
    return [];
  }

  return (result.data || []).map((row) => ({
    id: normalize(row.id),
    name: normalize(row.name),
    category: normalize(row.category),
    style: toNullableString(row.style),
    primary_color: toNullableString(row.primary_color),
    created_at: toNullableDate(row.created_at),
    updated_at: toNullableDate(row.updated_at),
  }));
}

export async function getAgencyOrgSavedResultsRows(orgId: string, range: AgencyTimeRange = "all"): Promise<AgencyOrgSavedResultRow[]> {
  const admin = createAdminClient();
  const window = rangeWindow(range);
  const query = admin
    .from("saved_results")
    .select("id, user_name, user_email, created_at, updated_at, org_id, payload")
    .eq("org_id", normalize(orgId))
    .order("created_at", { ascending: false })
    .limit(20);

  if (window.dateFrom) {
    query.gte("created_at", `${window.dateFrom}T00:00:00`);
  }

  const result = await query;

  if (result.error) {
    return [];
  }

  return (result.data || []).map((row) => {
    const payload = asRecord(row.payload);
    const tenant = asRecord(payload.tenant);
    const signals = extractLeadSignalsFromSavedResultPayload(payload);

    return {
      id: normalize(row.id),
      user_name: toNullableString(row.user_name),
      user_email: toNullableString(row.user_email),
      created_at: toNullableDate(row.created_at),
      updated_at: toNullableDate(row.updated_at),
      org_id: toNullableString(row.org_id),
      tenant_org_id: toNullableString(tenant.orgId || tenant.org_id || payload.org_id),
      tenant_org_slug: toNullableString(tenant.orgSlug || tenant.org_slug || payload.org_slug),
      tenant_source: toNullableString(tenant.source || payload.source),
      intent_score: typeof signals.intentScore === "number" ? signals.intentScore : null,
      has_tenant_context: Boolean(tenant.orgId || tenant.org_id || tenant.orgSlug || tenant.org_slug || payload.org_id || payload.org_slug),
    };
  });
}

export async function getAgencyOrgEventsRows(orgId: string, range: AgencyTimeRange = "all"): Promise<AgencyOrgEventRow[]> {
  const admin = createAdminClient();
  const window = rangeWindow(range);
  const query = admin
    .from("tenant_events")
    .select("id, event_type, event_source, created_at, payload")
    .eq("org_id", normalize(orgId))
    .order("created_at", { ascending: false })
    .limit(20);

  if (window.dateFrom) {
    query.gte("created_at", `${window.dateFrom}T00:00:00`);
  }

  const { data, error } = await query;

  if (error) {
    return [];
  }

  return (data || []).map((row) => ({
    id: normalize(row.id),
    event_type: normalize(row.event_type),
    event_source: toNullableString(row.event_source),
    created_at: toNullableDate(row.created_at),
    payload_summary: summarizePayload(row.payload),
    payload: asRecord(row.payload),
  }));
}

export async function getAgencyOrgWhatsAppSummary(orgId: string, range: AgencyTimeRange = "all"): Promise<AgencyOrgWhatsAppSummary | null> {
  const org = await resolveAgencyOrgRow(orgId);
  if (!org) {
    return null;
  }

  const admin = createAdminClient();
  const window = rangeWindow(range);
  const conversationQuery = admin
    .from("whatsapp_conversations")
    .select("id, status, priority, last_message, unread_count, user_name, user_phone, created_at, last_updated")
    .eq("org_slug", org.slug)
    .order("last_updated", { ascending: false })
    .limit(5);

  const conversationCountQuery = admin
    .from("whatsapp_conversations")
    .select("id", { count: "exact", head: true })
    .eq("org_slug", org.slug);

  const messageCountQuery = admin
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("org_slug", org.slug);

  const latestMessageQuery = admin
    .from("whatsapp_messages")
    .select("created_at")
    .eq("org_slug", org.slug)
    .order("created_at", { ascending: false })
    .limit(1);

  const earliestConversationQuery = admin
    .from("whatsapp_conversations")
    .select("created_at")
    .eq("org_slug", org.slug)
    .order("created_at", { ascending: true })
    .limit(1);

  const earliestMessageQuery = admin
    .from("whatsapp_messages")
    .select("created_at")
    .eq("org_slug", org.slug)
    .order("created_at", { ascending: true })
    .limit(1);

  if (window.dateFrom) {
    conversationQuery.gte("created_at", `${window.dateFrom}T00:00:00`);
    conversationCountQuery.gte("created_at", `${window.dateFrom}T00:00:00`);
    messageCountQuery.gte("created_at", `${window.dateFrom}T00:00:00`);
    latestMessageQuery.gte("created_at", `${window.dateFrom}T00:00:00`);
  }

  const [conversationResult, conversationCountResult, messageCountResult, latestMessageResult, earliestConversationResult, earliestMessageResult] = await Promise.all([
    conversationQuery,
    conversationCountQuery,
    messageCountQuery,
    latestMessageQuery,
    earliestConversationQuery,
    earliestMessageQuery,
  ]);

  const recentConversations = conversationResult.error
    ? []
    : (conversationResult.data || []).map((row) => ({
        id: normalize(row.id),
        status: normalize(row.status),
        priority: normalize(row.priority),
        last_message: toNullableString(row.last_message),
        unread_count: typeof row.unread_count === "number" ? row.unread_count : row.unread_count === null ? null : Number(row.unread_count) || null,
        user_name: toNullableString(row.user_name),
        user_phone: toNullableString(row.user_phone),
        created_at: toNullableDate(row.created_at),
        last_updated: toNullableDate(row.last_updated),
      }));

  const recentConversationsCount = conversationCountResult.error ? null : conversationCountResult.count ?? 0;
  const recentMessagesCount = messageCountResult.error ? null : messageCountResult.count ?? 0;
  const latestConversationActivity = recentConversations.reduce<string | null>((current, row) => {
    const candidate = row.last_updated || row.created_at;
    if (!candidate) return current;
    if (!current || candidate > current) return candidate;
    return current;
  }, null);

  const latestMessageActivity = latestMessageResult.error ? null : latestMessageResult.data?.[0]?.created_at || null;
  const latestWhatsAppActivityAt = [latestConversationActivity, latestMessageActivity]
    .filter((value): value is string => Boolean(value))
    .reduce<string | null>((current, candidate) => {
      if (!current || candidate > current) return candidate;
      return current;
    }, null);

  const earliestConversationActivity = earliestConversationResult.error ? null : earliestConversationResult.data?.[0]?.created_at || null;
  const earliestMessageActivity = earliestMessageResult.error ? null : earliestMessageResult.data?.[0]?.created_at || null;
  const historicalFirstActivityAt = [earliestConversationActivity, earliestMessageActivity]
    .filter((value): value is string => Boolean(value))
    .reduce<string | null>((current, candidate) => {
      if (!current || candidate < current) return candidate;
      return current;
    }, null);

  const historical = {
    total_conversations_count: org.total_whatsapp_conversations,
    total_messages_count: org.total_whatsapp_messages,
    first_activity_at: historicalFirstActivityAt,
    last_activity_at: org.last_activity_at,
  };

  const hasHistoricalData =
    historical.total_conversations_count !== null ||
    historical.total_messages_count !== null ||
    historical.first_activity_at !== null ||
    historical.last_activity_at !== null;

  return {
    recent_conversations_count: recentConversationsCount,
    recent_messages_count: recentMessagesCount,
    latest_whatsapp_activity_at: latestWhatsAppActivityAt,
    available: !conversationResult.error && !conversationCountResult.error && !messageCountResult.error && !latestMessageResult.error,
    recent_conversations: recentConversations,
    historical: hasHistoricalData ? historical : null,
  };
}

export async function getAgencyOrgPlaybookQueue(orgId: string, range: AgencyTimeRange = "all") {
  return listPlaybookQueueItems({ orgId, range, limit: 10 });
}

export async function getAgencyOrgDetail(orgId: string, range: AgencyTimeRange = "all"): Promise<AgencyOrgDetail | null> {
  const org = await resolveAgencyOrgRow(orgId);
  if (!org) {
    return null;
  }

  const filteredBillingRows = await listAgencyBillingRows({ orgId: org.id, range });
  const [billing, leads, products, savedResults, whatsapp, events] = await Promise.all([
    getAgencyOrgBillingDetail(org.id, range),
    getAgencyOrgLeadRows(org.id, range),
    getAgencyOrgProductRows(org.id, range),
    getAgencyOrgSavedResultsRows(org.id, range),
    getAgencyOrgWhatsAppSummary(org.id, range),
    getAgencyOrgEventsRows(org.id, range),
  ]);

  const guidanceRow = filteredBillingRows.find((row) => row.id === org.id) || org;
  const guidance = getOrgGuidanceSummary(guidanceRow);

  return {
    org,
    guidance,
    playbook: getOrgPlaybookSummary(guidance),
    billing: billing || { summary: org, recent_usage_rows: [] },
    lead_summary: getLeadSummary(leads),
    aging_summary: buildOperationalAgingSummary(leads),
    operational_summary: collectOperationalSignalSummary(events.map((event) => ({
      org_id: org.id,
      event_type: event.event_type,
      created_at: event.created_at,
      payload: event.payload,
    }))),
    leads,
    products,
    saved_results: savedResults,
    whatsapp: whatsapp || {
      recent_conversations_count: null,
      recent_messages_count: null,
      latest_whatsapp_activity_at: null,
      available: false,
      recent_conversations: [],
      historical: null,
    },
    events,
    playbook_queue: await getAgencyOrgPlaybookQueue(org.id, range),
  };
}

export async function getAgencyOrgExportDetail(orgId: string, range: AgencyTimeRange = "all") {
  const detail = await getAgencyOrgDetail(orgId, range);
  if (!detail) {
    return null;
  }

  const usageRow = detail.billing.recent_usage_rows[0] || null;

  return {
    detail,
    summary: {
      org_id: detail.org.id,
      org_name: detail.org.name,
      org_slug: detail.org.slug,
      status: detail.org.status,
      plan_id: detail.org.plan_id,
      kill_switch: detail.org.kill_switch,
      total_members: detail.org.total_members,
      total_products: detail.org.total_products,
      total_leads: detail.org.total_leads,
      total_saved_results: detail.org.total_saved_results,
      recent_whatsapp_conversations_count: detail.whatsapp.recent_conversations_count,
      recent_whatsapp_messages_count: detail.whatsapp.recent_messages_count,
      historical_whatsapp_conversations_count: detail.whatsapp.historical?.total_conversations_count ?? null,
      historical_whatsapp_messages_count: detail.whatsapp.historical?.total_messages_count ?? null,
      historical_whatsapp_first_activity_at: detail.whatsapp.historical?.first_activity_at ?? null,
      historical_whatsapp_last_activity_at: detail.whatsapp.historical?.last_activity_at ?? null,
      usage_date: usageRow?.usage_date || null,
      last_activity_at: detail.org.last_activity_at,
      estimated_cost_today_cents: detail.org.estimated_cost_today_cents,
      estimated_cost_total_cents: detail.org.estimated_cost_total_cents,
      usage_health: detail.billing.summary?.usage_health ?? null,
      billing_risk: detail.billing.summary?.billing_risk ?? null,
      overall_status: detail.billing.summary?.soft_cap_summary.overall_status ?? null,
      guidance_level: detail.guidance.guidance_level,
      recommended_action: detail.guidance.recommended_action,
      suggested_plan_if_any: detail.playbook.suggested_plan_if_any,
      playbook_title: detail.playbook.title,
      playbook_summary: detail.playbook.summary,
      recent_events_count: detail.events.length,
      recent_queue_count: detail.playbook_queue.length,
      recent_leads_count: detail.leads.length,
      recent_products_count: detail.products.length,
      recent_saved_results_count: detail.saved_results.length,
    } satisfies AgencyOrgExportSummary,
  };
}
