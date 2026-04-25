import "server-only";

import type {
  CanonicalProduct,
  CatalogQueryParams,
  ProductRankingScore,
  RankingConfig,
} from "./types";
import { DEFAULT_RANKING_CONFIG } from "./types";
import {
  getStyleDirectionCatalogSignals,
  getStyleDirectionConflictCode,
  getStyleDirectionDisplayLabel,
  isProductCompatibleWithStyleDirection,
  normalizeStyleDirectionPreference,
} from "@/lib/style-direction";

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeList(values: unknown): string[] {
  return Array.isArray(values) ? values.map((value) => normalizeText(value)).filter(Boolean) : [];
}

function collectProductDirectionSignals(product: CanonicalProduct): string[] {
  const rawMetadata = product.raw_metadata as Record<string, unknown> | undefined;
  return [
    product.title,
    product.description,
    product.category,
    ...(product.style_tags || []),
    ...(product.colors || []),
    ...(Array.isArray(rawMetadata?.target_profile) ? (rawMetadata?.target_profile as string[]) : []),
    ...(Array.isArray(rawMetadata?.use_cases) ? (rawMetadata?.use_cases as string[]) : []),
    ...(Array.isArray(rawMetadata?.occasion_tags) ? (rawMetadata?.occasion_tags as string[]) : []),
    ...(Array.isArray(rawMetadata?.style_tags) ? (rawMetadata?.style_tags as string[]) : []),
    ...(Array.isArray(rawMetadata?.category_tags) ? (rawMetadata?.category_tags as string[]) : []),
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);
}

function getProductDirection(product: CanonicalProduct): string {
  const raw = product.raw_metadata?.style_direction || product.raw_metadata?.styleDirection || product.raw_metadata?.direction;
  return normalizeStyleDirectionPreference(raw || normalizeText(product.category) || normalizeText(product.title));
}

export function rankProducts(
  products: CanonicalProduct[],
  params: CatalogQueryParams,
  config: RankingConfig = DEFAULT_RANKING_CONFIG
): ProductRankingScore[] {
  if (products.length === 0) return [];

  const context = params.context || {};
  const explicitStyleDirection = normalizeStyleDirectionPreference(context.user_style_direction || "");
  const consultationOccasion = normalizeText(context.user_occasion || params.occasion);
  const consultationBoldness = normalizeText(context.user_boldness).toLowerCase();
  const consultationRestrictions = normalizeList(context.user_restrictions);
  const consultationPreferredColors = normalizeList(context.user_preferred_colors);
  const consultationAvoidColors = normalizeList(context.user_avoid_colors);
  const consultationBodyFocus = normalizeText(context.user_body_focus).toLowerCase();
  const consultationVibe = normalizeText(context.user_aesthetic_vibe).toLowerCase();
  const consultationPerception = normalizeText(context.user_desired_perception).toLowerCase();
  const consultationConfidenceSource = normalizeText(context.user_confidence_source).toLowerCase();

  const scored = products.map((product) => {
    let score = 0;
    const reasons: string[] = [];
    const productDirection = getProductDirection(product);
    const productColors = Array.isArray(product.colors) ? product.colors : [];
    const rawMetadata = product.raw_metadata as Record<string, unknown> | undefined;
    const occasionTags = Array.isArray(rawMetadata?.occasion_tags) ? (rawMetadata?.occasion_tags as string[]) : [];
    const styleTags = Array.isArray(rawMetadata?.style_tags) ? (rawMetadata?.style_tags as string[]) : [];
    const productSignals = [
      product.title,
      product.description,
      product.category,
      ...product.style_tags,
      ...productColors,
      ...occasionTags,
      ...styleTags,
    ].filter((value): value is string => typeof value === "string" && Boolean(value));
    const productText = productSignals.join(" ").toLowerCase();
    const directionConflict = context.user_style_direction
      ? getStyleDirectionConflictCode(explicitStyleDirection, productDirection, collectProductDirectionSignals(product))
      : null;

    if (directionConflict) {
      return { product, score: -1000, reasons: [directionConflict] };
    }

    if (context.user_style_identity && product.style_tags.length > 0) {
      const styleMatch = product.style_tags.some((tag) =>
        tag.toLowerCase().includes(context.user_style_identity!.toLowerCase())
      );
      if (styleMatch) {
        score += config.style_match_weight;
        reasons.push("Estilo alinhado com seu perfil");
      }
    }

    if (context.user_style_direction) {
      const compatible = isProductCompatibleWithStyleDirection(explicitStyleDirection, productDirection, productSignals);
      if (compatible) {
        score += config.style_match_weight * 2;
        reasons.push(`Direção ${getStyleDirectionDisplayLabel(explicitStyleDirection)} compatível`);
        const directionSignals = getStyleDirectionCatalogSignals(explicitStyleDirection);
        if (product.style_tags.some((tag) => directionSignals.some((signal) => tag.toLowerCase().includes(signal)))) {
          score += config.style_match_weight;
          reasons.push("Tags compatíveis com a direção escolhida");
        }
      } else {
        score -= 1000;
        reasons.push("Bloqueado por direção de estilo");
      }
    }

    if (consultationRestrictions.length > 0) {
      const restrictionHit = consultationRestrictions.some((restriction) => {
        const tokens = restriction
          .toLowerCase()
          .split(/[\s,;/|]+/g)
          .map((token) => token.trim())
          .filter(Boolean);

        return tokens.some((token) => productText.includes(token));
      });

      if (restrictionHit) {
        score -= 40;
        reasons.push("Bloqueado por restrição de consultoria");
      }
    }

    if (consultationPerception) {
      const perceptionSignals = consultationPerception.includes("autor") || consultationPerception.includes("presen")
        ? ["autoridade", "presença", "estrutura", "firme"]
        : consultationPerception.includes("discre")
          ? ["discreto", "limpo", "neutro", "silencioso"]
          : consultationPerception.includes("criativ")
            ? ["editorial", "criativo", "impacto", "expressivo"]
            : consultationPerception.includes("eleg")
              ? ["elegante", "refinado", "sofisticado", "limpo"]
              : ["base", "seguro", "versátil"];

      if (perceptionSignals.some((signal) => productText.includes(signal))) {
        score += config.style_match_weight;
        reasons.push("Leitura alinhada à percepção desejada");
      }
    }

    if (consultationOccasion) {
      const occasionText = consultationOccasion.toLowerCase();
      const occasionMatch =
        (params.occasion && product.raw_metadata.occasion_tags && (product.raw_metadata.occasion_tags as string[]).some((tag) => tag.toLowerCase().includes(params.occasion!.toLowerCase()))) ||
        productText.includes(occasionText);

      if (occasionMatch) {
        score += config.occasion_match_weight * 1.5;
        reasons.push("Ocasião compatível");
      }
    }

    if (consultationPreferredColors.length > 0 && productColors.length > 0) {
      const preferredColorMatch = productColors.some((color) =>
        consultationPreferredColors.some((preferred) => color.toLowerCase().includes(preferred.toLowerCase()))
      );
      if (preferredColorMatch) {
        score += config.color_match_weight;
        reasons.push("Cor preferida");
      }
    }

    if (consultationAvoidColors.length > 0 && productColors.length > 0) {
      const avoidColorMatch = productColors.some((color) =>
        consultationAvoidColors.some((avoid) => color.toLowerCase().includes(avoid.toLowerCase()))
      );
      if (avoidColorMatch) {
        score -= config.color_match_weight * 2;
        reasons.push("Cor evitada");
      }
    }

    if (consultationVibe) {
      const vibeSignals = consultationVibe.includes("clean") || consultationVibe.includes("minimal")
        ? ["limpo", "minimal", "neutro", "base", "silencioso"]
        : consultationVibe.includes("editor")
          ? ["editorial", "impacto", "statement", "expressivo", "assinatura"]
          : consultationVibe.includes("urb")
            ? ["urbano", "street", "casual", "moderno", "atitude"]
            : consultationVibe.includes("cláss")
              ? ["clássico", "alfaiataria", "refinado", "tradicional"]
              : ["versátil", "equilíbrio", "uso real"];

      if (vibeSignals.some((signal) => productText.includes(signal))) {
        score += config.style_match_weight;
        reasons.push("Vibe estética compatível");
      }
    }

    if (consultationBoldness) {
      const boldSignals = productText.includes("statement") || productText.includes("impacto") || productText.includes("recorte") || productText.includes("textura") || productText.includes("contraste");
      const safeSignals = productText.includes("base") || productText.includes("neutro") || productText.includes("limpo") || productText.includes("silencioso") || productText.includes("versátil");

      if (consultationBoldness === "high") {
        if (boldSignals) {
          score += config.style_match_weight;
          reasons.push("Ousadia compatível");
        }
        if (safeSignals) {
          score -= 1;
        }
      } else if (consultationBoldness === "low") {
        if (safeSignals) {
          score += config.style_match_weight;
          reasons.push("Leitura segura");
        }
        if (boldSignals) {
          score -= config.style_match_weight;
          reasons.push("Ousadia acima do desejado");
        }
      }
    }

    if (consultationBodyFocus) {
      const bodyFocusSignals = consultationBodyFocus.includes("rosto")
        ? ["rosto", "gola", "decote", "colarinho"]
        : consultationBodyFocus.includes("tronco")
          ? ["tronco", "ombro", "blazer", "camisa", "jaqueta"]
          : consultationBodyFocus.includes("perna")
            ? ["calça", "saia", "comprimento"]
            : consultationBodyFocus.includes("silhueta")
              ? ["linha", "estrutura", "modelagem", "caimento"]
              : [];

      if (bodyFocusSignals.some((signal) => productText.includes(signal))) {
        score += config.category_match_weight;
        reasons.push("Foco corporal favorecido");
      }
    }

    if (consultationConfidenceSource === "photo" && product.availability === "available") {
      score += 0.5;
    }

    if (context.user_palette_family && productColors.length > 0) {
      const colorMatch = productColors.some((c) =>
        c.toLowerCase().includes(context.user_palette_family!.toLowerCase())
      );
      if (colorMatch) {
        score += config.color_match_weight;
        reasons.push("Cor da sua paleta");
      }
    } else if (params.color && productColors.length > 0) {
      const colorMatch = productColors.some((c) =>
        c.toLowerCase().includes(params.color!.toLowerCase())
      );
      if (colorMatch) {
        score += config.color_match_weight;
        reasons.push("Cor solicitada");
      }
    }

    if (productColors.length > 0) {
      const colorText = productColors.join(" ").toLowerCase();
      const baseMatch = context.user_palette_base?.some((color) => colorText.includes(color.toLowerCase()));
      const accentMatch = context.user_palette_accent?.some((color) => colorText.includes(color.toLowerCase()));
      const cautionMatch = context.user_palette_caution?.some((color) => colorText.includes(color.toLowerCase()));

      if (baseMatch) {
        score += config.color_match_weight * 2;
        reasons.push("Base segura da paleta");
      }

      if (accentMatch) {
        score += config.color_match_weight;
        reasons.push("Acento compatível com a paleta");
      }

      if (cautionMatch) {
        score -= config.color_match_weight * 2.5;
        reasons.push("Cor de cautela");
      }

      if (!context.user_palette_confidence || context.user_palette_confidence === "low") {
        if (colorText.includes("laranja") || colorText.includes("amarelo") || colorText.includes("neon") || colorText.includes("rosa choque")) {
          score -= config.color_match_weight;
        }
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
  return ranked
    .filter((r) => r.score > -1000 && !r.reasons.includes("PROFILE_DIRECTION_CONFLICT"))
    .slice(0, maxRecommendations)
    .map((r) => r.product);
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

  if (context.user_style_direction) {
    justifications.push(`considerando sua direção ${getStyleDirectionDisplayLabel(context.user_style_direction)}`);
  }

  if (context.user_occasion) {
    justifications.push(`para a ocasião ${context.user_occasion}`);
  }

  if (context.user_desired_perception) {
    justifications.push(`com foco em ${context.user_desired_perception}`);
  }

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
