import "server-only";

import type {
  ConversationState,
  ConversationContext,
  MessageAnalysis,
  ClosingTrigger,
} from "./conversation-engine-types";
import { CONVERSATION_STATES } from "./state-machine";

const DISCOVERY_KEYWORDS = [
  "não sei", "como começar", "o que usar", "sugestão", "ideia", "estou perdido",
  "não tenho", "nunca comprei", "primeira vez", "por onde", "ajuda", "dúvida",
  "estou pensando", "queria ver", "o que Recommenda", "me ajuda", "não conheço",
  "estou em dúvida", "não sei por onde", "como funciona", "pesquisando",
];

const STYLE_ANALYSIS_KEYWORDS = [
  "estilo", "preferência", "gosto de", "costumo usar", "meu estilo", "do meu tipo",
  "cor", "cor de", "gosto de cores", "caimento", "tipo de roupa", "formal",
  "casual", "moderno", "clássico", "descolado", "silhueta", "proporção",
];

const TRY_ON_KEYWORDS = [
  "try on", "try-on", "experimentar", "试穿", "visualizar", "ver como fica",
  "como fica", "试", " Experiments", "mostra como", "foto", "试穿照片",
  "modelo virtual", "ai", "transforma", "mudar foto",
];

const LOOK_RECOMMENDATION_KEYWORDS = [
  "look", "visual", "conjunto", "outfit", "composição", "combine",
  "juntar", "montar", "look completo", "proposta", "conjunto completo",
  "como usar", "para combinar", "combinar com", "complemento",
];

const CATALOG_KEYWORDS = [
  "produto", "catalogo", "tem", "tem tamanho", "tem cor", "preço", "valor",
  "quanto custa", "mais opções", "ver mais", "outro modelo", "alternativa",
  "estoque", "disponível", "roupa", "peça", "vá", "blazer", "calça", "camisa",
];

const CLOSING_KEYWORDS = [
  "quero", "vou levar", "compra", "comprar", "pagar", "fechar", "reservar",
  "garantir", "securei", "marcar", "agendar", "chegar", "entregar", "frete",
  "cartão", "pix", "transferência", "desconto", "promoção", "oferta",
  "tamanho", "número", "estou pronto", "pode enviar", "aguardo", "envia link",
  "link de compra", "checkout", "finalizar", "confirma", "ok", "sim",
];

const POST_PURCHASE_KEYWORDS = [
  "obrigado", "recebi", "chegou", "entregue", "amei", "ficou lindo",
  "muito bom", "perfeito", "adorei", "agradeço", "já usei", "vesti",
  "avaliação", "review", "feedback", "comentário",
];

const POSITIVE_FEEDBACK_PATTERNS = [
  "gostei", "amei", "ficou lindo", "perfeito", "excelente", "maravilhoso",
  "lindo demais", "top", "incrível", "show", "perfeito", "muito bom",
  "ficou muito", "adorei", "foi", "óbvio", "claro", "com certeza",
];

const PRICE_INQUIRY_PATTERNS = [
  "quanto", "valor", "preço", "custa", "valor", "por quanto", "mais barato",
  "desconto", "promoção", "oferta", "parcelas", "à vista",
];

const SIZE_INQUIRY_PATTERNS = [
  "tamanho", "número", "medida", "p", "m", "g", "gg", "tam", "numeração",
  "estrangeiro", "brasileiro", "equivale", "fit", "caimento",
];

const COMPARISON_PATTERNS = [
  "ou", "versus", "comparar", "diferença", "qual melhor", "melhor que",
  "diferente", "outro", "alternativa", "em vez", "ou então",
];

const OBJECTION_PATTERNS = [
  "caro", "expensive", "muito", "barato", "não tenho", "por enquanto",
  "depois", "pensar", "não sei", "não tenho certeza", "será que",
  "não convinced", "ainda não", "talvez", "deixa", "não agora",
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

function detectIntents(tokens: string[]): string[] {
  const intents: string[] = [];
  
  if (tokens.some((t) => DISCOVERY_KEYWORDS.some((k) => t.includes(k)))) {
    intents.push("discovery");
  }
  if (tokens.some((t) => STYLE_ANALYSIS_KEYWORDS.some((k) => t.includes(k)))) {
    intents.push("style_analysis");
  }
  if (tokens.some((t) => TRY_ON_KEYWORDS.some((k) => t.includes(k)))) {
    intents.push("try_on");
  }
  if (tokens.some((t) => LOOK_RECOMMENDATION_KEYWORDS.some((k) => t.includes(k)))) {
    intents.push("look_recommendation");
  }
  if (tokens.some((t) => CATALOG_KEYWORDS.some((k) => t.includes(k)))) {
    intents.push("catalog");
  }
  if (tokens.some((t) => CLOSING_KEYWORDS.some((k) => t.includes(k)))) {
    intents.push("closing");
  }
  if (tokens.some((t) => POST_PURCHASE_KEYWORDS.some((k) => t.includes(k)))) {
    intents.push("post_purchase");
  }
  
  return intents;
}

function detectEntities(tokens: string[]): Record<string, string[]> {
  const entities: Record<string, string[]> = {
    colors: [],
    categories: [],
    occasions: [],
    price: [],
  };
  
  const colorTokens = ["preto", "branco", "azul", "verde", "vermelho", "bege", "marrom", "cinza", "rose", "amarelo", "laranja", "roxo", "cores", "tons", "color"];
  const categoryTokens = ["blazer", "calça", "camisa", "saia", "vestido", "casaco", "moletom", "short", "blusa", "jaqueta", "sapato", "bolsa", "acessório"];
  const occasionTokens = ["trabalho", "festa", "casual", "evento", "dia", "noite", "formal", "约会", "casamento", "formatura", "presente"];
  
  for (const token of tokens) {
    if (colorTokens.some((c) => token.includes(c))) {
      entities.colors.push(token);
    }
    if (categoryTokens.some((c) => token.includes(c))) {
      entities.categories.push(token);
    }
    if (occasionTokens.some((c) => token.includes(c))) {
      entities.occasions.push(token);
    }
    if (token.includes("r$") || token.includes("reais") || /^\d+$/.test(token)) {
      entities.price.push(token);
    }
  }
  
  return entities;
}

function detectSentiment(tokens: string[]): "positive" | "negative" | "neutral" | "curious" {
  const positiveCount = tokens.filter((t) => POSITIVE_FEEDBACK_PATTERNS.some((p) => t.includes(p))).length;
  const negativeCount = tokens.filter((t) => OBJECTION_PATTERNS.some((p) => t.includes(p)) || ["não", "nao", "nem", "jamais"].some((p) => t.includes(p))).length;
  const questionCount = tokens.filter((t) => t.includes("?") || ["como", "qual", "onde", "quando", "por que", "porque", "?".includes(t)]).length;
  
  if (positiveCount > 0 && positiveCount >= negativeCount) {
    return "positive";
  }
  if (negativeCount > positiveCount) {
    return "negative";
  }
  if (questionCount > 1) {
    return "curious";
  }
  return "neutral";
}

export function analyzeMessage(text: string): MessageAnalysis {
  const tokens = tokenize(text);
  const intents = detectIntents(tokens);
  const entities = detectEntities(tokens);
  const sentiment = detectSentiment(tokens);
  
  const isClosingSignal = intents.includes("closing") || 
    tokens.some((t) => POSITIVE_FEEDBACK_PATTERNS.some((p) => t.includes(p))) ||
    tokens.some((t) => PRICE_INQUIRY_PATTERNS.some((p) => t.includes(p))) ||
    tokens.some((t) => SIZE_INQUIRY_PATTERNS.some((p) => t.includes(p)));
  
  const needsContext = intents.length === 0 || (intents.length === 1 && intents[0] === "discovery");
  
  return {
    text,
    tokens,
    detectedIntents: intents,
    detectedEntities: entities,
    sentiment,
    isClosingSignal,
    needsContext,
  };
}

export function detectClosingTriggers(text: string): ClosingTrigger[] {
  const tokens = tokenize(text);
  const triggers: ClosingTrigger[] = [];
  const now = new Date().toISOString();
  
  const purchaseIntentPatterns = [
    ...CLOSING_KEYWORDS,
    ...POSITIVE_FEEDBACK_PATTERNS,
  ];
  if (tokens.some((t) => purchaseIntentPatterns.some((p) => t.includes(p)))) {
    triggers.push({
      type: "purchase_intent",
      confidence: 0.8,
      detectedAt: now,
      messageSnippet: text.slice(0, 100),
    });
  }
  
  if (tokens.some((t) => PRICE_INQUIRY_PATTERNS.some((p) => t.includes(p)))) {
    triggers.push({
      type: "price_inquiry",
      confidence: 0.7,
      detectedAt: now,
      messageSnippet: text.slice(0, 100),
    });
  }
  
  if (tokens.some((t) => SIZE_INQUIRY_PATTERNS.some((p) => t.includes(p)))) {
    triggers.push({
      type: "size_inquiry",
      confidence: 0.75,
      detectedAt: now,
      messageSnippet: text.slice(0, 100),
    });
  }
  
  if (tokens.some((t) => COMPARISON_PATTERNS.some((p) => t.includes(p)))) {
    triggers.push({
      type: "comparison",
      confidence: 0.5,
      detectedAt: now,
      messageSnippet: text.slice(0, 100),
    });
  }
  
  if (tokens.some((t) => OBJECTION_PATTERNS.some((p) => t.includes(p)))) {
    triggers.push({
      type: "objection",
      confidence: 0.6,
      detectedAt: now,
      messageSnippet: text.slice(0, 100),
    });
  }
  
  if (tokens.some((t) => POSITIVE_FEEDBACK_PATTERNS.some((p) => t.includes(p)))) {
    triggers.push({
      type: "positive_feedback",
      confidence: 0.7,
      detectedAt: now,
      messageSnippet: text.slice(0, 100),
    });
  }
  
  return triggers;
}

export function detectConversationState(
  context: ConversationContext,
  analysis: MessageAnalysis
): ConversationState {
  const { currentState, messageCount, intentScore, tryOnCount, viewedProducts, closingTriggers, hasStyleProfile } = context;
  
  const hasClosingTrigger = closingTriggers.some((t) => t.type === "purchase_intent" || t.type === "positive_feedback");
  const hasPriceTrigger = closingTriggers.some((t) => t.type === "price_inquiry");
  const hasSizeTrigger = closingTriggers.some((t) => t.type === "size_inquiry");
  
  if (hasClosingTrigger || (hasPriceTrigger && intentScore > 60) || (hasSizeTrigger && intentScore > 50)) {
    return "CLOSING";
  }
  
  if (analysis.sentiment === "positive" && tryOnCount > 0 && currentState !== "CLOSING") {
    return "LOOK_RECOMMENDATION";
  }
  
  if (analysis.detectedIntents.includes("closing") && currentState !== "DISCOVERY") {
    return "CLOSING";
  }
  
  if (analysis.detectedIntents.includes("post_purchase")) {
    return "POST_PURCHASE";
  }
  
  if (analysis.detectedIntents.includes("catalog") && currentState !== "DISCOVERY") {
    return "CATALOG_ASSISTED";
  }
  
  if (analysis.detectedIntents.includes("look_recommendation") || (tryOnCount > 0 && hasStyleProfile)) {
    return "LOOK_RECOMMENDATION";
  }
  
  if (analysis.detectedIntents.includes("try_on") || analysis.detectedIntents.includes("style_analysis")) {
    if (tryOnCount > 0) {
      return "TRY_ON_GUIDED";
    }
    return "STYLE_ANALYSIS";
  }
  
  if (analysis.detectedIntents.includes("discovery") || analysis.needsContext) {
    if (messageCount > 3 && hasStyleProfile) {
      return "STYLE_ANALYSIS";
    }
    return "DISCOVERY";
  }
  
  if (viewedProducts.length > 0 && currentState !== "CLOSING") {
    return "CATALOG_ASSISTED";
  }
  
  const config = CONVERSATION_STATES[currentState];
  if (messageCount >= config.minMessagesForTransition) {
    if (hasStyleProfile && tryOnCount === 0) {
      return "STYLE_ANALYSIS";
    }
    if (tryOnCount > 0) {
      return "LOOK_RECOMMENDATION";
    }
  }
  
  return currentState;
}

export function isClosingMode(closingTriggers: ClosingTrigger[]): boolean {
  const purchaseIntent = closingTriggers.find((t) => t.type === "purchase_intent" && t.confidence > 0.6);
  const positiveFeedback = closingTriggers.find((t) => t.type === "positive_feedback" && t.confidence > 0.6);
  
  return !!(purchaseIntent || positiveFeedback);
}