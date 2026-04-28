/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");

const {
  buildPremiumResultViewModel,
} = require("../../src/lib/result/premium-result-view-model.ts");

function run(name: string, fn: () => void) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

const surface = {
  essence: {
    label: "assinatura de comando",
    summary: "A leitura cruza autoridade com zonas de ruído controladas.",
    confidenceLabel: "medium",
    keySignals: ["encaixe slim e traços marcantes", "sustentada por prateado"],
  },
  headline: "Essência captada: assinatura de comando",
  subheadline: "contexto ainda está sendo refinado",
  hero: { dominantStyle: "Autoridade Silenciosa", subtitle: "A leitura cruza autoridade." },
  palette: {
    description: "Paleta sustentada por prateado.",
    colors: [{ name: "preto" }],
    evidence: {
      basePalette: [{ name: "preto" }, { name: "off white" }],
      accentPalette: [{ name: "vinho" }],
      avoidOrUseCarefully: [{ name: "neon" }],
      confidence: "high",
      evidence: "Contraste médio sem zonas de ruído.",
    },
  },
  diagnostic: { gapSolution: "peças com caimento limpo" },
  accessories: { advice: "com detalhes em prata" },
  looks: [
    {
      id: "look-1",
      name: "Base de presença",
      explanation: "Blazer entra como peça principal por uma presença mais limpa.",
      items: [
        { id: "sku-1", product_id: "sku-1", name: "Blazer preto" },
        { id: "sku-2", product_id: "sku-2", name: "Calça reta" },
      ],
    },
  ],
  toAvoid: ["zonas de ruído no mesmo look", "disfarçar imperfeição"],
};

run("normalizes premium result into client-safe language", () => {
  const model = buildPremiumResultViewModel({
    surface,
    tryOn: { status: "completed", imageUrl: "https://example.com/tryon.png", qualityState: "hero" },
  });

  const text = JSON.stringify(model);
  assert.equal(model.signatureName, "look de presença");
  assert.equal(model.tryOn.status, "approved");
  assert.equal(model.tryOn.imageUrl, "https://example.com/tryon.png");
  assert.match(model.confidenceLabel, /consistente/i);
  assert.ok(model.recommendedLooks[0].productIds.includes("sku-1"));
  assert.match(model.recommendedLooks[0].whatsappMessage, /atendimento humana|orientação humana/i);
  assert.doesNotMatch(text, /zonas de ruído/i);
  assert.doesNotMatch(text, /assinatura de comando/i);
  assert.doesNotMatch(text, /retry_required|quality_blocked|insufficient_catalog|not_requested/i);
  assert.doesNotMatch(text, /bi[oó]tipo|defeito|disfar[cç]ar|corpo ideal|imperfei[cç][aã]o|tra[cç]os marcantes/i);
});

run("hides generated image unless try-on is approved", () => {
  const model = buildPremiumResultViewModel({
    surface,
    tryOn: { status: "completed", imageUrl: "https://example.com/bad.png", qualityState: "preview" },
  });

  assert.equal(model.tryOn.status, "rejected");
  assert.equal(model.tryOn.imageUrl, undefined);
  assert.match(model.tryOn.fallbackMessage, /prévia visual fica para depois/i);
});

run("does not invent products when catalog is insufficient", () => {
  const model = buildPremiumResultViewModel({
    surface: { ...surface, looks: [] },
    tryOn: { status: "failed", hasError: true },
  });

  assert.deepEqual(model.recommendedLooks, []);
  assert.match(model.shareCards.find((card: { type: string }) => card.type === "look").headline, /Catálogo insuficiente/i);
});

run("handles result without try-on image using a consultive fallback", () => {
  const model = buildPremiumResultViewModel({ surface, tryOn: null });

  assert.equal(model.tryOn.status, "not_requested");
  assert.equal(model.tryOn.imageUrl, undefined);
  assert.match(model.tryOn.fallbackMessage, /curadoria já está pronta/i);
  assert.ok(model.recommendedLooks.length > 0);
});

run("keeps failed try-on image hidden", () => {
  const model = buildPremiumResultViewModel({
    surface,
    tryOn: { status: "failed", imageUrl: "https://example.com/failed.png", hasError: true },
  });

  assert.equal(model.tryOn.status, "failed");
  assert.equal(model.tryOn.imageUrl, undefined);
  assert.match(model.tryOn.fallbackMessage, /peças reais da loja/i);
});

run("replaces technical copy with client-safe fallback", () => {
  const model = buildPremiumResultViewModel({
    surface: {
      ...surface,
      headline: "quality_blocked retry_required payload raw score",
      subheadline: "PROFILE_DIRECTION_CONFLICT",
      looks: [
        {
          id: "look-technical",
          name: "INVALID_LOOK",
          explanation: "insufficient_catalog enum raw",
          items: [{ id: "sku-1", product_id: "sku-1", name: "Blazer preto" }],
        },
      ],
    },
  });

  const text = JSON.stringify(model);
  assert.match(model.impactPhrase, /presença sem precisar exagerar/i);
  assert.match(model.shortDescription, /curadoria comprável/i);
  assert.doesNotMatch(text, /quality_blocked|retry_required|payload|raw|PROFILE_DIRECTION_CONFLICT|INVALID_LOOK|insufficient_catalog/i);
});

run("uses elegant defaults when result data is partial", () => {
  const model = buildPremiumResultViewModel({
    surface: {
      essence: null,
      palette: null,
      looks: [
        {
          id: "look-partial",
          items: [{ id: "sku-3", name: "Camisa branca" }],
        },
      ],
    },
  });

  assert.equal(model.signatureName, "Sua assinatura visual");
  assert.ok(model.palette.bestColors.length > 0);
  assert.deepEqual(model.recommendedLooks[0].productIds, ["sku-3"]);
  assert.match(model.recommendedLooks[0].reason, /combinação simples/i);
});

process.stdout.write("\n--- Premium result view model tests passed ---\n");

export {};
