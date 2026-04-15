import "server-only";

import type { ConversationState, ConversationContext, MessageAnalysis, ResponseStrategy } from "./conversation-engine-types";

export interface ExplorationRisk {
  level: "low" | "medium" | "high";
  reasons: string[];
  suggestedFix: string;
}

const EXPLORATION_PATTERNS = [
  "não sei", "talvez", "qualquer", "tanto faz", "tanto faz", "tanto faz",
  "qualquer um", "qualquer uma", "sem preferência", "sem opinião",
  "me ajude", "o que você Recommenda", "o que sugere", "o que achar",
  "não tenho certeza", "não sei bem", "estou em dúvida", "estou pensando",
];

const CONDUCTING_PATTERNS = [
  "te ajudo", "vamos", "confia", "a melhor opção", "o ideal é",
  "para você", "para seu", "no seu caso", "considerando seu",
  "com base no", "levando em conta", "sua leitura",
];

const REDIRECT_KEYWORDS: Record<ConversationState, string[]> = {
  DISCOVERY: ["me conta", "para você", "seu objetivo", "seu estilo"],
  STYLE_ANALYSIS: ["te ajudo", "entendi", "com base", "considerando"],
  TRY_ON_GUIDED: ["viu como", "nesse visual", "essa direção", "ficou"],
  LOOK_RECOMMENDATION: ["essa proposta", "esse look", "para seu", "ideal para"],
  CATALOG_ASSISTED: ["opções", "disponível", "tenho", "encontrei"],
  CLOSING: ["então", "para garantir", "só confirmar", "pronto para"],
  POST_PURCHASE: ["parabéns", "feliz", "agradeço", "qualquer dúvida"],
  REENGAGEMENT: ["de volta", "entendi", "retomando", "continuando"],
};

const PROHIBITED_PATTERNS_PER_STATE: Record<ConversationState, string[]> = {
  DISCOVERY: [
    "não sei", "qualquer", "tanto faz",
    "deixa", "depois", "talvez",
    "estou pensando", "não sei bem",
  ],
  STYLE_ANALYSIS: [
    "não sei", "qualquer", "tanto faz",
    "me ajuda", "o que Recommenda",
    "sem preferência",
  ],
  TRY_ON_GUIDED: [
    "não sei", "qualquer", "tanto faz",
    "sem opinião", "não sei dizer",
  ],
  LOOK_RECOMMENDATION: [
    "não sei", "não tenho certeza",
    "talvez", "estou em dúvida",
  ],
  CATALOG_ASSISTED: [
    "não sei", "qualquer", "tanto faz",
    "mostra tudo", "me mostra",
  ],
  CLOSING: [],
  POST_PURCHASE: [],
  REENGAGEMENT: [],
};

export function detectExplorationRisk(
  text: string,
  state: ConversationState,
  messageCount: number
): ExplorationRisk {
  const tokens = text.toLowerCase().split(/\s+/);
  const reasons: string[] = [];
  
  const hasExplorationPattern = EXPLORATION_PATTERNS.some((pattern) =>
    tokens.some((token) => token.includes(pattern))
  );
  
  if (hasExplorationPattern && messageCount > 2) {
    reasons.push("Usuário em modo de exploração após múltiplas mensagens");
  }
  
  if (state === "DISCOVERY" && messageCount > 5) {
    reasons.push("Exposição prolongada no estado de descoberta");
  }
  
  const hasConductingPattern = CONDUCTING_PATTERNS.some((pattern) =>
    text.toLowerCase().includes(pattern)
  );
  
  if (!hasConductingPattern && messageCount > 3) {
    reasons.push("AI não está conduzindo ativamente");
  }
  
  const prohibitedPatterns = PROHIBITED_PATTERNS_PER_STATE[state];
  const hasProhibited = prohibitedPatterns.some((pattern) =>
    tokens.some((token) => token.includes(pattern))
  );
  
  if (hasProhibited) {
    reasons.push(`Padrão proibido detectado para estado ${state}`);
  }
  
  let level: "low" | "medium" | "high" = "low";
  if (reasons.length >= 3) {
    level = "high";
  } else if (reasons.length >= 1) {
    level = "medium";
  }
  
  const suggestedFix = level === "high"
    ? "Redirecionar imediatamente com pergunta direta e CTA"
    : level === "medium"
      ? "Aumentar condução e adicionar CTA claro"
      : "Manter estratégia atual";

  return { level, reasons, suggestedFix };
}

export function applyAntiExplorationControl(
  response: string,
  state: ConversationState,
  context: ConversationContext,
  analysis: MessageAnalysis
): string {
  const risk = detectExplorationRisk(response, state, context.messageCount);
  
  if (risk.level === "low") {
    return response;
  }
  
  const redirectKeyword = REDIRECT_KEYWORDS[state][0] || "então";
  
  if (analysis.needsContext && state === "DISCOVERY") {
    const redirectQuestions = [
      "Para te ajudar melhor, me conta: qual é o objetivo dessa busca?",
      "Entendi! Para encontrar o que funciona para você, preciso saber:",
      "Que legal! Para te guiar no caminho certo:",
    ];
    
    return redirectQuestions[context.messageCount % redirectQuestions.length];
  }
  
  if (state === "LOOK_RECOMMENDATION") {
    const conducts = [
      "Essa é a melhor opção para você. Quer que eu avance?",
      "Com base no seu perfil, essa proposta é ideal. Seguimos?",
      "Considerando seu estilo, esse é o caminho. Posso ajudar a garantir?",
    ];
    
    return conducts[context.messageCount % conducts.length];
  }
  
  if (state === "CATALOG_ASSISTED" && context.viewedProducts.length === 0) {
    return "Das opções que tenho, essas são as mais indicadas para seu perfil. Quer ver detalhes de alguma?";
  }
  
  return response;
}

export function enforceConduction(
  response: string,
  state: ConversationState,
  strategy: ResponseStrategy
): string {
  const prohibitedPatterns = PROHIBITED_PATTERNS_PER_STATE[state];
  
  for (const pattern of prohibitedPatterns) {
    if (response.toLowerCase().includes(pattern)) {
      const index = response.toLowerCase().indexOf(pattern);
      const before = response.slice(0, index);
      const after = response.slice(index + pattern.length);
      
      const redirect = REDIRECT_KEYWORDS[state][0] || "Então";
      return `${before}${redirect}${after}`;
    }
  }
  
  if (!strategy.shouldAskQuestion && state !== "CLOSING" && state !== "POST_PURCHASE") {
    const hasCTA = strategy.ctaText && response.toLowerCase().includes(strategy.ctaText.toLowerCase());
    if (!hasCTA && strategy.cta !== "none") {
      return `${response} ${strategy.ctaText || ""}`.trim();
    }
  }
  
  return response;
}

export function ensureNoGenericResponse(
  response: string,
  context: ConversationContext,
  memory: { styleIdentity?: string; imageGoal?: string } | null
): string {
  const genericPhrases = [
    "como posso ajudar",
    "em que posso ajudar",
    "o que você procura",
    "o que você precisa",
    "posso ajudar com",
    "estou à disposição",
    "meu prazer",
    "qualquer dúvida",
  ];
  
  const isGeneric = genericPhrases.some((phrase) =>
    response.toLowerCase().includes(phrase)
  );
  
  if (isGeneric && context.messageCount > 1) {
    if (memory?.styleIdentity && memory?.imageGoal) {
      return `Entendi! Considerando seu estilo ${memory.styleIdentity} e seu objetivo ${memory.imageGoal}, ${response.slice(response.indexOf(",") + 1).trim()}`;
    }
    
    return "Para te ajudar melhor, preciso entender melhor o que você procura. Me conta:";
  }
  
  return response;
}

export function validateResponseQuality(
  response: string,
  state: ConversationState,
  strategy: ResponseStrategy
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (response.length < 10 && state !== "CLOSING") {
    issues.push("Resposta muito curta");
  }
  
  if (response.length > strategy.maxLength * 1.5) {
    issues.push(`Resposta excede limite recomendado de ${strategy.maxLength} caracteres`);
  }
  
  const prohibitedPatterns = PROHIBITED_PATTERNS_PER_STATE[state];
  const hasProhibited = prohibitedPatterns.some((pattern) =>
    response.toLowerCase().includes(pattern)
  );
  
  if (hasProhibited) {
    issues.push(`Contém padrões proibidos para estado ${state}`);
  }
  
  if (strategy.cta === "none" && state !== "CLOSING" && state !== "POST_PURCHASE") {
    issues.push("Sem CTA definido para estado que requer condução");
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}
