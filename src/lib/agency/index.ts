import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isAgencyRole,
  normalizeTenantSlug,
  type TenantRecord,
  type TenantMemberRecord,
  resolveTenantContext,
} from "@/lib/tenant/core";

export interface AgencyUsageSnapshot {
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

export interface AgencyOrgMetrics {
  total_members: number;
  total_products: number;
  total_leads: number;
  total_saved_results: number;
  total_whatsapp_conversations: number | null;
  total_whatsapp_messages: number | null;
  usage_today: AgencyUsageSnapshot | null;
  usage_source: "today" | "latest" | "none";
  last_activity_at: string | null;
}

export interface AgencyOrgRow extends TenantRecord, AgencyOrgMetrics {}

export interface AgencySession {
  supabase: SupabaseClient;
  user: User;
  role: string;
}

const ORG_SELECT_COLUMNS = "id, slug, name, status, kill_switch, plan_id, limits, owner_user_id, created_at, updated_at";

const AGENCY_MUTATION_EVENTS: Record<"activate" | "suspend" | "toggle_kill_switch", (current: TenantRecord) => string> = {
  activate: () => "agency.org_activated",
  suspend: () => "agency.org_suspended",
  toggle_kill_switch: (current) => (current.kill_switch ? "agency.kill_switch_disabled" : "agency.kill_switch_enabled"),
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toMillis(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function ensureMapValue(map: Map<string, number>, key: string, nextValue = 1) {
  map.set(key, (map.get(key) || 0) + nextValue);
}

function updateLatestDate(map: Map<string, string | null>, key: string, value?: string | null) {
  const current = map.get(key);
  if (!value) return;
  if (!current || toMillis(value) > toMillis(current)) {
    map.set(key, value);
  }
}

function buildUsageSnapshot(row: Record<string, unknown>): AgencyUsageSnapshot {
  return {
    usage_date: normalize(row.usage_date),
    ai_tokens: toNumber(row.ai_tokens),
    ai_requests: toNumber(row.ai_requests),
    messages_sent: toNumber(row.messages_sent),
    events_count: toNumber(row.events_count),
    revenue_cents: toNumber(row.revenue_cents),
    cost_cents: toNumber(row.cost_cents),
    leads: toNumber(row.leads),
    updated_at: normalize(row.updated_at) || null,
  };
}

async function loadAgencySnapshot() {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    orgsResult,
    membersResult,
    productsResult,
    leadsResult,
    savedResultsResult,
    usageResult,
    eventsResult,
    whatsappConversationsResult,
    whatsappMessagesResult,
  ] = await Promise.all([
    admin.from("orgs").select(ORG_SELECT_COLUMNS).order("created_at", { ascending: false }),
    admin.from("org_members").select("org_id, user_id, role, status, created_at, updated_at"),
    admin.from("products").select("org_id, created_at"),
    admin.from("leads").select("org_id, last_interaction_at, created_at, updated_at"),
    admin.from("saved_results").select("org_id, created_at, updated_at"),
    admin
      .from("org_usage_daily")
      .select("org_id, usage_date, ai_tokens, ai_requests, messages_sent, events_count, revenue_cents, cost_cents, leads, updated_at"),
    admin.from("tenant_events").select("org_id, created_at, event_type"),
    admin.from("whatsapp_conversations").select("org_slug, created_at"),
    admin.from("whatsapp_messages").select("org_slug, created_at"),
  ]);

  if (orgsResult.error) {
    throw new Error(`Failed to load agency orgs: ${orgsResult.error.message}`);
  }

  const orgs = (orgsResult.data || []) as TenantRecord[];
  const orgById = new Map(orgs.map((org) => [org.id, org]));
  const orgBySlug = new Map(orgs.map((org) => [normalizeTenantSlug(org.slug), org]));
  const whatsappConversationsAvailable = !whatsappConversationsResult.error;
  const whatsappMessagesAvailable = !whatsappMessagesResult.error;

  const memberCountByOrgId = new Map<string, number>();
  const productCountByOrgId = new Map<string, number>();
  const leadCountByOrgId = new Map<string, number>();
  const savedResultCountByOrgId = new Map<string, number>();
  const whatsappConversationCountByOrgId = new Map<string, number>();
  const whatsappMessageCountByOrgId = new Map<string, number>();
  const lastActivityByOrgId = new Map<string, string | null>();
  const usageTodayByOrgId = new Map<string, AgencyUsageSnapshot>();
  const usageLatestByOrgId = new Map<string, AgencyUsageSnapshot>();
  const allUsageRows = (usageResult.data || []) as Array<Record<string, unknown>>;

  for (const row of (membersResult.data || []) as TenantMemberRecord[]) {
    ensureMapValue(memberCountByOrgId, row.org_id);
    updateLatestDate(lastActivityByOrgId, row.org_id, row.updated_at || row.created_at || null);
  }

  for (const row of (productsResult.data || []) as Array<{ org_id: string | null; created_at: string | null }>) {
    if (!row.org_id) continue;
    ensureMapValue(productCountByOrgId, row.org_id);
    updateLatestDate(lastActivityByOrgId, row.org_id, row.created_at);
  }

  for (const row of (leadsResult.data || []) as Array<{ org_id: string | null; last_interaction_at: string | null; created_at: string | null; updated_at: string | null }>) {
    if (!row.org_id) continue;
    ensureMapValue(leadCountByOrgId, row.org_id);
    updateLatestDate(lastActivityByOrgId, row.org_id, row.last_interaction_at || row.updated_at || row.created_at || null);
  }

  for (const row of (savedResultsResult.data || []) as Array<{ org_id: string | null; created_at: string | null; updated_at: string | null }>) {
    if (!row.org_id) continue;
    ensureMapValue(savedResultCountByOrgId, row.org_id);
    updateLatestDate(lastActivityByOrgId, row.org_id, row.updated_at || row.created_at);
  }

  for (const row of (eventsResult.data || []) as Array<{ org_id: string | null; created_at: string | null; event_type?: string | null }>) {
    if (!row.org_id) continue;
    updateLatestDate(lastActivityByOrgId, row.org_id, row.created_at);
  }

  for (const row of (whatsappConversationsResult.data || []) as Array<{ org_slug: string | null; created_at: string | null }>) {
    const org = row.org_slug ? orgBySlug.get(normalizeTenantSlug(row.org_slug)) : null;
    if (!org) continue;
    ensureMapValue(whatsappConversationCountByOrgId, org.id);
    updateLatestDate(lastActivityByOrgId, org.id, row.created_at);
  }

  for (const row of (whatsappMessagesResult.data || []) as Array<{ org_slug: string | null; created_at: string | null }>) {
    const org = row.org_slug ? orgBySlug.get(normalizeTenantSlug(row.org_slug)) : null;
    if (!org) continue;
    ensureMapValue(whatsappMessageCountByOrgId, org.id);
    updateLatestDate(lastActivityByOrgId, org.id, row.created_at);
  }

  for (const row of allUsageRows) {
    const orgId = normalize(row.org_id);
    if (!orgId || !orgById.has(orgId)) continue;

    const snapshot = buildUsageSnapshot(row);
    const currentLatest = usageLatestByOrgId.get(orgId);
    const rowDate = snapshot.usage_date;
    const currentDate = currentLatest?.usage_date || "";

    if (rowDate === today) {
      usageTodayByOrgId.set(orgId, snapshot);
    }

    if (!currentLatest || rowDate > currentDate || (rowDate === currentDate && toMillis(snapshot.updated_at) > toMillis(currentLatest.updated_at))) {
      usageLatestByOrgId.set(orgId, snapshot);
    }

    updateLatestDate(lastActivityByOrgId, orgId, snapshot.updated_at || rowDate);
  }

  return {
    orgs,
    memberCountByOrgId,
    productCountByOrgId,
    leadCountByOrgId,
    savedResultCountByOrgId,
    whatsappConversationCountByOrgId,
    whatsappMessageCountByOrgId,
    lastActivityByOrgId,
    usageTodayByOrgId,
    usageLatestByOrgId,
    whatsappConversationsAvailable,
    whatsappMessagesAvailable,
  };
}

function buildAgencyRow(
  org: TenantRecord,
  snapshot: Awaited<ReturnType<typeof loadAgencySnapshot>>
): AgencyOrgRow {
  const usageSnapshot = snapshot.usageTodayByOrgId.get(org.id) || snapshot.usageLatestByOrgId.get(org.id) || null;
  const usageSource =
    snapshot.usageTodayByOrgId.has(org.id)
      ? "today"
      : snapshot.usageLatestByOrgId.has(org.id)
        ? "latest"
        : "none";

  return {
    ...org,
    total_members: snapshot.memberCountByOrgId.get(org.id) || 0,
    total_products: snapshot.productCountByOrgId.get(org.id) || 0,
    total_leads: snapshot.leadCountByOrgId.get(org.id) || 0,
    total_saved_results: snapshot.savedResultCountByOrgId.get(org.id) || 0,
    total_whatsapp_conversations: snapshot.whatsappConversationsAvailable
      ? (snapshot.whatsappConversationCountByOrgId.get(org.id) ?? 0)
      : null,
    total_whatsapp_messages: snapshot.whatsappMessagesAvailable
      ? (snapshot.whatsappMessageCountByOrgId.get(org.id) ?? 0)
      : null,
    usage_today: usageSnapshot,
    usage_source: usageSource,
    last_activity_at: snapshot.lastActivityByOrgId.get(org.id) || org.updated_at || org.created_at || null,
  };
}

export async function resolveAgencySession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const context = resolveTenantContext(user);

  if (!user || !isAgencyRole(context.role)) {
    throw new Error("Agency access denied");
  }

  return {
    supabase,
    user,
    role: context.role || "agency_owner",
  } satisfies AgencySession;
}

export async function listAgencyOrgRows(): Promise<AgencyOrgRow[]> {
  const snapshot = await loadAgencySnapshot();
  return snapshot.orgs
    .map((org) => buildAgencyRow(org, snapshot))
    .sort((left, right) => {
      const byActivity = toMillis(right.last_activity_at) - toMillis(left.last_activity_at);
      if (byActivity !== 0) return byActivity;
      return toMillis(right.created_at) - toMillis(left.created_at);
    });
}

export async function listAgencyOrgs() {
  return listAgencyOrgRows();
}

export async function getAgencyOrgMetrics(orgId: string): Promise<AgencyOrgMetrics | null> {
  const normalizedOrgId = normalize(orgId);
  if (!normalizedOrgId) return null;

  const rows = await listAgencyOrgRows();
  return rows.find((row) => row.id === normalizedOrgId) || null;
}

export async function updateAgencyOrgState(
  orgId: string,
  action: "activate" | "suspend" | "toggle_kill_switch",
  actorUserId: string
) {
  const normalizedOrgId = normalize(orgId);
  if (!normalizedOrgId) {
    throw new Error("Missing orgId");
  }

  const admin = createAdminClient();
  const { data: org, error: orgError } = await admin
    .from("orgs")
    .select(ORG_SELECT_COLUMNS)
    .eq("id", normalizedOrgId)
    .maybeSingle();

  if (orgError) {
    throw new Error(`Failed to load org: ${orgError.message}`);
  }

  if (!org) {
    throw new Error("Org not found");
  }

  const nextPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (action === "activate") {
    nextPatch.status = "active";
  }

  if (action === "suspend") {
    nextPatch.status = "suspended";
  }

  if (action === "toggle_kill_switch") {
    nextPatch.kill_switch = !org.kill_switch;
  }

  const { error: updateError } = await admin.from("orgs").update(nextPatch).eq("id", normalizedOrgId);
  if (updateError) {
    throw new Error(`Failed to update org: ${updateError.message}`);
  }

  const nextKillSwitch = action === "toggle_kill_switch" ? !org.kill_switch : org.kill_switch;
  const eventType = AGENCY_MUTATION_EVENTS[action](org);
  const dedupeKey = `agency:${normalizedOrgId}:${action}:${Date.now()}`;

  const { error: eventError } = await admin.from("tenant_events").insert({
    org_id: normalizedOrgId,
    actor_user_id: actorUserId,
    event_type: eventType,
    event_source: "agency",
    dedupe_key: dedupeKey,
    payload: {
      org_id: normalizedOrgId,
      org_slug: org.slug,
      status: action === "activate" ? "active" : action === "suspend" ? "suspended" : org.status,
      kill_switch: nextKillSwitch,
      action,
    },
  });

  if (eventError) {
    throw new Error(`Org updated but audit event failed: ${eventError.message}`);
  }

  return {
    orgId: normalizedOrgId,
    action,
  };
}
