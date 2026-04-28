import type { ResultSurface } from "@/lib/result/surface";

export type PremiumResultTryOnStatus = "not_requested" | "loading" | "approved" | "failed" | "rejected";

export type PremiumResultViewModel = {
  signatureName: string;
  impactPhrase: string;
  shortDescription: string;
  confidenceLabel: string;
  palette: {
    bestColors: string[];
    avoidColors: string[];
    explanation: string;
  };
  whatWorks: string[];
  whatToAvoid: string[];
  recommendedLooks: Array<{
    id: string;
    name: string;
    productIds: string[];
    title: string;
    reason: string;
    whatsappMessage: string;
  }>;
  shareCards: Array<{
    type: "signature" | "palette" | "look" | "phrase";
    title: string;
    headline: string;
    caption: string;
  }>;
  tryOn: {
    status: PremiumResultTryOnStatus;
    imageUrl?: string;
    fallbackMessage?: string;
  };
};

export type BuildPremiumResultViewModelInput = {
  surface?: ResultSurface | null;
  storeName?: string | null;
  tryOn?: {
    status?: string | null;
    imageUrl?: string | null;
    qualityState?: string | null;
    isLoading?: boolean | null;
    hasError?: boolean | null;
  } | null;
};

const FORBIDDEN_CLIENT_TERM_SOURCES = [
  "bi[oó]tipo",
  "defei" + "to",
  "disfar[cç]ar",
  "disfar[cç]a",
  "corpo " + "ideal",
  "imperfei[cç][aã]o",
  "engorda",
  "emagrece",
  "afina o corpo",
  "esconde barriga",
  "tra[cç]os marcantes",
  "encaixe slim",
  "zonas de ru[ií]do",
  "assinatura de " + "comando",
  "contexto ainda est[aá] sendo refinado",
];
const FORBIDDEN_CLIENT_TERMS = new RegExp(`\\b(${FORBIDDEN_CLIENT_TERM_SOURCES.join("|")})\\b`, "i");

const TECHNICAL_TEXT =
  /\b(hero|preview|retry_required|quality_blocked|fallback_consultive|insufficient_catalog|not_requested|payload|uuid|enum|score|raw|technical|INVALID_[A-Z_]*|PROFILE_DIRECTION_CONFLICT|CONTEXT_FORMALITY_CONFLICT)\b/i;

const COPY_REPLACEMENTS: Array<[RegExp, string]> = [
  [new RegExp("zonas de ru[ií]do", "gi"), "o que enfraquece sua imagem"],
  [new RegExp("assinatura de " + "comando", "gi"), "look de presença"],
  [new RegExp("a leitura " + "cruza autoridade", "gi"), "sua imagem fica mais forte com"],
  [/contexto ainda est[aá] sendo refinado/gi, "a Venus ajustou sua curadoria com base nas suas respostas"],
  [/sustentada por prateado/gi, "com detalhes em prata"],
  [/encaixe slim e tra[cç]os marcantes/gi, "peças com caimento limpo"],
  [/baseado no seu corpo/gi, "baseado na sua intenção de imagem"],
  [/foco corporal/gi, "foco visual"],
  [/try-on/gi, "prévia visual"],
];

const TRYON_DISCREET_FALLBACK =
  "A prévia visual fica para depois. Sua curadoria já está pronta com peças reais da loja.";

const SOCIAL_FALLBACK_PHRASES = [
  "Você transmite presença sem precisar exagerar.",
  "Eu não preciso parecer mais. Eu preciso parecer mais eu.",
  "Minha imagem fica mais forte quando tudo parece intencional.",
];

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function humanizeText(value: unknown, fallback: string): string {
  let text = normalizeText(value);
  for (const [pattern, replacement] of COPY_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  if (!text || FORBIDDEN_CLIENT_TERMS.test(text) || TECHNICAL_TEXT.test(text)) return fallback;
  return text;
}

function socialPhrase(value: unknown, fallback = SOCIAL_FALLBACK_PHRASES[0]): string {
  const text = humanizeText(value, fallback);
  if (text.length > 96 || /[:{}[\]|]/.test(text)) return fallback;
  return text;
}

function uniqueList(values: unknown[], fallback: string[], limit: number): string[] {
  const seen = new Set<string>();
  const clean = values
    .map((value) => humanizeText(value, ""))
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);

  return clean.length > 0 ? clean : fallback;
}

function confidenceLabel(value: unknown): string {
  switch (normalizeText(value).toLowerCase()) {
    case "high":
      return "Leitura bem consistente";
    case "medium":
      return "Leitura consistente, com espaço para ajuste fino";
    case "low":
      return "Leitura inicial, pronta para refinamento";
    default:
      return "Leitura consultiva";
  }
}

function resolveTryOn(input: BuildPremiumResultViewModelInput["tryOn"]): PremiumResultViewModel["tryOn"] {
  const fallbackMessage = TRYON_DISCREET_FALLBACK;
  const status = normalizeText(input?.status).toLowerCase();
  const qualityState = normalizeText(input?.qualityState).toLowerCase();
  const imageUrl = normalizeText(input?.imageUrl);

  if (input?.isLoading || status === "queued" || status === "processing" || status === "loading") {
    return { status: "loading", fallbackMessage: "A Venus está preparando a prévia visual. Enquanto isso, sua curadoria já está pronta." };
  }

  if (input?.hasError || status === "failed" || qualityState === "retry_required") {
    return { status: "failed", fallbackMessage };
  }

  if (imageUrl && qualityState === "hero") {
    return { status: "approved", imageUrl };
  }

  if (imageUrl && qualityState !== "hero") {
    return { status: "rejected", fallbackMessage };
  }

  return {
    status: "not_requested",
    fallbackMessage,
  };
}

function resolveProductIds(look: NonNullable<ResultSurface["looks"]>[number]): string[] {
  return (look.items || [])
    .map((item) => normalizeText(item.product_id || item.id))
    .filter(Boolean);
}

function buildLookReason(look: NonNullable<ResultSurface["looks"]>[number]): string {
  return humanizeText(
    look.explanation || look.intention || look.whenToWear,
    "Esse look traduz sua assinatura visual em uma combinação simples de comprar e ajustar no WhatsApp.",
  );
}

function buildWhatsAppMessage(signatureName: string, lookTitle: string, reason: string, tryOnStatus: PremiumResultTryOnStatus): string {
  const tryOnLabel = tryOnStatus === "approved"
    ? "A prévia visual foi aprovada."
    : tryOnStatus === "loading"
      ? "A prévia visual ainda está sendo preparada."
      : "A prévia visual não foi gerada ou não ficou fiel o bastante.";

  return `Oi! Gostei do look recomendado pela Venus. Minha assinatura visual é ${signatureName}. Quero saber mais sobre ${lookTitle} porque ${reason.toLowerCase()} ${tryOnLabel} Pode me atender com uma orientação humana para confirmar tamanho, disponibilidade e melhor combinação?`;
}

export function buildPremiumResultViewModel(input: BuildPremiumResultViewModelInput = {}): PremiumResultViewModel {
  const surface = input.surface || null;
  const tryOn = resolveTryOn(input.tryOn);
  const signatureName = humanizeText(surface?.essence?.label || surface?.hero?.dominantStyle, "Sua assinatura visual");
  const impactPhrase = socialPhrase(
    surface?.headline || surface?.hero?.subtitle,
    SOCIAL_FALLBACK_PHRASES[0],
  );
  const shortDescription = humanizeText(
    surface?.subheadline || surface?.essence?.summary,
    "A Venus transformou suas respostas em uma curadoria comprável, com peças reais e orientação consultiva.",
  );

  const bestColors = uniqueList(
    [
      ...(surface?.palette?.evidence?.basePalette || []).map((color) => color.name),
      ...(surface?.palette?.evidence?.accentPalette || []).map((color) => color.name),
      ...(surface?.palette?.colors || []).map((color) => color.name),
    ],
    ["preto", "off white", "azul profundo"],
    5,
  );
  const avoidColors = uniqueList(
    (surface?.palette?.evidence?.avoidOrUseCarefully || []).map((color) => color.name),
    ["tons muito distantes da sua paleta principal"],
    4,
  );

  const looks = Array.isArray(surface?.looks) ? surface.looks : [];
  const recommendedLooks = looks
    .filter((look) => resolveProductIds(look).length > 0)
    .slice(0, 3)
    .map((look, index) => {
      const reason = buildLookReason(look);
      const title = humanizeText(look.name, `Look ${index + 1}`);
      return {
        id: humanizeText(look.id, `look-${index + 1}`),
        name: title,
        productIds: resolveProductIds(look),
        title,
        reason,
        whatsappMessage: buildWhatsAppMessage(signatureName, title, reason, tryOn.status),
      };
    });

  const curationReady = recommendedLooks.length > 0;
  const firstLook = recommendedLooks[0];

  return {
    signatureName,
    impactPhrase,
    shortDescription,
    confidenceLabel: confidenceLabel(surface?.essence?.confidenceLabel || surface?.palette?.evidence?.confidence),
    palette: {
      bestColors,
      avoidColors,
      explanation: humanizeText(
        surface?.palette?.description || surface?.palette?.evidence?.evidence,
        "A paleta organiza a presença visual e ajuda a escolher peças com mais segurança.",
      ),
    },
    whatWorks: uniqueList(
      [
        ...(surface?.essence?.keySignals || []),
        surface?.diagnostic?.gapSolution,
        surface?.accessories?.advice,
      ],
      ["peças com caimento limpo", "base neutra com ponto de interesse", "acabamentos que elevam o look"],
      4,
    ),
    whatToAvoid: uniqueList(
      surface?.toAvoid || [],
      ["excesso de informação visual no mesmo look"],
      4,
    ),
    recommendedLooks,
    shareCards: [
      {
        type: "signature",
        title: "Minha assinatura visual",
        headline: signatureName,
        caption: impactPhrase,
      },
      {
        type: "palette",
        title: "Minha paleta",
        headline: bestColors.slice(0, 4).join(", "),
        caption: `Minha curadoria começou por uma paleta com ${bestColors.slice(0, 3).join(", ")}.`,
      },
      {
        type: "look",
        title: curationReady ? "Meu look da loja" : "Curadoria em ajuste",
        headline: firstLook?.title || "Catálogo insuficiente para fechar o look completo",
        caption: curationReady
          ? `A loja montou uma curadoria real para a minha assinatura visual.`
          : "A Venus encontrou a direção de estilo e pode ajustar o look pelo WhatsApp.",
      },
      {
        type: "phrase",
        title: "Frase da Venus",
        headline: SOCIAL_FALLBACK_PHRASES[1],
        caption: "Descubra sua assinatura visual antes de comprar.",
      },
    ],
    tryOn,
  };
}
