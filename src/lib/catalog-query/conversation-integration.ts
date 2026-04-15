import "server-only";

import type { CanonicalProduct } from "./types";
import { queryCatalogForConversation, getCatalogLink } from "./engine";
import type { CatalogQueryParams } from "./types";
import type { UserMemory, ConversationContext } from "@/lib/ai/conversation-engine-types";

export interface CatalogRecommendationOutput {
  recommendations: CanonicalProduct[];
  response_text: string;
  catalog_link: string;
  next_step: string;
  metadata: {
    justification: string;
    products_shown: number;
    intent_detected: string;
  };
}

function extractSearchIntent(userMessage: string, context: ConversationContext): Partial<CatalogQueryParams> {
  const message = userMessage.toLowerCase();
  const searchParams: Partial<CatalogQueryParams> = {
    intent: "browse",
  };

  if (message.includes("comprar") || message.includes("garantir") || message.includes("levar")) {
    searchParams.intent = "purchase";
  }

  if (message.includes("específico") || message.includes("procurando") || message.includes("buscando")) {
    searchParams.intent = "specific";
  }

  const occasionKeywords: Record<string, string> = {
    trabalho: "trabalho",
    escritório: "trabalho",
    evento: "evento",
    casamento: "evento",
    formatura: "evento",
    aniversário: "evento",
    dia_a_dia: "dia a dia",
    casual: "casual",
    viagem: "viagem",
    praia: "praia",
  };

  for (const [keyword, occasion] of Object.entries(occasionKeywords)) {
    const searchKey = keyword === "dia_a_dia" ? "dia a dia" : keyword;
    if (message.includes(searchKey)) {
      searchParams.occasion = occasion;
      break;
    }
  }

  const styleKeywords: Record<string, string> = {
    clássico: "clássico",
    moderno: "moderno",
    casual: "casual",
    esportivo: "esportivo",
    elegante: "elegante",
    minimalista: "minimalista",
    rocker: "rocker",
    romântico: "romântico",
    boho: "boho",
  };

  for (const [keyword, style] of Object.entries(styleKeywords)) {
    const searchKey = keyword === "dia_a_dia" ? "dia a dia" : keyword;
    if (message.includes(searchKey)) {
      searchParams.style = style;
      break;
    }
  }

  const colorKeywords = ["preto", "branco", "azul", "vermelho", "verde", "bege", "cinza", "rosa", "amarelo", "laranja"];
  for (const color of colorKeywords) {
    if (message.includes(color)) {
      searchParams.color = color;
      break;
    }
  }

  const categoryKeywords: Record<string, string> = {
    vestido: "Vestidos",
    blusa: "Blusas",
    camisa: "Camisas",
    calça: "Calças",
    shorts: "Shorts",
    saia: "Saias",
    terno: "Ternos",
    blazer: "Blazers",
    jacket: "Blazers",
    bolsa: "Bolsas",
    sapato: "Sapatos",
    tênis: "Tênis",
    bota: "Botas",
    acessório: "Acessórios",
  };

  for (const [keyword, category] of Object.entries(categoryKeywords)) {
    if (message.includes("dia_a_dia") || message.includes("dia a dia")) {
      searchParams.category = category;
      break;
    }
  }

  const priceKeywords: Record<string, { min?: number; max?: number }> = {
    barato: { max: 150 },
    econômico: { max: 200 },
    acessível: { max: 250 },
    médio: { min: 200, max: 500 },
    moderado: { min: 200, max: 500 },
    caro: { min: 500 },
    premium: { min: 500 },
    luxo: { min: 1000 },
  };

  for (const [keyword, price] of Object.entries(priceKeywords)) {
    if (message.includes("dia_a_dia") || message.includes("dia a dia")) {
      searchParams.price_min = price.min;
      searchParams.price_max = price.max;
      break;
    }
  }

  return searchParams;
}

function buildContextFromMemory(memory: UserMemory | null, conversationContext: ConversationContext) {
  if (!memory) return undefined;

  return {
    conversation_state: conversationContext.currentState,
    user_style_identity: memory.styleIdentity,
    user_image_goal: memory.imageGoal,
    user_palette_family: memory.paletteFamily,
    user_fit_preference: memory.fit,
    previous_products_shown: conversationContext.viewedProducts,
    try_on_count: conversationContext.tryOnCount,
    last_viewed_category: undefined,
  };
}

export async function generateCatalogRecommendations(
  userMessage: string,
  orgId: string,
  userId: string,
  conversationContext: ConversationContext,
  memory: UserMemory | null
): Promise<CatalogRecommendationOutput> {
  const searchIntent = extractSearchIntent(userMessage, conversationContext);
  const context = buildContextFromMemory(memory, conversationContext);

  const params: CatalogQueryParams = {
    org_id: orgId,
    ...searchIntent,
    context,
    limit: 10,
  };

  const result = await queryCatalogForConversation(params);

  const intentLabel = searchIntent.intent || "browse";
  const productsCount = result.recommendations.length;

  let responseText = "";
  if (productsCount === 0) {
    responseText = "Não encontrei produtos que correspondam exatamente ao que você procura. Posso tentar com outros critérios?";
  } else if (productsCount === 1) {
    responseText = `${result.justification} Encontrei 1 opção que pode funcionar:`;
  } else {
    responseText = `${result.justification} Encontrei ${productsCount} opções que combinam com você:`;
  }

  return {
    recommendations: result.recommendations,
    response_text: responseText,
    catalog_link: result.catalogLink,
    next_step: result.nextStep,
    metadata: {
      justification: result.justification,
      products_shown: productsCount,
      intent_detected: intentLabel,
    },
  };
}

export async function getCatalogLinkForUser(
  orgId: string,
  userId: string
): Promise<string> {
  return getCatalogLink(orgId);
}

export function shouldUseCatalogQuery(
  userMessage: string,
  conversationState: string
): boolean {
  const message = userMessage.toLowerCase();
  
  const productKeywords = [
    "mostrar", "ver", "produto", "peça", "roupa", "look", "opção",
    "tenho interesse", "queria ver", "pode mostrar", "me mostra",
    "tem", "tem disponível", "tem como", "qual modelo",
    "vestido", "blusa", "camisa", "calça", "sapato", "bolsa",
  ];

  const hasProductKeyword = productKeywords.some(kw => message.includes(kw));

  const stateTriggers = [
    "CATALOG_ASSISTED", "LOOK_RECOMMENDATION", "DISCOVERY", "STYLE_ANALYSIS"
  ];
  
  const stateMatch = stateTriggers.includes(conversationState);
  
  const explicitCatalog = message.includes("catálogo") || message.includes("ver tudo");
  
  return hasProductKeyword || explicitCatalog || stateMatch;
}

export function buildProductCardText(product: CanonicalProduct): string {
  const lines: string[] = [];
  
  lines.push(`• ${product.title}`);
  
  if (product.price > 0) {
    const priceFormatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: product.currency || "BRL",
    }).format(product.price);
    lines.push(`  Preço: ${priceFormatted}`);
  }
  
  if (product.colors.length > 0) {
    lines.push(`  Cores: ${product.colors.join(", ")}`);
  }
  
  if (product.sizes.length > 0) {
    lines.push(`  Tamanhos: ${product.sizes.join(", ")}`);
  }
  
  if (product.availability !== "available") {
    const availabilityLabels: Record<string, string> = {
      out_of_stock: "Indisponível",
      limited: "Estoque limitado",
      pre_order: "Pré-encomenda",
    };
    lines.push(`  Status: ${availabilityLabels[product.availability] || product.availability}`);
  }
  
  return lines.join("\n");
}

export function formatRecommendationsForDisplay(
  recommendations: CanonicalProduct[]
): string {
  if (recommendations.length === 0) {
    return "Nenhum produto encontrado.";
  }

  const cards = recommendations.slice(0, 3).map((product, index) => {
    const priceFormatted = product.price > 0
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: product.currency || "BRL" }).format(product.price)
      : "Consulte";

    return `${index + 1}. ${product.title}\n   ${priceFormatted}${product.colors.length > 0 ? ` • ${product.colors[0]}` : ""}`;
  });

  return cards.join("\n\n");
}