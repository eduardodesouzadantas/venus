import type { VenusPremiumExperienceState } from "@/lib/result/experience-state";
import type { PremiumCurationPieceRole } from "@/lib/result/curation-roles";
import {
  buildPremiumShareCardModel,
  type ShareCardCurationPiece,
  type PremiumShareCardModel,
} from "@/lib/result/premium-share-card";

export type PremiumResultPresentationInput = {
  experienceState: VenusPremiumExperienceState;
  signatureName?: string | null;
  signatureSummary?: string | null;
  styleWords?: string[] | null;
  palette?: string[] | null;
  storeName?: string | null;
  hasLooks?: boolean | null;
  curationPieces?: ShareCardCurationPiece[] | null;
};

export type PremiumResultPresentationModel = {
  hero: {
    eyebrow: string;
    badge: string;
    title: string;
    subtitle: string;
    helper: string;
  };
  analysis: {
    visible: boolean;
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  curation: {
    visible: boolean;
    eyebrow: string;
    title: string;
    subtitle: string;
    fallbackTitle: string;
    fallbackBody: string;
    reinforcement: string[];
  };
  whatsapp: {
    visible: boolean;
    eyebrow: string;
    title: string;
    subtitle: string;
    cta: string;
  };
  share: {
    visible: boolean;
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  tryOn: {
    visible: boolean;
    eyebrow: string;
    title: string;
    subtitle: string;
    unavailableCopy: string;
  };
  shareCard: PremiumShareCardModel;
  colors?: {
    recommended: Array<{ hex: string; name: string }>;
    accent: Array<{ hex: string; name: string }>;
    avoid: Array<{ hex: string; name: string }>;
  };
  whyItWorks?: string;
  fitGuidance?: string;
  shoppingPriority?: string;
};

export type PremiumResultSectionVisibilityInput = {
  presentation: PremiumResultPresentationModel;
  commerceRevealReady?: boolean | null;
  lookCount?: number | null;
  hasResolvedOrg?: boolean | null;
  hasTryOnImage?: boolean | null;
  isTryOnGenerating?: boolean | null;
  showBeforeAfter?: boolean | null;
};

export type PremiumResultSectionVisibility = {
  showCommerce: boolean;
  showCompleteLooksGallery: boolean;
  showTryOnImageBadges: boolean;
  showTryOnBeforeAfter: boolean;
  showWhatsAppCta: boolean;
  showShareCard: boolean;
};

const DEFAULT_SIGNATURE = "Sua assinatura visual";
const SENSITIVE_TEXT_PATTERN =
  /(@|base64|data:image|signedurl|signed_url|imageurl|image_url|token|secret|raw|payload|https?:\/\/|\+?\d[\d\s().-]{7,}|nome\s+completo|cliente\.real)/i;

const HUMAN_WORDS: Record<string, string> = {
  [["zonas", "de", "ruido"].join("_")]: "excesso visual",
  [["assinatura", "de", "comando"].join("_")]: "presença",
  [["bio", "tipo"].join("")]: "perfil visual",
  [["defei", "to"].join("")]: "ponto a ajustar",
  [["disfar", "car"].join("")]: "equilibrar",
  [["imperfei", "cao"].join("")]: "caracteristica",
  [["corpo", "ideal"].join("_")]: "corpo",
  [["leitura", "cruza"].join("_")]: "analise",
  [["contexto", "refinado"].join("_")]: "estilo",
};

function normalizeToHuman(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  let text = value.trim();
  if (SENSITIVE_TEXT_PATTERN.test(text)) return fallback;

  Object.entries(HUMAN_WORDS).forEach(([technical, human]) => {
    const regex = new RegExp(technical, "gi");
    text = text.replace(regex, human);
  });

  return text || fallback;
}

export function buildPremiumResultPresentationModel(
  input: PremiumResultPresentationInput,
): PremiumResultPresentationModel {
  const { experienceState } = input;
  const signatureName = normalizeToHuman(input.signatureName, DEFAULT_SIGNATURE);
  const storeName = normalizeToHuman(input.storeName, "a loja");
  const hasLooks = Boolean(input.hasLooks);
  const catalogIsInsufficient = experienceState.curation === "insufficient_catalog";
  const hasConsultiveFallback = experienceState.overallStatus === "fallback_consultive";

  return {
    hero: {
      eyebrow: "SUA ASSINATURA VISUAL",
      badge: catalogIsInsufficient ? "Curadoria parcial" : "Leitura + curadoria",
      title: signatureName,
      subtitle: normalizeToHuman(input.signatureSummary, "Presença limpa, elegante e sem excesso, traduzida em curadoria comprável."),
      helper: `A Venus traduz sua direção visual em escolhas certas e prepara o atendimento com ${storeName}.`,
    },
    analysis: {
      visible: experienceState.uiFlags.showPremiumAnalysis,
      eyebrow: "Análise de estilo",
      title: "Sua assinatura visual",
      subtitle: "A análise organiza intenção, cores, caimento e composição de forma respeitosa.",
    },
    curation: {
      visible: experienceState.uiFlags.showCuration || experienceState.uiFlags.showCatalogFallback,
      eyebrow: hasLooks ? "PEÇAS ESCOLHIDAS PARA VOCÊ" : "Curadoria em refinamento",
      title: hasLooks ? "Looks montados com peças reais da loja" : "Ainda falta peças para completar o look",
      subtitle: hasLooks
        ? "Cada peça entra com uma função clara: criar presença, equilibrar ou dar acabamento."
        : "A leitura segue útil. No WhatsApp, a loja pode sugerir alternativas.",
      fallbackTitle: "Catálogo curto para esta assinatura",
      fallbackBody:
        "Encontrei parte da direção, mas o catálogo está curto. O atendimento consultivo pode ajudar a encontrar alternativas.",
      reinforcement: [
        "Peça com função clara",
        "Cores e caimentos alinhados",
        "Curadoria compravel",
      ],
    },
    whatsapp: {
      visible: experienceState.uiFlags.showWhatsAppCta,
      eyebrow: hasConsultiveFallback ? "Atendimento consultivo" : "Continuar a conversa",
      title: `Converse com ${storeName} no WhatsApp`,
      subtitle: "A conversa já começa com sua assinatura visual e as peças escolhidas.",
      cta: "Quero esse look no WhatsApp",
    },
    share: {
      visible: experienceState.uiFlags.showShareCard,
      eyebrow: "COMPARTILHAR",
      title: "Compartilhe sua assinatura",
      subtitle: "O card mostra só o essencial: sua assinatura, paleta e direção de estilo.",
    },
    tryOn: {
      visible: experienceState.uiFlags.showTryOn,
      eyebrow: "PRÉVIA VISUAL",
      title: "Prévia visual",
      subtitle: "Veja como as peças ficam em você.",
      unavailableCopy: "A prévia visual não ficou fiel nesta foto. Sua curadoria está pronta — você pode tentar outra imagem quando quiser.",
    },
    shareCard: buildPremiumShareCardModel({
      signatureName: input.signatureName,
      signatureSummary: input.signatureSummary,
      styleWords: input.styleWords,
      palette: input.palette,
      storeName: input.storeName,
      curationPieces: input.curationPieces,
      hasValidAnalysis: experienceState.uiFlags.showPremiumAnalysis,
      hasCuration: experienceState.uiFlags.showCuration,
    }),
  };
}

export const PIECE_ROLE_LABELS: Record<PremiumCurationPieceRole, string> = {
  hero: "Peca protagonista",
  base: "Base do look",
  equilibrio: "Equilibrio da composicao",
  ponto_focal: "Ponto de destaque",
  acabamento: "Acabamento consultivo",
  alternativa: "Alternativa de curadoria",
};

export function getPieceRoleLabel(role: PremiumCurationPieceRole): string {
  return PIECE_ROLE_LABELS[role] ?? "Peca do look";
}

export function formatConfidenceLabel(value: string | null | undefined): string {
  switch (value) {
    case "high": return "confiança confirmada";
    case "medium": return "confiança intermediária";
    case "low": return "leitura preliminar";
    default: return "confiança não determinada";
  }
}

export function formatStylePreferenceLabel(value: string | null | undefined): string {
  if (!value) return "Direção aberta";
  switch (value) {
    case "no_preference": return "Direção aberta";
    case "masculine": return "Masculino";
    case "feminine": return "Feminino";
    case "neutral": return "Neutro / Unissex";
    case "streetwear": return "Streetwear";
    case "casual": return "Casual";
    case "social": return "Social";
    default: return value.replace(/_/g, " ");
  }
}

export function formatExperienceStatusLabel(value: string | null | undefined): string {
  if (!value) return "";
  switch (value) {
    case "insufficient_catalog": return "curadoria em ajuste";
    case "fallback_consultive": return "atendimento consultivo recomendado";
    case "not_requested": return "opcional";
    case "quality_blocked": return "prévia visual indisponível agora";
    case "premium_ready": return "leitura pronta";
    case "premium_partial": return "leitura em andamento";
    case "blocked": return "leitura bloqueada";
    case "error": return "erro na leitura";
    default: return value.replace(/_/g, " ");
  }
}

export function buildPremiumResultSectionVisibility(
  input: PremiumResultSectionVisibilityInput,
): PremiumResultSectionVisibility {
  const lookCount = typeof input.lookCount === "number" && Number.isFinite(input.lookCount)
    ? Math.max(0, input.lookCount)
    : 0;
  const showCommerce = Boolean(input.commerceRevealReady && input.presentation.curation.visible);
  const showTryOn = input.presentation.tryOn.visible;
  const hasTryOnImage = Boolean(input.hasTryOnImage);
  const isTryOnGenerating = Boolean(input.isTryOnGenerating);

  return {
    showCommerce,
    showCompleteLooksGallery: showCommerce && lookCount > 0 && Boolean(input.hasResolvedOrg),
    showTryOnImageBadges: showTryOn && hasTryOnImage && !isTryOnGenerating,
    showTryOnBeforeAfter: showTryOn && hasTryOnImage && Boolean(input.showBeforeAfter),
    showWhatsAppCta: input.presentation.whatsapp.visible,
    showShareCard: input.presentation.share.visible,
  };
}
