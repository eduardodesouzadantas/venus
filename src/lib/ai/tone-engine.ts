import "server-only";

import type {
  ConversationState,
  ResponseTone,
  ConversationContext,
  MessageAnalysis,
  UserMemory,
} from "./conversation-engine-types";

export interface ToneProfile {
  greetingPrefix: string;
  tone: ResponseTone;
  maxLength: number;
  explanationDensity: "minimal" | "moderate" | "detailed";
  persuasionLevel: "minimal" | "soft" | "moderate" | "high";
  ctaStyle: "open_question" | "invitation" | "direct_statement";
  emotionalTone: "neutral" | "warm" | "enthusiastic" | "calm";
  validationFocus: "choice" | "aesthetic" | "confidence" | "value";
}

export interface BrandVoiceConfig {
  vocabulary: {
    preferred: string[];
    avoided: string[];
    replacements: Record<string, string>;
  };
  formality: "casual" | "friendly" | "formal";
  intensity: "subtle" | "moderate" | "assertive";
}

const TONE_PROFILES: Record<ConversationState, ToneProfile> = {
  DISCOVERY: {
    greetingPrefix: "Que bom ter você aqui!",
    tone: "friendly",
    maxLength: 180,
    explanationDensity: "minimal",
    persuasionLevel: "minimal",
    ctaStyle: "open_question",
    emotionalTone: "warm",
    validationFocus: "choice",
  },
  STYLE_ANALYSIS: {
    greetingPrefix: "Entendi!",
    tone: "consultive",
    maxLength: 250,
    explanationDensity: "moderate",
    persuasionLevel: "soft",
    ctaStyle: "invitation",
    emotionalTone: "warm",
    validationFocus: "aesthetic",
  },
  TRY_ON_GUIDED: {
    greetingPrefix: "Que interessante!",
    tone: "consultive",
    maxLength: 220,
    explanationDensity: "moderate",
    persuasionLevel: "soft",
    ctaStyle: "invitation",
    emotionalTone: "enthusiastic",
    validationFocus: "aesthetic",
  },
  LOOK_RECOMMENDATION: {
    greetingPrefix: "Olha quelook!",
    tone: "consultive",
    maxLength: 300,
    explanationDensity: "detailed",
    persuasionLevel: "moderate",
    ctaStyle: "invitation",
    emotionalTone: "enthusiastic",
    validationFocus: "confidence",
  },
  CATALOG_ASSISTED: {
    greetingPrefix: "Encontrei!",
    tone: "direct",
    maxLength: 250,
    explanationDensity: "moderate",
    persuasionLevel: "moderate",
    ctaStyle: "direct_statement",
    emotionalTone: "calm",
    validationFocus: "value",
  },
  CLOSING: {
    greetingPrefix: "Perfeito!",
    tone: "direct",
    maxLength: 150,
    explanationDensity: "minimal",
    persuasionLevel: "high",
    ctaStyle: "direct_statement",
    emotionalTone: "calm",
    validationFocus: "value",
  },
  POST_PURCHASE: {
    greetingPrefix: "Parabéns!",
    tone: "friendly",
    maxLength: 200,
    explanationDensity: "minimal",
    persuasionLevel: "minimal",
    ctaStyle: "open_question",
    emotionalTone: "warm",
    validationFocus: "choice",
  },
  REENGAGEMENT: {
    greetingPrefix: "Que bom que você voltou!",
    tone: "consultive",
    maxLength: 180,
    explanationDensity: "minimal",
    persuasionLevel: "soft",
    ctaStyle: "invitation",
    emotionalTone: "warm",
    validationFocus: "choice",
  },
};

const VOICE_CONFIGS: Record<string, BrandVoiceConfig> = {
  default: {
    vocabulary: {
      preferred: ["perfeito", "ideal", "ótimo", "funciona", "combina"],
      avoided: ["produto", "item", "articulo"],
      replacements: {
        "produto": "peça",
        "comprar": "garantir",
        "compra": "escolha",
        "preço": "valor",
        "mais barato": "melhor custo-benefício",
      },
    },
    formality: "friendly",
    intensity: "moderate",
  },
  premium: {
    vocabulary: {
      preferred: ["exclusivo", "sofisticação", "elegância", "cuidado", "artesanal"],
      avoided: ["barato", "promoção", "desconto"],
      replacements: {
        "produto": "peça",
        "comprar": "adquirir",
        "loja": "atelier",
        "preço": "investimento",
      },
    },
    formality: "formal",
    intensity: "subtle",
  },
  casual: {
    vocabulary: {
      preferred: ["demais", "show", "loko", "ficou", "maravilhoso"],
      avoided: ["adquirir", "arte"],
      replacements: {
        "peça": "look",
        "garantir": "levar",
      },
    },
    formality: "casual",
    intensity: "moderate",
  },
  professional: {
    vocabulary: {
      preferred: ["solução", "indicado", "recomendação", "opção"],
      avoided: ["loko", "demais"],
      replacements: {
        "peça": "produto",
        "look": "conjunto",
      },
    },
    formality: "formal",
    intensity: "assertive",
  },
};

export function getToneProfile(state: ConversationState): ToneProfile {
  return TONE_PROFILES[state];
}

export function adaptToneForMessageCount(
  profile: ToneProfile,
  messageCount: number,
  context: ConversationContext
): ToneProfile {
  if (context.currentState !== "DISCOVERY") {
    return profile;
  }

  if (messageCount > 4 && profile.persuasionLevel === "minimal") {
    return {
      ...profile,
      persuasionLevel: "soft",
      ctaStyle: "invitation",
    };
  }

  return profile;
}

export function adaptToneForMemory(
  profile: ToneProfile,
  memory: UserMemory | null
): ToneProfile {
  if (!memory || !memory.styleIdentity) {
    return profile;
  }

  if (memory.conversationCount > 2) {
    return {
      ...profile,
      tone: "consultive",
      emotionalTone: "warm",
    };
  }

  return profile;
}

export function adaptToneForSentiment(
  profile: ToneProfile,
  sentiment: MessageAnalysis["sentiment"]
): ToneProfile {
  if (sentiment === "positive") {
    return {
      ...profile,
      emotionalTone: "enthusiastic" as const,
      persuasionLevel: profile.persuasionLevel === "minimal" ? "soft" : profile.persuasionLevel,
    };
  }

  if (sentiment === "negative") {
    return {
      ...profile,
      emotionalTone: "warm" as const,
      ctaStyle: "open_question",
    };
  }

  return profile;
}

export function getBrandVoice(brandType: string): BrandVoiceConfig {
  return VOICE_CONFIGS[brandType] || VOICE_CONFIGS.default;
}

export function adaptVocabularyWithBrand(
  text: string,
  brandVoice: BrandVoiceConfig
): string {
  let adapted = text;

  for (const [avoided, preferred] of Object.entries(brandVoice.vocabulary.replacements)) {
    const regex = new RegExp(avoided, "gi");
    adapted = adapted.replace(regex, preferred);
  }

  return adapted;
}

export function applyVoiceIntensity(
  text: string,
  intensity: "subtle" | "moderate" | "assertive"
): string {
  if (intensity === "subtle") {
    return text
      .replace(/\bmuito\b/g, "um pouco")
      .replace(/\bsuper\b/g, "bem")
      .replace(/\bincrível\b/g, "ótimo");
  }

  if (intensity === "assertive") {
    return text
      .replace(/\bumm\b/g, "")
      .replace(/\bcomo\b/g, "")
      .replace(/\bserá que\b/g, "vai");
  }

  return text;
}

export function applyFormality(
  text: string,
  formality: "casual" | "friendly" | "formal"
): string {
  if (formality === "formal") {
    return text
      .replace(/\bQueria\b/g, "Gostaria")
      .replace(/\bqueria\b/g, "gostaria")
      .replace(/\bpode\b/g, "consegue");
  }

  if (formality === "casual") {
    return text
      .replace(/\bgostaria\b/g, "queria")
      .replace(/\bconseguir\b/g, "poder")
      .replace(/\bnecessário\b/g, "precisa");
  }

  return text;
}

export function refineResponse(
  response: string,
  state: ConversationState,
  context: ConversationContext,
  analysis: MessageAnalysis,
  memory: UserMemory | null,
  brandType: string = "default"
): string {
  let profile = getToneProfile(state);
  profile = adaptToneForMessageCount(profile, context.messageCount, context);
  profile = adaptToneForMemory(profile, memory);
  profile = adaptToneForSentiment(profile, analysis.sentiment);

  const brandVoice = getBrandVoice(brandType);
  let refined = adaptVocabularyWithBrand(response, brandVoice);
  refined = applyFormality(refined, brandVoice.formality);
  refined = applyVoiceIntensity(refined, brandVoice.intensity);

  if (refined.length > profile.maxLength) {
    const sentences = refined.split(/(?<=[.!?])\s+/);
    refined = sentences[0];
    if (sentences.length > 1) {
      const cta = getDefaultCTA(profile.ctaStyle, profile.tone);
      refined = `${refined.trim()} ${cta}`;
    }
  }

  return refined;
}

function getDefaultCTA(
  ctaStyle: ToneProfile["ctaStyle"],
  tone: ResponseTone
): string {
  switch (ctaStyle) {
    case "open_question":
      return tone === "friendly" ? "Me conta!" : "O que você achou?";
    case "invitation":
      return "Quer ver mais?";
    case "direct_statement":
      return "Vamos seguir?";
  }
}

export function getToneConfigSummary():Record<string, {tone: ResponseTone, maxLength: number}> {
  const summary: Record<string, {tone: ResponseTone, maxLength: number}> = {};
  for (const [state, profile] of Object.entries(TONE_PROFILES)) {
    summary[state] = { tone: profile.tone, maxLength: profile.maxLength };
  }
  return summary;
}