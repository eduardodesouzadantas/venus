export type VenusVisualAnalysisState = "not_started" | "processing" | "ready" | "failed";
export type VenusCurationState = "not_available" | "partial" | "ready" | "insufficient_catalog";
export type VenusWhatsAppState = "unavailable" | "ready" | "fallback_message_only";
export type VenusShareState = "unavailable" | "ready";
export type VenusPremiumTryOnState =
  | "not_requested"
  | "not_available"
  | "beta_available"
  | "quality_blocked"
  | "ready";
export type VenusPremiumOverallState =
  | "premium_ready"
  | "premium_partial"
  | "fallback_consultive"
  | "blocked"
  | "error";

export type VenusPremiumRecommendedNextAction =
  | "open_whatsapp_consultive_handoff"
  | "show_premium_result"
  | "show_partial_curation"
  | "show_catalog_fallback"
  | "show_share_card"
  | "request_new_photo"
  | "retry_later";

export type VenusPremiumExperienceStateInput = {
  visualAnalysis?: {
    status?: VenusVisualAnalysisState | null;
    hasSignature?: boolean | null;
    isProcessing?: boolean | null;
    failed?: boolean | null;
  } | null;
  curation?: {
    status?: VenusCurationState | "unavailable" | null;
    lookCount?: number | null;
    productCount?: number | null;
    missingSlots?: string[] | null;
  } | null;
  whatsapp?: {
    available?: boolean | null;
    hasConsultivePayload?: boolean | null;
    hasSuggestedMessage?: boolean | null;
    fallbackMessageAvailable?: boolean | null;
  } | null;
  share?: {
    available?: boolean | null;
    hasSignatureCard?: boolean | null;
  } | null;
  tryOn?: {
    state?: "hero" | "preview" | "retry_required" | "not_requested" | "not_available" | null;
    enabled?: boolean | null;
    qualityGatePassed?: boolean | null;
  } | null;
  blocked?: boolean | null;
  errors?: string[] | null;
  warnings?: string[] | null;
};

export type VenusPremiumExperienceState = {
  overallStatus: VenusPremiumOverallState;
  visualAnalysis: VenusVisualAnalysisState;
  curation: VenusCurationState;
  whatsapp: VenusWhatsAppState;
  share: VenusShareState;
  tryOn: VenusPremiumTryOnState;
  reasons: string[];
  warnings: string[];
  recommendedNextAction: VenusPremiumRecommendedNextAction;
  uiFlags: {
    showPremiumAnalysis: boolean;
    showCuration: boolean;
    showWhatsAppCta: boolean;
    showShareCard: boolean;
    showTryOn: boolean;
    showCatalogFallback: boolean;
    showPhotoRetry: boolean;
  };
};

const SAFE_CODE_PATTERN = /^[a-z0-9:_-]+$/;
const SENSITIVE_VALUE_PATTERN =
  /(@|base64|data:image|signedurl|signed_url|imageurl|image_url|token|secret|phone|email|raw|payload|nome|full\s*name|fullname|cliente|customer|tenant[:\s_-][a-z0-9-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|https?:\/\/|\+?\d[\d\s().-]{7,})/i;

function normalizeCode(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9:_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  if (!normalized || !SAFE_CODE_PATTERN.test(normalized) || SENSITIVE_VALUE_PATTERN.test(value)) {
    return "";
  }

  return normalized;
}

function uniqueCodes(values: unknown[], limit = 12) {
  return Array.from(new Set(values.map(normalizeCode).filter(Boolean))).slice(0, limit);
}

function finiteCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function deriveVisualAnalysis(input: VenusPremiumExperienceStateInput): VenusVisualAnalysisState {
  const visual = input.visualAnalysis;
  if (visual?.failed || visual?.status === "failed") return "failed";
  if (visual?.isProcessing || visual?.status === "processing") return "processing";
  if (visual?.hasSignature || visual?.status === "ready") return "ready";
  return visual?.status === "not_started" ? "not_started" : "not_started";
}

function deriveCuration(input: VenusPremiumExperienceStateInput): VenusCurationState {
  const curation = input.curation;
  const status = curation?.status;
  if (status === "ready" || status === "partial" || status === "insufficient_catalog" || status === "not_available") {
    return status;
  }
  if (status === "unavailable") return "not_available";

  const lookCount = finiteCount(curation?.lookCount);
  const productCount = finiteCount(curation?.productCount);
  const missingSlots = Array.isArray(curation?.missingSlots) ? curation.missingSlots.length : 0;

  if (lookCount > 0 && productCount >= 2 && missingSlots === 0) return "ready";
  if (lookCount > 0 || productCount > 0) return "partial";
  if (missingSlots > 0) return "insufficient_catalog";
  return "not_available";
}

function deriveWhatsApp(input: VenusPremiumExperienceStateInput): VenusWhatsAppState {
  const whatsapp = input.whatsapp;
  if (whatsapp?.available && (whatsapp.hasConsultivePayload || whatsapp.hasSuggestedMessage)) return "ready";
  if (whatsapp?.fallbackMessageAvailable || whatsapp?.hasSuggestedMessage) return "fallback_message_only";
  return "unavailable";
}

function deriveShare(input: VenusPremiumExperienceStateInput, visualAnalysis: VenusVisualAnalysisState): VenusShareState {
  if (input.share?.available || input.share?.hasSignatureCard) return "ready";
  return visualAnalysis === "ready" ? "ready" : "unavailable";
}

function deriveTryOn(input: VenusPremiumExperienceStateInput): VenusPremiumTryOnState {
  const tryOn = input.tryOn;
  if (!tryOn || tryOn.state === "not_requested") return "not_requested";
  if (tryOn.enabled === false || tryOn.state === "not_available") return "not_available";
  if (tryOn.state === "retry_required" || tryOn.qualityGatePassed === false) return "quality_blocked";
  // After the qualityGatePassed === false guard above, qualityGatePassed is true | null | undefined.
  // Any non-false value means the gate has not explicitly failed, so hero state is ready.
  if (tryOn.state === "hero") return "ready";
  if (tryOn.state === "preview") return "beta_available";
  return "not_requested";
}

function deriveOverallStatus(
  input: VenusPremiumExperienceStateInput,
  visualAnalysis: VenusVisualAnalysisState,
  curation: VenusCurationState,
  whatsapp: VenusWhatsAppState,
): VenusPremiumOverallState {
  if (input.blocked) return "blocked";
  if (visualAnalysis === "failed") return whatsapp !== "unavailable" ? "fallback_consultive" : "error";
  if (visualAnalysis === "processing" || visualAnalysis === "not_started") return "premium_partial";
  if (curation === "ready" && whatsapp === "ready") return "premium_ready";
  if (curation === "insufficient_catalog") return "fallback_consultive";
  if (curation === "partial" || whatsapp === "fallback_message_only") return "premium_partial";
  return whatsapp === "ready" ? "fallback_consultive" : "premium_partial";
}

function deriveNextAction(
  overallStatus: VenusPremiumOverallState,
  visualAnalysis: VenusVisualAnalysisState,
  curation: VenusCurationState,
  whatsapp: VenusWhatsAppState,
  share: VenusShareState,
): VenusPremiumRecommendedNextAction {
  if (overallStatus === "blocked") return "retry_later";
  if (visualAnalysis === "failed") return "request_new_photo";
  if (whatsapp === "ready") return "open_whatsapp_consultive_handoff";
  if (curation === "insufficient_catalog") return "show_catalog_fallback";
  if (curation === "partial") return "show_partial_curation";
  if (share === "ready") return "show_share_card";
  return "show_premium_result";
}

export function deriveVenusPremiumExperienceState(
  input: VenusPremiumExperienceStateInput = {},
): VenusPremiumExperienceState {
  const visualAnalysis = deriveVisualAnalysis(input);
  const curation = deriveCuration(input);
  const whatsapp = deriveWhatsApp(input);
  const share = deriveShare(input, visualAnalysis);
  const tryOn = deriveTryOn(input);
  const overallStatus = deriveOverallStatus(input, visualAnalysis, curation, whatsapp);
  const recommendedNextAction = deriveNextAction(overallStatus, visualAnalysis, curation, whatsapp, share);

  const reasons = uniqueCodes([
    `visual_analysis_${visualAnalysis}`,
    `curation_${curation}`,
    `whatsapp_${whatsapp}`,
    `share_${share}`,
    `tryon_${tryOn}`,
    overallStatus,
  ]);
  const warnings = uniqueCodes([
    ...(input.warnings || []),
    ...(input.errors || []).map((error) => `error:${error}`),
    ...(curation === "insufficient_catalog" ? ["catalog:insufficient"] : []),
    ...(tryOn === "quality_blocked" ? ["tryon:quality_blocked"] : []),
  ]);

  return {
    overallStatus,
    visualAnalysis,
    curation,
    whatsapp,
    share,
    tryOn,
    reasons,
    warnings,
    recommendedNextAction,
    uiFlags: {
      showPremiumAnalysis: visualAnalysis === "ready",
      showCuration: curation === "ready" || curation === "partial",
      showWhatsAppCta: whatsapp === "ready" || whatsapp === "fallback_message_only",
      showShareCard: share === "ready",
      showTryOn: tryOn === "ready" || tryOn === "beta_available",
      showCatalogFallback: curation === "insufficient_catalog",
      showPhotoRetry: visualAnalysis === "failed" || tryOn === "quality_blocked",
    },
  };
}
