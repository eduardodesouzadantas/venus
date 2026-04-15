import "server-only";

import type {
  ConversationContext,
  ClosingTrigger,
  MessageAnalysis,
  UserMemory,
} from "./conversation-engine-types";

export interface CloserConfig {
  maxExplorationMessages: number;
  frictionReduction: boolean;
  prioritizePriceSizeAvailability: boolean;
  upsellMode: "none" | "light" | "aggressive";
  handleObjections: boolean;
}

export interface ClosingSignal {
  type: "price" | "size" | "availability" | "payment" | "objection" | "ready";
  priority: number;
  response: string;
}

const CLOSER_CONFIGS: Record<string, CloserConfig> = {
  default: {
    maxExplorationMessages: 3,
    frictionReduction: true,
    prioritizePriceSizeAvailability: true,
    upsellMode: "light",
    handleObjections: true,
  },
  conservative: {
    maxExplorationMessages: 5,
    frictionReduction: true,
    prioritizePriceSizeAvailability: true,
    upsellMode: "none",
    handleObjections: true,
  },
  aggressive: {
    maxExplorationMessages: 2,
    frictionReduction: true,
    prioritizePriceSizeAvailability: true,
    upsellMode: "aggressive",
    handleObjections: true,
  },
  premium: {
    maxExplorationMessages: 4,
    frictionReduction: true,
    prioritizePriceSizeAvailability: true,
    upsellMode: "none",
    handleObjections: true,
  },
};

const CLOSING_SIGNALS: ClosingSignal[] = [
  { type: "price", priority: 3, response: "Vamos falar sobre valor: tenho opções de pagamento que cabem no seu orçamento. Qual prefere?" },
  { type: "size", priority: 3, response: "Vou verificar os tamanhos disponíveis para você agora." },
  { type: "availability", priority: 2, response: "Esta opção está pronta para entrega imediata. Quer seguir?" },
  { type: "payment", priority: 2, response: "Você escolhe: cartão ou PIX. Processo na hora." },
  { type: "objection", priority: 1, response: "Entendo sua preocupação. Vou te ajudar a resolver isso." },
  { type: "ready", priority: 4, response: "Então vamos fechar essa escolha agora." },
];

const OBJECTION_RESPONSES: Record<string, string> = {
  expensive: "I understand the investment. Let me show you payment options that fit your budget.",
  too_much: "That's fair. Would you like to see a more affordable alternative?",
  need_time: "Of course. Take the time you need. I'm here when you're ready.",
  not_sure: "What specific question can I answer to help you decide?",
  another_color: "We have this in other colors. Which would you like to see?",
  different_size: "Let me check what sizes we have available.",
  shipping_time: "Shipping takes 3-5 business days. Want me to proceed?",
  default: "I understand. Let me know what would help you feel more confident about this choice.",
};

export function getCloserConfig(mode: string = "default"): CloserConfig {
  return CLOSER_CONFIGS[mode] || CLOSER_CONFIGS.default;
}

export function detectClosingSignal(
  triggers: ClosingTrigger[]
): ClosingSignal | null {
  const signalPriority: Record<string, number> = {
    price_inquiry: 3,
    size_inquiry: 3,
    purchase_intent: 4,
    positive_feedback: 2,
    objection: 1,
  };

  let highestPriority = 0;
  let detectedSignal: ClosingSignal | null = null;

  for (const trigger of triggers) {
    const priority = signalPriority[trigger.type] || 0;
    if (priority > highestPriority) {
      highestPriority = priority;

      if (trigger.type === "price_inquiry") {
        detectedSignal = CLOSING_SIGNALS.find((s) => s.type === "price") || null;
      } else if (trigger.type === "size_inquiry") {
        detectedSignal = CLOSING_SIGNALS.find((s) => s.type === "size") || null;
      } else if (trigger.type === "purchase_intent") {
        detectedSignal = CLOSING_SIGNALS.find((s) => s.type === "ready") || null;
      } else if (trigger.type === "objection") {
        detectedSignal = CLOSING_SIGNALS.find((s) => s.type === "objection") || null;
      } else if (trigger.type === "positive_feedback") {
        detectedSignal = CLOSING_SIGNALS.find((s) => s.type === "ready") || null;
      }
    }
  }

  return detectedSignal;
}

export function shouldReduceExploration(
  context: ConversationContext,
  triggers: ClosingTrigger[]
): boolean {
  if (triggers.length === 0) return false;

  const config = getCloserConfig("default");
  const hasPurchaseIntent = triggers.some(
    (t) => t.type === "purchase_intent" || t.type === "positive_feedback"
  );

  if (hasPurchaseIntent) return true;
  if (context.messageCount > config.maxExplorationMessages) return true;

  return false;
}

export function buildCloserResponse(
  context: ConversationContext,
  triggers: ClosingTrigger[],
  analysis: MessageAnalysis,
  memory: UserMemory | null,
  config: CloserConfig = CLOSER_CONFIGS.default
): string {
  const signal = detectClosingSignal(triggers);
  
  if (signal) {
    return signal.response;
  }

  const objectionType = detectObjectionType(analysis.text);
  if (objectionType && config.handleObjections) {
    return OBJECTION_RESPONSES[objectionType] || OBJECTION_RESPONSES.default;
  }

  const hasPriceMention = triggers.some((t) => t.type === "price_inquiry");
  if (hasPriceMention && config.prioritizePriceSizeAvailability) {
    return "Temos opções de pagamento que cabem no seu orçamento. Quer ver?";
  }

  const hasSizeMention = triggers.some((t) => t.type === "size_inquiry");
  if (hasSizeMention && config.prioritizePriceSizeAvailability) {
    return "Vou verificar os tamanhos disponíveis para você agora.";
  }

  if (memory?.styleIdentity) {
    return `Considerando seu estilo ${memory.styleIdentity}, essa é uma ótima escolha. Pronto para seguir?`;
  }

  return "Esta opção está disponível. Como você gostaria de prosseguir?";
}

function detectObjectionType(text: string): string | null {
  const lower = text.toLowerCase();

  if (lower.includes("caro") || lower.includes("preço") || lower.includes("valor")) {
    return "expensive";
  }
  if (lower.includes("muito") || lower.includes("demais")) {
    return "too_much";
  }
  if (lower.includes("pensar") || lower.includes("tempo") || lower.includes("decidir")) {
    return "need_time";
  }
  if (lower.includes("não sei") || lower.includes("inseguro") || lower.includes("dúvida")) {
    return "not_sure";
  }
  if (lower.includes("outra cor") || lower.includes("cor diferente")) {
    return "another_color";
  }
  if (lower.includes("tamanho") || lower.includes("tamanho")) {
    return "different_size";
  }
  if (lower.includes("entrega") || lower.includes("frete") || lower.includes("quando")) {
    return "shipping_time";
  }

  return null;
}

export function addUpsellLight(
  response: string,
  context: ConversationContext,
  config: CloserConfig
): string {
  if (config.upsellMode === "none") {
    return response;
  }

  if (config.upsellMode === "light" && context.viewedProducts.length > 0) {
    const lightUpsell = [
      "Aliás, temos acessórios que completam esse look.",
      "Essa peça combina bem com nossas novidades.",
      "Já viu nossa nova coleção?",
    ];

    if (Math.random() > 0.5) {
      return `${response} ${lightUpsell[context.messageCount % lightUpsell.length]}`;
    }
  }

  return response;
}

export function isClosingReady(
  triggers: ClosingTrigger[],
  context: ConversationContext
): boolean {
  const purchaseIntent = triggers.some(
    (t) => t.type === "purchase_intent" || t.type === "positive_feedback"
  );

  const hasExploredEnough = context.messageCount >= 3;

  return purchaseIntent || hasExploredEnough;
}

export function getClosingMetrics(
  triggers: ClosingTrigger[],
  context: ConversationContext
): {
  readiness: number;
  mainFriction: string | null;
  recommendedAction: string;
} {
  let readiness = 0;
  let mainFriction: string | null = null;
  let recommendedAction = "continue";

  if (triggers.some((t) => t.type === "purchase_intent")) {
    readiness = 100;
    recommendedAction = "close";
  } else if (triggers.some((t) => t.type === "price_inquiry")) {
    readiness = 70;
    mainFriction = "price";
    recommendedAction = "address_price";
  } else if (triggers.some((t) => t.type === "size_inquiry")) {
    readiness = 70;
    mainFriction = "size";
    recommendedAction = "check_availability";
  } else if (triggers.some((t) => t.type === "objection")) {
    readiness = 50;
    mainFriction = "objection";
    recommendedAction = "handle_objection";
  } else if (triggers.some((t) => t.type === "positive_feedback")) {
    readiness = 80;
    recommendedAction = "confirm_close";
  }

  if (context.messageCount > 5 && readiness < 50) {
    mainFriction = "exploration";
    recommendedAction = "conclude_exploration";
  }

  return { readiness, mainFriction, recommendedAction };
}