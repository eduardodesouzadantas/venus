import assert from "node:assert/strict";

import {
  buildPremiumShareCardModel,
  type BuildPremiumShareCardModelInput,
} from "../../src/lib/result/premium-share-card.ts";

function run(name: string, fn: () => void) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

const BODY_JUDGMENT_TERMS = [
  /disfar[cç]/i,
  /esconde/i,
  /mais magr/i,
  /engorda/i,
  /imperfei[cç][aã]o/i,
  /barriga/i,
  /quadril/i,
  /afina\s+o\s+corp/i,
  /corrig(e|iu)/i,
];

const GUARANTEE_TERMS = [/transformac[aã]o\s+garantida/i, /look\s+perfeito\s+garantido/i, /resultado\s+garantido/i];

const SENSITIVE_VALUES = [
  "+55 11 99999-1234",
  "cliente.real@example.com",
  "Nome Completo",
  "data:image/png;base64",
  "https://signed.example.com",
  "SECRET_TOKEN",
  "raw_ai_response",
  "maison-elite",
  "08105310-a61d-40fd-82b9-b9142643867c",
];

function assertNoBodyJudgment(value: unknown) {
  const text = JSON.stringify(value);
  for (const pattern of BODY_JUDGMENT_TERMS) {
    assert.doesNotMatch(text, pattern);
  }
}

function assertNoGuarantee(value: unknown) {
  const text = JSON.stringify(value);
  for (const pattern of GUARANTEE_TERMS) {
    assert.doesNotMatch(text, pattern);
  }
}

function assertNoSensitiveValues(value: unknown) {
  const text = JSON.stringify(value).toLowerCase();
  for (const sensitive of SENSITIVE_VALUES) {
    assert.doesNotMatch(
      text,
      new RegExp(sensitive.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
  assert.doesNotMatch(text, /base64|secret_token|raw_ai_response|signed\.example/);
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const fullInput: BuildPremiumShareCardModelInput = {
  signatureName: "Autoridade Silenciosa",
  signatureSummary: "Presenca limpa, estruturada e segura, com poucos elementos fortes.",
  styleWords: ["elegante", "estruturada", "discreta"],
  palette: ["preto", "off white", "azul marinho"],
  occasion: "trabalho e encontros casuais",
  storeName: "Loja Aurora",
  hasCuration: true,
  hasValidAnalysis: true,
  curationPieces: [
    { productId: "sku-blazer", name: "Blazer preto de alfaiataria", role: "hero" },
    { productId: "sku-calca", name: "Calca reta marinho", role: "base" },
    { productId: "sku-bolsa", name: "Bolsa media couro", role: "acabamento" },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

run("generates premium share card with visual signature and curation", () => {
  const model = buildPremiumShareCardModel(fullInput);

  assert.equal(model.title, "Autoridade Silenciosa");
  assert.ok(model.subtitle.length > 0);
  assert.match(model.visualSignatureSummary, /presenca|estruturada|segura/i);
  assert.ok(model.curationHighlights.length > 0);
  assert.equal(model.flags.hasCuration, true);
  assert.equal(model.flags.isShareable, true);
});

run("share card does not depend on try-on", () => {
  const model = buildPremiumShareCardModel(fullInput);

  // The flag must be statically false — try-on data never enters the share card.
  assert.equal(model.flags.usesTryOn, false);
  // No try-on image URLs or try-on status fields should appear in the output.
  const serialized = JSON.stringify(model);
  assert.doesNotMatch(serialized, /tryOnImageUrl|try_on_image|tryOnUrl|tryOnStatus/i);
});

run("share card does not depend on generated image", () => {
  const model = buildPremiumShareCardModel(fullInput);

  const serialized = JSON.stringify(model);
  assert.doesNotMatch(serialized, /imageUrl|image_url|signedUrl|base64|photo/i);
});

run("generates fallback card when curation is insufficient", () => {
  const model = buildPremiumShareCardModel({
    signatureName: "Elegancia Natural",
    hasValidAnalysis: true,
    hasCuration: false,
    curationPieces: [],
  });

  assert.equal(model.flags.hasCuration, false);
  assert.equal(model.flags.isShareable, true);
  assert.ok(model.title.length > 0);
  assert.match(model.ctaLabel, /assinatura visual/i);
  assert.ok(model.curationHighlights.length === 0);
  assert.ok(model.warnings.some((w) => w.includes("curation")));
});

run("returns non-shareable state when visual analysis is absent", () => {
  const model = buildPremiumShareCardModel({
    signatureName: "Sem analise",
    hasValidAnalysis: false,
    hasCuration: false,
  });

  assert.equal(model.flags.isShareable, false);
  assert.ok(model.warnings.some((w) => w.includes("analysis")));
});

run("uses consultive piece role labels from canonical source", () => {
  const model = buildPremiumShareCardModel(fullInput);

  assert.ok(
    model.curationHighlights.some((h) => h.includes("Peca protagonista")),
    "hero must use label 'Peca protagonista'",
  );
  assert.ok(
    model.curationHighlights.some((h) => h.includes("Base do look")),
    "base must use label 'Base do look'",
  );
  assert.ok(
    model.curationHighlights.some((h) => h.includes("Acabamento consultivo")),
    "acabamento must use label 'Acabamento consultivo'",
  );
});

run("piece role highlights list only distinct canonical roles", () => {
  const model = buildPremiumShareCardModel(fullInput);

  const uniqueHighlights = new Set(model.pieceRoleHighlights);
  assert.equal(model.pieceRoleHighlights.length, uniqueHighlights.size, "no duplicate role highlights");
  assert.ok(model.pieceRoleHighlights.length <= 6);
});

run("output contains no PII or sensitive values", () => {
  const hostileInput: BuildPremiumShareCardModelInput = {
    // signatureName with PII pattern (full name) → must use fallback
    signatureName: "Nome Completo Cliente",
    // signatureSummary with raw AI response / token → must use fallback
    signatureSummary: "SECRET_TOKEN raw_ai_response data:image/png;base64,AAAA",
    // styleWords: first has phone number → must be filtered
    styleWords: ["+55 11 99999-1234", "elegante"],
    // palette: first has signed URL with token → must be filtered
    palette: ["https://signed.example.com?token=abc", "preto"],
    // storeName with UUID → must use "a loja" fallback
    storeName: "08105310-a61d-40fd-82b9-b9142643867c",
    // piece name with email → must use fallback
    curationPieces: [
      { productId: "sku-safe", name: "cliente.real@example.com blazer", role: "hero" },
      { productId: "sku-safe-2", name: "Calca reta", role: "base" },
      { productId: "sku-safe-3", name: "Bolsa media", role: "acabamento" },
    ],
    hasValidAnalysis: true,
    hasCuration: true,
  };

  const model = buildPremiumShareCardModel(hostileInput);
  assertNoSensitiveValues(model);
  // Additional explicit checks
  const serialized = JSON.stringify(model);
  assert.doesNotMatch(serialized, /nome completo/i);
  assert.doesNotMatch(serialized, /secret_token/i);
  assert.doesNotMatch(serialized, /signed\.example/i);
  assert.doesNotMatch(serialized, /08105310/);
});

run("output does not contain body judgment language", () => {
  const model = buildPremiumShareCardModel(fullInput);
  assertNoBodyJudgment(model);
});

run("shareCaption does not promise guaranteed transformation", () => {
  const model = buildPremiumShareCardModel(fullInput);
  assertNoGuarantee(model);
  assert.doesNotMatch(model.shareCaption, /garantid/i);
});

run("buildPremiumShareCardModel is deterministic for equal input", () => {
  const first = buildPremiumShareCardModel(fullInput);
  const second = buildPremiumShareCardModel(fullInput);
  assert.deepEqual(first, second);
});

run("does not hardcode org_id or tenant identifier", () => {
  const model = buildPremiumShareCardModel(fullInput);
  const serialized = JSON.stringify(model);
  assert.doesNotMatch(serialized, /maison-elite|08105310-a61d-40fd-82b9/);
});

run("undefined input does not throw and returns safe defaults", () => {
  const model = buildPremiumShareCardModel();

  assert.ok(typeof model.title === "string" && model.title.length > 0);
  assert.ok(typeof model.shareCaption === "string" && model.shareCaption.length > 0);
  assert.equal(model.flags.usesTryOn, false);
  assert.deepEqual(model.curationHighlights, []);
  assert.deepEqual(model.styleWords, []);
});

run("style words are limited to 4 entries", () => {
  const model = buildPremiumShareCardModel({
    ...fullInput,
    styleWords: ["a", "b", "c", "d", "e", "f", "g"],
  });

  assert.ok(model.styleWords.length <= 4);
});

run("palette labels are limited to 5 entries", () => {
  const model = buildPremiumShareCardModel({
    ...fullInput,
    palette: ["a", "b", "c", "d", "e", "f", "g"],
  });

  assert.ok(model.paletteLabels.length <= 5);
});

run("curation highlights cap at 5 pieces", () => {
  const model = buildPremiumShareCardModel({
    ...fullInput,
    curationPieces: [
      { productId: "p1", name: "Peca 1", role: "hero" },
      { productId: "p2", name: "Peca 2", role: "base" },
      { productId: "p3", name: "Peca 3", role: "acabamento" },
      { productId: "p4", name: "Peca 4", role: "ponto_focal" },
      { productId: "p5", name: "Peca 5", role: "equilibrio" },
      { productId: "p6", name: "Peca 6", role: "alternativa" },
    ],
  });

  assert.ok(model.curationHighlights.length <= 5);
});

run("store name appears in shareCaption when provided", () => {
  const model = buildPremiumShareCardModel({
    ...fullInput,
    storeName: "Boutique Prime",
    hasCuration: true,
  });

  assert.match(model.shareCaption, /Boutique Prime/);
});

run("shareCaption works without store name", () => {
  const model = buildPremiumShareCardModel({
    signatureName: "Presenca Natural",
    hasValidAnalysis: true,
    hasCuration: false,
  });

  assert.ok(typeof model.shareCaption === "string" && model.shareCaption.length > 0);
  assert.doesNotMatch(model.shareCaption, /a loja\b/);
});

run("sensitive signatureName is replaced with safe default", () => {
  const model = buildPremiumShareCardModel({
    signatureName: "https://signed.example.com?token=SECRET",
    hasValidAnalysis: true,
  });

  assert.doesNotMatch(model.title, /https|token|secret/i);
  assert.ok(model.title.length > 0);
});

run("WhatsApp contract is not altered by share card model", () => {
  // The share card model is purely presentational — it has no side effects
  // and does not call or modify the WhatsApp consultive payload.
  const model = buildPremiumShareCardModel(fullInput);
  const serialized = JSON.stringify(model);
  assert.doesNotMatch(serialized, /venus_whatsapp_consultive_v1/);
  assert.doesNotMatch(serialized, /suggestedOpeningMessage/);
});

process.stdout.write("\n--- Premium share card tests passed ---\n");
