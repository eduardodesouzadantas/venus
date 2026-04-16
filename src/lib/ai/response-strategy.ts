import "server-only";

import type {
  ConversationState,
  ResponseStrategy,
  ResponseTone,
  CTAType,
  PersuasionLevel,
  ConversationContext,
  MessageAnalysis,
  ClosingTrigger,
  UserMemory,
} from "./conversation-engine-types";
import { CONVERSATION_STATES } from "./state-machine";

const CTA_TEXT: Record<CTAType, string> = {
  ask_question: "Me conta mais sobre você?",
  suggest_tryon: "Quer ver como fica na sua foto?",
  show_look: "Quer que eu te mostre um look?",
  show_product: "Quer ver os produtos disponíveis?",
  close_deal: "Posso te ajudar a finalizar agora?",
  schedule_call: "Que tal agendarmos uma call?",
  follow_up: "Entendi, qualquer dúvida é só chamar!",
  none: "",
};

const STATE_TONE_OVERRIDES: Record<ConversationState, Partial<Record<ResponseTone, string>>> = {
  DISCOVERY: {
    friendly: "Oi! Que bom ter você aqui. Me manda uma foto e eu te mostro rapidinho o que já valoriza sua imagem.",
    consultive: "Entendi. Primeiro me manda sua foto e eu devolvo o wow com leitura clara e direta.",
    direct: "Vamos lá! Me envie sua foto e eu te mostro agora o primeiro wow.",
  },
  STYLE_ANALYSIS: {
    friendly: "Perfeito. Agora eu te explico por que essa leitura funciona e quais opções seguem na mesma linha.",
    consultive: "Agora que a foto entrou, eu conecto cor, visagismo e caimento para refinar o wow.",
    direct: "Com a foto em mãos, eu sigo com a leitura e a próxima direção.",
  },
  TRY_ON_GUIDED: {
    friendly: "Que experiência legal! Viu como a leitura ganha força com o try-on?",
    consultive: "O try-on ajuda a validar a direção visual. Vamos seguir por aqui?",
    direct: "Essa leitura já aponta uma direção clara. Quer ver mais?",
  },
  LOOK_RECOMMENDATION: {
    friendly: "Olha que look interesting para o seu perfil!",
    consultive: "Com base no seu estilo, essa proposta faz muito sentido.",
    direct: "Essa é a melhor opção para o que você procura.",
  },
  CATALOG_ASSISTED: {
    friendly: "Encontrei essas opções que combinam com você!",
    consultive: "Das opções disponíveis, essas são as mais indicadas para seu perfil.",
    direct: "Essas são as melhores opções para você.",
  },
  CLOSING: {
    friendly: "Que ótimo que você curtiu! Vou te ajudar a garantir esse look.",
    consultive: "Perfeito, esse é o caminho certo. Deixa eu te ajudar a fechar.",
    direct: "Perfeito! Agora é só confirmar para garantir.",
  },
  POST_PURCHASE: {
    friendly: "Fico muito feliz que você adorou! Qualquer dúvida, estou aqui.",
    consultive: "Seu feedback é muito importante. Posso te ajudar em algo mais?",
    direct: "Parabéns pela escolha! Posso ajudar com mais alguma coisa?",
  },
  REENGAGEMENT: {
    friendly: "Olá de volta! Que bom que você voltou. Posso te ajudar com algo?",
    consultive: "Entendo que você quer continuar. Vou te guiar de onde paramos.",
    direct: "Voltando de onde paramos. O que você gostaria de ver?",
  },
};

function getClosingCTAText(trigger: ClosingTrigger | undefined): string {
  if (!trigger) return "Posso te ajudar a finalizar agora?";
  
  switch (trigger.type) {
    case "price_inquiry":
      return "Quer que eu te mostre as opções de pagamento?";
    case "size_inquiry":
      return "Posso verificar os tamanhos disponíveis para você?";
    case "positive_feedback":
      return "Quer que eu avance para garantir esse look?";
    case "objection":
      return "Posso te ajudar a resolver essa dúvida?";
    default:
      return "Vamos avançar para garantir esse look?";
  }
}

function adaptStrategyForClosingMode(
  strategy: ResponseStrategy,
  closingTriggers: ClosingTrigger[],
  intentScore: number
): ResponseStrategy {
  const primaryTrigger = closingTriggers.find(
    (t) => t.type === "purchase_intent" || t.type === "price_inquiry" || t.type === "size_inquiry"
  );
  
  return {
    ...strategy,
    tone: "direct",
    maxLength: Math.min(strategy.maxLength, 200),
    persuasionLevel: "high",
    cta: "close_deal",
    ctaText: getClosingCTAText(primaryTrigger),
    shouldUseMemory: false,
    shouldShowLook: true,
    shouldShowProduct: true,
    shouldAskQuestion: false,
  };
}

function adaptStrategyForLowContext(
  strategy: ResponseStrategy,
  analysis: MessageAnalysis
): ResponseStrategy {
  if (analysis.needsContext && strategy.shouldAskQuestion) {
    return {
      ...strategy,
      maxLength: Math.min(strategy.maxLength, 150),
      cta: "ask_question",
      ctaText: CTA_TEXT.ask_question,
    };
  }
  
  return strategy;
}

function adaptStrategyWithMemory(
  strategy: ResponseStrategy,
  memory: UserMemory | null,
  context: ConversationContext
): ResponseStrategy {
  if (!memory || !strategy.shouldUseMemory) {
    return strategy;
  }
  
  const hasHistory = memory.conversationCount > 1;
  const hasProfile = !!(memory.styleIdentity || memory.imageGoal);
  
  if (hasProfile && hasHistory && context.currentState === "DISCOVERY") {
    return {
      ...strategy,
      tone: "consultive",
      cta: "show_look",
      ctaText: "Quer que eu te mostre algo baseado no que você já viu?",
    };
  }
  
  if (hasProfile && memory.converted) {
    return {
      ...strategy,
      cta: "follow_up",
      ctaText: "Que bom ter você de volta! Posso te mostrar as novidades?",
    };
  }
  
  return strategy;
}

export function buildResponseStrategy(
  state: ConversationState,
  context: ConversationContext,
  analysis: MessageAnalysis,
  memory: UserMemory | null
): ResponseStrategy {
  const config = CONVERSATION_STATES[state];
  let strategy: ResponseStrategy = {
    tone: config.defaultTone,
    maxLength: config.maxResponseLength,
    persuasionLevel: config.persuasionLevel,
    cta: config.defaultCTA,
    ctaText: CTA_TEXT[config.defaultCTA] || null,
    shouldUseMemory: true,
    shouldShowLook: config.state === "LOOK_RECOMMENDATION" || config.state === "TRY_ON_GUIDED",
    shouldShowProduct: config.state === "CATALOG_ASSISTED" || config.state === "CLOSING",
    shouldAskQuestion: config.state === "DISCOVERY" || config.state === "STYLE_ANALYSIS",
    prohibitedPatterns: [],
    requiredContext: [],
  };
  
  const hasClosingTrigger = context.closingTriggers.some(
    (t) => t.type === "purchase_intent" || t.type === "positive_feedback"
  );
  
  if (hasClosingTrigger || state === "CLOSING") {
    strategy = adaptStrategyForClosingMode(strategy, context.closingTriggers, context.intentScore);
  }
  
  if (analysis.needsContext && context.messageCount < 3) {
    strategy = adaptStrategyForLowContext(strategy, analysis);
  }
  
  if (memory) {
    strategy = adaptStrategyWithMemory(strategy, memory, context);
  }
  
  return strategy;
}

export function adaptToneForState(
  state: ConversationState,
  baseTone: ResponseTone,
  context: ConversationContext,
  memory: UserMemory | null
): ResponseTone {
  if (state === "CLOSING" || context.closingTriggers.length > 0) {
    return "direct";
  }
  
  if (context.messageCount < 2 && state === "DISCOVERY") {
    return "friendly";
  }
  
  if (memory && memory.conversationCount > 3) {
    return "direct";
  }
  
  return baseTone;
}

export function getStatePromptHints(state: ConversationState): string[] {
  const config = CONVERSATION_STATES[state];
  const hints: string[] = [];
  
  hints.push(`Estado: ${config.name}`);
  hints.push(`Tom: ${config.defaultTone}`);
  hints.push(`Nível de persuasão: ${config.persuasionLevel}`);
  
  if (state === "DISCOVERY") {
    hints.push("Abra pedindo foto cedo e criando antecipação");
    hints.push("Evite perguntas abstratas antes do primeiro wow");
  }
  
  if (state === "STYLE_ANALYSIS") {
    hints.push("Explique o resultado com base na foto já enviada");
    hints.push("Conecte cor, visagismo e caimento ao wow entregue");
  }
  
  if (state === "TRY_ON_GUIDED") {
    hints.push("Valide visualmente as recomendações");
    hints.push("Acompanhe reações ao try-on");
  }
  
  if (state === "LOOK_RECOMMENDATION") {
    hints.push("Apresente looks completos");
    hints.push("Foque em conversão");
  }
  
  if (state === "CLOSING") {
    hints.push("Seja direto e objetivo");
    hints.push("Remova objeções");
    hints.push("Não disperse");
    hints.push("Foque em fechar");
  }
  
  return hints;
}

export function shouldOfferTryOn(state: ConversationState, context: ConversationContext): boolean {
  if (state === "TRY_ON_GUIDED" || state === "LOOK_RECOMMENDATION") {
    return context.tryOnCount < 3 && context.hasStyleProfile;
  }
  
  if (state === "STYLE_ANALYSIS" && context.hasStyleProfile) {
    return true;
  }
  
  return false;
}

export function shouldShowProduct(state: ConversationState, context: ConversationContext): boolean {
  return state === "CATALOG_ASSISTED" || 
    state === "CLOSING" || 
    (state === "LOOK_RECOMMENDATION" && context.viewedProducts.length === 0);
}

export function shouldShowLook(state: ConversationState, context: ConversationContext): boolean {
  return state === "LOOK_RECOMMENDATION" || 
    state === "TRY_ON_GUIDED" ||
    (state === "STYLE_ANALYSIS" && context.tryOnCount > 0);
}
