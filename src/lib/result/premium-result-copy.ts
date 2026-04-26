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

function normalizeText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (SENSITIVE_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed || fallback;
}

export function buildPremiumResultPresentationModel(
  input: PremiumResultPresentationInput,
): PremiumResultPresentationModel {
  const { experienceState } = input;
  const signatureName = normalizeText(input.signatureName, DEFAULT_SIGNATURE);
  const storeName = normalizeText(input.storeName, "a loja");
  const hasLooks = Boolean(input.hasLooks);
  const catalogIsInsufficient = experienceState.curation === "insufficient_catalog";
  const hasConsultiveFallback = experienceState.overallStatus === "fallback_consultive";

  return {
    hero: {
      eyebrow: "Assinatura visual",
      badge: catalogIsInsufficient ? "Curadoria parcial" : "Leitura + curadoria",
      title: signatureName,
      subtitle: "Uma leitura de estilo criada para orientar escolhas reais, com curadoria compravel e continuidade consultiva.",
      helper: `A Venus traduz sua direcao visual em criterios de compra e prepara o atendimento com ${storeName}.`,
    },
    analysis: {
      visible: experienceState.uiFlags.showPremiumAnalysis,
      eyebrow: "Leitura de estilo",
      title: "Sua assinatura visual",
      subtitle: "A analise organiza intencao, cores, caimento e composicao sem julgamento corporal.",
    },
    curation: {
      visible: experienceState.uiFlags.showCuration || experienceState.uiFlags.showCatalogFallback,
      eyebrow: hasLooks ? "Curadoria com pecas da loja" : "Curadoria em refinamento",
      title: hasLooks ? "Pecas reais para transformar a leitura em look" : "Ainda falta catalogo para fechar o look completo",
      subtitle: hasLooks
        ? "Cada item entra com uma funcao na composicao: base, presenca, equilibrio ou acabamento."
        : "A leitura segue util, e o WhatsApp pode ajudar a loja a sugerir uma alternativa de estoque.",
      fallbackTitle: "Catalogo curto para esta assinatura visual",
      fallbackBody:
        "Encontrei parte da direcao, mas ainda falta variedade suficiente para completar a curadoria com o mesmo criterio. O atendimento consultivo pode ajustar estoque, tamanho e alternativas.",
      reinforcement: [
        "Funcao clara no look",
        "Cores e caimentos orientados",
        "Curadoria compravel da loja",
      ],
    },
    whatsapp: {
      visible: experienceState.uiFlags.showWhatsAppCta,
      eyebrow: hasConsultiveFallback ? "Atendimento consultivo" : "Continuar com contexto",
      title: `Leve esta curadoria para ${storeName}`,
      subtitle: "A conversa no WhatsApp ja parte da sua assinatura visual, da ocasiao e das pecas selecionadas.",
      cta: "Conversar com a stylist da loja",
    },
    share: {
      visible: experienceState.uiFlags.showShareCard,
      eyebrow: "Artefato compartilhavel",
      title: "Compartilhe sua assinatura visual",
      subtitle: "O card mostra a leitura de forma social, sem expor diagnostico completo por padrao.",
    },
    tryOn: {
      visible: experienceState.uiFlags.showTryOn,
      eyebrow: "Provador virtual em beta",
      title: "Previa visual opcional",
      subtitle: "O provador virtual aparece apenas quando a previa esta confiavel para apoiar a composicao.",
      unavailableCopy: "A visualizacao no corpo nao esta disponivel agora. A curadoria segue pronta com base na leitura visual e nas pecas reais.",
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
