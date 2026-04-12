export type TryOnQualityState = "hero" | "preview" | "retry_required";

export type TryOnQualityInput = {
  hasGeneratedImage: boolean;
  hasPersonImage: boolean;
  hasRealProduct: boolean;
  isLegacyLook: boolean;
  isPreviousLook: boolean;
  hasTryOnError: boolean;
  primaryLookItemCount: number;
};

export type TryOnQualityAssessment = {
  state: TryOnQualityState;
  score: number;
  reason: string;
  badgeLabel: string;
  showBeforeAfter: boolean;
  showWhatsappCta: boolean;
  showRetryPhotoCta: boolean;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function classifyTryOnQuality(input: TryOnQualityInput): TryOnQualityAssessment {
  let score = 0;

  if (input.hasGeneratedImage) score += 32;
  if (input.hasPersonImage) score += 16;
  if (input.hasRealProduct) score += 24;
  if (!input.isLegacyLook) score += 12;
  if (!input.hasTryOnError) score += 8;
  if (!input.isPreviousLook) score += 6;
  if (input.primaryLookItemCount >= 2) score += 10;
  if (input.primaryLookItemCount === 1) score += 2;

  if (!input.hasGeneratedImage) score -= 40;
  if (!input.hasPersonImage) score -= 24;
  if (!input.hasRealProduct) score -= 40;
  if (input.isLegacyLook) score -= 45;
  if (input.isPreviousLook) score -= 18;
  if (input.hasTryOnError) score -= 30;

  score = clampScore(score);

  if (!input.hasGeneratedImage || !input.hasPersonImage || !input.hasRealProduct || input.isLegacyLook || input.hasTryOnError) {
    return {
      state: "retry_required",
      score,
      reason: input.isLegacyLook
        ? "Este resultado vem de um legado sem produto validado para try-on."
        : !input.hasRealProduct
          ? "Faltou UUID real de produto para sustentar a transformação."
          : !input.hasPersonImage
            ? "Faltou uma foto de entrada confiável para fechar a leitura."
            : input.hasTryOnError
              ? "A geração não chegou a um nível confiável para vitrine premium."
              : "O resultado não atingiu integridade suficiente para virar hero.",
      badgeLabel: "Try-on indisponível",
      showBeforeAfter: false,
      showWhatsappCta: false,
      showRetryPhotoCta: true,
    };
  }

  if (input.isPreviousLook || input.primaryLookItemCount < 2 || score < 75) {
    return {
      state: "preview",
      score,
      reason: input.isPreviousLook
        ? "Este é um resultado de memória. A imagem existe, mas ainda merece validação premium."
        : input.primaryLookItemCount < 2
          ? "A curadoria chegou perto, mas ainda não fechou a composição ideal para vitrine."
          : "A leitura está boa, mas ainda não subiu para a faixa hero.",
      badgeLabel: "Prévia em validação",
      showBeforeAfter: true,
      showWhatsappCta: true,
      showRetryPhotoCta: true,
    };
  }

  return {
    state: "hero",
    score,
    reason: "A foto, o produto real e a composição fecharam com integridade suficiente para exibir como resultado premium.",
    badgeLabel: "Resultado hero",
    showBeforeAfter: true,
    showWhatsappCta: true,
    showRetryPhotoCta: false,
  };
}
