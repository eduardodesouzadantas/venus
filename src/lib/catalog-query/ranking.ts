import "server-only";

import type {
  CanonicalProduct,
  CatalogQueryParams,
  CatalogQueryContext,
  ProductRankingScore,
  RankingConfig,
} from "./types";
import { DEFAULT_RANKING_CONFIG } from "./types";

export function rankProducts(
  products: CanonicalProduct[],
  params: CatalogQueryParams,
  config: RankingConfig = DEFAULT_RANKING_CONFIG
): ProductRankingScore[] {
  if (products.length === 0) return [];

  const context = params.context || {};

  const scored = products.map((product) => {
    let score = 0;
    const reasons: string[] = [];

    if (context.user_style_identity && product.style_tags.length > 0) {
      const styleMatch = product.style_tags.some((tag) =>
        tag.toLowerCase().includes(context.user_style_identity!.toLowerCase())
      );
      if (styleMatch) {
        score += config.style_match_weight;
        reasons.push("Estilo alinhado com seu perfil");
      }
    }

    if (context.user_palette_family && product.colors.length > 0) {
      const colorMatch = product.colors.some((c) =>
        c.toLowerCase().includes(context.user_palette_family!.toLowerCase())
      );
      if (colorMatch) {
        score += config.color_match_weight;
        reasons.push("Cor da sua paleta");
      }
    } else if (params.color && product.colors.length > 0) {
      const colorMatch = product.colors.some((c) =>
        c.toLowerCase().includes(params.color!.toLowerCase())
      );
      if (colorMatch) {
        score += config.color_match_weight;
        reasons.push("Cor solicitada");
      }
    }

    if (params.price_min !== undefined && params.price_max !== undefined) {
      if (product.price >= params.price_min && product.price <= params.price_max) {
        score += config.price_match_weight;
        reasons.push("Dentro do orçamento");
      } else if (product.price <= params.price_max * 1.2) {
        score += config.price_match_weight * 0.5;
        reasons.push("Próximo ao orçamento");
      }
    }

    if (params.category) {
      if (product.category.toLowerCase().includes(params.category.toLowerCase())) {
        score += config.category_match_weight;
        reasons.push("Categoria solicitada");
      }
    }

    if (params.occasion && product.raw_metadata.occasion_tags) {
      const occasionTags = product.raw_metadata.occasion_tags as string[];
      const occasionMatch = occasionTags.some((o) =>
        o.toLowerCase().includes(params.occasion!.toLowerCase())
      );
      if (occasionMatch) {
        score += config.occasion_match_weight;
        reasons.push(`Ideal para ${params.occasion}`);
      }
    }

    if (context.conversation_state === "LOOK_RECOMMENDATION" || context.conversation_state === "CLOSING") {
      if (product.availability === "available") {
        score += config.context_relevance_weight;
        reasons.push("Pronto para entrega");
      }
      if (context.try_on_count !== undefined && context.try_on_count > 0) {
        if (product.raw_metadata.face_effect || product.raw_metadata.body_effect) {
          score += config.context_relevance_weight * 0.5;
          reasons.push("Suporta try-on");
        }
      }
    }

    if (context.previous_products_shown?.includes(product.id)) {
      score -= 1;
    }

    if (product.availability === "out_of_stock") {
      score -= 2;
      reasons.push("Indisponível");
    }

    return { product, score, reasons };
  });

  return scored.sort((a, b) => b.score - a.score);
}

export function getTopRecommendations(
  products: CanonicalProduct[],
  params: CatalogQueryParams,
  maxRecommendations: number = 3
): CanonicalProduct[] {
  const ranked = rankProducts(products, params);
  return ranked.slice(0, maxRecommendations).map((r) => r.product);
}

export function buildRecommendationJustification(
  recommendations: ProductRankingScore[],
  params: CatalogQueryParams
): string {
  if (recommendations.length === 0) {
    return "Não encontrei produtos que correspondam aos seus critérios. Posso te mostrar outras opções?";
  }

  const context = params.context || {};

  const justifications: string[] = [];

  if (context.user_style_identity) {
    justifications.push(`considerando seu estilo ${context.user_style_identity}`);
  }

  if (context.user_image_goal) {
    justifications.push(`para alcançar seu objetivo: ${context.user_image_goal}`);
  }

  if (params.occasion) {
    justifications.push(`perfeito para a ocasião: ${params.occasion}`);
  }

  if (params.color) {
    justifications.push(`na cor ${params.color}`);
  }

  const prefix = justifications.length > 0
    ? `Encontrei opções ${justifications.join(", ")}:`
    : "Aqui estão as melhores opções para você:";

  return prefix;
}

export function buildNextStepSuggestion(
  recommendations: ProductRankingScore[],
  params: CatalogQueryParams
): string {
  const context = params.context || {};
  const topProduct = recommendations[0];

  if (!topProduct) {
    return "Quer que eu refine a busca com outros critérios?";
  }

  if (context.conversation_state === "LOOK_RECOMMENDATION") {
    if (topProduct.product.raw_metadata.face_effect || topProduct.product.raw_metadata.body_effect) {
      return "Posso te mostrar como fica com o try-on?";
    }
    return "Quer ver os detalhes dessa peça?";
  }

  if (context.conversation_state === "CLOSING" || params.intent === "purchase") {
    return "Posso te ajudar a garantir essa escolha?";
  }

  if (context.try_on_count !== undefined && context.try_on_count < 3) {
    return "Quer ver como fica na sua foto?";
  }

  return "Qual dessas opções te chamou mais atenção?";
}