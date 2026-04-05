import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { extractLeadSignalsFromSavedResultPayload } from "@/lib/leads";
import { listAgencyBillingRows, type AgencyBillingRow } from "@/lib/billing";

export interface AgencyOrgLeadRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  intent_score: number | null;
  whatsapp_key: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_interaction_at: string | null;
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
  total_conversations: number | null;
  total_messages: number | null;
  last_activity_at: string | null;
  available: boolean;
  recent_conversations: AgencyOrgWhatsAppConversationRow[];
}

export interface AgencyOrgDetail {
  org: AgencyBillingRow;
  billing: AgencyOrgBillingDetail;
  leads: AgencyOrgLeadRow[];
  products: AgencyOrgProductRow[];
  saved_results: AgencyOrgSavedResultRow[];
  whatsapp: AgencyOrgWhatsAppSummary;
  events: AgencyOrgEventRow[];
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

function summarizePayload(payload: unknown) {
  const record = asRecord(payload);
  const tenant = asRecord(record.tenant);
  const parts = [
    tenant.orgSlug ? `tenant=${tenant.orgSlug}` : "",
    tenant.source ? `source=${tenant.source}` : "",
    record.org_slug ? `org_slug=${record.org_slug}` : "",
    record.lead_id ? `lead_id=${record.lead_id}` : "",
    record.saved_result_id ? `saved_result_id=${record.saved_result_id}` : "",
    record.product_id ? `product_id=${record.product_id}` : "",
    record.action ? `action=${record.action}` : "",
  ].filter(Boolean);

  return parts.length ? parts.join(" | ") : null;
}

async function resolveAgencyOrgRow(orgId: string) {
  const rows = await listAgencyBillingRows();
  return rows.find((row) => row.id === normalize(orgId)) || null;
}

export async function getAgencyOrgBillingDetail(orgId: string): Promise<AgencyOrgBillingDetail | null> {
  const org = await resolveAgencyOrgRow(orgId);
  if (!org) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("org_usage_daily")
    .select("usage_date, ai_tokens, ai_requests, messages_sent, events_count, revenue_cents, cost_cents, leads, updated_at")
    .eq("org_id", org.id)
    .order("usage_date", { ascending: false })
    .limit(7);

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

export async function getAgencyOrgLeadRows(orgId: string): Promise<AgencyOrgLeadRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("leads")
    .select("id, name, email, phone, source, status, intent_score, whatsapp_key, created_at, updated_at, last_interaction_at")
    .eq("org_id", normalize(orgId))
    .order("last_interaction_at", { ascending: false, nullsFirst: false })
    .limit(20);

  if (error) {
    return [];
  }

  return (data || []).map((row) => ({
    id: normalize(row.id),
    name: toNullableString(row.name),
    email: toNullableString(row.email),
    phone: toNullableString(row.phone),
    source: toNullableString(row.source),
    status: normalize(row.status) || "new",
    intent_score: typeof row.intent_score === "number" ? row.intent_score : row.intent_score === null ? null : Number(row.intent_score) || null,
    whatsapp_key: toNullableString(row.whatsapp_key),
    created_at: toNullableDate(row.created_at),
    updated_at: toNullableDate(row.updated_at),
    last_interaction_at: toNullableDate(row.last_interaction_at),
  }));
}

export async function getAgencyOrgProductRows(orgId: string): Promise<AgencyOrgProductRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .select("id, name, category, style, primary_color, created_at, updated_at")
    .eq("org_id", normalize(orgId))
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return [];
  }

  return (data || []).map((row) => ({
    id: normalize(row.id),
    name: normalize(row.name),
    category: normalize(row.category),
    style: toNullableString(row.style),
    primary_color: toNullableString(row.primary_color),
    created_at: toNullableDate(row.created_at),
    updated_at: toNullableDate(row.updated_at),
  }));
}

export async function getAgencyOrgSavedResultsRows(orgId: string): Promise<AgencyOrgSavedResultRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("saved_results")
    .select("id, user_name, user_email, created_at, updated_at, org_id, payload")
    .eq("org_id", normalize(orgId))
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return [];
  }

  return (data || []).map((row) => {
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

export async function getAgencyOrgEventsRows(orgId: string): Promise<AgencyOrgEventRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenant_events")
    .select("id, event_type, event_source, created_at, payload")
    .eq("org_id", normalize(orgId))
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return [];
  }

  return (data || []).map((row) => ({
    id: normalize(row.id),
    event_type: normalize(row.event_type),
    event_source: toNullableString(row.event_source),
    created_at: toNullableDate(row.created_at),
    payload_summary: summarizePayload(row.payload),
  }));
}

export async function getAgencyOrgWhatsAppSummary(orgId: string): Promise<AgencyOrgWhatsAppSummary | null> {
  const org = await resolveAgencyOrgRow(orgId);
  if (!org) {
    return null;
  }

  const admin = createAdminClient();
  const [conversationResult, messageResult] = await Promise.all([
    admin
      .from("whatsapp_conversations")
      .select("id, status, priority, last_message, unread_count, user_name, user_phone, created_at, last_updated")
      .eq("org_slug", org.slug)
      .order("last_updated", { ascending: false })
      .limit(5),
    admin.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("org_slug", org.slug),
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

  const totalMessages = messageResult.error ? null : messageResult.count ?? 0;
  const lastConversationActivity = recentConversations.reduce<string | null>((current, row) => {
    const candidate = row.last_updated || row.created_at;
    if (!candidate) return current;
    if (!current || candidate > current) return candidate;
    return current;
  }, org.last_activity_at || null);

  return {
    total_conversations: org.total_whatsapp_conversations,
    total_messages: totalMessages,
    last_activity_at: lastConversationActivity,
    available: !conversationResult.error && !messageResult.error,
    recent_conversations: recentConversations,
  };
}

export async function getAgencyOrgDetail(orgId: string): Promise<AgencyOrgDetail | null> {
  const org = await resolveAgencyOrgRow(orgId);
  if (!org) {
    return null;
  }

  const [billing, leads, products, savedResults, whatsapp, events] = await Promise.all([
    getAgencyOrgBillingDetail(org.id),
    getAgencyOrgLeadRows(org.id),
    getAgencyOrgProductRows(org.id),
    getAgencyOrgSavedResultsRows(org.id),
    getAgencyOrgWhatsAppSummary(org.id),
    getAgencyOrgEventsRows(org.id),
  ]);

  return {
    org,
    billing: billing || { summary: org, recent_usage_rows: [] },
    leads,
    products,
    saved_results: savedResults,
    whatsapp: whatsapp || {
      total_conversations: org.total_whatsapp_conversations,
      total_messages: org.total_whatsapp_messages,
      last_activity_at: org.last_activity_at,
      available: false,
      recent_conversations: [],
    },
    events,
  };
}
