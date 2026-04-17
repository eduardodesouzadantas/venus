import "server-only";

import type { CatalogSource, CatalogSourceType } from "@/lib/tenant-config/types";

export interface CanonicalProduct {
  id: string;
  source_type: CatalogSourceType;
  source_id: string;
  title: string;
  description: string;
  image_url: string;
  price: number;
  currency: string;
  colors: string[];
  sizes: string[];
  category: string;
  style_tags: string[];
  availability: "available" | "out_of_stock" | "limited" | "pre_order";
  product_url: string;
  raw_metadata: Record<string, unknown>;
}

export interface CatalogQueryParams {
  org_id: string;
  occasion?: string;
  style?: string;
  color?: string;
  body_type?: string;
  price_min?: number;
  price_max?: number;
  category?: string;
  intent?: "browse" | "specific" | "purchase";
  context?: CatalogQueryContext;
  limit?: number;
}

export interface CatalogQueryContext {
  conversation_state?: string;
  user_style_identity?: string;
  user_image_goal?: string;
  user_palette_family?: string;
  user_palette_base?: string[];
  user_palette_accent?: string[];
  user_palette_caution?: string[];
  user_palette_confidence?: "low" | "medium" | "high";
  user_fit_preference?: string;
  previous_products_shown?: string[];
  try_on_count?: number;
  last_viewed_category?: string;
}

export interface CatalogQueryResult {
  products: CanonicalProduct[];
  source_used: CatalogSource;
  fallback_used: CatalogSource | null;
  total_found: number;
  query_params: CatalogQueryParams;
  metadata: {
    sources_tried: CatalogSource[];
    sources_failed: string[];
    no_results: boolean;
    ranking_applied: boolean;
  };
}

export interface CatalogSourceAdapter {
  type: CatalogSourceType;
  fetchProducts(
    source: CatalogSource,
    params: CatalogQueryParams
  ): Promise<AdapterFetchResult>;
  getCatalogLink(source: CatalogSource): string;
}

export interface AdapterFetchResult {
  success: boolean;
  products: CanonicalProduct[];
  error?: string;
  raw_response?: unknown;
}

export interface ProductRankingScore {
  product: CanonicalProduct;
  score: number;
  reasons: string[];
}

export interface RankingConfig {
  style_match_weight: number;
  color_match_weight: number;
  price_match_weight: number;
  category_match_weight: number;
  occasion_match_weight: number;
  context_relevance_weight: number;
}

export interface CatalogQueryLoggerEntry {
  timestamp: string;
  org_id: string;
  source_type: CatalogSourceType;
  source_id: string;
  action: "query" | "fallback" | "success" | "error" | "no_results";
  products_found: number;
  params: CatalogQueryParams;
  error?: string;
  fallback_source?: string;
}

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  style_match_weight: 2.0,
  color_match_weight: 1.5,
  price_match_weight: 1.0,
  category_match_weight: 1.5,
  occasion_match_weight: 1.0,
  context_relevance_weight: 2.0,
};

export const DEFAULT_QUERY_LIMIT = 20;
export const MAX_RECOMMENDATIONS = 3;
