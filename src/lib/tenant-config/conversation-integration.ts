import "server-only";

import { getTenantConfig, isCapabilityEnabled, searchKnowledgeBase, type TenantConfig } from "./index";
import { getB2BProducts } from "@/lib/catalog";
import type { KnowledgeBaseSearchResult } from "./types";

export interface ConversationConfigContext {
  orgId: string;
  shouldOfferTryOn: boolean;
  shouldShowCatalog: boolean;
  shouldUseNegotiation: boolean;
  shouldOfferDiscounts: boolean;
  shouldUseGuidedMode: boolean;
  personality: string;
  languageStyle: string;
  customInstructions: string;
  knowledgeBaseContext: string;
  knowledgeBaseEnabled: boolean;
  catalogSource: string | null;
  maxInteractionTurns: number;
  fallbackToHumanThreshold: number;
}

export async function getConversationConfigContext(orgId: string): Promise<ConversationConfigContext> {
  let config: TenantConfig | null = null;

  try {
    config = await getTenantConfig(orgId);
  } catch (error) {
    console.warn("[TENANT_CONFIG] Failed to load config, using defaults", { orgId });
  }

  if (!config) {
    return getDefaultContext(orgId);
  }

  const [kbEnabled, tryOnEnabled, catalogEnabled, negotiationEnabled, discountsEnabled, guidedEnabled] = await Promise.all([
    Promise.resolve(config.knowledge_base_config.enabled),
    isCapabilityEnabled(orgId, "try_on"),
    isCapabilityEnabled(orgId, "catalog_navigation"),
    isCapabilityEnabled(orgId, "negotiation"),
    isCapabilityEnabled(orgId, "discounts"),
    isCapabilityEnabled(orgId, "guided_mode"),
  ]);

  let knowledgeBaseContext = "";
  if (kbEnabled) {
    try {
      const kbResults = await searchKnowledgeBase(orgId, "", { max_results: 3 });
      knowledgeBaseContext = kbResults.map((r) => r.entry.content).join("\n\n");
    } catch (error) {
      console.warn("[TENANT_CONFIG] Failed to load KB context", { orgId });
    }
  }

  const defaultSource = config.catalog_sources.find((s) => s.is_default || s.status === "active");

  return {
    orgId,
    shouldOfferTryOn: tryOnEnabled,
    shouldShowCatalog: catalogEnabled,
    shouldUseNegotiation: negotiationEnabled,
    shouldOfferDiscounts: discountsEnabled,
    shouldUseGuidedMode: guidedEnabled,
    personality: config.ai_config.personality || "consultive",
    languageStyle: config.ai_config.language_style || "pt-BR",
    customInstructions: config.ai_config.custom_instructions || "",
    knowledgeBaseContext,
    knowledgeBaseEnabled: kbEnabled,
    catalogSource: defaultSource?.name || null,
    maxInteractionTurns: config.ai_config.max_interaction_turns,
    fallbackToHumanThreshold: config.ai_config.fallback_to_human_threshold,
  };
}

function getDefaultContext(orgId: string): ConversationConfigContext {
  return {
    orgId,
    shouldOfferTryOn: true,
    shouldShowCatalog: true,
    shouldUseNegotiation: true,
    shouldOfferDiscounts: false,
    shouldUseGuidedMode: false,
    personality: "consultive",
    languageStyle: "pt-BR",
    customInstructions: "",
    knowledgeBaseContext: "",
    knowledgeBaseEnabled: false,
    catalogSource: null,
    maxInteractionTurns: 20,
    fallbackToHumanThreshold: 3,
  };
}

export async function getCatalogForConversation(
  orgId: string,
  sourcePreference?: string
): Promise<{ products: unknown[]; source: string; error?: string }> {
  const context = await getConversationConfigContext(orgId);

  if (!context.shouldShowCatalog) {
    return { products: [], source: "disabled", error: "Catalog navigation is disabled" };
  }

  try {
    const products = await getB2BProducts(orgId);
    return {
      products,
      source: context.catalogSource || "internal",
    };
  } catch (error) {
    return {
      products: [],
      source: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function adaptResponseWithConfig(
  response: string,
  context: ConversationConfigContext
): string {
  let adapted = response;

  if (context.customInstructions) {
    adapted = `${context.customInstructions}\n\n${adapted}`;
  }

  if (!context.shouldOfferTryOn) {
    adapted = adapted.replace(/try[- ]?on/gi, "visualização");
  }

  if (!context.shouldOfferDiscounts) {
    adapted = adapted.replace(/desconto|promoção|off/i, "");
  }

  return adapted;
}

export function buildSystemPromptFromConfig(context: ConversationConfigContext): string {
  const parts: string[] = [];

  parts.push(`Idioma: ${context.languageStyle}`);

  if (context.personality === "friendly") {
    parts.push("Tom: amigável e acessível");
  } else if (context.personality === "consultive") {
    parts.push("Tom: consultivo e profissional");
  } else if (context.personality === "direct") {
    parts.push("Tom: direto e objetivo");
  } else if (context.personality === "professional") {
    parts.push("Tom: formal e técnico");
  }

  if (!context.shouldOfferTryOn) {
    parts.push("Funcionalidade de try-on está desabilitada para este tenant");
  }

  if (!context.shouldOfferDiscounts) {
    parts.push("Não ofereça descontos automaticamente");
  }

  if (context.shouldUseGuidedMode) {
    parts.push("Modo guiado obrigatório: conduza a conversa passo a passo");
  }

  if (context.knowledgeBaseEnabled && context.knowledgeBaseContext) {
    parts.push(`\nConhecimento da marca:\n${context.knowledgeBaseContext}`);
  }

  return parts.join("\n");
}

export function shouldTriggerHumanFallback(
  consecutiveFailures: number,
  context: ConversationConfigContext
): boolean {
  return consecutiveFailures >= context.fallbackToHumanThreshold;
}

export async function getProductSourceInfo(orgId: string): Promise<{
  primary: string;
  fallback: string[];
  active: boolean;
}> {
  const config = await getTenantConfig(orgId);

  if (!config || config.catalog_sources.length === 0) {
    return {
      primary: "internal",
      fallback: [],
      active: false,
    };
  }

  const active = config.catalog_sources.filter((s) => s.status === "active");
  const defaultSource = active.find((s) => s.is_default) || active[0];

  return {
    primary: defaultSource?.type || "internal",
    fallback: active.slice(1).map((s) => s.type),
    active: active.length > 0,
  };
}
