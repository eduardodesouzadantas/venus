import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  TenantAIConfig,
  AICapability,
  AICapabilityConfig,
  DEFAULT_AI_CAPABILITIES,
} from "./types";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const VALID_CAPABILITIES: AICapability[] = [
  "try_on",
  "catalog_navigation",
  "negotiation",
  "discounts",
  "guided_mode",
  "look_recommendation",
  "style_analysis",
  "closing_assistance",
];

const VALID_PERSONALITIES = ["friendly", "consultive", "direct", "professional"];

function isValidCapability(capability: string): capability is AICapability {
  return VALID_CAPABILITIES.includes(capability as AICapability);
}

function isValidPersonality(personality: string): boolean {
  return VALID_PERSONALITIES.includes(personality);
}

export async function getTenantAIConfig(orgId: string): Promise<TenantAIConfig | null> {
  const admin = createAdminClient();

  const normalizedOrgId = normalizeString(orgId);
  if (!normalizedOrgId) return null;

  const { data, error } = await admin
    .from("tenant_ai_config")
    .select("*")
    .eq("org_id", normalizedOrgId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    org_id: data.org_id,
    capabilities: (data.capabilities || []) as AICapabilityConfig[],
    guided_mode_required: data.guided_mode_required ?? false,
    max_interaction_turns: data.max_interaction_turns ?? 20,
    response_time_limit_ms: data.response_time_limit_ms ?? 5000,
    fallback_to_human_threshold: data.fallback_to_human_threshold ?? 3,
    custom_instructions: data.custom_instructions || undefined,
    personality: (data.personality as "friendly" | "consultive" | "direct" | "professional") || "consultive",
    language_style: data.language_style || "pt-BR",
  };
}

export async function getOrCreateTenantAIConfig(orgId: string): Promise<TenantAIConfig> {
  let config = await getTenantAIConfig(orgId);

  if (!config) {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("tenant_ai_config")
      .insert({
        org_id: orgId,
        capabilities: [],
        guided_mode_required: false,
        max_interaction_turns: 20,
        response_time_limit_ms: 5000,
        fallback_to_human_threshold: 3,
        personality: "consultive",
        language_style: "pt-BR",
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create AI config: ${error?.message || "unknown"}`);
    }

    config = {
      org_id: data.org_id,
      capabilities: [],
      guided_mode_required: data.guided_mode_required,
      max_interaction_turns: data.max_interaction_turns,
      response_time_limit_ms: data.response_time_limit_ms,
      fallback_to_human_threshold: data.fallback_to_human_threshold,
      custom_instructions: data.custom_instructions,
      personality: data.personality,
      language_style: data.language_style,
    };
  }

  if (!config.capabilities || config.capabilities.length === 0) {
    config.capabilities = getDefaultCapabilities();
  }

  return config;
}

function getDefaultCapabilities(): AICapabilityConfig[] {
  return [
    { capability: "try_on", enabled: true, limits: { monthly: 50 } },
    { capability: "catalog_navigation", enabled: true },
    { capability: "negotiation", enabled: true },
    { capability: "discounts", enabled: false },
    { capability: "guided_mode", enabled: false },
    { capability: "look_recommendation", enabled: true },
    { capability: "style_analysis", enabled: true },
    { capability: "closing_assistance", enabled: true },
  ];
}

export async function updateTenantAIConfig(
  orgId: string,
  updates: Partial<TenantAIConfig>
): Promise<TenantAIConfig | null> {
  const admin = createAdminClient();

  const normalizedOrgId = normalizeString(orgId);
  if (!normalizedOrgId) return null;

  await getOrCreateTenantAIConfig(normalizedOrgId);

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.capabilities !== undefined) {
    const validatedCapabilities = (updates.capabilities || []).filter(
      (c) => isValidCapability(c.capability) && typeof c.enabled === "boolean"
    );
    updateData.capabilities = validatedCapabilities;
  }

  if (updates.guided_mode_required !== undefined) {
    updateData.guided_mode_required = updates.guided_mode_required;
  }

  if (updates.max_interaction_turns !== undefined) {
    updateData.max_interaction_turns = Math.max(1, Math.min(100, updates.max_interaction_turns));
  }

  if (updates.response_time_limit_ms !== undefined) {
    updateData.response_time_limit_ms = Math.max(1000, Math.min(30000, updates.response_time_limit_ms));
  }

  if (updates.fallback_to_human_threshold !== undefined) {
    updateData.fallback_to_human_threshold = Math.max(1, Math.min(10, updates.fallback_to_human_threshold));
  }

  if (updates.custom_instructions !== undefined) {
    updateData.custom_instructions = updates.custom_instructions?.slice(0, 5000) || null;
  }

  if (updates.personality !== undefined) {
    updateData.personality = isValidPersonality(updates.personality) ? updates.personality : "consultive";
  }

  if (updates.language_style !== undefined) {
    updateData.language_style = updates.language_style?.slice(0, 10) || "pt-BR";
  }

  const { data, error } = await admin
    .from("tenant_ai_config")
    .update(updateData)
    .eq("org_id", normalizedOrgId)
    .select()
    .single();

  if (error || !data) {
    console.warn("[TENANT_CONFIG] Failed to update AI config", { orgId, error: error?.message });
    return null;
  }

  return {
    org_id: data.org_id,
    capabilities: (data.capabilities || []) as AICapabilityConfig[],
    guided_mode_required: data.guided_mode_required,
    max_interaction_turns: data.max_interaction_turns,
    response_time_limit_ms: data.response_time_limit_ms,
    fallback_to_human_threshold: data.fallback_to_human_threshold,
    custom_instructions: data.custom_instructions,
    personality: data.personality,
    language_style: data.language_style,
  };
}

export async function isCapabilityEnabled(
  orgId: string,
  capability: AICapability
): Promise<boolean> {
  const config = await getTenantAIConfig(orgId);

  if (!config) return true;

  const capabilityConfig = config.capabilities.find((c) => c.capability === capability);

  if (!capabilityConfig) return true;

  return capabilityConfig.enabled;
}

export async function getCapabilityLimits(
  orgId: string,
  capability: AICapability
): Promise<{ daily?: number; monthly?: number; per_session?: number } | null> {
  const config = await getTenantAIConfig(orgId);

  if (!config) return null;

  const capabilityConfig = config.capabilities.find((c) => c.capability === capability);

  return capabilityConfig?.limits || null;
}

export async function checkAndUpdateCapabilityUsage(
  orgId: string,
  capability: AICapability
): Promise<{ allowed: boolean; remaining?: number; error?: string }> {
  const limits = await getCapabilityLimits(orgId, capability);

  if (!limits) return { allowed: true };

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: usage } = await admin
    .from("tenant_capability_usage")
    .select("*")
    .eq("org_id", orgId)
    .eq("capability", capability)
    .eq("usage_date", today)
    .maybeSingle();

  const currentUsage = usage?.usage_count || 0;

  if (limits.daily !== undefined && currentUsage >= limits.daily) {
    return { allowed: false, remaining: 0, error: `Daily limit exceeded for ${capability}` };
  }

  await admin
    .from("tenant_capability_usage")
    .upsert({
      org_id: orgId,
      capability,
      usage_date: today,
      usage_count: currentUsage + 1,
    }, { onConflict: "org_id,capability,usage_date" });

  const remaining = limits.daily !== undefined ? limits.daily - currentUsage - 1 : undefined;

  return { allowed: true, remaining };
}

export async function getCapabilityUsageStats(
  orgId: string,
  capability: AICapability,
  days: number = 30
): Promise<{ daily: Record<string, number>; total: number; average: number }> {
  const admin = createAdminClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data } = await admin
    .from("tenant_capability_usage")
    .select("usage_date, usage_count")
    .eq("org_id", orgId)
    .eq("capability", capability)
    .gte("usage_date", startDate.toISOString().slice(0, 10));

  const daily: Record<string, number> = {};
  let total = 0;

  for (const row of data || []) {
    daily[row.usage_date] = row.usage_count;
    total += row.usage_count;
  }

  return {
    daily,
    total,
    average: days > 0 ? total / days : 0,
  };
}

export function getPersonalityPromptHints(personality: string): string[] {
  switch (personality) {
    case "friendly":
      return [
        "Use linguagem descontraída e acessível",
        "Use emojis ocasionalmente",
        "Faça referências amigáveis",
      ];
    case "consultive":
      return [
        "Use linguagem de consultoria profissional",
        "Explique o porquê das recomendações",
        "Sea guia, não impositivo",
      ];
    case "direct":
      return [
        "Seja direto e objetivo",
        "Vá direto ao ponto",
        "Minimize informações desnecessárias",
      ];
    case "professional":
      return [
        "Use linguagem formal e técnica",
        "Mantenha precisão",
        "Evite coloquialismos",
      ];
    default:
      return [];
  }
}