import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { listAgencyOrgRows, type AgencyOrgRow } from "@/lib/agency";
import { normalizeAgencyTimeRange, resolveAgencyTimeRangeWindow, type AgencyTimeRange } from "@/lib/agency/time-range";

export type PlaybookQueueStatusLight = "recent" | "open" | "aging";

export type PlaybookQueueActionType =
  | "agency.monitoring_marked"
  | "agency.operational_review_marked"
  | "agency.upgrade_candidate_marked"
  | "agency.anomaly_investigation_marked";

export interface AgencyPlaybookQueueFilters {
  range?: AgencyTimeRange | null;
  orgId?: string | null;
  actionType?: PlaybookQueueActionType | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
}

export interface AgencyPlaybookQueueItem {
  event_id: string;
  org_id: string;
  org_name: string;
  org_slug: string;
  action_type: PlaybookQueueActionType;
  label: string;
  metadata: Record<string, unknown>;
  created_at: string;
  status_light: PlaybookQueueStatusLight;
}

export interface AgencyPlaybookQueueSummary {
  total_items: number;
  recent_items: number;
  open_items: number;
  aging_items: number;
  by_action_type: Record<PlaybookQueueActionType, number>;
}

const PLAYBOOK_EVENT_LABELS: Record<PlaybookQueueActionType, string> = {
  "agency.monitoring_marked": "Monitoramento",
  "agency.operational_review_marked": "Revisão operacional",
  "agency.upgrade_candidate_marked": "Upgrade candidate",
  "agency.anomaly_investigation_marked": "Investigação",
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLimit(value: number | undefined) {
  if (!value || !Number.isFinite(value)) return 50;
  return Math.max(1, Math.min(100, Math.floor(value)));
}

function statusLightForDate(createdAt: string) {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 2) return "recent";
  if (ageDays <= 7) return "open";
  return "aging";
}

function matchesDateRange(createdAt: string, dateFrom?: string | null, dateTo?: string | null) {
  if (dateFrom && createdAt < `${dateFrom}T00:00:00`) return false;
  if (dateTo && createdAt > `${dateTo}T23:59:59.999`) return false;
  return true;
}

async function loadOrgMap() {
  const orgRows = await listAgencyOrgRows();
  const orgById = new Map(orgRows.map((org) => [org.id, org] as const));
  const orgBySlug = new Map(orgRows.map((org) => [normalize(org.slug), org] as const));
  return { orgRows, orgById, orgBySlug };
}

function toQueueItem(
  event: {
    id: string;
    org_id: string | null;
    event_type: string;
    payload: unknown;
    created_at: string | null;
  },
  orgById: Map<string, AgencyOrgRow>,
  orgBySlug: Map<string, AgencyOrgRow>
): AgencyPlaybookQueueItem | null {
  const orgId = normalize(event.org_id);
  const createdAt = normalize(event.created_at);
  if (!orgId || !createdAt) return null;

  const org = orgById.get(orgId);
  const payload = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
    ? (event.payload as Record<string, unknown>)
    : {};
  const payloadOrgSlug = normalize(payload.org_slug);
  const resolvedOrg = org || (payloadOrgSlug ? orgBySlug.get(payloadOrgSlug) : null);

  if (!resolvedOrg) return null;

  const actionType = event.event_type as PlaybookQueueActionType;
  if (!(actionType in PLAYBOOK_EVENT_LABELS)) {
    return null;
  }

  return {
    event_id: event.id,
    org_id: resolvedOrg.id,
    org_name: resolvedOrg.name,
    org_slug: resolvedOrg.slug,
    action_type: actionType,
    label: PLAYBOOK_EVENT_LABELS[actionType],
    metadata: payload,
    created_at: createdAt,
    status_light: statusLightForDate(createdAt),
  };
}

export async function listPlaybookQueueItems(
  filters: AgencyPlaybookQueueFilters = {}
): Promise<AgencyPlaybookQueueItem[]> {
  const limit = normalizeLimit(filters.limit);
  const range = normalizeAgencyTimeRange(filters.range, "all");
  const rangeWindow = resolveAgencyTimeRangeWindow(range);
  const dateFrom = filters.dateFrom || rangeWindow.dateFrom;
  const dateTo = filters.dateTo || null;
  const admin = createAdminClient();
  const { orgById, orgBySlug } = await loadOrgMap();

  const query = admin
    .from("tenant_events")
    .select("id, org_id, event_type, payload, created_at")
    .in("event_type", Object.keys(PLAYBOOK_EVENT_LABELS));

  if (filters.orgId) {
    query.eq("org_id", normalize(filters.orgId));
  }

  if (filters.actionType) {
    query.eq("event_type", filters.actionType);
  }

  if (dateFrom) {
    query.gte("created_at", `${dateFrom}T00:00:00`);
  }

  if (dateTo) {
    query.lte("created_at", `${dateTo}T23:59:59.999`);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error || !data) {
    return [];
  }

  return data
    .map((event) => toQueueItem(event as {
      id: string;
      org_id: string | null;
      event_type: string;
      payload: unknown;
      created_at: string | null;
    }, orgById, orgBySlug))
    .filter((item) => (item ? matchesDateRange(item.created_at, dateFrom, dateTo) : false))
    .filter((item): item is AgencyPlaybookQueueItem => Boolean(item));
}

export async function getPlaybookQueueSummary(
  filters: AgencyPlaybookQueueFilters = {}
): Promise<AgencyPlaybookQueueSummary> {
  const items = await listPlaybookQueueItems({ ...filters, limit: filters.limit || 100 });
  const summary: AgencyPlaybookQueueSummary = {
    total_items: items.length,
    recent_items: items.filter((item) => item.status_light === "recent").length,
    open_items: items.filter((item) => item.status_light === "open").length,
    aging_items: items.filter((item) => item.status_light === "aging").length,
    by_action_type: {
      "agency.monitoring_marked": 0,
      "agency.operational_review_marked": 0,
      "agency.upgrade_candidate_marked": 0,
      "agency.anomaly_investigation_marked": 0,
    },
  };

  for (const item of items) {
    summary.by_action_type[item.action_type] += 1;
  }

  return summary;
}

export async function listPlaybookQueueByOrg(orgId: string, limit = 20) {
  return listPlaybookQueueItems({ orgId, limit });
}
