const assert = require("node:assert/strict");

const {
  getCloserConfig,
  detectClosingSignal,
  shouldReduceExploration,
  buildCloserResponse,
  addUpsellLight,
  isClosingReady,
  getClosingMetrics,
} = require("../../src/lib/ai/closer-refinement");

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

run("getCloserConfig returns default config", () => {
  const config = getCloserConfig("default");
  assert.strictEqual(config.maxExplorationMessages, 3);
  assert.strictEqual(config.frictionReduction, true);
  assert.strictEqual(config.upsellMode, "light");
});

run("getCloserConfig returns conservative config", () => {
  const config = getCloserConfig("conservative");
  assert.strictEqual(config.maxExplorationMessages, 5);
  assert.strictEqual(config.upsellMode, "none");
});

run("getCloserConfig returns premium config", () => {
  const config = getCloserConfig("premium");
  assert.strictEqual(config.upsellMode, "none");
});

run("detectClosingSignal returns price signal for price_inquiry", () => {
  const triggers = [
    {
      type: "price_inquiry",
      confidence: 0.8,
      detectedAt: new Date().toISOString(),
      messageSnippet: "Qual o preço?",
    },
  ];
  const signal = detectClosingSignal(triggers);
  assert.notStrictEqual(signal, null);
  assert.strictEqual(signal?.type, "price");
});

run("detectClosingSignal returns ready signal for purchase_intent", () => {
  const triggers = [
    {
      type: "purchase_intent",
      confidence: 0.9,
      detectedAt: new Date().toISOString(),
      messageSnippet: "Quero comprar",
    },
  ];
  const signal = detectClosingSignal(triggers);
  assert.notStrictEqual(signal, null);
  assert.strictEqual(signal?.type, "ready");
});

run("detectClosingSignal returns null for no triggers", () => {
  const signal = detectClosingSignal([]);
  assert.strictEqual(signal, null);
});

run("shouldReduceExploration returns true with purchase intent", () => {
  const context = {
    currentState: "LOOK_RECOMMENDATION",
    messageCount: 2,
  };
  const triggers = [
    {
      type: "purchase_intent",
      confidence: 0.9,
      detectedAt: new Date().toISOString(),
      messageSnippet: "Quero comprar",
    },
  ];
  const result = shouldReduceExploration(context, triggers);
  assert.strictEqual(result, true);
});

run("shouldReduceExploration returns false without triggers", () => {
  const context = {
    currentState: "DISCOVERY",
    messageCount: 1,
  };
  const triggers: never[] = [];
  const result = shouldReduceExploration(context, triggers);
  assert.strictEqual(result, false);
});

run("buildCloserResponse handles price inquiry", () => {
  const context = {
    currentState: "CLOSING",
    messageCount: 3,
  };
  const triggers = [
    {
      type: "price_inquiry",
      confidence: 0.8,
      detectedAt: new Date().toISOString(),
      messageSnippet: "Qual o preço?",
    },
  ];
  const analysis = {
    text: "Qual o preço?",
    tokens: ["qual", "o", "preço"],
    detectedIntents: ["price_inquiry"],
    detectedEntities: {},
    sentiment: "curious",
    isClosingSignal: true,
    needsContext: false,
  };
  const config = getCloserConfig("default");
  const response = buildCloserResponse(context, triggers, analysis, null, config);
  assert.ok(response.length > 0);
});

run("buildCloserResponse handles objection", () => {
  const context = {
    currentState: "CLOSING",
    messageCount: 4,
  };
  const triggers = [
    {
      type: "objection",
      confidence: 0.6,
      detectedAt: new Date().toISOString(),
      messageSnippet: "Está muito caro",
    },
  ];
  const analysis = {
    text: "Está muito caro",
    tokens: ["está", "muito", "caro"],
    detectedIntents: ["objection"],
    detectedEntities: {},
    sentiment: "negative",
    isClosingSignal: false,
    needsContext: false,
  };
  const config = getCloserConfig("default");
  const response = buildCloserResponse(context, triggers, analysis, null, config);
  assert.ok(response.length > 0);
});

run("isClosingReady returns true with purchase intent", () => {
  const triggers = [
    {
      type: "purchase_intent",
      confidence: 0.9,
      detectedAt: new Date().toISOString(),
      messageSnippet: "Quero comprar",
    },
  ];
  const context = {
    currentState: "CLOSING",
    messageCount: 2,
  };
  const result = isClosingReady(triggers, context);
  assert.strictEqual(result, true);
});

run("getClosingMetrics calculates readiness correctly", () => {
  const triggers = [
    {
      type: "purchase_intent",
      confidence: 0.9,
      detectedAt: new Date().toISOString(),
      messageSnippet: "Quero comprar",
    },
  ];
  const context = {
    currentState: "CLOSING",
    messageCount: 2,
  };
  const metrics = getClosingMetrics(triggers, context);
  assert.strictEqual(metrics.readiness, 100);
  assert.strictEqual(metrics.recommendedAction, "close");
});

run("getClosingMetrics detects price friction", () => {
  const triggers = [
    {
      type: "price_inquiry",
      confidence: 0.8,
      detectedAt: new Date().toISOString(),
      messageSnippet: "Qual o preço?",
    },
  ];
  const context = {
    currentState: "CLOSING",
    messageCount: 2,
  };
  const metrics = getClosingMetrics(triggers, context);
  assert.strictEqual(metrics.readiness, 70);
  assert.strictEqual(metrics.mainFriction, "price");
  assert.strictEqual(metrics.recommendedAction, "address_price");
});