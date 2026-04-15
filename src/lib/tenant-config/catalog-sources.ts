import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CatalogSource,
  CatalogSourceInput,
  CatalogSourceType,
  CatalogSourceConfig,
} from "./types";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validateCatalogSourceConfig(type: CatalogSourceType, config: unknown): boolean {
  if (!config || typeof config !== "object") return false;

  const cfg = config as Record<string, unknown>;

  switch (type) {
    case "whatsapp":
      return !!(cfg.phone_number_id && cfg.business_account_id && cfg.catalog_id);

    case "external_api":
      return !!(cfg.endpoint_url && cfg.auth_type);

    case "url":
      return !!(cfg.feed_url && cfg.format);

    case "internal":
      return !!cfg.table_name;

    default:
      return false;
  }
}

export async function getCatalogSources(orgId: string): Promise<CatalogSource[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("tenant_catalog_sources")
    .select("*")
    .eq("org_id", orgId)
    .order("priority", { ascending: true });

  if (error) {
    console.warn("[TENANT_CONFIG] Failed to get catalog sources", { orgId, error: error.message });
    return [];
  }

  return (data || []) as CatalogSource[];
}

export async function getActiveCatalogSources(orgId: string): Promise<CatalogSource[]> {
  const sources = await getCatalogSources(orgId);
  return sources.filter((s) => s.status === "active");
}

export async function getDefaultCatalogSource(orgId: string): Promise<CatalogSource | null> {
  const sources = await getCatalogSources(orgId);
  const defaultSource = sources.find((s) => s.is_default);
  if (defaultSource) return defaultSource;
  return sources[0] || null;
}

export async function resolveCatalogSource(
  orgId: string,
  preferredType?: CatalogSourceType
): Promise<CatalogSource | null> {
  const sources = await getActiveCatalogSources(orgId);

  if (preferredType) {
    const byType = sources.filter((s) => s.type === preferredType);
    if (byType.length > 0) return byType[0];
  }

  const withFallback = sources.find((s) => s.is_default);
  if (withFallback) return withFallback;

  return sources[0] || null;
}

export async function addCatalogSource(
  orgId: string,
  input: CatalogSourceInput,
  actorUserId?: string
): Promise<CatalogSource | null> {
  const admin = createAdminClient();

  const normalizedOrgId = normalizeString(orgId);
  if (!normalizedOrgId) {
    throw new Error("org_id is required");
  }

  if (!validateCatalogSourceConfig(input.type, input.config)) {
    throw new Error(`Invalid config for source type: ${input.type}`);
  }

  const existingSources = await getCatalogSources(normalizedOrgId);

  let isDefault = input.is_default ?? false;
  if (isDefault) {
    await admin
      .from("tenant_catalog_sources")
      .update({ is_default: false })
      .eq("org_id", normalizedOrgId);
  }

  if (!isDefault && existingSources.length === 0) {
    isDefault = true;
  }

  const { data, error } = await admin
    .from("tenant_catalog_sources")
    .insert({
      org_id: normalizedOrgId,
      type: input.type,
      name: normalizeString(input.name),
      config: input.config as unknown as Record<string, unknown>,
      priority: input.priority ?? existingSources.length,
      is_default: isDefault,
      status: input.status || "active",
      created_by_user_id: actorUserId || null,
    })
    .select()
    .single();

  if (error) {
    console.warn("[TENANT_CONFIG] Failed to add catalog source", { orgId, error: error.message });
    throw new Error(`Failed to add catalog source: ${error.message}`);
  }

  return data as CatalogSource;
}

export async function updateCatalogSource(
  orgId: string,
  sourceId: string,
  updates: Partial<CatalogSourceInput>,
  actorUserId?: string
): Promise<CatalogSource | null> {
  const admin = createAdminClient();

  const normalizedOrgId = normalizeString(orgId);
  const normalizedSourceId = normalizeString(sourceId);

  if (!normalizedOrgId || !normalizedSourceId) {
    throw new Error("org_id and source_id are required");
  }

  if (updates.config && !validateCatalogSourceConfig(updates.type!, updates.config)) {
    throw new Error(`Invalid config for source type: ${updates.type}`);
  }

  if (updates.is_default) {
    await admin
      .from("tenant_catalog_sources")
      .update({ is_default: false })
      .eq("org_id", normalizedOrgId);
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name) updateData.name = normalizeString(updates.name);
  if (updates.config) updateData.config = updates.config;
  if (updates.priority !== undefined) updateData.priority = updates.priority;
  if (updates.is_default !== undefined) updateData.is_default = updates.is_default;
  if (updates.type) updateData.type = updates.type;
  if (updates.status) updateData.status = updates.status;

  const { data, error } = await admin
    .from("tenant_catalog_sources")
    .update(updateData)
    .eq("id", normalizedSourceId)
    .eq("org_id", normalizedOrgId)
    .select()
    .single();

  if (error) {
    console.warn("[TENANT_CONFIG] Failed to update catalog source", { orgId, sourceId, error: error.message });
    throw new Error(`Failed to update catalog source: ${error.message}`);
  }

  return data as CatalogSource;
}

export async function deleteCatalogSource(
  orgId: string,
  sourceId: string
): Promise<boolean> {
  const admin = createAdminClient();

  const normalizedOrgId = normalizeString(orgId);
  const normalizedSourceId = normalizeString(sourceId);

  if (!normalizedOrgId || !normalizedSourceId) {
    throw new Error("org_id and source_id are required");
  }

  const { error } = await admin
    .from("tenant_catalog_sources")
    .delete()
    .eq("id", normalizedSourceId)
    .eq("org_id", normalizedOrgId);

  if (error) {
    console.warn("[TENANT_CONFIG] Failed to delete catalog source", { orgId, sourceId, error: error.message });
    return false;
  }

  const remaining = await getCatalogSources(normalizedOrgId);
  if (remaining.length > 0 && !remaining.some((s) => s.is_default)) {
    await admin
      .from("tenant_catalog_sources")
      .update({ is_default: true })
      .eq("id", remaining[0].id);
  }

  return true;
}

export async function syncCatalogSource(
  orgId: string,
  sourceId: string
): Promise<{ success: boolean; records_synced?: number; error?: string }> {
  const admin = createAdminClient();

  const sources = await getCatalogSources(orgId);
  const source = sources.find((s) => s.id === sourceId);

  if (!source) {
    return { success: false, error: "Source not found" };
  }

  if (source.status === "syncing") {
    return { success: false, error: "Source is already syncing" };
  }

  await admin
    .from("tenant_catalog_sources")
    .update({ status: "syncing" })
    .eq("id", sourceId);

  try {
    let recordsSynced = 0;

    switch (source.type) {
      case "whatsapp":
        break;
      case "external_api":
        break;
      case "url":
        break;
      case "internal":
        break;
    }

    await admin
      .from("tenant_catalog_sources")
      .update({
        status: "active",
        last_sync_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", sourceId);

    return { success: true, records_synced: recordsSynced };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await admin
      .from("tenant_catalog_sources")
      .update({
        status: "error",
        last_error: errorMessage,
      })
      .eq("id", sourceId);

    return { success: false, error: errorMessage };
  }
}

export async function reorderCatalogSources(
  orgId: string,
  sourceIds: string[]
): Promise<boolean> {
  const admin = createAdminClient();

  for (let i = 0; i < sourceIds.length; i++) {
    const { error } = await admin
      .from("tenant_catalog_sources")
      .update({ priority: i })
      .eq("org_id", orgId)
      .eq("id", sourceIds[i]);

    if (error) {
      console.warn("[TENANT_CONFIG] Failed to reorder catalog source", {
        orgId,
        sourceId: sourceIds[i],
        error: error.message,
      });
      return false;
    }
  }

  return true;
}
