import type { OnboardingData } from "@/types/onboarding";
import type { ResultSurface } from "@/lib/result/surface";
import type { DecisionResult } from "@/lib/decision-engine/types";
import type { TryOnQualityAssessment } from "@/lib/tryon/result-quality";
import { buildVenusResultNarrative, buildVenusWhatsAppLeadIn, VENUS_STYLIST_NAME } from "@/lib/venus/brand";

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
  const onboardingGoal = normalizeText(onboardingData?.intent?.imageGoal);
  const onboardingStyle = normalizeText(onboardingData?.intent?.styleDirection);
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
      helper: tryOnQuality.reason,
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
  };
}

export function getStoreBoundBuyNowLooks(surface: ResultSurface) {
  return collectBuyNowLooks(surface);
}

export type { BuildVenusStylistAuditInput };
