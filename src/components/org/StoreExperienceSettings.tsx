"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronUp, Plus, Sparkles } from "lucide-react";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import {
  DEFAULT_AI_CAPABILITIES,
  type AICapability,
  type AICapabilityConfig,
  type CatalogSource,
  type CatalogSourceStatus,
  type CatalogSourceType,
  type TenantAIConfig,
  type TenantConfig,
} from "@/lib/tenant-config/types";
import { buildTenantBehaviorPreview } from "@/lib/tenant-config/prompt";

type SettingsResponse =
  | {
      ok: true;
      tenant_config: TenantConfig;
    }
  | {
      error?: string;
    };

type EditableCatalogSource = {
  clientId: string;
  id: string | null;
  type: CatalogSourceType;
  name: string;
  priority: number;
  is_default: boolean;
  status: CatalogSourceStatus;
  config: {
    phone_number_id: string;
    business_account_id: string;
    catalog_id: string;
    endpoint_url: string;
    auth_type: "none" | "api_key" | "oauth2" | "bearer";
    feed_url: string;
    format: "json" | "xml" | "csv";
    table_name: string;
  };
};

const AI_CAPABILITY_LABELS: Record<Extract<AICapability, "try_on" | "catalog_navigation" | "discounts">, string> = {
  try_on: "Permitir try-on",
  catalog_navigation: "Permitir catalogo livre",
  discounts: "Permitir descontos",
};

function generateClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `source_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function createDefaultCapabilities(): AICapabilityConfig[] {
  return DEFAULT_AI_CAPABILITIES.map((capability) => ({ ...capability }));
}

function createBlankSource(priority = 0): EditableCatalogSource {
  return {
    clientId: generateClientId(),
    id: null,
    type: "url",
    name: "Nova fonte",
    priority,
    is_default: priority === 0,
    status: "active",
    config: {
      phone_number_id: "",
      business_account_id: "",
      catalog_id: "",
      endpoint_url: "",
      auth_type: "none",
      feed_url: "",
      format: "json",
      table_name: "",
    },
  };
}

function mapSourceToDraft(source: CatalogSource, index: number): EditableCatalogSource {
  const config = (source.config || {}) as unknown as Record<string, unknown>;
  return {
    clientId: source.id,
    id: source.id,
    type: source.type,
    name: source.name,
    priority: source.priority ?? index,
    is_default: source.is_default,
    status: source.status,
    config: {
      phone_number_id: typeof config.phone_number_id === "string" ? config.phone_number_id : "",
      business_account_id: typeof config.business_account_id === "string" ? config.business_account_id : "",
      catalog_id: typeof config.catalog_id === "string" ? config.catalog_id : "",
      endpoint_url: typeof config.endpoint_url === "string" ? config.endpoint_url : "",
      auth_type:
        config.auth_type === "api_key" || config.auth_type === "oauth2" || config.auth_type === "bearer" ? config.auth_type : "none",
      feed_url: typeof config.feed_url === "string" ? config.feed_url : "",
      format: config.format === "xml" || config.format === "csv" ? config.format : "json",
      table_name: typeof config.table_name === "string" ? config.table_name : "",
    },
  };
}

function buildSourcePayload(source: EditableCatalogSource) {
  const base = {
    id: source.id || undefined,
    type: source.type,
    name: source.name.trim(),
    priority: source.priority,
    is_default: source.is_default,
    status: source.status,
  };

  switch (source.type) {
    case "whatsapp":
      return {
        ...base,
        config: {
          phone_number_id: source.config.phone_number_id.trim(),
          business_account_id: source.config.business_account_id.trim(),
          catalog_id: source.config.catalog_id.trim(),
        },
      };
    case "external_api":
      return {
        ...base,
        config: {
          endpoint_url: source.config.endpoint_url.trim(),
          auth_type: source.config.auth_type,
        },
      };
    case "internal":
      return {
        ...base,
        config: {
          table_name: source.config.table_name.trim(),
        },
      };
    case "url":
    default:
      return {
        ...base,
        config: {
          feed_url: source.config.feed_url.trim(),
          format: source.config.format,
        },
      };
  }
}

function mergeCapabilities(current: AICapabilityConfig[], capability: AICapability, enabled: boolean): AICapabilityConfig[] {
  const map = new Map(current.map((item) => [item.capability, item] as const));
  map.set(capability, {
    capability,
    enabled,
    limits: map.get(capability)?.limits,
    config: map.get(capability)?.config,
  });
  return createDefaultCapabilities().map((preset) => map.get(preset.capability) || preset);
}

function buildFallbackConfig(): TenantConfig {
  return {
    org_id: "",
    catalog_sources: [],
    ai_config: {
      org_id: "",
      capabilities: createDefaultCapabilities(),
      guided_mode_required: false,
      max_interaction_turns: 20,
      response_time_limit_ms: 5000,
      fallback_to_human_threshold: 3,
      custom_instructions: "",
      personality: "consultive",
      language_style: "pt-BR",
    },
    knowledge_base_config: {
      org_id: "",
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

function normalizeTenantConfig(config: TenantConfig | null): TenantConfig {
  if (!config) {
    return buildFallbackConfig();
  }

  return {
    ...config,
    ai_config: {
      ...config.ai_config,
      capabilities:
        config.ai_config.capabilities.length > 0 ? config.ai_config.capabilities : createDefaultCapabilities(),
    },
  };
}

export function StoreExperienceSettings({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [catalogSources, setCatalogSources] = useState<EditableCatalogSource[]>([]);
  const [aiConfig, setAiConfig] = useState<TenantAIConfig | null>(null);
  const [brandText, setBrandText] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/org/${slug}/settings`, { headers: { "Cache-Control": "no-store" } });
        const payload = (await response.json().catch(() => null)) as SettingsResponse | null;

        if (!response.ok || !payload || !("ok" in payload) || !payload.ok) {
          throw new Error(payload && "error" in payload && payload.error ? payload.error : "Nao foi possivel carregar a configuracao");
        }

        if (cancelled) return;

        const nextConfig = normalizeTenantConfig(payload.tenant_config);
        setTenantConfig(nextConfig);
        setCatalogSources(nextConfig.catalog_sources.map((source, index) => mapSourceToDraft(source, index)));
        setAiConfig(nextConfig.ai_config);
        setBrandText(nextConfig.ai_config.custom_instructions || "");
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Falha ao carregar configuracao");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const currentAi = aiConfig || buildFallbackConfig().ai_config;
  const preview = useMemo(
    () => {
      const previewConfig = normalizeTenantConfig(
        (tenantConfig
          ? {
              ...tenantConfig,
              catalog_sources: catalogSources.map((source, index) => ({
                id: source.id || source.clientId,
                org_id: tenantConfig.org_id,
                type: source.type,
                name: source.name,
                config: buildSourcePayload(source).config,
                priority: source.priority ?? index,
                is_default: source.is_default,
                status: source.status,
                last_sync_at: null,
                last_error: null,
                created_at: tenantConfig.created_at,
                updated_at: tenantConfig.updated_at,
              })) as unknown as TenantConfig["catalog_sources"],
              ai_config: {
                ...currentAi,
                custom_instructions: brandText,
              },
            }
          : {
              ...buildFallbackConfig(),
              catalog_sources: catalogSources.map((source, index) => ({
                id: source.id || source.clientId,
                org_id: "",
                type: source.type,
                name: source.name,
                config: buildSourcePayload(source).config,
                priority: source.priority ?? index,
                is_default: source.is_default,
                status: source.status,
                last_sync_at: null,
                last_error: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })) as unknown as TenantConfig["catalog_sources"],
              ai_config: {
                ...currentAi,
                custom_instructions: brandText,
              },
            }) as TenantConfig
      );

      return buildTenantBehaviorPreview(previewConfig);
    },
    [aiConfig, brandText, catalogSources, currentAi, tenantConfig]
  );

  const updateSource = (clientId: string, patch: Partial<EditableCatalogSource>) => {
    setCatalogSources((current) => current.map((source) => (source.clientId === clientId ? { ...source, ...patch } : source)));
  };

  const addSource = () => {
    setCatalogSources((current) => [...current, createBlankSource(current.length)]);
  };

  const toggleCapability = (capability: Extract<AICapability, "try_on" | "catalog_navigation" | "discounts">, enabled: boolean) => {
    setAiConfig((current) => {
      const base = current || buildFallbackConfig().ai_config;
      return {
        ...base,
        capabilities: mergeCapabilities(base.capabilities || createDefaultCapabilities(), capability, enabled),
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const formData = new FormData();
      formData.set("catalog_sources_json", JSON.stringify(catalogSources.map(buildSourcePayload)));
      formData.set(
        "ai_config_json",
        JSON.stringify({
          ...(aiConfig || buildFallbackConfig().ai_config),
          custom_instructions: brandText.trim(),
        })
      );

      const response = await fetch(`/api/org/${slug}/settings`, {
        method: "PATCH",
        headers: { "Cache-Control": "no-store" },
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as SettingsResponse | null;

      if (!response.ok || !payload || !("ok" in payload) || !payload.ok) {
        throw new Error(payload && "error" in payload && payload.error ? payload.error : "Nao foi possivel salvar a configuracao");
      }

      const nextConfig = normalizeTenantConfig(payload.tenant_config);
      setTenantConfig(nextConfig);
      setCatalogSources(nextConfig.catalog_sources.map((source, index) => mapSourceToDraft(source, index)));
      setAiConfig(nextConfig.ai_config);
      setBrandText(nextConfig.ai_config.custom_instructions || "");
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Falha ao salvar configuracao");
    } finally {
      setSaving(false);
    }
  };

  const tryOnEnabled = currentAi.capabilities.find((item) => item.capability === "try_on")?.enabled ?? true;
  const catalogEnabled = currentAi.capabilities.find((item) => item.capability === "catalog_navigation")?.enabled ?? true;
  const discountsEnabled = currentAi.capabilities.find((item) => item.capability === "discounts")?.enabled ?? true;
  const activeSourceCount = catalogSources.filter((source) => source.status === "active").length;

  return (
    <section className="space-y-6">
      <div className="rounded-[36px] border border-white/5 bg-white/[0.02] p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Text className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#C9A84C]">ConfiguraÃ§Ã£o de loja</Text>
            <Heading as="h2" className="text-2xl md:text-3xl tracking-tighter uppercase leading-none">
              Fontes de catÃ¡logo, limites da IA e personalidade da marca
            </Heading>
            <Text className="max-w-3xl text-sm text-white/50">
              Ajuste o comportamento da IA sem mudar o pipeline principal. As alteraÃ§Ãµes entram no contexto em tempo real.
            </Text>
          </div>

          <div className="flex flex-wrap gap-3">
            <VenusButton
              type="button"
              onClick={addSource}
              variant="outline"
              className="h-11 rounded-full border-white/10 px-4 text-[10px] uppercase tracking-[0.2em] font-bold"
            >
              <Plus size={14} />
              Adicionar fonte
            </VenusButton>
            <VenusButton
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              variant="solid"
              className="h-11 rounded-full bg-[#C9A84C] px-5 text-[10px] uppercase tracking-[0.2em] font-bold text-black"
            >
              {saving ? "Salvando..." : saved ? "Salvo" : "Salvar IA"}
            </VenusButton>
          </div>
        </div>

        {error ? <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-4 rounded-[36px] border border-white/5 bg-white/[0.02] p-5 md:p-7">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-[9px] uppercase tracking-[0.35em] text-[#C9A84C]">CatÃ¡logo</Text>
              <Heading as="h3" className="text-xl uppercase tracking-tight">Fontes e prioridade</Heading>
            </div>
            <span className="text-[9px] uppercase tracking-[0.3em] text-white/35">{activeSourceCount} ativas</span>
          </div>

          <div className="space-y-4">
            {catalogSources.length > 0 ? catalogSources.map((source, index) => (
              <article key={source.clientId} className="rounded-[28px] border border-white/5 bg-black/30 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.2em] text-white/45">
                      Fonte {index + 1}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-[8px] font-bold uppercase tracking-[0.2em] ${source.status === "active" ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border border-white/10 bg-white/5 text-white/45"}`}>
                      {source.status === "active" ? "Ativa" : "Inativa"}
                    </span>
                    {source.is_default ? <span className="rounded-full border border-[#C9A84C]/20 bg-[#C9A84C]/10 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.2em] text-[#E7D08B]">Padrao</span> : null}
                  </div>

                  <label className="inline-flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-white/35">
                    <input
                      type="checkbox"
                      checked={source.is_default}
                      onChange={(event) => updateSource(source.clientId, { is_default: event.target.checked })}
                      className="h-4 w-4 rounded border-white/20 bg-black/50"
                    />
                    definir como padrao
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-[9px] uppercase tracking-[0.28em] text-white/35">Nome da fonte</span>
                    <input
                      value={source.name}
                      onChange={(event) => updateSource(source.clientId, { name: event.target.value })}
                      className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                      placeholder="Ex: Catalogo WhatsApp principal"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[9px] uppercase tracking-[0.28em] text-white/35">Tipo</span>
                    <select
                      value={source.type}
                      onChange={(event) => updateSource(source.clientId, { type: event.target.value as CatalogSourceType })}
                      className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="external_api">API externa</option>
                      <option value="url">URL / feed</option>
                      <option value="internal">Interno</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-[9px] uppercase tracking-[0.28em] text-white/35">Prioridade</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={source.priority}
                      onChange={(event) => updateSource(source.clientId, { priority: Number(event.target.value || 0) })}
                      className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[9px] uppercase tracking-[0.28em] text-white/35">Status</span>
                    <select
                      value={source.status}
                      onChange={(event) => updateSource(source.clientId, { status: event.target.value as CatalogSourceStatus })}
                      className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                    >
                      <option value="active">Ativa</option>
                      <option value="inactive">Inativa</option>
                      <option value="error">Erro</option>
                      <option value="syncing">Sincronizando</option>
                    </select>
                  </label>

                  {source.type === "whatsapp" ? (
                    <>
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-[9px] uppercase tracking-[0.28em] text-white/35">Phone number id</span>
                        <input
                          value={source.config.phone_number_id}
                          onChange={(event) => updateSource(source.clientId, { config: { ...source.config, phone_number_id: event.target.value } })}
                          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-[9px] uppercase tracking-[0.28em] text-white/35">Business account id</span>
                        <input
                          value={source.config.business_account_id}
                          onChange={(event) => updateSource(source.clientId, { config: { ...source.config, business_account_id: event.target.value } })}
                          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-[9px] uppercase tracking-[0.28em] text-white/35">Catalog id</span>
                        <input
                          value={source.config.catalog_id}
                          onChange={(event) => updateSource(source.clientId, { config: { ...source.config, catalog_id: event.target.value } })}
                          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                        />
                      </label>
                    </>
                  ) : null}

                  {source.type === "external_api" ? (
                    <>
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-[9px] uppercase tracking-[0.28em] text-white/35">Endpoint</span>
                        <input
                          value={source.config.endpoint_url}
                          onChange={(event) => updateSource(source.clientId, { config: { ...source.config, endpoint_url: event.target.value } })}
                          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-[9px] uppercase tracking-[0.28em] text-white/35">Auth type</span>
                        <select
                          value={source.config.auth_type}
                          onChange={(event) => updateSource(source.clientId, { config: { ...source.config, auth_type: event.target.value as EditableCatalogSource["config"]["auth_type"] } })}
                          className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                        >
                          <option value="none">Nenhuma</option>
                          <option value="api_key">API key</option>
                          <option value="oauth2">OAuth2</option>
                          <option value="bearer">Bearer</option>
                        </select>
                      </label>
                    </>
                  ) : null}

                  {source.type === "url" ? (
                    <>
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-[9px] uppercase tracking-[0.28em] text-white/35">Feed URL</span>
                        <input
                          value={source.config.feed_url}
                          onChange={(event) => updateSource(source.clientId, { config: { ...source.config, feed_url: event.target.value } })}
                          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-[9px] uppercase tracking-[0.28em] text-white/35">Formato</span>
                        <select
                          value={source.config.format}
                          onChange={(event) => updateSource(source.clientId, { config: { ...source.config, format: event.target.value as EditableCatalogSource["config"]["format"] } })}
                          className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                        >
                          <option value="json">JSON</option>
                          <option value="xml">XML</option>
                          <option value="csv">CSV</option>
                        </select>
                      </label>
                    </>
                  ) : null}

                  {source.type === "internal" ? (
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-[9px] uppercase tracking-[0.28em] text-white/35">Tabela interna</span>
                      <input
                        value={source.config.table_name}
                        onChange={(event) => updateSource(source.clientId, { config: { ...source.config, table_name: event.target.value } })}
                        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                      />
                    </label>
                  ) : null}
                </div>
              </article>
            )) : (
              <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-white/45">
                Nenhuma fonte configurada. Adicione a primeira fonte para a IA enxergar o catÃ¡logo.
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[36px] border border-white/5 bg-white/[0.02] p-5 md:p-7">
            <div className="flex items-center justify-between">
              <div>
                <Text className="text-[9px] uppercase tracking-[0.35em] text-[#C9A84C]">IA</Text>
                <Heading as="h3" className="text-xl uppercase tracking-tight">Limites e permissÃµes</Heading>
              </div>
              <Sparkles size={16} className="text-[#C9A84C]" />
            </div>

            <div className="mt-5 space-y-4">
              {(["try_on", "catalog_navigation", "discounts"] as const).map((capability) => (
                <label key={capability} className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-black/30 px-4 py-4">
                  <div>
                    <div className="text-sm font-medium text-white">{AI_CAPABILITY_LABELS[capability]}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-white/35">Controle direto do comportamento</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={(currentAi.capabilities.find((item) => item.capability === capability)?.enabled ?? true)}
                    onChange={(event) => toggleCapability(capability, event.target.checked)}
                    className="h-5 w-5 rounded border-white/20 bg-black/50"
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-[9px] uppercase tracking-[0.28em] text-white/35">Max. turnos</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={currentAi.max_interaction_turns}
                  onChange={(event) =>
                    setAiConfig((current) => ({
                      ...(current || buildFallbackConfig().ai_config),
                      max_interaction_turns: Number(event.target.value || 20),
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                />
              </label>

              <label className="space-y-2">
                <span className="text-[9px] uppercase tracking-[0.28em] text-white/35">Tempo de resposta</span>
                <input
                  type="number"
                  min={1000}
                  max={30000}
                  step={500}
                  value={currentAi.response_time_limit_ms}
                  onChange={(event) =>
                    setAiConfig((current) => ({
                      ...(current || buildFallbackConfig().ai_config),
                      response_time_limit_ms: Number(event.target.value || 5000),
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-[9px] uppercase tracking-[0.28em] text-white/35">Limite de fallback humano</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={currentAi.fallback_to_human_threshold}
                  onChange={(event) =>
                    setAiConfig((current) => ({
                      ...(current || buildFallbackConfig().ai_config),
                      fallback_to_human_threshold: Number(event.target.value || 3),
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-[9px] uppercase tracking-[0.28em] text-white/35">Personalidade</span>
                <select
                  value={currentAi.personality}
                  onChange={(event) =>
                    setAiConfig((current) => ({
                      ...(current || buildFallbackConfig().ai_config),
                      personality: event.target.value as TenantAIConfig["personality"],
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                >
                  <option value="friendly">Friendly</option>
                  <option value="consultive">Consultiva</option>
                  <option value="direct">Direta</option>
                  <option value="professional">Profissional</option>
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-[36px] border border-white/5 bg-white/[0.02] p-5 md:p-7">
            <div className="flex items-center justify-between">
              <div>
                <Text className="text-[9px] uppercase tracking-[0.35em] text-[#C9A84C]">Marca</Text>
                <Heading as="h3" className="text-xl uppercase tracking-tight">Base de conhecimento</Heading>
              </div>
              <ChevronUp size={16} className="text-white/25" />
            </div>

            <textarea
              value={brandText}
              onChange={(event) => {
                const nextValue = event.target.value;
                setBrandText(nextValue);
                setAiConfig((current) => ({
                  ...(current || buildFallbackConfig().ai_config),
                  custom_instructions: nextValue,
                }));
              }}
              rows={10}
              placeholder="Descreva a personalidade da marca, objeÃ§Ãµes recorrentes, tom ideal, regras de conversa e contexto comercial..."
              className="mt-4 w-full rounded-[28px] border border-white/10 bg-black/40 p-4 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-white/20 focus:border-[#C9A84C]/40"
            />

            <div className="mt-4 rounded-[24px] border border-white/5 bg-black/25 p-4">
              <div className="text-[9px] font-bold uppercase tracking-[0.35em] text-white/35">Preview em tempo real</div>
              <div className="mt-3 space-y-2">
                <div className="text-sm font-medium text-white">{preview.headline}</div>
                <p className="text-sm leading-relaxed text-white/55">{preview.summary}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {preview.signals.map((signal) => (
                    <span key={signal} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.2em] text-white/45">
                      {signal}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
