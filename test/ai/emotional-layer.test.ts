const assert = require("node:assert/strict");

const {
  detectEmotionalNeed,
  getReinforcementMessage,
  addEmotionalReinforcement,
  getPostPurchaseBehavior,
  hasResolvedIntent,
  adaptForInsecurity,
} = require("../../src/lib/ai/emotional-layer");

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

run("hasResolvedIntent returns true for purchase_intent", () => {
  const triggers = [
    {
      type: "purchase_intent",
      confidence: 0.9,
      detectedAt: new Date().toISOString(),
      messageSnippet: "Quero comprar",
    },
  ];
  const result = hasResolvedIntent(triggers);
  assert.strictEqual(result, true);
});

run("hasResolvedIntent returns false for price_inquiry", () => {
  const triggers = [
    {
      type: "price_inquiry",
      confidence: 0.8,
      detectedAt: new Date().toISOString(),
      messageSnippet: "Qual o preço?",
    },
  ];
  const result = hasResolvedIntent(triggers);
  assert.strictEqual(result, false);
});

run("detectEmotionalNeed returns confidence for negative sentiment", () => {
  const analysis = {
    text: "Não sei se gosto",
    tokens: ["não", "sei", "se", "gosto"],
    detectedIntents: [],
    detectedEntities: {},
    sentiment: "negative",
    isClosingSignal: false,
    needsContext: false,
  };
  const context = {
    currentState: "DISCOVERY",
    messageCount: 2,
    closingTriggers: [],
  };

  const result = detectEmotionalNeed(analysis, context, []);
  assert.strictEqual(result, "confidence");
});

run("detectEmotionalNeed returns aesthetic-validation for positive in LOOK_RECOMMENDATION", () => {
  const analysis = {
    text: "Adorei",
    tokens: ["adorei"],
    detectedIntents: [],
    detectedEntities: {},
    sentiment: "positive",
    isClosingSignal: false,
    needsContext: false,
  };
  const context = {
    currentState: "LOOK_RECOMMENDATION",
    messageCount: 2,
    closingTriggers: [],
  };

  const result = detectEmotionalNeed(analysis, context, []);
  assert.strictEqual(result, "aesthetic-validation");
});

run("detectEmotionalNeed returns choice-validation in CLOSING", () => {
  const analysis = {
    text: "Vou levar",
    tokens: ["vou", "levar"],
    detectedIntents: [],
    detectedEntities: {},
    sentiment: "positive",
    isClosingSignal: true,
    needsContext: false,
  };
  const context = {
    currentState: "CLOSING",
    messageCount: 2,
    closingTriggers: [],
  };

  const result = detectEmotionalNeed(analysis, context, []);
  assert.strictEqual(result, "choice-validation");
});

run("detectEmotionalNeed returns self-esteem for objection", () => {
  const analysis = {
    text: "Não sei",
    tokens: ["não", "sei"],
    detectedIntents: [],
    detectedEntities: {},
    sentiment: "neutral",
    isClosingSignal: false,
    needsContext: false,
  };
  const context = {
    currentState: "DISCOVERY",
    messageCount: 4,
    closingTriggers: [],
  };
  const triggers = [
    {
      type: "objection",
      confidence: 0.6,
      detectedAt: new Date().toISOString(),
      messageSnippet: "Não sei",
    },
  ];

  const result = detectEmotionalNeed(analysis, context, triggers);
  assert.strictEqual(result, "self-esteem");
});

run("getReinforcementMessage returns message for valid type", () => {
  const context = {
    currentState: "DISCOVERY",
    messageCount: 1,
  };

  const message = getReinforcementMessage("self-esteem", context);
  assert.ok(message !== null);
  assert.ok(message.length > 0);
});

run("getReinforcementMessage returns null for invalid type", () => {
  const context = {
    currentState: "DISCOVERY",
    messageCount: 1,
  };

  const message = getReinforcementMessage(null, context);
  assert.strictEqual(message, null);
});

run("getPostPurchaseBehavior allows upsell by default", () => {
  const context = {
    currentState: "POST_PURCHASE",
    messageCount: 1,
  };
  const memory = {
    userId: "user-1",
    orgId: "org-1",
    conversationCount: 1,
    totalTryOns: 0,
    converted: true,
    tags: [],
  };

  const behavior = getPostPurchaseBehavior(context, memory, { allowUpsell: true, allowComplement: true });
  assert.strictEqual(behavior.shouldUpsell, true);
});

run("getPostPurchaseBehavior forbids upsell when disabled", () => {
  const context = {
    currentState: "POST_PURCHASE",
    messageCount: 1,
  };
  const memory = {
    userId: "user-1",
    orgId: "org-1",
    conversationCount: 1,
    totalTryOns: 0,
    converted: true,
    tags: [],
  };

  const behavior = getPostPurchaseBehavior(context, memory, { allowUpsell: false, allowComplement: false });
  assert.strictEqual(behavior.shouldUpsell, false);
  assert.strictEqual(behavior.shouldSuggestComplement, false);
});

run("adaptForInsecurity adds reassurance for insecure user", () => {
  const analysis = {
    text: "Não tenho certeza",
    tokens: ["não", "tenho", "certeza"],
    detectedIntents: [],
    detectedEntities: {},
    sentiment: "curious",
    isClosingSignal: false,
    needsContext: false,
  };
  const response = "Quer que eu te mostre?";
  const adapted = adaptForInsecurity(response, analysis, null);

  assert.ok(adapted.length > response.length);
});

run("adaptForInsecurity keeps same response for confident user", () => {
  const analysis = {
    text: "Adorei essa opção",
    tokens: ["adorei", "essa", "opção"],
    detectedIntents: [],
    detectedEntities: {},
    sentiment: "positive",
    isClosingSignal: false,
    needsContext: false,
  };
  const response = "Quer que eu te mostre?";
  const adapted = adaptForInsecurity(response, analysis, null);

  assert.strictEqual(adapted, response);
});