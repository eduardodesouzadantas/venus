import type { OnboardingData } from "@/types/onboarding";
import type { ResultSurface } from "@/lib/result/surface";
import type { DecisionResult } from "@/lib/decision-engine/types";
import type { TryOnQualityAssessment } from "@/lib/tryon/result-quality";
import { buildVenusResultNarrative, buildVenusWhatsAppLeadIn, VENUS_STYLIST_NAME } from "@/lib/venus/brand";
import { normalizeConsultationProfile } from "@/lib/consultation-profile";

type NormalizedLookCard = {
  id: string;
  productId: string;
  name: string;
  type: string;
  explanation: string;
  whenToWear: string;
  reason: string;
  price?: string;
  brand?: string;
  photoUrl?: string | null;
  itemName?: string;
  itemPhotoUrl?: string | null;
  itemPrice?: string;
};

export type VenusStylistAudit = {
  opening: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  diagnosis: {
    strengths: string[];
    blockers: string[];
    hiddenPotential: string;
    stopReinforcing: string[];
    amplify: string[];
    positioning: string;
    buyingGuidance: string;
  };
  direction: {
    eyebrow: string;
    title: string;
    subtitle: string;
    bullets: string[];
    realWorldImpression: string;
  };
  tryOn: {
    eyebrow: string;
    title: string;
    subtitle: string;
    helper: string;
  };
  buyNow: {
    eyebrow: string;
    title: string;
    subtitle: string;
    looks: NormalizedLookCard[];
    emptyState: string;
  };
  whatsapp: {
    eyebrow: string;
    title: string;
    subtitle: string;
    cta: string;
    leadIn: string;
  };
  social: {
    eyebrow: string;
    title: string;
    subtitle: string;
    prompt: string;
  };
  report: {
    sections: Array<{
      eyebrow: string;
      title: string;
      body: string;
      bullets: string[];
    }>;
  };
};

type BuildVenusStylistAuditInput = {
  surface: ResultSurface;
  tryOnQuality: TryOnQualityAssessment;
  onboardingData?: OnboardingData | null;
  contactName?: string | null;
  decision?: DecisionResult | null;
  resultId?: string | null;
  orgName?: string | null;
};

const normalizeText = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");
const TECHNICAL_REASON_CODES = new Set([
  "INVALID_OUTFIT_COMPOSITION",
  "SAME_SLOT_CONFLICT",
  "INVALID_HERO_SLOT",
  "PROFILE_DIRECTION_CONFLICT",
  "CONTEXT_FORMALITY_CONFLICT",
]);
const CURATION_FALLBACK_MESSAGE =
  "Ainda não tenho uma composição completa forte o suficiente. Posso refinar com uma nova foto ou levar essa leitura para o WhatsApp.";

function publicReason(value: unknown): string {
  const text = normalizeText(value);
  return TECHNICAL_REASON_CODES.has(text) ? CURATION_FALLBACK_MESSAGE : text;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function compactSentence(value: string) {
  return normalizeText(value).replace(/[.?!\s]+$/, "");
}

function joinPieces(values: Array<string | null | undefined>) {
  return uniqueStrings(values).join(" • ");
}

function collectBuyNowLooks(surface: ResultSurface): NormalizedLookCard[] {
  const cards: NormalizedLookCard[] = [];

  for (const look of surface.looks || []) {
    const productId = normalizeText(look.product_id);
    if (!productId) continue;

    const firstItem = look.items?.find((item) => normalizeText(item.product_id)) || look.items?.[0];
    cards.push({
      id: look.id,
      productId,
      name: normalizeText(look.name) || "Look curado",
      type: normalizeText(look.type) || "Expansão Direcionada",
      explanation: normalizeText(look.explanation),
      whenToWear: normalizeText(look.whenToWear),
      reason: compactSentence(
        joinPieces([
          look.explanation,
          look.whenToWear,
          firstItem?.conversionCopy,
          firstItem?.impactLine,
        ]),
      ),
      price: normalizeText(look.bundlePrice) || undefined,
      photoUrl: firstItem?.photoUrl || look.tryOnUrl || null,
      brand: firstItem?.brand || undefined,
      itemName: normalizeText(firstItem?.name) || undefined,
      itemPhotoUrl: firstItem?.photoUrl || null,
      itemPrice: normalizeText(firstItem?.price) || undefined,
    });
  }

  return cards;
}

export function buildVenusStylistAudit({
  surface,
  tryOnQuality,
  onboardingData,
  contactName,
  decision,
  resultId,
  orgName,
}: BuildVenusStylistAuditInput): VenusStylistAudit {
  const consultation = normalizeConsultationProfile(onboardingData?.consultation);
  const narrative = buildVenusResultNarrative({
    state: tryOnQuality.state,
    reason: tryOnQuality.reason,
    hasArtifact: tryOnQuality.showBeforeAfter || tryOnQuality.showWhatsappCta,
    hasLegacy: surface.looks.length > 0 && surface.looks.every((look) => !normalizeText(look.product_id)),
    styleDirection: onboardingData?.intent?.styleDirection || null,
  });

  const topLook = surface.looks[0] || null;
  const topLookName = normalizeText(topLook?.name) || surface.lookHierarchy[0]?.title || "seu look principal";
  const buyNowLooks = collectBuyNowLooks(surface);
  const hasRenderableLook = Boolean(surface.looks[0]?.product_id && surface.looks[0]?.items?.length);
  const onboardingGoal = normalizeText(onboardingData?.intent?.imageGoal);
  const onboardingStyle = normalizeText(onboardingData?.intent?.styleDirection);
  const perception = normalizeText(consultation.desiredPerception) || onboardingGoal || surface.essence.label;
  const occasion = normalizeText(consultation.occasion) || "contexto principal";
  const strengths = uniqueStrings([
    surface.essence.summary,
    surface.palette.description,
    surface.bodyVisagism.generalFit,
    surface.diagnostic.desiredGoal,
  ]);
  const blockers = uniqueStrings(surface.toAvoid.slice(0, 3));
  const amplify = uniqueStrings([
    surface.lookHierarchy[0]?.description,
    surface.lookHierarchy[1]?.description,
    surface.lookHierarchy[2]?.description,
  ]);
  const paletteBase = surface.palette.evidence.basePalette.slice(0, 3).map((entry) => `${entry.name}: ${entry.reason}`);
  const paletteAccent = surface.palette.evidence.accentPalette.slice(0, 3).map((entry) => `${entry.name}: ${entry.reason}`);
  const paletteCaution = surface.palette.evidence.avoidOrUseCarefully.slice(0, 3).map((entry) => `${entry.name}: ${entry.reason}`);

  const openingTitle =
    tryOnQuality.state === "hero"
      ? narrative.title
      : tryOnQuality.state === "preview"
        ? "A leitura está muito perto do ponto ideal."
        : "Essa leitura pede uma nova foto.";

  const openingSubtitle =
    tryOnQuality.state === "hero"
      ? narrative.subtitle
      : tryOnQuality.state === "preview"
        ? "A Venus já encontrou uma direção sólida. Falta só lapidar a presença para virar vitrine final."
        : narrative.subtitle;

  const directionTitle = surface.lookHierarchy[0]?.title || surface.hero.dominantStyle || "Direção curada";

  const tryOnSubtitle =
    tryOnQuality.state === "hero"
      ? "O try-on já funciona como payoff: imagem, antes/depois e leitura de valor no mesmo frame."
      : tryOnQuality.state === "preview"
        ? "A imagem já comunica direção, mas ainda pede um ajuste fino para assumir o papel de hero."
        : "A curva ainda não fechou o suficiente para vitrine premium.";

  const whatsappLeadIn = buildVenusWhatsAppLeadIn({
    contactName,
    state: tryOnQuality.state,
    lookName: topLookName,
  });

  const contextualCta =
    tryOnQuality.state === "hero"
      ? "Continuar com minha stylist"
      : tryOnQuality.state === "preview"
        ? "Refinar com Venus Stylist"
        : "Ver minha curadoria";

  return {
    opening: {
      eyebrow: narrative.eyebrow,
      title: openingTitle,
      subtitle: openingSubtitle,
    },
    diagnosis: {
      strengths: strengths.length > 0 ? strengths : [surface.desirePulse.body],
      blockers: blockers.length > 0 ? blockers : ["A leitura ainda pede lapidação antes de virar hero."],
      hiddenPotential: surface.desirePulse.body,
      stopReinforcing: surface.toAvoid.slice(0, 3),
      amplify: amplify.length > 0 ? amplify : surface.lookHierarchy.map((item) => item.description).filter(Boolean),
      positioning: onboardingGoal
        ? `Seu eixo de imagem hoje é ${surface.essence.label.toLowerCase()}, com foco em ${onboardingGoal.toLowerCase()}.`
        : `Seu eixo de imagem hoje é ${surface.essence.label.toLowerCase()}.`,
      buyingGuidance: compactSentence(
        joinPieces([
          surface.diagnostic.gapSolution,
          onboardingStyle ? `Leitura conectada à direção ${onboardingStyle.toLowerCase()}.` : null,
        ]),
      ),
    },
    direction: {
      eyebrow: "Direção curada",
      title: directionTitle,
      subtitle: compactSentence(surface.diagnostic.desiredGoal),
      bullets: surface.lookHierarchy.map((entry) => `${entry.label}: ${entry.title}`),
      realWorldImpression: compactSentence(surface.diagnostic.currentPerception),
    },
    tryOn: {
      eyebrow: tryOnQuality.badgeLabel,
      title:
        tryOnQuality.state === "hero"
          ? "O payoff já está pronto."
          : tryOnQuality.state === "preview"
            ? "A imagem está muito perto do ponto ideal."
            : "A leitura ainda não fechou para vitrine premium.",
      subtitle: tryOnSubtitle,
      helper: publicReason(tryOnQuality.reason) || CURATION_FALLBACK_MESSAGE,
    },
    buyNow: {
      eyebrow: "O que comprar agora",
      title: "Peças da sua loja, priorizadas pela leitura",
      subtitle:
        buyNowLooks.length > 0
          ? "Cada peça abaixo pertence ao catálogo da loja ligada a esta sessão."
          : "Ainda não há peças validadas o suficiente para vitrine premium nesta leitura.",
      looks: buyNowLooks.slice(0, 3),
      emptyState: "A Venus ainda não encontrou peças validadas o suficiente para destacar nesta leitura.",
    },
    whatsapp: {
      eyebrow: "Continuação natural",
      title: `Continuar com ${VENUS_STYLIST_NAME}`,
      subtitle:
        tryOnQuality.state === "hero"
          ? "A conversa segue com a mesma leitura, agora com contexto de compra e refinamento."
          : "A conversa segue com a mesma leitura, sem começar do zero.",
      cta: contextualCta,
      leadIn: [whatsappLeadIn, decision?.reason, resultId ? `Resultado ${resultId}` : null, orgName ? `Loja ${orgName}` : null]
        .filter(Boolean)
        .join("\n"),
    },
    social: {
      eyebrow: "Momento de postar",
      title: "Transforme a leitura em prova social",
      subtitle: "A Venus ganha força quando a imagem sai da tela e vira presença pública.",
      prompt: orgName
        ? `Se quiser, registre o post para manter a memória da leitura viva na próxima conversa da ${orgName}.`
        : "Se quiser, registre o post para manter a memória da leitura viva na próxima conversa.",
    },
    report: {
      sections: [
        {
          eyebrow: "Essência de estilo",
          title: surface.essence.label,
          body: compactSentence(
            joinPieces([
              surface.essence.summary,
              onboardingStyle ? `Direção explícita: ${onboardingStyle}.` : null,
              consultation.aestheticVibe ? `Vibe: ${consultation.aestheticVibe}.` : null,
            ]),
          ),
          bullets: uniqueStrings([
            surface.essence.keySignals[0],
            surface.essence.keySignals[1],
            consultation.desiredPerception,
          ]).slice(0, 3),
        },
        {
          eyebrow: "Leitura visual",
          title: "O que a imagem sustenta hoje",
          body: compactSentence(
            joinPieces([
              surface.diagnostic.currentPerception,
              surface.bodyVisagism.generalFit,
              consultation.bodyFocus ? `Foco corporal: ${consultation.bodyFocus}.` : null,
            ]),
          ),
          bullets: uniqueStrings([
            surface.bodyVisagism.shoulders,
            surface.bodyVisagism.face,
            surface.bodyVisagism.generalFit,
          ]).slice(0, 3),
        },
        {
          eyebrow: "Cores base / acentos / cautela",
          title: surface.palette.family,
          body: compactSentence(surface.palette.description),
          bullets: uniqueStrings([
            ...paletteBase.slice(0, 2),
            ...paletteAccent.slice(0, 2),
            ...paletteCaution.slice(0, 2),
          ]).slice(0, 3),
        },
        {
          eyebrow: "O que valorizar",
          title: "Sinais que merecem reforço",
          body: "A leitura fica mais forte quando a curadoria valoriza coerência, presença e uso real.",
          bullets: uniqueStrings([
            surface.lookHierarchy[0]?.title,
            surface.lookHierarchy[1]?.title,
            consultation.preferredColors.length > 0 ? `Cores preferidas: ${consultation.preferredColors.slice(0, 2).join(", ")}` : null,
          ]).slice(0, 3),
        },
        {
          eyebrow: "O que evitar",
          title: "Zonas de ruído",
          body: "Evitar aqui não é censura visual. É cortar o que enfraquece a leitura e quebra a linha escolhida.",
          bullets: uniqueStrings([
            ...surface.toAvoid.slice(0, 3),
            ...consultation.restrictions.slice(0, 2),
            consultation.avoidColors.length > 0 ? `Cores de cautela: ${consultation.avoidColors.slice(0, 2).join(", ")}` : null,
          ]).slice(0, 3),
        },
        {
          eyebrow: "Curadoria da loja",
          title: "Peças do catálogo real com melhor aderência",
          body: compactSentence(
            joinPieces([
              surface.lookHierarchy[0]?.description,
              surface.lookHierarchy[1]?.description,
              consultation.occasion ? `Ocasião: ${consultation.occasion}.` : null,
            ]),
          ),
          bullets: uniqueStrings([
            surface.lookHierarchy[0]?.title,
            surface.lookHierarchy[1]?.title,
            surface.lookHierarchy[2]?.title,
          ]).slice(0, 3),
        },
        ...(hasRenderableLook
          ? [
              {
                eyebrow: "Próximo look recomendado",
                title: surface.lookHierarchy[0]?.title || "Look principal",
                body: compactSentence(
                  joinPieces([
                    surface.lookHierarchy[0]?.description,
                    surface.looks[0]?.explanation,
                    `Próxima leitura: ${perception.toLowerCase()} para ${occasion.toLowerCase()}.`,
                  ]),
                ),
                bullets: uniqueStrings([
                  surface.looks[0]?.name,
                  surface.looks[0]?.items[0]?.name,
                  surface.looks[0]?.accessories[0],
                ]).slice(0, 3),
              },
            ]
          : []),
      ],
    },
  };
}

export function getStoreBoundBuyNowLooks(surface: ResultSurface) {
  return collectBuyNowLooks(surface);
}

export type { BuildVenusStylistAuditInput };
