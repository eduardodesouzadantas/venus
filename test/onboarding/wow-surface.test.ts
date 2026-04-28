import assert from "node:assert/strict";

import { buildOnboardingWowCopy } from "../../src/lib/onboarding/wow-surface.ts";
import { isOnboardingWowSurfaceEnabled } from "../../src/lib/onboarding/feature-flags.ts";
import { buildVenusBodyScannerIntro, buildVenusStylistIntro, resolveVenusTenantBrand } from "../../src/lib/venus/brand.ts";
import {
  buildFollowUpWithoutPhoto,
  generateAnticipationMessage,
  generateConsultoryAfterWow,
} from "../../src/lib/ai/photo-analysis-flow.ts";

function run(name: string, fn: () => void) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

function normalize(text: string) {
  return text.toLowerCase();
}

run("buildOnboardingWowCopy sets intent-first narrative without camera promise as first step", () => {
  const copy = buildOnboardingWowCopy("Loja Aurora");

  assert.ok(copy.intro.includes("Loja Aurora"), "store name must appear in intro");
  assert.ok(
    copy.intro.includes("intenção") || copy.intro.includes("direção"),
    "intro must set intent-first expectation"
  );
  assert.doesNotMatch(copy.intro, /me envie uma foto/i, "intro must not promise camera before intent");
  assert.doesNotMatch(copy.analyzing, /rosto/i, "analyzing must not use 'rosto'");
  assert.ok(copy.analyzing.includes("wow"), "analyzing must reference the wow moment");
  assert.ok(
    copy.followUp.includes("opcional") || copy.followUp.includes("câmera") || copy.followUp.includes("sem foto"),
    "followUp must position camera as optional"
  );
  assert.ok(copy.wowSummary.includes("Depois do resultado"), "wowSummary must include 'Depois do resultado'");
  assert.ok(copy.consultiveNote.includes("visagismo"), "consultiveNote must reference visagismo");
  assert.equal(copy.sendPhotoLabel, "Enviar foto agora", "sendPhotoLabel must be unchanged");
  assert.equal(copy.continueLabel, "Continuar com a Venus", "continueLabel must be unchanged");
});

run("brand helpers resolve premium public identity", () => {
  const withLogo = resolveVenusTenantBrand({
    orgSlug: "loja-aurora",
    branchName: "Loja Aurora",
    logoUrl: "https://cdn.example.com/logo.png",
    primaryColor: "#111111",
  });

  assert.equal(withLogo.displayName, "Loja Aurora");
  assert.equal(withLogo.logoUrl, "https://cdn.example.com/logo.png");
  assert.equal(withLogo.hasLogo, true);

  const fallback = resolveVenusTenantBrand({ orgSlug: "loja-aurora" }, "sua loja");
  assert.equal(fallback.displayName, "Loja Aurora");
  assert.equal(fallback.hasLogo, false);
});

run("brand and photo flow helpers set intent-first narrative without forbidden terms", () => {
  const intro = buildVenusStylistIntro();
  const scannerIntro = buildVenusBodyScannerIntro();
  const anticipation = generateAnticipationMessage();
  const followUp = buildFollowUpWithoutPhoto();

  // Must not promise camera before intent
  assert.doesNotMatch(intro, /me envie uma foto/i);
  assert.doesNotMatch(intro, /perfeito\.\s*agora eu refino/i);
  assert.doesNotMatch(scannerIntro, /perfeito\.\s*agora eu refino/i);
  assert.doesNotMatch(anticipation, /perfeito\.\s*agora eu refino/i);

  // Must not contain forbidden physical-judgment terms
  const allText = [intro, scannerIntro, anticipation, followUp].join(" ");
  assert.doesNotMatch(allText, /\brosto\b/i);
  assert.doesNotMatch(allText, /\bcorpo\b/i);
  assert.doesNotMatch(allText, /tra[cç]os/i);
  assert.doesNotMatch(allText, /propor[cç][oõ]es/i);

  // Direction must be mentioned or camera positioned as optional
  assert.ok(
    intro.includes("direção") || intro.includes("intenção") || intro.includes("câmera"),
    "intro must reference style direction or position camera as optional"
  );

  assert.equal(followUp, "Pode ser uma foto simples mesmo — eu ajusto tudo pra você 😊");

  const consultive = generateConsultoryAfterWow(
    {
      colorSeason: "Inverno Puro",
      faceShape: "oval",
      bestColors: ["preto", "azul-marinho", "prata"],
      styleIdentity: "elegante",
      bodyType: "estruturado",
    },
    {
      orgId: "org-1",
      userId: "user-1",
      conversationId: "conv-1",
      currentState: "LOOK_RECOMMENDATION",
      previousState: null,
      messageCount: 3,
      lastMessageAt: null,
      lastUserMessage: null,
      intentScore: 50,
      tryOnCount: 1,
      viewedProducts: [],
      hasStyleProfile: true,
      hasPurchaseIntent: false,
      closingTriggers: [],
      hasPhotoUploaded: true,
      photoUploadAt: new Date().toISOString(),
      analysisInProgress: false,
      analysisCompleted: true,
      firstWowDelivered: true,
    }
  );

  assert.ok(consultive.includes("leitura de cor"));
  assert.ok(consultive.includes("visagismo"));
  assert.ok(consultive.includes("outras opções nessa mesma linha"));

  // generateConsultoryAfterWow must not use body-judgment language
  assert.doesNotMatch(consultive, /\brosto\b/i);
  assert.doesNotMatch(consultive, /\bcorpo\b/i);
  assert.doesNotMatch(consultive, /\bombros\b/i);
  assert.doesNotMatch(consultive, /tra[cç]os/i);
  assert.doesNotMatch(consultive, /propor[cç][oõ]es/i);
});

run("photo-first helpers do not reintroduce abstract onboarding questions or forbidden terms", () => {
  const forbidden = [
    "qual linha sustenta sua imagem",
    "que presença você quer que a roupa entregue",
    "quando você se olha no espelho",
    "a venus lê seu rosto",
    "baseado no seu corpo",
    "perfeito. agora eu refino",
    "me envie uma foto",
  ];

  const samples = [
    buildOnboardingWowCopy("Loja Aurora").intro,
    buildOnboardingWowCopy("Loja Aurora").followUp,
    buildOnboardingWowCopy("Loja Aurora").sending,
    buildOnboardingWowCopy("Loja Aurora").analyzing,
    buildVenusStylistIntro(),
    buildVenusBodyScannerIntro(),
    generateAnticipationMessage(),
    buildFollowUpWithoutPhoto(),
  ];

  for (const sample of samples) {
    const normalized = normalize(sample);
    for (const phrase of forbidden) {
      assert.equal(normalized.includes(phrase), false, `Unexpected abstract prompt: ${sample}`);
    }
  }
});

run("isOnboardingWowSurfaceEnabled is photo-first by default", () => {
  const previous = {
    enabled: process.env.NEXT_PUBLIC_ONBOARDING_WOW_ENABLED,
    legacyEnabled: process.env.NEXT_PUBLIC_ONBOARDING_LEGACY_ENABLED,
    legacyOrgs: process.env.NEXT_PUBLIC_ONBOARDING_LEGACY_ORGS,
    legacyOrgIds: process.env.NEXT_PUBLIC_ONBOARDING_LEGACY_ORG_IDS,
  };

  try {
    delete process.env.NEXT_PUBLIC_ONBOARDING_WOW_ENABLED;
    delete process.env.NEXT_PUBLIC_ONBOARDING_LEGACY_ENABLED;
    delete process.env.NEXT_PUBLIC_ONBOARDING_LEGACY_ORGS;
    delete process.env.NEXT_PUBLIC_ONBOARDING_LEGACY_ORG_IDS;

    assert.equal(isOnboardingWowSurfaceEnabled({ orgSlug: "loja-aurora" }), true);
    assert.equal(isOnboardingWowSurfaceEnabled({ orgId: "org-123" }), true);
    assert.equal(isOnboardingWowSurfaceEnabled({ orgSlug: "outra-loja" }), true);

    process.env.NEXT_PUBLIC_ONBOARDING_WOW_ENABLED = "false";
    assert.equal(isOnboardingWowSurfaceEnabled({ orgSlug: "loja-aurora" }), false);

    process.env.NEXT_PUBLIC_ONBOARDING_WOW_ENABLED = "true";
    assert.equal(isOnboardingWowSurfaceEnabled({ orgSlug: "loja-aurora" }), true);

    process.env.NEXT_PUBLIC_ONBOARDING_LEGACY_ENABLED = "true";
    process.env.NEXT_PUBLIC_ONBOARDING_LEGACY_ORGS = "loja-aurora,loja-beta";
    assert.equal(isOnboardingWowSurfaceEnabled({ orgSlug: "loja-aurora" }), false);
    assert.equal(isOnboardingWowSurfaceEnabled({ orgSlug: "outra-loja" }), true);
  } finally {
    process.env.NEXT_PUBLIC_ONBOARDING_WOW_ENABLED = previous.enabled;
    process.env.NEXT_PUBLIC_ONBOARDING_LEGACY_ENABLED = previous.legacyEnabled;
    process.env.NEXT_PUBLIC_ONBOARDING_LEGACY_ORGS = previous.legacyOrgs;
    process.env.NEXT_PUBLIC_ONBOARDING_LEGACY_ORG_IDS = previous.legacyOrgIds;
  }
});

console.log("\n--- Onboarding wow surface tests passed ---");
