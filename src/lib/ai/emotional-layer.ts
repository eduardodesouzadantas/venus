import "server-only";

import type {
  ConversationContext,
  MessageAnalysis,
  ClosingTrigger,
  UserMemory,
} from "./conversation-engine-types";

export interface EmotionalReinforcement {
  type: "self-esteem" | "aesthetic-validation" | "confidence" | "choice-validation" | null;
  message: string;
  intensity: "subtle" | "moderate" | "strong";
}

const SELF_ESTEEM_REINFORCEMENTS: string[] = [
  "Você tem um ótimo senso de estilo.",
  "Sua escolha mostra que você se conhece bem.",
  "Você sabe o que funciona para você.",
  "Seu instincts estão em dia.",
  "Você tem um olhar muito apurado.",
];

const AESTHETIC_VALIDATIONS: string[] = [
  "Essa escolha valoriza muito seu visual.",
  "Essa peça tem tudo a ver com o que você busca.",
  "O contraste funciona incredibly bem no seu caso.",
  "Essa cor combina muito com seu tom de pele.",
  "Esse modelo realça suas melhores características.",
];

const CONFIDENCE_BUILDERS: string[] = [
  "Você vai se sentir muito bem usando isso.",
  "Essa escolha demonstra segurança.",
  "Você fez uma excelente escolha.",
  "Essa decisão reflete muito bem seu estilo.",
  "Você acertou em cheio com essa escolha.",
];

const CHOICE_VALIDATIONS: string[] = [
  "Essa é uma escolha fantástica.",
  "Você fez uma ótima escolha.",
  "Essa peça é perfeita para você.",
  "Congratulations pela escolha!",
  "Essa decisão vai render muitos elogios.",
];

export function detectEmotionalNeed(
  analysis: MessageAnalysis,
  context: ConversationContext,
  triggers: ClosingTrigger[]
): EmotionalReinforcement["type"] {
  if (analysis.sentiment === "negative" || analysis.sentiment === "curious") {
    return "confidence";
  }

  if (analysis.sentiment === "positive") {
    if (context.currentState === "LOOK_RECOMMENDATION" || context.currentState === "TRY_ON_GUIDED") {
      return "aesthetic-validation";
    }

    if (context.currentState === "CLOSING") {
      return "choice-validation";
    }
  }

  const hasObjection = triggers.some((t) => t.type === "objection");
  if (hasObjection) {
    return "self-esteem";
  }

  if (context.messageCount > 3 && context.currentState === "DISCOVERY") {
    return "self-esteem";
  }

  return null;
}

export function getReinforcementMessage(
  type: EmotionalReinforcement["type"],
  context: ConversationContext
): string | null {
  let messages: string[] = [];

  switch (type) {
    case "self-esteem":
      messages = SELF_ESTEEM_REINFORCEMENTS;
      break;
    case "aesthetic-validation":
      messages = AESTHETIC_VALIDATIONS;
      break;
    case "confidence":
      messages = CONFIDENCE_BUILDERS;
      break;
    case "choice-validation":
      messages = CHOICE_VALIDATIONS;
      break;
    default:
      return null;
  }

  return messages[context.messageCount % messages.length];
}

export function addEmotionalReinforcement(
  response: string,
  context: ConversationContext,
  analysis: MessageAnalysis,
  memory: UserMemory | null
): string {
  const emotionalType = detectEmotionalNeed(analysis, context, context.closingTriggers);
  if (!emotionalType) {
    return response;
  }

  const reinforcement = getReinforcementMessage(emotionalType, context);
  if (!reinforcement) {
    return response;
  }

  const shouldAdd = Math.random() > 0.3;
  if (!shouldAdd) {
    return response;
  }

  if (context.currentState === "CLOSING") {
    const closingAdd = `${reinforcement} ${response}`;
    return closingAdd;
  }

  const prefix = getEmotionalPrefix(context.currentState);
  return `${prefix} ${reinforcement}. ${response}`;
}

function getEmotionalPrefix(state: ConversationContext["currentState"]): string {
  switch (state) {
    case "DISCOVERY":
      return "Sabe";
    case "STYLE_ANALYSIS":
      return "E";
    case "TRY_ON_GUIDED":
      return "Viu só";
    case "LOOK_RECOMMENDATION":
      return "Olha";
    case "CATALOG_ASSISTED":
      return "E";
    default:
      return "";
  }
}

export interface PostPurchaseSensitivity {
  shouldUpsell: boolean;
  shouldSuggestComplement: boolean;
  upsellMessage: string | null;
}

const POST_PURCHASE_COMPLEMENTS: string[] = [
  "Essa peça combina muito com acessórios em ouro.",
  "Um acessório discreto valorizaria ainda mais esse look.",
  "Essa escolha ganha reforço com uma peça complementar.",
];

const POST_PURCHASE_UPSELL_MESSAGES: string[] = [
  "Quando quiser incrementar seu guardar-roupa, é só chamar.",
  "Temos novidades que combinam com essa escolha.",
  "Em breve teremos novas peças que complementam esse estilo.",
];

export function getPostPurchaseBehavior(
  context: ConversationContext,
  memory: UserMemory | null,
  config: { allowUpsell: boolean; allowComplement: boolean } = { allowUpsell: true, allowComplement: true }
): PostPurchaseSensitivity {
  if (!config.allowUpsell) {
    return {
      shouldUpsell: false,
      shouldSuggestComplement: false,
      upsellMessage: null,
    };
  }

  const shouldComplement = config.allowComplement && Math.random() > 0.5;
  let upsellMessage: string | null = null;

  if (shouldComplement) {
    upsellMessage = POST_PURCHASE_COMPLEMENTS[context.messageCount % POST_PURCHASE_COMPLEMENTS.length];
  }

  return {
    shouldUpsell: config.allowUpsell,
    shouldSuggestComplement: shouldComplement,
    upsellMessage,
  };
}

export function buildPostPurchaseResponse(
  context: ConversationContext,
  memory: UserMemory | null
): string {
  if (memory?.lastLookShown) {
    return `Parabéns pela escolha! O look "${memory.lastLookShown}" ficou ótimo.${Math.random() > 0.5 ? " " + POST_PURCHASE_UPSELL_MESSAGES[context.messageCount % POST_PURCHASE_UPSELL_MESSAGES.length] : ""}`;
  }

  return "Parabéns pela escolha! Você fez uma ótima decisão.";
}

export function hasResolvedIntent(triggers: ClosingTrigger[]): boolean {
  return triggers.some(
    (t) => t.type === "purchase_intent" || t.type === "positive_feedback"
  );
}

export function isPostPurchaseSensitivityNeeded(
  context: ConversationContext,
  triggers: ClosingTrigger[]
): boolean {
  return context.currentState === "POST_PURCHASE" || hasResolvedIntent(triggers);
}

export function adaptForInsecurity(
  response: string,
  analysis: MessageAnalysis,
  memory: UserMemory | null
): string {
  const hasInsecurity = /não sei|não tenho certeza|estou em dúvida|me sinto/i.test(analysis.text);
  if (!hasInsecurity) {
    return response;
  }

  const insecurityResponses = [
    "Não precisa ter pressa. Essa decisão deve ser sua e do seu ritmo.",
    "Tudo bem levar o tempo que precisar. Estou aqui para ajudar.",
    "Essa escolha é sua. Deixe-me saber quando estiver pronto.",
  ];

  const memoryRef = memory?.styleIdentity ? ` para seu estilo ${memory.styleIdentity}` : "";
  return `${insecurityResponses[Math.floor(Math.random() * insecurityResponses.length)]} ${response}`.trim();
}