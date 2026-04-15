import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type CampaignType =
  | "welcome"
  | "tryon_followup"
  | "reengagement"
  | "new_product"
  | "low_stock_alert"
  | "inactive_lead"
  | "anniversary";

export type CampaignStatus = "draft" | "active" | "paused" | "archived";

export interface CampaignRecord {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  campaign_type: CampaignType;
  status: CampaignStatus;
  audience_query: Record<string, unknown>;
  message_template: Record<string, unknown>;
  schedule_config: Record<string, unknown>;
  limits: Record<string, unknown>;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignRunRecord {
  id: string;
  campaign_id: string;
  org_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  trigger_event: string | null;
  audience_count: number;
  sent_count: number;
  failed_count: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CampaignTriggerRecord {
  id: string;
  campaign_id: string;
  org_id: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  is_enabled: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

export interface CampaignLogRecord {
  id: string;
  run_id: string | null;
  campaign_id: string;
  org_id: string;
  lead_id: string | null;
  phone: string;
  message: string;
  status: "pending" | "sent" | "delivered" | "failed" | "skipped";
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface AudienceFilter {
  status?: string[];
  source?: string[];
  intentScoreMin?: number;
  intentScoreMax?: number;
  daysSinceInteraction?: number;
  hasPhone?: boolean;
}

export interface MessageTemplate {
  type: "text" | "template";
  content: string;
  variables?: Record<string, unknown>;
}

export const DEFAULT_LIMITS = {
  daily_limit: 50,
  per_user_limit: 3,
  throttle_seconds: 60,
};

const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  welcome: "Boas-vindas",
  tryon_followup: "Follow-up pós try-on",
  reengagement: "Reengajamento",
  new_product: "Novo produto",
  low_stock_alert: "Alerta de estoque baixo",
  inactive_lead: "Lead inativo",
  anniversary: "Aniversário",
};

export function getCampaignTypeLabel(type: CampaignType): string {
  return CAMPAIGN_TYPE_LABELS[type] || type;
}

export function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function buildAudienceQuery(
  filters: AudienceFilter
): Record<string, unknown> {
  const query: Record<string, unknown> = {};

  if (filters.status?.length) {
    query.status = filters.status;
  }

  if (filters.source?.length) {
    query.source = filters.source;
  }

  if (filters.intentScoreMin !== undefined) {
    query.intent_score_min = filters.intentScoreMin;
  }

  if (filters.intentScoreMax !== undefined) {
    query.intent_score_max = filters.intentScoreMax;
  }

  if (filters.daysSinceInteraction) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filters.daysSinceInteraction);
    query.last_interaction_before = cutoff.toISOString();
  }

  if (filters.hasPhone) {
    query.has_phone = true;
  }

  return query;
}

export async function fetchCampaignAudience(
  supabase: SupabaseClient,
  orgId: string,
  filters: AudienceFilter,
  limit = 50
): Promise<{ leads: Record<string, unknown>[]; error: Error | null }> {
  const query = buildAudienceQuery(filters);
  let dbQuery = supabase
    .from("leads")
    .select("id, org_id, name, email, phone, status, source, intent_score, last_interaction_at")
    .eq("org_id", orgId)
    .order("last_interaction_at", { ascending: false })
    .limit(limit);

  if (query.status) {
    dbQuery = dbQuery.in("status", query.status as string[]);
  }

  if (query.source) {
    dbQuery = dbQuery.in("source", query.source as string[]);
  }

  if (query.intent_score_min) {
    dbQuery = dbQuery.gte("intent_score", query.intent_score_min as number);
  }

  if (query.last_interaction_before) {
    dbQuery = dbQuery.lt("last_interaction_at", query.last_interaction_before as string);
  }

  if (query.has_phone) {
    dbQuery = dbQuery.not("phone", "is", null);
  }

  const { data, error } = await dbQuery;

  if (error) {
    return { leads: [], error };
  }

  return { leads: data || [], error: null };
}

export async function createCampaignRun(
  supabase: SupabaseClient,
  campaignId: string,
  orgId: string,
  triggerEvent?: string | null
): Promise<{ run: CampaignRunRecord | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("campaign_runs")
    .insert({
      campaign_id: campaignId,
      org_id: orgId,
      status: "running",
      trigger_event: triggerEvent || null,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return { run: null, error };
  }

  return { run: data, error: null };
}

export async function completeCampaignRun(
  supabase: SupabaseClient,
  runId: string,
  sentCount: number,
  failedCount: number,
  errorMessage?: string | null
): Promise<boolean> {
  const updates: Record<string, unknown> = {
    status: errorMessage ? "failed" : "completed",
    sent_count: sentCount,
    failed_count: failedCount,
    completed_at: new Date().toISOString(),
  };

  if (errorMessage) {
    updates.error_message = errorMessage;
  }

  const { error } = await supabase
    .from("campaign_runs")
    .update(updates)
    .eq("id", runId);

  return !error;
}

export async function recordCampaignMessage(
  supabase: SupabaseClient,
  runId: string,
  campaignId: string,
  orgId: string,
  leadId: string,
  phone: string,
  message: string,
  status: "sent" | "failed" | "skipped",
  errorMessage?: string | null
): Promise<boolean> {
  const { error } = await supabase
    .from("campaign_logs")
    .insert({
      run_id: runId,
      campaign_id: campaignId,
      org_id: orgId,
      lead_id: leadId,
      phone,
      message,
      status,
      error_message: errorMessage || null,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    });

  return !error;
}

export async function checkUserRateLimit(
  supabase: SupabaseClient,
  leadId: string,
  campaignId: string,
  limitPerUser = 3
): Promise<{ allowed: boolean; recentCount: number }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 1);

  const { data, error } = await supabase
    .from("campaign_logs")
    .select("id", { count: "exact" })
    .eq("lead_id", leadId)
    .eq("campaign_id", campaignId)
    .eq("status", "sent")
    .gte("sent_at", cutoff.toISOString());

  if (error || !data) {
    return { allowed: true, recentCount: 0 };
  }

  return {
    allowed: data.length < limitPerUser,
    recentCount: data.length,
  };
}

export async function fetchCampaignsByOrg(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ campaigns: CampaignRecord[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    return { campaigns: [], error };
  }

  return { campaigns: data || [], error: null };
}

export async function fetchCampaignTriggers(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ triggers: CampaignTriggerRecord[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("campaign_triggers")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_enabled", true)
    .order("created_at", { ascending: false });

  if (error) {
    return { triggers: [], error };
  }

  return { triggers: data || [], error: null };
}