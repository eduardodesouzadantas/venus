import type {
  VenusPremiumExperienceState,
  VenusPremiumExperienceStateInput,
} from "@/lib/result/experience-state";

type ResultExperienceLookLike = {
  items?: unknown[] | null;
};

type ResultExperienceSurfaceLike = {
  essence?: unknown | null;
  hero?: unknown | null;
  looks?: ResultExperienceLookLike[] | null;
  curationFallback?: unknown | null;
};

type ResultExperienceTryOnState = "hero" | "preview" | "retry_required" | null;

export type ResultExperienceStateAdapterInput = {
  surface?: ResultExperienceSurfaceLike | null;
  loading?: boolean | null;
  error?: unknown;
  whatsappUrl?: string | null;
  hasWhatsAppFallbackMessage?: boolean | null;
  tryOnQualityState?: ResultExperienceTryOnState;
  tryOnEnabled?: boolean | null;
  hasTryOnArtifact?: boolean | null;
  hasTryOnError?: boolean | null;
  shareAvailable?: boolean | null;
};

export type ResultExperienceStateTelemetry = {
  overallStatus: VenusPremiumExperienceState["overallStatus"];
  visualAnalysis: VenusPremiumExperienceState["visualAnalysis"];
  curation: VenusPremiumExperienceState["curation"];
  whatsapp: VenusPremiumExperienceState["whatsapp"];
  share: VenusPremiumExperienceState["share"];
  tryOn: VenusPremiumExperienceState["tryOn"];
  recommendedNextAction: VenusPremiumExperienceState["recommendedNextAction"];
  reasons: string[];
  warnings: string[];
  uiFlags: VenusPremiumExperienceState["uiFlags"];
  counts: {
    reasons: number;
    warnings: number;
  };
};

function finiteCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function countLookProducts(looks: ResultExperienceLookLike[]) {
  return looks.reduce((count, look) => count + finiteCount(look.items?.length), 0);
}

function deriveTryOnInput(input: ResultExperienceStateAdapterInput): VenusPremiumExperienceStateInput["tryOn"] {
  if (input.tryOnQualityState === "hero" || input.tryOnQualityState === "preview") {
    return {
      state: input.tryOnQualityState,
      enabled: input.tryOnEnabled !== false,
      qualityGatePassed: true,
    };
  }

  if (input.tryOnQualityState === "retry_required" || input.hasTryOnError) {
    return {
      state: "retry_required",
      enabled: input.tryOnEnabled !== false,
      qualityGatePassed: false,
    };
  }

  if (input.tryOnEnabled === false) {
    return {
      state: "not_available",
      enabled: false,
      qualityGatePassed: false,
    };
  }

  // After the explicit `=== false` guard above, tryOnEnabled is true | null | undefined.
  // All three cases are treated as enabled (default-on), so enabled is always true here.
  return {
    state: input.hasTryOnArtifact ? "preview" : "not_requested",
    enabled: true,
    qualityGatePassed: input.hasTryOnArtifact ? true : null,
  };
}

export function buildExperienceStateInputFromResultData(
  input: ResultExperienceStateAdapterInput,
): VenusPremiumExperienceStateInput {
  const surface = input.surface || null;
  const looks = Array.isArray(surface?.looks) ? surface.looks : [];
  const lookCount = looks.length;
  const productCount = countLookProducts(looks);
  const hasSurface = Boolean(surface);
  const hasError = Boolean(input.error);
  const hasSignature = Boolean(surface?.essence || surface?.hero);
  const hasCurationFallback = Boolean(surface?.curationFallback);
  const hasWhatsAppUrl = Boolean(input.whatsappUrl);
  const hasFallbackMessage = Boolean(input.hasWhatsAppFallbackMessage);

  return {
    visualAnalysis: {
      status: hasError ? "failed" : input.loading && !hasSurface ? "processing" : hasSurface ? "ready" : "not_started",
      hasSignature,
      isProcessing: Boolean(input.loading && !hasSurface),
      failed: hasError,
    },
    curation: {
      status: hasCurationFallback && productCount === 0 ? "insufficient_catalog" : undefined,
      lookCount,
      productCount,
      missingSlots: hasCurationFallback && productCount === 0 ? ["catalog:insufficient"] : [],
    },
    whatsapp: {
      available: hasWhatsAppUrl,
      hasConsultivePayload: hasWhatsAppUrl,
      hasSuggestedMessage: hasWhatsAppUrl || hasFallbackMessage,
      fallbackMessageAvailable: hasFallbackMessage,
    },
    share: {
      available: Boolean(input.shareAvailable || hasSignature),
      hasSignatureCard: hasSignature,
    },
    tryOn: deriveTryOnInput(input),
    errors: hasError ? ["result:error"] : [],
    warnings: hasCurationFallback ? ["catalog:fallback_available"] : [],
  };
}

export function buildExperienceStateTelemetry(
  state: VenusPremiumExperienceState,
): ResultExperienceStateTelemetry {
  return {
    overallStatus: state.overallStatus,
    visualAnalysis: state.visualAnalysis,
    curation: state.curation,
    whatsapp: state.whatsapp,
    share: state.share,
    tryOn: state.tryOn,
    recommendedNextAction: state.recommendedNextAction,
    reasons: [...state.reasons],
    warnings: [...state.warnings],
    uiFlags: { ...state.uiFlags },
    counts: {
      reasons: state.reasons.length,
      warnings: state.warnings.length,
    },
  };
}
