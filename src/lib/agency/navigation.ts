import type { AgencyTimeRange } from "@/lib/agency/time-range";

export type AgencyOrigin = "agency" | "billing" | "playbooks";

export interface AgencyNavigationContext {
  from?: AgencyOrigin | null;
  range?: AgencyTimeRange | null;
  actionType?: string | null;
  orgId?: string | null;
  limit?: number | null;
}

function appendIfPresent(searchParams: URLSearchParams, key: string, value: string | number | null | undefined) {
  if (value === null || value === undefined) return;
  const normalized = typeof value === "string" ? value.trim() : String(value);
  if (!normalized) return;
  searchParams.set(key, normalized);
}

export function normalizeAgencyOrigin(value: unknown): AgencyOrigin | null {
  if (value === "agency" || value === "billing" || value === "playbooks") {
    return value;
  }

  return null;
}

export function buildAgencyOrgDetailHref(orgId: string, context: AgencyNavigationContext = {}) {
  const searchParams = new URLSearchParams();
  appendIfPresent(searchParams, "from", normalizeAgencyOrigin(context.from));
  appendIfPresent(searchParams, "range", context.range && context.range !== "all" ? context.range : null);
  appendIfPresent(searchParams, "actionType", context.actionType);
  appendIfPresent(searchParams, "orgId", context.orgId);
  appendIfPresent(searchParams, "limit", context.limit);

  const query = searchParams.toString();
  return query ? `/agency/orgs/${orgId}?${query}` : `/agency/orgs/${orgId}`;
}

export function buildAgencyBackHref(context: AgencyNavigationContext = {}) {
  const origin = normalizeAgencyOrigin(context.from) || "agency";
  const searchParams = new URLSearchParams();
  appendIfPresent(searchParams, "range", context.range && context.range !== "all" ? context.range : null);

  if (origin === "playbooks") {
    appendIfPresent(searchParams, "orgId", context.orgId);
    appendIfPresent(searchParams, "actionType", context.actionType);
    appendIfPresent(searchParams, "limit", context.limit);
  }

  const query = searchParams.toString();

  switch (origin) {
    case "billing":
      return query ? `/agency/billing?${query}` : "/agency/billing";
    case "playbooks":
      return query ? `/agency/playbooks?${query}` : "/agency/playbooks";
    default:
      return query ? `/agency?${query}` : "/agency";
  }
}
