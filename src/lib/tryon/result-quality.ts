export type TryOnQualityState = "hero" | "preview" | "retry_required";

export type TryOnStructuralInput = {
  hasGeneratedImage: boolean;
  hasPersonImage: boolean;
  hasRealProduct: boolean;
  isLegacyLook: boolean;
  isPreviousLook: boolean;
  hasTryOnError: boolean;
  primaryLookItemCount: number;
};

export type TryOnVisualInput = {
  hasGeneratedImage: boolean;
  hasBeforeAfter: boolean;
  hasHeroFrame: boolean;
  hasNarrative: boolean;
  hasContextualCTA: boolean;
  hasPremiumBadge: boolean;
  isPreviousLook: boolean;
  hasTryOnError: boolean;
};

export type TryOnAxisAssessment = {
  state: TryOnQualityState;
  score: number;
  reason: string;
  reasons: string[];
  badgeLabel: string;
};

export type TryOnQualityInput = TryOnStructuralInput & Partial<TryOnVisualInput>;

export type TryOnQualityAssessment = {
  state: TryOnQualityState;
  score: number;
  reason: string;
  reasons: string[];
  badgeLabel: string;
  showBeforeAfter: boolean;
  showWhatsappCta: boolean;
  showRetryPhotoCta: boolean;
  structural: TryOnAxisAssessment;
  visual: TryOnAxisAssessment;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function buildAxisAssessment(
  score: number,
  reasons: string[],
  fallbackReason: string,
  previewThreshold: number,
  heroThreshold: number,
  retryThreshold: number = 0,
): TryOnAxisAssessment {
  const normalizedScore = clampScore(score);

  if (normalizedScore <= retryThreshold || reasons.length === 0) {
    return {
      state: "retry_required",
      score: normalizedScore,
      reason: fallbackReason,
      reasons: reasons.length > 0 ? reasons : [fallbackReason],
      badgeLabel: "Try-on indisponível",
    };
  }

  if (normalizedScore < previewThreshold) {
    return {
      state: "preview",
      score: normalizedScore,
      reason: reasons[0] || fallbackReason,
      reasons,
      badgeLabel: "Prévia em validação",
    };
  }

  if (normalizedScore >= heroThreshold) {
    return {
      state: "hero",
      score: normalizedScore,
      reason: reasons[0] || fallbackReason,
      reasons,
      badgeLabel: "Resultado hero",
    };
  }

  return {
    state: "preview",
    score: normalizedScore,
    reason: reasons[0] || fallbackReason,
    reasons,
    badgeLabel: "Prévia em validação",
  };
}

export function evaluateTryOnStructural(input: TryOnStructuralInput): TryOnAxisAssessment {
  let score = 0;
  const reasons: string[] = [];

  if (input.hasGeneratedImage) {
    score += 28;
    reasons.push("imagem gerada com sucesso");
  } else {
    score -= 40;
    reasons.push("sem imagem gerada");
  }

  if (input.hasPersonImage) {
    score += 18;
    reasons.push("foto de entrada disponível");
  } else {
    score -= 24;
    reasons.push("foto de entrada ausente");
  }

  if (input.hasRealProduct) {
    score += 24;
    reasons.push("produto real validado");
  } else {
    score -= 40;
    reasons.push("sem UUID real de produto");
  }

  if (!input.isLegacyLook) {
    score += 12;
    reasons.push("não é legado");
  } else {
    score -= 45;
    reasons.push("resultado legado");
  }

  if (!input.hasTryOnError) {
    score += 8;
  } else {
    score -= 30;
    reasons.push("try-on com falha");
  }

  if (!input.isPreviousLook) {
    score += 6;
  } else {
    score -= 18;
    reasons.push("memória de look anterior");
  }

  if (input.primaryLookItemCount >= 2) {
    score += 10;
    reasons.push("composição com múltiplas peças");
  } else if (input.primaryLookItemCount === 1) {
    score += 2;
    reasons.push("composição mínima");
  } else {
    score -= 8;
    reasons.push("sem peças suficientes");
  }

  if (!input.hasGeneratedImage || !input.hasPersonImage || !input.hasRealProduct || input.isLegacyLook || input.hasTryOnError) {
    return {
      state: "retry_required",
      score: clampScore(score),
      reason: input.isLegacyLook
        ? "Este resultado vem de um legado sem produto validado para try-on."
        : !input.hasRealProduct
          ? "Faltou UUID real de produto para sustentar a transformação."
          : !input.hasPersonImage
            ? "Faltou uma foto de entrada confiável para fechar a leitura."
            : input.hasTryOnError
              ? "A geração não chegou a um nível confiável para vitrine premium."
              : "O resultado não atingiu integridade suficiente para virar hero.",
      reasons,
      badgeLabel: "Try-on indisponível",
    };
  }

  return buildAxisAssessment(
    score,
    reasons,
    "O resultado estrutural não atingiu integridade suficiente para virar hero.",
    68,
    84,
  );
}

export function evaluateTryOnVisual(input: TryOnVisualInput): TryOnAxisAssessment {
  let score = 0;
  const reasons: string[] = [];

  if (input.hasGeneratedImage) {
    score += 30;
    reasons.push("imagem final disponível");
  } else {
    score -= 35;
    reasons.push("sem imagem final");
  }

  if (input.hasBeforeAfter) {
    score += 18;
    reasons.push("comparação antes/depois presente");
  }

  if (input.hasHeroFrame) {
    score += 18;
    reasons.push("hero frame presente");
  }

  if (input.hasNarrative) {
    score += 12;
    reasons.push("narrativa de valor presente");
  }

  if (input.hasContextualCTA) {
    score += 10;
    reasons.push("cta contextual disponível");
  }

  if (input.hasPremiumBadge) {
    score += 6;
    reasons.push("badge premium visível");
  }

  if (input.isPreviousLook) {
    score -= 18;
    reasons.push("resultado anterior reaproveitado");
  }

  if (input.hasTryOnError) {
    score -= 28;
    reasons.push("erro de try-on detectado");
  }

  if (!input.hasGeneratedImage || input.hasTryOnError) {
    return {
      state: "retry_required",
      score: clampScore(score),
      reason: input.hasTryOnError
        ? "O resultado visual não atingiu integridade por causa de uma falha de try-on."
        : "Ainda não existe uma imagem visual suficiente para vitrine premium.",
      reasons,
      badgeLabel: "Prévia visual indisponível",
    };
  }

  return buildAxisAssessment(
    score,
    reasons,
    "O resultado visual ainda pede validação antes de virar hero.",
    60,
    80,
  );
}

export function classifyTryOnQuality(input: TryOnQualityInput): TryOnQualityAssessment {
  const structural = evaluateTryOnStructural(input);
  const visual = evaluateTryOnVisual({
    hasGeneratedImage: input.hasGeneratedImage,
    hasBeforeAfter: input.hasBeforeAfter ?? false,
    hasHeroFrame: input.hasHeroFrame ?? false,
    hasNarrative: input.hasNarrative ?? false,
    hasContextualCTA: input.hasContextualCTA ?? false,
    hasPremiumBadge: input.hasPremiumBadge ?? false,
    isPreviousLook: input.isPreviousLook,
    hasTryOnError: input.hasTryOnError,
  });

  if (structural.state === "retry_required") {
    return {
      state: "retry_required",
      score: structural.score,
      reason: structural.reason,
      reasons: [...structural.reasons],
      badgeLabel: structural.badgeLabel,
      showBeforeAfter: false,
      showWhatsappCta: false,
      showRetryPhotoCta: true,
      structural,
      visual,
    };
  }

  if (visual.state === "retry_required") {
    return {
      state: "retry_required",
      score: Math.min(structural.score, visual.score),
      reason: visual.reason,
      reasons: [...new Set([...structural.reasons, ...visual.reasons])],
      badgeLabel: visual.badgeLabel,
      showBeforeAfter: false,
      showWhatsappCta: false,
      showRetryPhotoCta: true,
      structural,
      visual,
    };
  }

  const combinedScore = Math.round((structural.score * 0.58) + (visual.score * 0.42));
  const combinedReasons = [...new Set([...structural.reasons, ...visual.reasons])];

  if (structural.state === "hero" && visual.state === "hero" && combinedScore >= 88) {
    return {
      state: "hero",
      score: combinedScore,
      reason: "A estrutura do look e a apresentação visual fecharam em padrão hero com consistência alta.",
      reasons: combinedReasons,
      badgeLabel: "Resultado hero",
      showBeforeAfter: true,
      showWhatsappCta: true,
      showRetryPhotoCta: false,
      structural,
      visual,
    };
  }

  const previewReason =
    structural.state === "preview" && visual.state === "hero"
      ? "A leitura estrutural é boa, mas a apresentação ainda não sobe para hero."
      : structural.state === "hero" && visual.state === "preview"
        ? "A estrutura está forte, mas o visual ainda pede refinamento antes de virar hero."
        : "A leitura está perto, mas ainda não subiu para o padrão hero.";

  return {
    state: "preview",
    score: combinedScore,
    reason: previewReason,
    reasons: combinedReasons,
    badgeLabel: "Prévia em validação",
    showBeforeAfter: true,
    showWhatsappCta: true,
    showRetryPhotoCta: true,
    structural,
    visual,
  };
}
