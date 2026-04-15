import type { AICapability, CatalogSource, TenantConfig } from "./types";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function enabledCapabilityMap(capabilities: Array<{ capability: AICapability; enabled: boolean }>) {
  return new Map(capabilities.map((item) => [item.capability, item.enabled] as const));
}

function formatSource(source: CatalogSource) {
  const status = source.status === "active" ? "ativa" : source.status === "inactive" ? "inativa" : source.status;
  return `${source.name} (${source.type}, prioridade ${source.priority}, ${status})`;
}

export function buildTenantBehaviorPrompt(config: TenantConfig | null) {
  if (!config) {
    return "";
  }

  const ai = config.ai_config;
  const enabledCaps = enabledCapabilityMap(ai.capabilities || []);
  const activeSources = [...(config.catalog_sources || [])]
    .filter((source) => source.status === "active")
    .sort((left, right) => left.priority - right.priority);
  const customInstructions = normalizeText(ai.custom_instructions);

  return [
    "CONFIGURAÇÃO DO TENANT:",
    `- Personalidade: ${ai.personality || "consultive"}`,
    `- Permitir try-on: ${enabledCaps.get("try_on") === false ? "não" : "sim"}`,
    `- Permitir catálogo livre: ${enabledCaps.get("catalog_navigation") === false ? "não" : "sim"}`,
    `- Permitir descontos: ${enabledCaps.get("discounts") === false ? "não" : "sim"}`,
    `- Limite de interação: ${ai.max_interaction_turns} turnos`,
    `- Tempo de resposta: ${ai.response_time_limit_ms}ms`,
    `- Fallback humano: acima de ${ai.fallback_to_human_threshold} sinais`,
    activeSources.length ? `- Fontes ativas: ${activeSources.slice(0, 5).map(formatSource).join(" | ")}` : "- Fontes ativas: nenhuma configurada",
    customInstructions ? `BASE DA MARCA / RAG:\n${customInstructions}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildTenantBehaviorPreview(config: TenantConfig | null) {
  if (!config) {
    return {
      headline: "Configuração neutra",
      summary: "A IA segue os padrões padrão do sistema até que a loja personalize sua personalidade e seus limites.",
      signals: [] as string[],
    };
  }

  const ai = config.ai_config;
  const enabledCaps = enabledCapabilityMap(ai.capabilities || []);
  const activeSource = [...config.catalog_sources]
    .filter((source) => source.status === "active")
    .sort((left, right) => left.priority - right.priority)[0];

  const signals = [
    ai.personality ? `Tom ${ai.personality}` : null,
    enabledCaps.get("try_on") === false ? "try-on bloqueado" : "try-on liberado",
    enabledCaps.get("catalog_navigation") === false ? "catálogo fechado" : "catálogo livre",
    enabledCaps.get("discounts") === false ? "desconto bloqueado" : "desconto liberado",
    activeSource ? `fonte principal: ${activeSource.name}` : "sem fonte ativa",
  ].filter(Boolean) as string[];

  return {
    headline: ai.personality === "direct" ? "IA objetiva" : ai.personality === "friendly" ? "IA calorosa" : "IA consultiva",
    summary: ai.custom_instructions
      ? ai.custom_instructions.slice(0, 160)
      : "A IA usa a personalidade e os limites configurados no dashboard da loja.",
    signals,
  };
}
