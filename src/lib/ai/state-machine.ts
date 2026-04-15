import "server-only";

import type {
  ConversationState,
  ConversationStateConfig,
  StateTransition,
  ConversationContext,
  ResponseStrategy,
  ResponseTone,
  CTAType,
  PersuasionLevel,
  ClosingTrigger,
  MessageAnalysis,
  ConversationResponse,
} from "./conversation-engine-types";

export const CONVERSATION_STATES: Record<ConversationState, ConversationStateConfig> = {
  DISCOVERY: {
    state: "DISCOVERY",
    name: "Descoberta",
    description: "Usuário está explorando, ainda não sabe o que quer",
    defaultTone: "friendly",
    maxResponseLength: 200,
    persuasionLevel: "minimal",
    defaultCTA: "ask_question",
    minMessagesForTransition: 2,
    transitionTriggers: ["style_preference", "occasion", "budget", "goal"],
  },
  STYLE_ANALYSIS: {
    state: "STYLE_ANALYSIS",
    name: "Análise de Estilo",
    description: "Coletando preferências de estilo, perfil visual",
    defaultTone: "consultive",
    maxResponseLength: 300,
    persuasionLevel: "soft",
    defaultCTA: "suggest_tryon",
    minMessagesForTransition: 3,
    transitionTriggers: ["style_identity", "color_preference", "fit_preference", "budget_range"],
  },
  TRY_ON_GUIDED: {
    state: "TRY_ON_GUIDED",
    name: "Try-On Guiado",
    description: "Usuário fazendo try-ons, avaliando visualmente",
    defaultTone: "consultive",
    maxResponseLength: 250,
    persuasionLevel: "soft",
    defaultCTA: "show_look",
    minMessagesForTransition: 2,
    transitionTriggers: ["tryon_completed", "look_approved", "feedback_received"],
  },
  LOOK_RECOMMENDATION: {
    state: "LOOK_RECOMMENDATION",
    name: "Recomendação de Look",
    description: "Apresentando looks completos, potencializando",
    defaultTone: "consultive",
    maxResponseLength: 350,
    persuasionLevel: "moderate",
    defaultCTA: "show_look",
    minMessagesForTransition: 2,
    transitionTriggers: ["look_presented", "interest_shown", "product_viewed"],
  },
  CATALOG_ASSISTED: {
    state: "CATALOG_ASSISTED",
    name: "Assistência de Catálogo",
    description: "Navegando pelo catálogo, mostrando produtos",
    defaultTone: "direct",
    maxResponseLength: 300,
    persuasionLevel: "moderate",
    defaultCTA: "show_product",
    minMessagesForTransition: 2,
    transitionTriggers: ["product_shown", "category_selected", "price_inquired"],
  },
  CLOSING: {
    state: "CLOSING",
    name: "Fechamento",
    description: "Usuário quer comprar, momento de decisão",
    defaultTone: "closing",
    maxResponseLength: 200,
    persuasionLevel: "high",
    defaultCTA: "close_deal",
    minMessagesForTransition: 1,
    transitionTriggers: ["purchase_intent", "size_check", "price_accepted"],
  },
  POST_PURCHASE: {
    state: "POST_PURCHASE",
    name: "Pós-compra",
    description: "Compra realizada, nurturing",
    defaultTone: "friendly",
    maxResponseLength: 250,
    persuasionLevel: "minimal",
    defaultCTA: "follow_up",
    minMessagesForTransition: 1,
    transitionTriggers: ["purchase_confirmed", "delivery_completed"],
  },
  REENGAGEMENT: {
    state: "REENGAGEMENT",
    name: "Reengajamento",
    description: "Retomando conversa inativa",
    defaultTone: "consultive",
    maxResponseLength: 200,
    persuasionLevel: "soft",
    defaultCTA: "follow_up",
    minMessagesForTransition: 1,
    transitionTriggers: ["returning_user", "abandoned_cart", "expired_offer"],
  },
};

export const STATE_TRANSITIONS: StateTransition[] = [
  { from: "DISCOVERY", to: "STYLE_ANALYSIS", trigger: "style_info_collected", conditions: ["has_style_preference", "has_goal"] },
  { from: "DISCOVERY", to: "LOOK_RECOMMENDATION", trigger: "direct_interest", conditions: ["explicit_interest", "has_budget"] },
  { from: "STYLE_ANALYSIS", to: "TRY_ON_GUIDED", trigger: "profile_complete", conditions: ["style_identity_defined", "tryon_available"] },
  { from: "STYLE_ANALYSIS", to: "LOOK_RECOMMENDATION", trigger: "quick_recommendation", conditions: ["high_confidence_profile"] },
  { from: "TRY_ON_GUIDED", to: "LOOK_RECOMMENDATION", trigger: "look_approved", conditions: ["user_approved_look", "has_products"] },
  { from: "TRY_ON_GUIDED", to: "STYLE_ANALYSIS", trigger: "need_more_info", conditions: ["inconclusive_tryon", "missing_info"] },
  { from: "LOOK_RECOMMENDATION", to: "CATALOG_ASSISTED", trigger: "product_focused", conditions: ["showed_product", "user_asked_details"] },
  { from: "LOOK_RECOMMENDATION", to: "CLOSING", trigger: "purchase_signal", conditions: ["expresses_want", "asks_price", "asks_size"] },
  { from: "CATALOG_ASSISTED", to: "CLOSING", trigger: "ready_to_buy", conditions: ["decided_on_product", "asks_checkout"] },
  { from: "CLOSING", to: "POST_PURCHASE", trigger: "purchase_completed", conditions: ["payment_confirmed"] },
  { from: "CLOSING", to: "CATALOG_ASSISTED", trigger: "needs_more_options", conditions: ["rejected_proposal", "wants_alternative"] },
  { from: "POST_PURCHASE", to: "REENGAGEMENT", trigger: "return_interest", conditions: ["user_returns", "new_interest"] },
  { from: "REENGAGEMENT", to: "DISCOVERY", trigger: "new_conversation", conditions: ["new_session"] },
  { from: "REENGAGEMENT", to: "LOOK_RECOMMENDATION", trigger: "quick_interest", conditions: ["has_history", "clear_interest"] },
];

export function getStateConfig(state: ConversationState): ConversationStateConfig {
  return CONVERSATION_STATES[state];
}

export function getValidTransitions(fromState: ConversationState): StateTransition[] {
  return STATE_TRANSITIONS.filter((t) => t.from === fromState);
}

export function canTransition(
  fromState: ConversationState,
  toState: ConversationState,
  conditions: string[]
): boolean {
  const transition = STATE_TRANSITIONS.find((t) => t.from === fromState && t.to === toState);
  if (!transition) return false;
  
  return conditions.every((condition) => transition.conditions.includes(condition));
}

export function getNextState(
  currentState: ConversationState,
  trigger: string,
  conditions: string[]
): ConversationState | null {
  const transition = STATE_TRANSITIONS.find(
    (t) => t.from === currentState && t.trigger === trigger
  );
  
  if (!transition) return null;
  
  const canGo = conditions.every((condition) => transition.conditions.includes(condition));
  return canGo ? transition.to : null;
}

export function buildDefaultStrategy(state: ConversationState): ResponseStrategy {
  const config = CONVERSATION_STATES[state];
  
  return {
    tone: config.defaultTone,
    maxLength: config.maxResponseLength,
    persuasionLevel: config.persuasionLevel,
    cta: config.defaultCTA,
    ctaText: null,
    shouldUseMemory: true,
    shouldShowLook: state === "LOOK_RECOMMENDATION" || state === "TRY_ON_GUIDED",
    shouldShowProduct: state === "CATALOG_ASSISTED" || state === "CLOSING",
    shouldAskQuestion: state === "DISCOVERY" || state === "STYLE_ANALYSIS",
    prohibitedPatterns: [],
    requiredContext: [],
  };
}