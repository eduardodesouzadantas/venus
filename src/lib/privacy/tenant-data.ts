import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizePrivacyLogEntry, stripUrlQuery } from "@/lib/privacy/logging";

type TenantInfo = {
  id: string;
  slug: string;
  name: string;
  branch_name?: string | null;
  status?: string | null;
  plan_id?: string | null;
};

type TableRow = Record<string, unknown>;

export interface TenantPrivacyExportBundle {
  exported_at: string;
  organization: {
    id: string;
    slug: string;
    name: string;
    branch_name: string | null;
    status: string | null;
    plan_id: string | null;
  };
  counts: {
    leads: number;
    products: number;
    saved_results: number;
    lead_context: number;
    whatsapp_conversations: number;
    whatsapp_messages: number;
    tryon_events: number;
  };
  data: {
    leads: TableRow[];
    products: TableRow[];
    saved_results: TableRow[];
    lead_context: TableRow[];
    whatsapp_conversations: TableRow[];
    whatsapp_messages: TableRow[];
    tryon_events: TableRow[];
  };
}

export interface TenantPrivacyDeleteSummary {
  removed_at: string;
  organization: {
    id: string;
    slug: string;
  };
  deleted: Record<string, number>;
}

export interface PrivacyAuditInput {
  orgId: string | null;
  orgSlug: string | null;
  actorUserId: string | null;
  action:
    | "data_export_requested"
    | "data_export_completed"
    | "tenant_delete_requested"
    | "tenant_delete_completed"
    | "tenant_delete_failed";
  summary: string;
  details?: Record<string, unknown>;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
}

function toRow(value: unknown): TableRow {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as TableRow) : {};
}

function stripImageUrls(row: TableRow) {
  const next = { ...row };
  for (const key of ["image_url", "result_image_url", "public_url", "url"]) {
    if (typeof next[key] === "string") {
      next[key] = stripUrlQuery(next[key]);
    }
  }
  return next;
}

export function buildTenantPrivacyExportBundle(input: {
  organization: TenantInfo;
  leads?: unknown[];
  products?: unknown[];
  savedResults?: unknown[];
  leadContext?: unknown[];
  whatsappConversations?: unknown[];
  whatsappMessages?: unknown[];
  tryonEvents?: unknown[];
}): TenantPrivacyExportBundle {
  const organization = input.organization;
  const leads = (input.leads || []).map(toRow);
  const products = (input.products || []).map((row) => stripImageUrls(toRow(row)));
  const savedResults = (input.savedResults || []).map((row) => {
    const next = stripImageUrls(toRow(row));
    if (next.payload && typeof next.payload === "object") {
      next.payload = sanitizePrivacyLogEntry(next.payload as Record<string, unknown>);
    }
    return next;
  });

  return {
    exported_at: new Date().toISOString(),
    organization: {
      id: organization.id,
      slug: organization.slug,
      name: organization.name,
      branch_name: organization.branch_name || null,
      status: organization.status || null,
      plan_id: organization.plan_id || null,
    },
    counts: {
      leads: leads.length,
      products: products.length,
      saved_results: savedResults.length,
      lead_context: (input.leadContext || []).length,
      whatsapp_conversations: (input.whatsappConversations || []).length,
      whatsapp_messages: (input.whatsappMessages || []).length,
      tryon_events: (input.tryonEvents || []).length,
    },
    data: {
      leads,
      products,
      saved_results: savedResults,
      lead_context: (input.leadContext || []).map(toRow),
      whatsapp_conversations: (input.whatsappConversations || []).map(toRow),
      whatsapp_messages: (input.whatsappMessages || []).map(toRow),
      tryon_events: (input.tryonEvents || []).map(toRow),
    },
  };
}

export function buildTenantPrivacyDeleteSummary(input: {
  organization: TenantInfo;
  deleted: Record<string, number>;
}) : TenantPrivacyDeleteSummary {
  return {
    removed_at: new Date().toISOString(),
    organization: {
      id: input.organization.id,
      slug: input.organization.slug,
    },
    deleted: input.deleted,
  };
}

export async function recordPrivacyAuditEvent(
  supabase: SupabaseClient,
  input: PrivacyAuditInput
) {
  const summary = normalizeText(input.summary) || input.action;
  const { error } = await supabase.from("privacy_audit_events").insert({
    org_id: input.orgId || null,
    org_slug: input.orgSlug || null,
    actor_user_id: input.actorUserId || null,
    action: input.action,
    status: input.action.endsWith("failed") ? "error" : "ok",
    summary,
    details: input.details || {},
  });

  if (error) {
    console.warn("[PRIVACY_AUDIT] failed to record event", sanitizePrivacyLogEntry({
      orgId: input.orgId,
      orgSlug: input.orgSlug,
      action: input.action,
      summary,
      error: error.message,
    }));
    return false;
  }

  return true;
}

async function deleteStoragePrefix(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string
) {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    return 0;
  }

  const paths = (data || [])
    .map((item) => item?.name)
    .filter((name): name is string => typeof name === "string" && !!name)
    .map((name) => `${prefix}/${name}`);

  if (paths.length === 0) {
    return 0;
  }

  const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
  if (removeError) {
    return 0;
  }

  return paths.length;
}

async function deleteTableRows(
  supabase: SupabaseClient,
  table: string,
  filter: { column: string; value: string }
) {
  const { data, error } = await supabase.from(table).delete().eq(filter.column, filter.value).select("id");

  if (error) {
    const message = error.message || "";
    if (message.includes("does not exist") || message.includes("relation") || message.includes("table")) {
      return 0;
    }
    throw error;
  }

  return Array.isArray(data) ? data.length : 0;
}

export async function purgeTenantData(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    orgSlug: string;
  }
) {
  const deleted: Record<string, number> = {};
  deleted.saved_results = await deleteTableRows(supabase, "saved_results", { column: "org_id", value: input.orgId });
  deleted.products = await deleteTableRows(supabase, "products", { column: "org_id", value: input.orgId });
  deleted.tryon_events = await deleteTableRows(supabase, "tryon_events", { column: "org_id", value: input.orgId });
  deleted.leads = await deleteTableRows(supabase, "leads", { column: "org_id", value: input.orgId });
  deleted.lead_context = await deleteTableRows(supabase, "lead_context", { column: "org_id", value: input.orgId });
  deleted.whatsapp_messages = await deleteTableRows(supabase, "whatsapp_messages", { column: "org_slug", value: input.orgSlug });
  deleted.whatsapp_conversations = await deleteTableRows(supabase, "whatsapp_conversations", { column: "org_slug", value: input.orgSlug });
  deleted.storage_product_files = await deleteStoragePrefix(supabase, "products", input.orgId);
  deleted.storage_tryon_inputs = await deleteStoragePrefix(supabase, "products", `tryon-inputs/${input.orgId}`);

  const { error: orgError } = await supabase.from("orgs").delete().eq("id", input.orgId);
  if (orgError) {
    throw orgError;
  }

  return deleted;
}
