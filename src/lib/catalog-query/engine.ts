import "server-only";

import type {
  CanonicalProduct,
  CatalogQueryParams,
  CatalogQueryResult,
  CatalogQueryLoggerEntry,
  ProductRankingScore,
} from "./types";
import { DEFAULT_QUERY_LIMIT, MAX_RECOMMENDATIONS } from "./types";
import { getAdapter, getAllAdapters } from "./adapters";
import { rankProducts, getTopRecommendations, buildRecommendationJustification, buildNextStepSuggestion } from "./ranking";
import { getActiveCatalogSources, resolveCatalogSource } from "@/lib/tenant-config/catalog-sources";

const queryLogs: CatalogQueryLoggerEntry[] = [];

function logQueryEntry(entry: Omit<CatalogQueryLoggerEntry, "timestamp">): void {
  const fullEntry: CatalogQueryLoggerEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  queryLogs.push(fullEntry);
  console.log("[CATALOG_QUERY]", JSON.stringify(fullEntry));
}

export function getQueryLogs(orgId?: string): CatalogQueryLoggerEntry[] {
  if (orgId) {
    return queryLogs.filter((log) => log.org_id === orgId);
  }
  return [...queryLogs];
}

export function clearQueryLogs(): void {
  queryLogs.length = 0;
}

export async function queryCatalog(
  params: CatalogQueryParams
): Promise<CatalogQueryResult> {
  const limit = params.limit || DEFAULT_QUERY_LIMIT;
  const sources = await getActiveCatalogSources(params.org_id);

  if (sources.length === 0) {
    logQueryEntry({
      org_id: params.org_id,
      source_type: "internal",
      source_id: "",
      action: "error",
      products_found: 0,
      params,
      error: "No active catalog sources configured",
    });

    return {
      products: [],
      source_used: null as never,
      fallback_used: null,
      total_found: 0,
      query_params: params,
      metadata: {
        sources_tried: [],
        sources_failed: [],
        no_results: true,
        ranking_applied: false,
      },
    };
  }

  const sortedSources = [...sources].sort((a, b) => a.priority - b.priority);
  const sourcesTried: typeof sortedSources = [];
  const sourcesFailed: string[] = [];
  let allProducts: CanonicalProduct[] = [];
  let primarySource = sortedSources[0];
  let fallbackSource: typeof sortedSources[0] | null = null;

  for (let i = 0; i < sortedSources.length; i++) {
    const source = sortedSources[i];
    sourcesTried.push(source);

    logQueryEntry({
      org_id: params.org_id,
      source_type: source.type,
      source_id: source.id,
      action: "query",
      products_found: 0,
      params,
    });

    try {
      const adapter = getAdapter(source.type);
      const result = await adapter.fetchProducts(source, {
        ...params,
        limit: limit + allProducts.length,
      });

      if (result.success) {
        allProducts = [...allProducts, ...result.products];

        if (allProducts.length >= limit) {
          if (i === 0) {
            primarySource = source;
          } else {
            fallbackSource = source;
          }
          break;
        }
      } else {
        sourcesFailed.push(source.id);
        logQueryEntry({
          org_id: params.org_id,
          source_type: source.type,
          source_id: source.id,
          action: "error",
          products_found: 0,
          params,
          error: result.error,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      sourcesFailed.push(source.id);
      logQueryEntry({
        org_id: params.org_id,
        source_type: source.type,
        source_id: source.id,
        action: "error",
        products_found: 0,
        params,
        error: errorMessage,
      });
    }
  }

  if (allProducts.length === 0) {
    logQueryEntry({
      org_id: params.org_id,
      source_type: primarySource.type,
      source_id: primarySource.id,
      action: "no_results",
      products_found: 0,
      params,
    });

    return {
      products: [],
      source_used: primarySource,
      fallback_used: null,
      total_found: 0,
      query_params: params,
      metadata: {
        sources_tried: sourcesTried,
        sources_failed: sourcesFailed,
        no_results: true,
        ranking_applied: false,
      },
    };
  }

  const rankedProducts = rankProducts(allProducts, params);
  if (params.context?.user_style_direction && rankedProducts.length > 0 && rankedProducts[0].score <= -1000) {
    logQueryEntry({
      org_id: params.org_id,
      source_type: primarySource.type,
      source_id: primarySource.id,
      action: "no_results",
      products_found: allProducts.length,
      params,
      error: "CATALOG_NO_MATCH_FOR_STYLE_DIRECTION",
    });

    return {
      products: [],
      source_used: primarySource,
      fallback_used: fallbackSource,
      total_found: allProducts.length,
      query_params: params,
      metadata: {
        sources_tried: sourcesTried,
        sources_failed: sourcesFailed,
        no_results: true,
        ranking_applied: true,
      },
    };
  }

  const topProducts = rankedProducts.slice(0, limit);
  const recommendations = rankedProducts.slice(0, MAX_RECOMMENDATIONS);

  logQueryEntry({
    org_id: params.org_id,
    source_type: primarySource.type,
    source_id: primarySource.id,
    action: fallbackSource ? "fallback" : "success",
    products_found: allProducts.length,
    params,
    fallback_source: fallbackSource?.id,
  });

  return {
    products: topProducts.map((r) => r.product),
    source_used: primarySource,
    fallback_used: fallbackSource,
    total_found: allProducts.length,
    query_params: params,
    metadata: {
      sources_tried: sourcesTried,
      sources_failed: sourcesFailed,
      no_results: false,
      ranking_applied: true,
    },
  };
}

export async function queryCatalogForConversation(
  params: CatalogQueryParams
): Promise<{
  recommendations: CanonicalProduct[];
  justification: string;
  nextStep: string;
  catalogLink: string;
  result: CatalogQueryResult;
}> {
  const result = await queryCatalog(params);

  const rankedScores = rankProducts(result.products, params);
  const recommendations = rankedScores.slice(0, MAX_RECOMMENDATIONS);

  const justification = buildRecommendationJustification(recommendations, params);
  const nextStep = buildNextStepSuggestion(recommendations, params);

  let catalogLink = "/catalog";
  if (result.source_used) {
    const adapter = getAdapter(result.source_used.type);
    catalogLink = adapter.getCatalogLink(result.source_used);
  }

  return {
    recommendations: recommendations.map((r) => r.product),
    justification,
    nextStep,
    catalogLink,
    result,
  };
}

export async function getCatalogLink(
  orgId: string,
  sourceType?: string
): Promise<string> {
  const source = await resolveCatalogSource(orgId, sourceType as any);

  if (!source) {
    return "/catalog";
  }

  const adapter = getAdapter(source.type);
  return adapter.getCatalogLink(source);
}

export async function validateTenantCatalogAccess(
  orgId: string,
  userOrgId: string
): Promise<boolean> {
  return orgId === userOrgId;
}

export function sanitizeQueryParams(
  params: Partial<CatalogQueryParams>,
  orgId: string
): CatalogQueryParams {
  return {
    org_id: orgId,
    occasion: params.occasion,
    style: params.style,
    color: params.color,
    body_type: params.body_type,
    price_min: params.price_min,
    price_max: params.price_max,
    category: params.category,
    intent: params.intent || "browse",
    context: params.context,
    limit: params.limit || DEFAULT_QUERY_LIMIT,
  };
}
