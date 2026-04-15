export type CatalogSourceType = "whatsapp" | "external_api" | "url" | "internal";

export type CatalogSourceStatus = "active" | "inactive" | "error" | "syncing";

export interface CatalogSource {
  id: string;
  org_id: string;
  type: CatalogSourceType;
  name: string;
  config: CatalogSourceConfig;
  priority: number;
  is_default: boolean;
  status: CatalogSourceStatus;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export type CatalogSourceConfig =
  | WhatsAppCatalogSourceConfig
  | ExternalApiCatalogSourceConfig
  | UrlCatalogSourceConfig
  | InternalCatalogSourceConfig;

export interface WhatsAppCatalogSourceConfig {
  phone_number_id: string;
  business_account_id: string;
  catalog_id: string;
}

export interface ExternalApiCatalogSourceConfig {
  endpoint_url: string;
  auth_type: "none" | "api_key" | "oauth2" | "bearer";
  auth_config: Record<string, string>;
  headers?: Record<string, string>;
  timeout_ms?: number;
}

export interface UrlCatalogSourceConfig {
  feed_url: string;
  format: "json" | "xml" | "csv";
  polling_interval_minutes?: number;
  auth_config?: Record<string, string>;
}

export interface InternalCatalogSourceConfig {
  table_name: string;
  filters?: Record<string, unknown>;
}

export type AICapability =
  | "try_on"
  | "catalog_navigation"
  | "negotiation"
  | "discounts"
  | "guided_mode"
  | "look_recommendation"
  | "style_analysis"
  | "closing_assistance";

export interface AICapabilityConfig {
  capability: AICapability;
  enabled: boolean;
  limits?: {
    daily?: number;
    monthly?: number;
    per_session?: number;
  };
  config?: Record<string, unknown>;
}

export interface TenantAIConfig {
  org_id: string;
  capabilities: AICapabilityConfig[];
  guided_mode_required: boolean;
  max_interaction_turns: number;
  response_time_limit_ms: number;
  fallback_to_human_threshold: number;
  custom_instructions?: string;
  personality?: "friendly" | "consultive" | "direct" | "professional";
  language_style?: string;
}

export interface KnowledgeBaseEntry {
  id: string;
  org_id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  embedding?: number[];
  metadata?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseSearchResult {
  entry: KnowledgeBaseEntry;
  similarity: number;
  highlights: string[];
}

export interface KnowledgeBaseConfig {
  org_id: string;
  enabled: boolean;
  embedding_model?: string;
  similarity_threshold: number;
  max_results: number;
  auto_sync: boolean;
  last_indexed_at: string | null;
}

export interface TenantConfig {
  org_id: string;
  catalog_sources: CatalogSource[];
  ai_config: TenantAIConfig;
  knowledge_base_config: KnowledgeBaseConfig;
  created_at: string;
  updated_at: string;
}

export interface TenantConfigUpdateInput {
  catalog_sources?: Partial<CatalogSource>[];
  ai_config?: Partial<TenantAIConfig>;
  knowledge_base_config?: Partial<KnowledgeBaseConfig>;
}

export interface CatalogSourceInput {
  type: CatalogSourceType;
  name: string;
  config: CatalogSourceConfig;
  priority?: number;
  is_default?: boolean;
  status?: CatalogSourceStatus;
}

export interface AICapabilityInput {
  capability: AICapability;
  enabled: boolean;
  limits?: {
    daily?: number;
    monthly?: number;
    per_session?: number;
  };
  config?: Record<string, unknown>;
}

export const DEFAULT_AI_CAPABILITIES: AICapabilityConfig[] = [
  { capability: "try_on", enabled: true, limits: { monthly: 50 } },
  { capability: "catalog_navigation", enabled: true },
  { capability: "negotiation", enabled: true },
  { capability: "discounts", enabled: false },
  { capability: "guided_mode", enabled: false },
  { capability: "look_recommendation", enabled: true },
  { capability: "style_analysis", enabled: true },
  { capability: "closing_assistance", enabled: true },
];

export const DEFAULT_TENANT_AI_CONFIG: Omit<TenantAIConfig, "org_id"> = {
  capabilities: DEFAULT_AI_CAPABILITIES,
  guided_mode_required: false,
  max_interaction_turns: 20,
  response_time_limit_ms: 5000,
  fallback_to_human_threshold: 3,
  personality: "consultive",
  language_style: "pt-BR",
};

export const DEFAULT_KNOWLEDGE_BASE_CONFIG: Omit<KnowledgeBaseConfig, "org_id"> = {
  enabled: false,
  similarity_threshold: 0.7,
  max_results: 5,
  auto_sync: false,
  last_indexed_at: null,
};
