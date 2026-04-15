import "server-only";

import type {
  ConversationState,
  ConversationContext,
  MessageAnalysis,
  ClosingTrigger,
  ConversationResponse,
  UserMemory,
  OrgMemory,
} from "./conversation-engine-types";
import { CONVERSATION_STATES, buildDefaultStrategy } from "./state-machine";
import { analyzeMessage, detectClosingTriggers, detectConversationState, isClosingMode } from "./conversation-state-detector";
import { buildResponseStrategy, getStatePromptHints, shouldOfferTryOn, shouldShowProduct, shouldShowLook } from "./response-strategy";
import { getUserMemory, getOrgMemory, saveConversationState, buildMemoryContext, shouldSkipOnboarding } from "./memory-integration";
import { detectExplorationRisk, applyAntiExplorationControl, enforceConduction, ensureNoGenericResponse, validateResponseQuality } from "./anti-exploration";
import { refineResponse, getToneProfile, adaptToneForSentiment, getBrandVoice, adaptVocabularyWithBrand } from "./tone-engine";
import { buildCloserResponse, getCloserConfig, getClosingMetrics, shouldReduceExploration } from "./closer-refinement";
import { addEmotionalReinforcement, getPostPurchaseBehavior, buildPostPurchaseResponse as getEmotionalPostPurchaseResponse, adaptForInsecurity, hasResolvedIntent } from "./emotional-layer";

export interface ConversationEngineInput {
  orgId: string;
  userId: string;
  conversationId: string;
  userMessage: string;
  currentState?: ConversationState;
  intentScore?: number;
  tryOnCount?: number;
  viewedProducts?: string[];
  hasStyleProfile?: boolean;
}

export interface ConversationEngineOutput {
  response: string;
  state: ConversationState;
  strategy: ReturnType<typeof buildResponseStrategy>;
  shouldOfferTryOn: boolean;
  shouldShowLook: boolean;
  shouldShowProduct: boolean;
  shouldPersistState: boolean;
  metadata: {
    messageAnalysis: MessageAnalysis;
    closingTriggers: ClosingTrigger[];
    explorationRisk: ReturnType<typeof detectExplorationRisk>;
    memoryHints: string[];
    stateConfig: typeof CONVERSATION_STATES[ConversationState];
    validation: ReturnType<typeof validateResponseQuality>;
  };
}

function buildInitialContext(
  input: ConversationEngineInput,
  existingState: ConversationState | null
): ConversationContext {
  return {
    orgId: input.orgId,
    userId: input.userId,
    conversationId: input.conversationId,
    currentState: input.currentState || existingState || "DISCOVERY",
    previousState: input.currentState || null,
    messageCount: 1,
    lastMessageAt: new Date().toISOString(),
    lastUserMessage: input.userMessage,
    intentScore: input.intentScore || 0,
    tryOnCount: input.tryOnCount || 0,
    viewedProducts: input.viewedProducts || [],
    hasStyleProfile: input.hasStyleProfile || false,
    hasPurchaseIntent: false,
    closingTriggers: [],
  };
}

export async function processConversation(
  input: ConversationEngineInput
): Promise<ConversationEngineOutput> {
  const existingState = input.currentState 
    ? input.currentState 
    : null;

  let context = buildInitialContext(input, existingState);
  
  const [userMemory, orgMemory] = await Promise.all([
    getUserMemory(input.userId, input.orgId),
    getOrgMemory(input.userId, input.orgId),
  ]);
  
  const analysis = analyzeMessage(input.userMessage);
  const closingTriggers = detectClosingTriggers(input.userMessage);
  context.closingTriggers = closingTriggers;
  context.hasPurchaseIntent = isClosingMode(closingTriggers);
  
  let nextState = detectConversationState(context, analysis);
  
  if (nextState !== context.currentState) {
    context.previousState = context.currentState;
    context.currentState = nextState;
  }
  
  const strategy = buildResponseStrategy(
    context.currentState,
    context,
    analysis,
    userMemory
  );
  
  let response = "";
  
  const memoryHints = buildMemoryContext(userMemory);
  const stateHints = getStatePromptHints(context.currentState);
  const stateConfig = CONVERSATION_STATES[context.currentState];
  const explorationRisk = detectExplorationRisk(input.userMessage, context.currentState, context.messageCount);
  
  const isClosing = isClosingMode(closingTriggers);
  
  if (isClosing) {
    response = buildClosingResponse(context, analysis, userMemory);
  } else {
    response = buildStateBasedResponse(context, analysis, userMemory, isClosing);
  }
  
  response = applyAntiExplorationControl(response, context.currentState, context, analysis);
  response = enforceConduction(response, context.currentState, strategy);
  response = ensureNoGenericResponse(response, context, userMemory);

  if (isClosing || context.currentState === "CLOSING") {
    const closerConfig = getCloserConfig("default");
    response = buildCloserResponse(context, closingTriggers, analysis, userMemory, closerConfig);
  }

  if (context.currentState !== "CLOSING") {
    response = refineResponse(response, context.currentState, context, analysis, userMemory, "default");
  }

  if (context.currentState === "POST_PURCHASE" || (isClosing && hasResolvedIntent(closingTriggers))) {
    const postPurchaseBehavior = getPostPurchaseBehavior(context, userMemory, { allowUpsell: true, allowComplement: false });
    if (postPurchaseBehavior.shouldUpsell && closingTriggers.length > 0) {
      response = getEmotionalPostPurchaseResponse(context, userMemory) + " " + (postPurchaseBehavior.upsellMessage || "");
    } else {
      response = getEmotionalPostPurchaseResponse(context, userMemory);
    }
  }

  response = adaptForInsecurity(response, analysis, userMemory);

  if (context.currentState !== "CLOSING" && context.currentState !== "POST_PURCHASE") {
    response = addEmotionalReinforcement(response, context, analysis, userMemory);
  }
  
  const validation = validateResponseQuality(response, context.currentState, strategy);
  
  await saveConversationState(
    input.userId,
    input.orgId,
    input.conversationId,
    context.currentState,
    input.userMessage
  );
  
  return {
    response,
    state: context.currentState,
    strategy,
    shouldOfferTryOn: shouldOfferTryOn(context.currentState, context),
    shouldShowLook: shouldShowLook(context.currentState, context),
    shouldShowProduct: shouldShowProduct(context.currentState, context),
    shouldPersistState: true,
    metadata: {
      messageAnalysis: analysis,
      closingTriggers,
      explorationRisk,
      memoryHints,
      stateConfig,
      validation,
    },
  };
}

function buildClosingResponse(
  context: ConversationContext,
  analysis: MessageAnalysis,
  memory: UserMemory | null
): string {
  const primaryTrigger = context.closingTriggers.find(
    (t) => t.type === "purchase_intent" || t.type === "positive_feedback"
  );
  
  const name = memory ? "Você" : "Você";
  
  switch (primaryTrigger?.type) {
    case "purchase_intent":
      return `${name}, vou te ajudar a garantir esse look agora. Me conta: prefere passar no cartão ou PIX?`;
    
    case "price_inquiry":
      return `${name}, temos opções de pagamento que cabem no seu orçamento. Quer ver as condições?`;
    
    case "size_inquiry":
      return `${name}, vou verificar os tamanhos disponíveis agora. Um momento...`;
    
    case "positive_feedback":
      return `${name}, que bom que curtiu! Posso te ajudar a garantir esse look. Qual o próximo passo?`;
    
    case "objection":
      return `${name}, qual é a sua dúvida? Posso te ajudar a resolver e seguir com a escolha.`;
    
    default:
      return `${name}, para garantir esse look, me conta: como você prefere finalizar?`;
  }
}

function buildStateBasedResponse(
  context: ConversationContext,
  analysis: MessageAnalysis,
  memory: UserMemory | null,
  isClosing: boolean
): string {
  if (isClosing) {
    return buildClosingResponse(context, analysis, memory);
  }
  
  const state = context.currentState;
  
  if (shouldSkipOnboarding(memory) && state === "DISCOVERY") {
    const hasHistory = memory && memory.conversationCount > 1;
    
    if (hasHistory) {
      const styleHint = memory?.styleIdentity ? ` sobre ${memory.styleIdentity}` : "";
      return `Que bom ver você de volta! ${memory?.imageGoal ? `Vi que seu objetivo é ${memory.imageGoal}.` : ""} Quer que eu te mostre algo baseado no que você já viu${styleHint}?`;
    }
    
    if (memory?.styleIdentity) {
      return `Entendi! Considerando seu estilo ${memory.styleIdentity}, ${memory?.imageGoal ? `para alcançar ${memory.imageGoal}` : "tenho algumas sugestões"}. Quer ver?`;
    }
  }
  
  switch (state) {
    case "DISCOVERY":
      return buildDiscoveryResponse(context, analysis, memory);
    
    case "STYLE_ANALYSIS":
      return buildStyleAnalysisResponse(context, analysis, memory);
    
    case "TRY_ON_GUIDED":
      return buildTryOnGuidedResponse(context, analysis, memory);
    
    case "LOOK_RECOMMENDATION":
      return buildLookRecommendationResponse(context, analysis, memory);
    
    case "CATALOG_ASSISTED":
      return buildCatalogAssistedResponse(context, analysis, memory);
    
    case "POST_PURCHASE":
      return buildPostPurchaseResponse(context, analysis, memory);
    
    case "REENGAGEMENT":
      return buildReengagementResponse(context, analysis, memory);
    
    default:
      return "Em que posso te ajudar?";
  }
}

function buildDiscoveryResponse(context: ConversationContext, analysis: MessageAnalysis, memory: UserMemory | null): string {
  const skips = shouldSkipOnboarding(memory);
  
  if (skips) {
    const profileHint = memory?.styleIdentity 
      ? `seu estilo ${memory.styleIdentity}` 
      : "o que já conversamos";
    
    return `Que bom ter você aqui! Com base em ${profileHint}, ${memory?.imageGoal ? `para chegar em ${memory.imageGoal}` : "posso te mostrar opções"}. O que gostaria de ver?`;
  }
  
  const questions = [
    "Para começar, me conta: qual é o objetivo dessa busca? (trabalho, evento especial, dia a dia?)",
    "O que você está procurando? (uma peça específica ou looks completos?)",
    "Me conta: você já tem alguma ideia do que quer ou Prefere sugestões baseadas no seu perfil?",
  ];
  
  const idx = context.messageCount % questions.length;
  return questions[idx];
}

function buildStyleAnalysisResponse(context: ConversationContext, analysis: MessageAnalysis, memory: UserMemory | null): string {
  if (memory?.styleIdentity) {
    return `Perfeito! Com base no seu estilo ${memory.styleIdentity}${memory.imageGoal ? ` e objetivo ${memory.imageGoal}` : ""}, vou te mostrar o que funciona. Quer ver um try-on para validar?`;
  }
  
  const nextSteps = [
    "Agora que entendi seu objetivo, preciso entender melhor seu estilo. Quais cores você prefere usar no dia a dia?",
    "Para refinar as sugestões, me conta: você Prefere peças mais formais ou casuais?",
    "Entendi o contexto! Uma última pergunta: prefere algo mais justo ou mais solto no caimento?",
  ];
  
  const idx = context.messageCount % nextSteps.length;
  return nextSteps[idx];
}

function buildTryOnGuidedResponse(context: ConversationContext, analysis: MessageAnalysis, memory: UserMemory | null): string {
  const hasFeedback = analysis.sentiment === "positive";
  
  if (hasFeedback) {
    return "Ótimo! Viu como a leitura ganha força com o try-on? Quer que eu te mostre um look completo para validar essa direção?";
  }
  
  if (analysis.sentiment === "negative") {
    return "Entendi! Esse visual não funcionou como esperado. Me conta: o que você mudaria? (cor, modelo, estilo?)";
  }
  
  return "O try-on ajuda a validar a direção visual. Esse look está alinhado com o que você procura?";
}

function buildLookRecommendationResponse(context: ConversationContext, analysis: MessageAnalysis, memory: UserMemory | null): string {
  if (analysis.sentiment === "positive") {
    const profileNote = memory?.styleIdentity 
      ? `considerando seu estilo ${memory.styleIdentity}` 
      : "";
    
    return `${profileNote ? `Perfeito, ${profileNote}!` : "Ótimo!"} Esse look funciona muito bem. Quer que eu avance para garantir essa escolha?`;
  }
  
  if (context.viewedProducts.length > 0) {
    return "Das opções que você viu, qual chamou mais atenção? Posso te ajudar a decidir.";
  }
  
  return "Esse look está alinhado com seu objetivo. Quer ver mais opções ou aprofundar em alguma peça?";
}

function buildCatalogAssistedResponse(context: ConversationContext, analysis: MessageAnalysis, memory: UserMemory | null): string {
  const categories = analysis.detectedEntities.categories;
  const colors = analysis.detectedEntities.colors;
  
  if (categories.length > 0) {
    return `Encontrei opções de ${categories.join(", ")} ${colors.length > 0 ? `na cor ${colors[0]}` : ""} que combinam com seu perfil. Quer ver detalhes de alguma?`;
  }
  
  return "Das opções disponíveis, essas são as mais indicadas para seu estilo. Qual você gostaria de ver mais?";
}

function buildPostPurchaseResponse(context: ConversationContext, analysis: MessageAnalysis, memory: UserMemory | null): string {
  return "Que bom que você adorou! Posso te ajudar em algo mais? (novas peças, combinações, acompanhamento)";
}

function buildReengagementResponse(context: ConversationContext, analysis: MessageAnalysis, memory: UserMemory | null): string {
  if (memory?.lastLookShown) {
    return `Que bom que você voltou! Você tinha interesse no look "${memory.lastLookShown}". Quer que eu te mostre opções atualizadas?`;
  }
  
  return "Olá de volta! Em que posso te ajudar hoje? Posso te mostrar as novidades ou continuar de onde paramos.";
}