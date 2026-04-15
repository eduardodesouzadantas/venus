import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  TenantConfig,
  TenantConfigUpdateInput,
  CatalogSource,
  TenantAIConfig,
  KnowledgeBaseConfig,
} from "./types";
import * as CatalogSources from "./catalog-sources";
import * as AICapabilities from "./ai-capabilities";
import * as KnowledgeBase from "./knowledge-base";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function getTenantConfig(orgId: string): Promise<TenantConfig | null> {
  const normalizedOrgId = normalizeString(orgId);
  if (!normalizedOrgId) return null;

  const [catalogSources, aiConfig, kbConfig] = await Promise.all([
    CatalogSources.getCatalogSources(normalizedOrgId),
    AICapabilities.getTenantAIConfig(normalizedOrgId),
    KnowledgeBase.getKnowledgeBaseConfig(normalizedOrgId),
  ]);

  const fallback = getSafeFallbackConfig(normalizedOrgId);

  return {
    org_id: normalizedOrgId,
    catalog_sources: catalogSources,
    ai_config: aiConfig || fallback.ai_config,
    knowledge_base_config: kbConfig || fallback.knowledge_base_config,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function updateTenantConfig(
  orgId: string,
  input: TenantConfigUpdateInput,
  actorUserId?: string
): Promise<TenantConfig | null> {
  const normalizedOrgId = normalizeString(orgId);
  if (!normalizedOrgId) return null;

  if (input.catalog_sources) {
    for (const source of input.catalog_sources) {
      if (source.id) {
        await CatalogSources.updateCatalogSource(normalizedOrgId, source.id, source, actorUserId);
      } else if (source.type && source.name && source.config) {
        await CatalogSources.addCatalogSource(
          normalizedOrgId,
          {
            type: source.type,
            name: source.name,
            config: source.config,
            priority: source.priority,
            is_default: source.is_default,
          },
          actorUserId
        );
      }
    }
  }

  if (input.ai_config) {
    await AICapabilities.updateTenantAIConfig(normalizedOrgId, input.ai_config);
  }

  if (input.knowledge_base_config) {
    await KnowledgeBase.updateKnowledgeBaseConfig(normalizedOrgId, input.knowledge_base_config);
  }

  return getTenantConfig(normalizedOrgId);
}

export async function getTenantConfigSummary(orgId: string): Promise<{
  catalog_sources_count: number;
  active_catalog_source: string | null;
  ai_capabilities_enabled: number;
  ai_capabilities_disabled: number;
  knowledge_base_enabled: boolean;
  knowledge_base_entries: number;
  personality: string;
}> {
  const normalizedOrgId = normalizeString(orgId);
  if (!normalizedOrgId) {
    return {
      catalog_sources_count: 0,
      active_catalog_source: null,
      ai_capabilities_enabled: 0,
      ai_capabilities_disabled: 0,
      knowledge_base_enabled: false,
      knowledge_base_entries: 0,
      personality: "consultive",
    };
  }

  const [catalogSources, aiConfig, kbConfig, kbEntries] = await Promise.all([
    CatalogSources.getCatalogSources(normalizedOrgId),
    AICapabilities.getTenantAIConfig(normalizedOrgId),
    KnowledgeBase.getKnowledgeBaseConfig(normalizedOrgId),
    KnowledgeBase.getKnowledgeBaseEntries(normalizedOrgId, undefined, false),
  ]);

  const activeSource = catalogSources.find((s) => s.is_default || s.status === "active");
  const enabledCaps = (aiConfig?.capabilities || []).filter((c) => c.enabled).length;
  const disabledCaps = (aiConfig?.capabilities || []).filter((c) => !c.enabled).length;

  return {
    catalog_sources_count: catalogSources.length,
    active_catalog_source: activeSource?.name || null,
    ai_capabilities_enabled: enabledCaps,
    ai_capabilities_disabled: disabledCaps,
    knowledge_base_enabled: kbConfig?.enabled || false,
    knowledge_base_entries: kbEntries.length,
    personality: aiConfig?.personality || "consultive",
  };
}

export async function resetTenantConfig(orgId: string): Promise<boolean> {
  const normalizedOrgId = normalizeString(orgId);
  if (!normalizedOrgId) return false;

  const admin = createAdminClient();

  await Promise.all([
    admin.from("tenant_catalog_sources").delete().eq("org_id", normalizedOrgId),
    admin.from("tenant_ai_config").delete().eq("org_id", normalizedOrgId),
    admin.from("tenant_knowledge_base_config").delete().eq("org_id", normalizedOrgId),
    admin.from("tenant_knowledge_base").delete().eq("org_id", normalizedOrgId),
  ]);

  return true;
}

export function getSafeFallbackConfig(orgId: string): TenantConfig {
  return {
    org_id: orgId,
    catalog_sources: [],
    ai_config: {
      org_id: orgId,
      capabilities: [
        { capability: "try_on", enabled: true },
        { capability: "catalog_navigation", enabled: true },
        { capability: "look_recommendation", enabled: true },
        { capability: "style_analysis", enabled: true },
        { capability: "closing_assistance", enabled: true },
        { capability: "negotiation", enabled: true },
        { capability: "discounts", enabled: false },
        { capability: "guided_mode", enabled: false },
      ],
      guided_mode_required: false,
      max_interaction_turns: 20,
      response_time_limit_ms: 5000,
      fallback_to_human_threshold: 3,
      personality: "consultive",
      language_style: "pt-BR",
    },
    knowledge_base_config: {
      org_id: orgId,
      enabled: false,
      similarity_threshold: 0.7,
      max_results: 5,
      auto_sync: false,
      last_indexed_at: null,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function validateTenantConfig(orgId: string): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const normalizedOrgId = normalizeString(orgId);
  if (!normalizedOrgId) {
    return { valid: false, errors: ["org_id is required"], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  const config = await getTenantConfig(normalizedOrgId);

  if (!config) {
    warnings.push("No configuration found, using defaults");
    return { valid: true, errors: [], warnings };
  }

  if (config.catalog_sources.length === 0) {
    warnings.push("No catalog sources configured");
  }

  const hasDefaultSource = config.catalog_sources.some((s) => s.is_default);
  if (!hasDefaultSource && config.catalog_sources.length > 0) {
    warnings.push("No default catalog source set");
  }

  const activeSources = config.catalog_sources.filter((s) => s.status === "active");
  if (activeSources.length === 0 && config.catalog_sources.length > 0) {
    warnings.push("No active catalog sources");
  }

  const enabledCapabilities = config.ai_config.capabilities.filter((c) => c.enabled);
  if (enabledCapabilities.length === 0) {
    warnings.push("All AI capabilities are disabled");
  }

  if (config.ai_config.guided_mode_required && !enabledCapabilities.find((c) => c.capability === "guided_mode")) {
    errors.push("Guided mode required but not enabled");
  }

  if (config.knowledge_base_config.enabled) {
    const kbEntries = await KnowledgeBase.getKnowledgeBaseEntries(normalizedOrgId, undefined, false);
    if (kbEntries.length === 0) {
      warnings.push("Knowledge base enabled but has no entries");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export { CatalogSources, AICapabilities, KnowledgeBase };
export * from "./conversation-integration";
export { isCapabilityEnabled, getCapabilityLimits, checkAndUpdateCapabilityUsage, getCapabilityUsageStats, getPersonalityPromptHints } from "./ai-capabilities";
export { searchKnowledgeBase, buildKnowledgeBaseContext, adaptResponseWithKnowledge, getKnowledgeBaseConfig, getOrCreateKnowledgeBaseConfig } from "./knowledge-base";
export type {
  CatalogSource,
  CatalogSourceInput,
  CatalogSourceType,
  TenantConfig,
  TenantAIConfig,
  AICapability,
  AICapabilityConfig,
  KnowledgeBaseConfig,
  KnowledgeBaseEntry,
  KnowledgeBaseSearchResult,
} from "./types";
