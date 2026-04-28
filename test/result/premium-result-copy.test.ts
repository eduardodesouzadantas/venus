import assert from "node:assert/strict";

import type { VenusPremiumExperienceState } from "../../src/lib/result/experience-state";
import {
  buildPremiumResultPresentationModel,
  buildPremiumResultSectionVisibility,
  getPieceRoleLabel,
  PIECE_ROLE_LABELS,
  formatConfidenceLabel,
  formatStylePreferenceLabel,
  formatExperienceStatusLabel,
} from "../../src/lib/result/premium-result-copy";

function run(name: string, fn: () => void) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

const readyState: VenusPremiumExperienceState = {
  overallStatus: "premium_ready",
  visualAnalysis: "ready",
  curation: "ready",
  whatsapp: "ready",
  share: "ready",
  tryOn: "not_requested",
  reasons: ["premium_ready"],
  warnings: [],
  recommendedNextAction: "open_whatsapp_consultive_handoff",
  uiFlags: {
    showPremiumAnalysis: true,
    showCuration: true,
    showWhatsAppCta: true,
    showShareCard: true,
    showTryOn: false,
    showCatalogFallback: false,
    showPhotoRetry: false,
  },
};

const forbiddenBodyJudgmentTerms = [
  /disfar[cç]a/i,
  /imperfei[cç][aã]o/i,
  /mais magr/i,
  /engorda/i,
  /esconde/i,
  /barriga/i,
  /quadril/i,
  /corpo combina/i,
  /n[aã]o combina com voc/i,
  /perfeito garantido/i,
];

const sensitiveValues = [
  "+55 11 99999-1234",
  "cliente.real@example.com",
  "Nome Completo Cliente",
  "data:image/png;base64,ABC123",
  "https://signed.example.com/private.png?token=SECRET",
  "SECRET_TOKEN_123",
  "RAW_AI_RESPONSE_PRIVATE",
];

function serialize(value: unknown) {
  return JSON.stringify(value);
}

function assertNoForbiddenCopy(value: unknown) {
  const text = serialize(value);
  for (const pattern of forbiddenBodyJudgmentTerms) {
    assert.doesNotMatch(text, pattern);
  }
}

function assertNoSensitiveValues(value: unknown) {
  const text = serialize(value).toLowerCase();
  for (const sensitive of sensitiveValues) {
    assert.doesNotMatch(text, new RegExp(sensitive.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(text, /99999-1234|cliente\.real@example\.com|nome completo cliente|base64|signed\.example|secret_token_123|raw_ai_response_private/);
}

run("premium result headline positions signature visual instead of try-on", () => {
  const model = buildPremiumResultPresentationModel({
    experienceState: readyState,
    signatureName: "Autoridade Silenciosa",
    storeName: "Loja Aurora",
    hasLooks: true,
  });

  assert.match(model.hero.eyebrow, /assinatura visual/i);
  assert.equal(model.hero.title, "Autoridade Silenciosa");
  assert.doesNotMatch(model.hero.title, /try-on|provador/i);
  assert.doesNotMatch(model.hero.subtitle, /try-on obrigat/i);
});

run("signature analysis section follows showPremiumAnalysis flag", () => {
  const visible = buildPremiumResultPresentationModel({ experienceState: readyState });
  const hidden = buildPremiumResultPresentationModel({
    experienceState: {
      ...readyState,
      uiFlags: { ...readyState.uiFlags, showPremiumAnalysis: false },
    },
  });

  assert.equal(visible.analysis.visible, true);
  assert.equal(hidden.analysis.visible, false);
  assert.match(visible.analysis.title, /assinatura visual/i);
});

run("curation section follows showCuration flag and uses compravel copy", () => {
  const model = buildPremiumResultPresentationModel({
    experienceState: readyState,
    hasLooks: true,
  });

  assert.equal(model.curation.visible, true);
  assert.match(model.curation.eyebrow, /peças escolhidas|pecas escolhidas/i);
  assert.ok(model.curation.reinforcement.includes("Curadoria compravel"));
});

run("WhatsApp section is consultive when showWhatsAppCta is true", () => {
  const model = buildPremiumResultPresentationModel({
    experienceState: readyState,
    storeName: "Loja Aurora",
  });

  assert.equal(model.whatsapp.visible, true);
  assert.match(model.whatsapp.cta, /Quero esse look no WhatsApp/i);
  assert.match(model.whatsapp.subtitle, /assinatura visual/i);
});

run("share section follows showShareCard flag", () => {
  const model = buildPremiumResultPresentationModel({ experienceState: readyState });

  assert.equal(model.share.visible, true);
  assert.match(model.share.title, /Compartilhe sua assinatura/i);
});

run("try-on is hidden when showTryOn is false", () => {
  const model = buildPremiumResultPresentationModel({ experienceState: readyState });

  assert.equal(model.tryOn.visible, false);
  assert.match(model.tryOn.unavailableCopy, /curadoria está pronta|curadoria esta pronta/i);
});

run("catalog insufficient receives an elegant fallback", () => {
  const model = buildPremiumResultPresentationModel({
    experienceState: {
      ...readyState,
      overallStatus: "fallback_consultive",
      curation: "insufficient_catalog",
      uiFlags: {
        ...readyState.uiFlags,
        showCuration: false,
        showCatalogFallback: true,
      },
    },
    hasLooks: false,
  });

  assert.equal(model.curation.visible, true);
  assert.match(model.curation.fallbackTitle, /Cat[aá]logo curto/i);
  assert.match(model.curation.fallbackBody, /atendimento consultivo/i);
});

run("premium result copy avoids body judgment terms", () => {
  const model = buildPremiumResultPresentationModel({
    experienceState: readyState,
    signatureName: "Presenca Natural",
    storeName: "Loja Aurora",
    hasLooks: true,
  });

  assertNoForbiddenCopy(model);
});

run("presentation model does not render PII from hostile inputs", () => {
  const model = buildPremiumResultPresentationModel({
    experienceState: readyState,
    signatureName: "Nome Completo Cliente",
    storeName: "+55 11 99999-1234 cliente.real@example.com",
    hasLooks: true,
  });

  assertNoSensitiveValues(model);
  assert.equal(model.hero.title, "Sua assinatura visual");
  assert.match(model.whatsapp.title, /a loja/);
});

run("legacy page behavior keeps basic sections available", () => {
  const model = buildPremiumResultPresentationModel({
    experienceState: {
      ...readyState,
      overallStatus: "premium_partial",
      curation: "partial",
      whatsapp: "fallback_message_only",
      uiFlags: {
        ...readyState.uiFlags,
        showCuration: true,
        showWhatsAppCta: true,
        showTryOn: false,
      },
    },
    hasLooks: true,
  });

  assert.equal(model.analysis.visible, true);
  assert.equal(model.curation.visible, true);
  assert.equal(model.whatsapp.visible, true);
  assert.equal(model.tryOn.visible, false);
});

// ── PR 5.1 regression: decouple complete looks gallery from try-on ────────────

const readyStateWithTryOn: VenusPremiumExperienceState = {
  ...readyState,
  tryOn: "ready",
  uiFlags: { ...readyState.uiFlags, showTryOn: true },
};

run("PR5.1 — complete looks gallery appears with valid curation even when showTryOn is false", () => {
  const presentation = buildPremiumResultPresentationModel({
    experienceState: readyState,
    hasLooks: true,
    storeName: "Loja Aurora",
  });
  const visibility = buildPremiumResultSectionVisibility({
    presentation,
    commerceRevealReady: true,
    lookCount: 3,
    hasResolvedOrg: true,
    hasTryOnImage: false,
    isTryOnGenerating: false,
  });

  assert.equal(presentation.tryOn.visible, false, "tryOn must be hidden");
  assert.equal(visibility.showCompleteLooksGallery, true, "gallery must show");
  assert.equal(visibility.showCommerce, true, "commerce must be enabled");
  assert.equal(visibility.showTryOnImageBadges, false, "image badges must be hidden");
});

run("PR5.1 — complete looks gallery does not require a try-on image", () => {
  const presentation = buildPremiumResultPresentationModel({
    experienceState: readyState,
    hasLooks: true,
  });
  const visibility = buildPremiumResultSectionVisibility({
    presentation,
    commerceRevealReady: true,
    lookCount: 5,
    hasResolvedOrg: true,
    hasTryOnImage: false,
  });

  assert.equal(visibility.showCompleteLooksGallery, true);
  assert.equal(visibility.showTryOnImageBadges, false);
  assert.equal(visibility.showTryOnBeforeAfter, false);
});

run("PR5.1 — try-on image badges hidden when showTryOn is false, even with image present", () => {
  const presentation = buildPremiumResultPresentationModel({
    experienceState: readyState,
    hasLooks: true,
  });
  const visibility = buildPremiumResultSectionVisibility({
    presentation,
    commerceRevealReady: true,
    lookCount: 2,
    hasResolvedOrg: true,
    hasTryOnImage: true,
    isTryOnGenerating: false,
  });

  assert.equal(presentation.tryOn.visible, false);
  assert.equal(visibility.showTryOnImageBadges, false);
  assert.equal(visibility.showTryOnBeforeAfter, false);
});

run("PR5.1 — try-on image badges visible when showTryOn is true and image is available", () => {
  const presentation = buildPremiumResultPresentationModel({
    experienceState: readyStateWithTryOn,
    hasLooks: true,
  });
  const visibility = buildPremiumResultSectionVisibility({
    presentation,
    commerceRevealReady: true,
    lookCount: 2,
    hasResolvedOrg: true,
    hasTryOnImage: true,
    isTryOnGenerating: false,
  });

  assert.equal(presentation.tryOn.visible, true);
  assert.equal(visibility.showTryOnImageBadges, true);
});

run("PR5.1 — curation and WhatsApp remain available without try-on", () => {
  const presentation = buildPremiumResultPresentationModel({
    experienceState: readyState,
    hasLooks: true,
    storeName: "Loja Teste",
  });
  const visibility = buildPremiumResultSectionVisibility({
    presentation,
    commerceRevealReady: true,
    lookCount: 2,
    hasResolvedOrg: true,
  });

  assert.equal(presentation.curation.visible, true);
  assert.equal(presentation.whatsapp.visible, true);
  assert.equal(visibility.showCommerce, true);
  assert.equal(visibility.showWhatsAppCta, true);
  assert.equal(presentation.tryOn.visible, false);
});

run("PR5.1 — gallery visibility is identical for quality_blocked and not_requested try-on states", () => {
  const stateQualityBlocked: VenusPremiumExperienceState = {
    ...readyState,
    tryOn: "quality_blocked",
    uiFlags: { ...readyState.uiFlags, showTryOn: false, showPhotoRetry: true },
  };

  const presentationBlocked = buildPremiumResultPresentationModel({
    experienceState: stateQualityBlocked,
    hasLooks: true,
  });
  const presentationNotRequested = buildPremiumResultPresentationModel({
    experienceState: readyState,
    hasLooks: true,
  });

  const visibilityBlocked = buildPremiumResultSectionVisibility({
    presentation: presentationBlocked,
    commerceRevealReady: true,
    lookCount: 3,
    hasResolvedOrg: true,
    hasTryOnImage: true,
  });
  const visibilityNotRequested = buildPremiumResultSectionVisibility({
    presentation: presentationNotRequested,
    commerceRevealReady: true,
    lookCount: 3,
    hasResolvedOrg: true,
    hasTryOnImage: true,
  });

  assert.equal(visibilityBlocked.showCompleteLooksGallery, true, "gallery must show when quality_blocked");
  assert.equal(visibilityNotRequested.showCompleteLooksGallery, true, "gallery must show when not_requested");
  assert.equal(visibilityBlocked.showTryOnImageBadges, false, "badges hidden when quality_blocked");
  assert.equal(visibilityNotRequested.showTryOnImageBadges, false, "badges hidden when not_requested");
  assert.equal(
    visibilityBlocked.showCommerce,
    visibilityNotRequested.showCommerce,
    "commerce visibility must be equal regardless of try-on state",
  );
});

run("PR5.1 — hero copy does not position try-on as central promise", () => {
  const model = buildPremiumResultPresentationModel({
    experienceState: readyState,
    signatureName: "Autoridade Silenciosa",
    storeName: "Loja Aurora",
    hasLooks: true,
  });

  assert.doesNotMatch(model.hero.subtitle, /try-on|provador virtual|visualizacao no corpo|previa visual/i);
  assert.doesNotMatch(model.hero.helper, /try-on|provador virtual|previa visual/i);
  assert.doesNotMatch(model.hero.title, /try-on|provador/i);
  assert.doesNotMatch(model.whatsapp.cta, /try-on|provador/i);
  assert.doesNotMatch(model.whatsapp.subtitle, /try-on/i);
  assert.match(model.hero.subtitle, /curadoria/i);
});

// ── PR 10: share card in presentation model ───────────────────────────────────

run("PR10 — buildPremiumResultPresentationModel includes shareCard when showShareCard is true", () => {
  const model = buildPremiumResultPresentationModel({
    experienceState: readyState,
    signatureName: "Autoridade Silenciosa",
    storeName: "Loja Aurora",
    hasLooks: true,
    curationPieces: [
      { productId: "sku-1", name: "Blazer preto", role: "hero" },
      { productId: "sku-2", name: "Calca reta", role: "base" },
      { productId: "sku-3", name: "Bolsa media", role: "acabamento" },
    ],
  });

  assert.ok("shareCard" in model, "shareCard must be present in presentation model");
  assert.equal(model.shareCard.flags.usesTryOn, false);
  assert.equal(model.shareCard.flags.hasCuration, true);
  assert.equal(model.shareCard.flags.isShareable, true);
  assert.ok(model.shareCard.curationHighlights.length > 0);
});

run("PR10 — shareCard uses signatureSummary and styleWords when provided", () => {
  const model = buildPremiumResultPresentationModel({
    experienceState: readyState,
    signatureName: "Elegancia Direta",
    signatureSummary: "Presenca estruturada com caimentos limpos.",
    styleWords: ["elegante", "precisa"],
    storeName: "Loja Exemplo",
  });

  assert.match(model.shareCard.visualSignatureSummary, /presenca estruturada/i);
  assert.ok(model.shareCard.styleWords.includes("elegante"));
});

run("PR10 — shareCard does not depend on try-on in presentation model", () => {
  const model = buildPremiumResultPresentationModel({
    experienceState: readyState,
    signatureName: "Autoridade Silenciosa",
  });

  assert.equal(model.shareCard.flags.usesTryOn, false);
  const serialized = JSON.stringify(model.shareCard);
  assert.doesNotMatch(serialized, /tryOnImageUrl|try_on_image/i);
});

run("PR10 — shareCard isShareable follows showPremiumAnalysis flag", () => {
  const stateNoAnalysis = {
    ...readyState,
    uiFlags: { ...readyState.uiFlags, showPremiumAnalysis: false },
  };
  const modelNoAnalysis = buildPremiumResultPresentationModel({ experienceState: stateNoAnalysis });
  assert.equal(modelNoAnalysis.shareCard.flags.isShareable, false);

  const modelWithAnalysis = buildPremiumResultPresentationModel({ experienceState: readyState });
  assert.equal(modelWithAnalysis.shareCard.flags.isShareable, true);
});

run("PR10 — shareCard hasCuration follows showCuration flag", () => {
  const stateNoCuration = {
    ...readyState,
    uiFlags: { ...readyState.uiFlags, showCuration: false, showCatalogFallback: false },
  };
  const model = buildPremiumResultPresentationModel({ experienceState: stateNoCuration });
  assert.equal(model.shareCard.flags.hasCuration, false);
  assert.ok(model.shareCard.warnings.some((w) => w.includes("curation")));
});

run("PR10 — shareCard output contains no PII", () => {
  const model = buildPremiumResultPresentationModel({
    experienceState: readyState,
    signatureName: "Nome Completo Cliente",
    signatureSummary: "cliente.real@example.com SECRET_TOKEN",
    storeName: "08105310-a61d-40fd-82b9-b9142643867c",
    curationPieces: [{ productId: "sku-safe", name: "Blazer preto", role: "hero" }],
  });

  const serialized = JSON.stringify(model.shareCard).toLowerCase();
  assert.doesNotMatch(serialized, /nome completo/i);
  assert.doesNotMatch(serialized, /secret_token/i);
  assert.doesNotMatch(serialized, /08105310/);
  assert.doesNotMatch(serialized, /cliente\.real/i);
});

run("PR10 — shareCard copy is not body judgmental", () => {
  const model = buildPremiumResultPresentationModel({ experienceState: readyState, signatureName: "Presenca Natural" });
  const text = JSON.stringify(model.shareCard);
  for (const pattern of [/disfar[cç]/i, /esconde/i, /mais magr/i, /engorda/i, /barriga/i]) {
    assert.doesNotMatch(text, pattern);
  }
});

run("PR10 — legacy page behavior keeps shareCard with defaults when no curation data", () => {
  const model = buildPremiumResultPresentationModel({ experienceState: readyState });
  assert.ok("shareCard" in model);
  assert.equal(model.shareCard.flags.usesTryOn, false);
  assert.deepEqual(model.shareCard.curationHighlights, []);
});

// ── PR 8: piece role labels ───────────────────────────────────────────────────

run("PR8 — getPieceRoleLabel returns a non-empty string for every canonical role", () => {
  const canonicalRoles = Object.keys(PIECE_ROLE_LABELS) as Array<keyof typeof PIECE_ROLE_LABELS>;
  assert.ok(canonicalRoles.length >= 6, "must cover all canonical roles");

  for (const role of canonicalRoles) {
    const label = getPieceRoleLabel(role);
    assert.ok(typeof label === "string" && label.length > 0, `label for "${role}" must be non-empty`);
    assert.doesNotMatch(label, /undefined|null/i);
  }
});

run("PR8 — getPieceRoleLabel returns consultive premium labels for hero and base", () => {
  assert.match(getPieceRoleLabel("hero"), /protagonista/i);
  assert.match(getPieceRoleLabel("base"), /base do look/i);
});

run("PR8 — getPieceRoleLabel returns non-judgmental labels for all roles", () => {
  const forbidden = [/disfar[cç]/i, /esconde/i, /corrig/i, /imperfei/i, /barriga/i, /engorda/i];
  for (const role of Object.keys(PIECE_ROLE_LABELS) as Array<keyof typeof PIECE_ROLE_LABELS>) {
    const label = getPieceRoleLabel(role);
    for (const pattern of forbidden) {
      assert.doesNotMatch(label, pattern, `label for "${role}" must not contain body-judgment terms`);
    }
  }
});

run("PR8 — PIECE_ROLE_LABELS covers equilibrio, ponto_focal, acabamento and alternativa", () => {
  assert.ok("equilibrio" in PIECE_ROLE_LABELS);
  assert.ok("ponto_focal" in PIECE_ROLE_LABELS);
  assert.ok("acabamento" in PIECE_ROLE_LABELS);
  assert.ok("alternativa" in PIECE_ROLE_LABELS);
  assert.match(PIECE_ROLE_LABELS.ponto_focal, /destaque/i);
  assert.match(PIECE_ROLE_LABELS.acabamento, /acabamento/i);
  assert.match(PIECE_ROLE_LABELS.alternativa, /alternativa/i);
});

// ── Format helpers: enum label formatters ──────────────────────────────────────

run("formatConfidenceLabel maps raw enum values to human labels", () => {
  assert.equal(formatConfidenceLabel("high"), "confiança confirmada");
  assert.equal(formatConfidenceLabel("medium"), "confiança intermediária");
  assert.equal(formatConfidenceLabel("low"), "leitura preliminar");
  assert.doesNotMatch(formatConfidenceLabel("medium"), /^medium$/);
  assert.doesNotMatch(formatConfidenceLabel("high"), /^high$/);
  assert.doesNotMatch(formatConfidenceLabel("low"), /^low$/);
});

run("formatStylePreferenceLabel maps no_preference to Direção aberta", () => {
  assert.equal(formatStylePreferenceLabel("no_preference"), "Direção aberta");
  assert.doesNotMatch(formatStylePreferenceLabel("no_preference"), /no_preference/);
  assert.doesNotMatch(formatStylePreferenceLabel(null), /null/i);
  assert.doesNotMatch(formatStylePreferenceLabel(undefined), /undefined/i);
  assert.equal(formatStylePreferenceLabel("masculine"), "Masculino");
  assert.equal(formatStylePreferenceLabel("feminine"), "Feminino");
});

run("formatExperienceStatusLabel maps all required enum codes", () => {
  assert.match(formatExperienceStatusLabel("fallback_consultive"), /consultivo/i);
  assert.match(formatExperienceStatusLabel("insufficient_catalog"), /ajuste/i);
  assert.match(formatExperienceStatusLabel("not_requested"), /opcional/i);
  assert.match(formatExperienceStatusLabel("quality_blocked"), /indispon/i);
  assert.doesNotMatch(formatExperienceStatusLabel("insufficient_catalog"), /insufficient_catalog/);
  assert.doesNotMatch(formatExperienceStatusLabel("fallback_consultive"), /fallback_consultive/);
  assert.doesNotMatch(formatExperienceStatusLabel("not_requested"), /not_requested/);
  assert.doesNotMatch(formatExperienceStatusLabel("quality_blocked"), /quality_blocked/);
});

// ── Enum leak guard ────────────────────────────────────────────────────────────

run("presentation model text fields do not expose raw enum strings", () => {
  const model = buildPremiumResultPresentationModel({
    experienceState: {
      ...readyState,
      curation: "insufficient_catalog",
      overallStatus: "fallback_consultive",
      tryOn: "quality_blocked",
      uiFlags: {
        ...readyState.uiFlags,
        showCuration: false,
        showCatalogFallback: true,
        showTryOn: false,
        showPhotoRetry: true,
      },
    },
  });

  const textFields = [
    model.hero.eyebrow, model.hero.badge, model.hero.title, model.hero.subtitle, model.hero.helper,
    model.analysis.eyebrow, model.analysis.title, model.analysis.subtitle,
    model.curation.eyebrow, model.curation.title, model.curation.subtitle,
    model.curation.fallbackTitle, model.curation.fallbackBody,
    model.whatsapp.eyebrow, model.whatsapp.title, model.whatsapp.subtitle, model.whatsapp.cta,
    model.share.eyebrow, model.share.title, model.share.subtitle,
    model.tryOn.eyebrow, model.tryOn.title, model.tryOn.subtitle, model.tryOn.unavailableCopy,
  ].join(" ");

  assert.doesNotMatch(textFields, /insufficient_catalog/);
  assert.doesNotMatch(textFields, /fallback_consultive/);
  assert.doesNotMatch(textFields, /not_requested/);
  assert.doesNotMatch(textFields, /quality_blocked/);
  assert.doesNotMatch(textFields, /no_preference/);
  assert.doesNotMatch(textFields, /\bmedium\b/);
});

// ── Forbidden body term guard ──────────────────────────────────────────────────

run("tryOn.unavailableCopy does not contain 'corpo' or 'rosto'", () => {
  const model = buildPremiumResultPresentationModel({ experienceState: readyState });
  assert.doesNotMatch(model.tryOn.unavailableCopy, /\bcorpo\b/i);
  assert.doesNotMatch(model.tryOn.unavailableCopy, /\brosto\b/i);
});

run("all presentation model text fields avoid forbidden body-judgment terms", () => {
  const FORBIDDEN_BODY = [
    /\bcorpo\b/i, /\brosto\b/i, /\bombros\b/i, /tra[cç]os/i,
    /propor[cç][oõ]es/i, /emagrec/i, /disfar[cç]/i, /imperfei[cç]/i, /\bdefeit/i,
  ];
  const model = buildPremiumResultPresentationModel({
    experienceState: readyState,
    signatureName: "Autoridade Silenciosa",
    storeName: "Loja Aurora",
    hasLooks: true,
  });
  const allText = JSON.stringify(model);
  for (const pattern of FORBIDDEN_BODY) {
    assert.doesNotMatch(allText, pattern);
  }
});

// ── Onboarding camera narrative guard ─────────────────────────────────────────

run("onboarding: hero copy does not promise camera as first step", () => {
  const model = buildPremiumResultPresentationModel({
    experienceState: readyState,
    signatureName: "Presença Natural",
    storeName: "Loja Aurora",
    hasLooks: true,
  });
  assert.doesNotMatch(model.hero.subtitle, /me envie uma foto/i);
  assert.doesNotMatch(model.hero.subtitle, /envie.*foto/i);
  assert.doesNotMatch(model.hero.helper, /me envie uma foto/i);
  assert.match(model.hero.subtitle, /curadoria/i);
});

process.stdout.write("\n--- Venus premium result copy tests passed ---\n");
