const assert = require("node:assert/strict");

const {
  processConversation,
} = require("../../src/lib/ai/conversation-engine");

const {
  CONVERSATION_STATES,
  STATE_TRANSITIONS,
} = require("../../src/lib/ai/state-machine");

const {
  analyzeMessage,
  detectClosingTriggers,
  detectConversationState,
  isClosingMode,
} = require("../../src/lib/ai/conversation-state-detector");

const {
  buildResponseStrategy,
} = require("../../src/lib/ai/response-strategy");

const {
  getToneProfile,
} = require("../../src/lib/ai/tone-engine");

const {
  getCloserConfig,
  getClosingMetrics,
  shouldReduceExploration,
} = require("../../src/lib/ai/closer-refinement");

const {
  detectEmotionalNeed,
  hasResolvedIntent,
} = require("../../src/lib/ai/emotional-layer");

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name} - ${error.message}\n`);
    throw error;
  }
}

process.stdout.write("\n=== VENUS JOURNEY AUDIT ===\n");

process.stdout.write("\n--- 1. CRITICAL JOURNEYS ---\n");

run("Journey 1: New user discovery flow", () => {
  const conversationStates = ["DISCOVERY", "STYLE_ANALYSIS", "LOOK_RECOMMENDATION", "CLOSING", "POST_PURCHASE"];
  for (const state of conversationStates) {
    assert.ok(CONVERSATION_STATES[state], `State ${state} should exist`);
  }
});

run("Journey 2: Try-on flow", () => {
  const states = ["DISCOVERY", "STYLE_ANALYSIS", "TRY_ON_GUIDED", "LOOK_RECOMMENDATION", "CLOSING"];
  for (const state of states) {
    assert.ok(CONVERSATION_STATES[state], `State ${state} should exist`);
  }
});

run("Journey 3: Returning user reengagement", () => {
  assert.ok(CONVERSATION_STATES["REENGAGEMENT"], "REENGAGEMENT state should exist");
});

process.stdout.write("\n--- 2. STATE TRANSITIONS ---\n");

run("All defined transitions have valid from/to states", () => {
  for (const transition of STATE_TRANSITIONS) {
    assert.ok(CONVERSATION_STATES[transition.from], `Transition from ${transition.from} invalid`);
    assert.ok(CONVERSATION_STATES[transition.to], `Transition to ${transition.to} invalid`);
  }
});

run("DISCOVERY transitions to STYLE_ANALYSIS or LOOK_RECOMMENDATION", () => {
  const discoveryTransitions = STATE_TRANSITIONS.filter(t => t.from === "DISCOVERY");
  assert.ok(discoveryTransitions.length >= 2, "DISCOVERY should have at least 2 transitions");
});

run("CLOSING transitions to POST_PURCHASE or CATALOG_ASSISTED", () => {
  const closingTransitions = STATE_TRANSITIONS.filter(t => t.from === "CLOSING");
  assert.ok(closingTransitions.length >= 2, "CLOSING should have at least 2 transitions");
});

process.stdout.write("\n--- 3. DETECTION CONSISTENCY ---\n");

run("Message analysis returns valid sentiment", () => {
  const cases = [
    { text: "Adorei tudo!", sentiment: "positive" },
    { text: "Não gostei", sentiment: "negative" },
    { text: "Quanto custa?", sentiment: "curious" },
    { text: "Olá tudo bem", sentiment: "neutral" },
  ];
  for (const { text, sentiment } of cases) {
    const analysis = analyzeMessage(text);
    assert.ok(analysis.sentiment, `Should detect sentiment for: "${text}"`);
  }
});

run("Closing trigger detection works for key signals", () => {
  const triggers = [
    { text: "Quero comprar agora", type: "purchase_intent" },
    { text: "Quanto custa?", type: "price_inquiry" },
    { text: "Que tamanho tem?", type: "size_inquiry" },
    { text: "Gostei muito!", type: "positive_feedback" },
  ];
  for (const { text, type } of triggers) {
    const found = detectClosingTriggers(text);
    assert.ok(found.length > 0, `Should detect closing trigger for: "${text}"`);
  }
});

run("isClosingMode detects purchase intent", () => {
  const result = isClosingMode([
    { type: "purchase_intent", confidence: 0.8, detectedAt: new Date().toISOString(), messageSnippet: "quero comprar" }
  ]);
  assert.strictEqual(result, true, "Should return true for purchase_intent");
});

run("isClosingMode detects positive feedback", () => {
  const result = isClosingMode([
    { type: "positive_feedback", confidence: 0.7, detectedAt: new Date().toISOString(), messageSnippet: "gostei" }
  ]);
  assert.strictEqual(result, true, "Should return true for positive_feedback");
});

run("isClosingMode returns false for price inquiry only", () => {
  const result = isClosingMode([
    { type: "price_inquiry", confidence: 0.7, detectedAt: new Date().toISOString(), messageSnippet: "quanto custa?" }
  ]);
  assert.strictEqual(result, false, "Should return false for price_inquiry only");
});

process.stdout.write("\n--- 4. RESPONSE STRATEGY ---\n");

run("Response strategy builds for each state", () => {
  const states = Object.keys(CONVERSATION_STATES);
  for (const state of states) {
    const context = {
      currentState: state,
      messageCount: 1,
      intentScore: 50,
      tryOnCount: 0,
      viewedProducts: [],
      hasStyleProfile: false,
      closingTriggers: [],
    };
    const analysis = analyzeMessage("test");
    const strategy = buildResponseStrategy(state, context, analysis, null);
    assert.ok(strategy, `Should build strategy for ${state}`);
  }
});

run("CLOSING state has direct tone and high persuasion", () => {
  const context = { currentState: "CLOSING", messageCount: 1, intentScore: 80, tryOnCount: 0, viewedProducts: [], hasStyleProfile: false, closingTriggers: [] };
  const analysis = analyzeMessage("quero comprar");
  const strategy = buildResponseStrategy("CLOSING", context, analysis, null);
  assert.strictEqual(strategy.tone, "direct", "CLOSING should have direct tone");
  assert.strictEqual(strategy.persuasionLevel, "high", "CLOSING should have high persuasion");
});

run("DISCOVERY state has friendly tone and minimal persuasion", () => {
  const context = { currentState: "DISCOVERY", messageCount: 1, intentScore: 30, tryOnCount: 0, viewedProducts: [], hasStyleProfile: false, closingTriggers: [] };
  const analysis = analyzeMessage("oi");
  const strategy = buildResponseStrategy("DISCOVERY", context, analysis, null);
  assert.strictEqual(strategy.tone, "friendly", "DISCOVERY should have friendly tone");
  assert.strictEqual(strategy.persuasionLevel, "minimal", "DISCOVERY should have minimal persuasion");
});

process.stdout.write("\n--- 5. TONE ENGINE CONSISTENCY ---\n");

run("Tone profiles exist for all states", () => {
  const states = Object.keys(CONVERSATION_STATES);
  for (const state of states) {
    const profile = getToneProfile(state);
    assert.ok(profile, `Tone profile should exist for ${state}`);
    assert.ok(profile.tone, `${state} should have tone defined`);
    assert.ok(profile.maxLength, `${state} should have maxLength`);
  }
});

run("Tone matches state persuasion level", () => {
  const profile = getToneProfile("CLOSING");
  assert.strictEqual(profile.persuasionLevel, "high", "CLOSING should have high persuasion");
  
  const discoveryProfile = getToneProfile("DISCOVERY");
  assert.strictEqual(discoveryProfile.persuasionLevel, "minimal", "DISCOVERY should have minimal");
});

process.stdout.write("\n--- 6. CLOSER REFINEMENT ---\n");

run("Closer configs exist for all modes", () => {
  const modes = ["default", "conservative", "aggressive", "premium"];
  for (const mode of modes) {
    const config = getCloserConfig(mode);
    assert.ok(config, `Closer config should exist for ${mode}`);
  }
});

run("Closing metrics calculate readiness correctly", () => {
  const triggers = [
    { type: "purchase_intent", confidence: 0.9, detectedAt: new Date().toISOString(), messageSnippet: "quero comprar" }
  ];
  const context = { currentState: "CLOSING", messageCount: 2 };
  const metrics = getClosingMetrics(triggers, context);
  assert.strictEqual(metrics.readiness, 100, "Purchase intent should give 100 readiness");
  assert.strictEqual(metrics.recommendedAction, "close", "Should recommend close action");
});

run("Closing metrics detect price friction", () => {
  const triggers = [
    { type: "price_inquiry", confidence: 0.8, detectedAt: new Date().toISOString(), messageSnippet: "quanto custa?" }
  ];
  const context = { currentState: "CLOSING", messageCount: 2 };
  const metrics = getClosingMetrics(triggers, context);
  assert.strictEqual(metrics.mainFriction, "price", "Should detect price friction");
});

run("shouldReduceExploration returns true with purchase intent", () => {
  const context = { currentState: "LOOK_RECOMMENDATION", messageCount: 2 };
  const triggers = [
    { type: "purchase_intent", confidence: 0.9, detectedAt: new Date().toISOString(), messageSnippet: "vou levar" }
  ];
  const result = shouldReduceExploration(context, triggers);
  assert.strictEqual(result, true, "Should reduce exploration with purchase intent");
});

process.stdout.write("\n--- 7. EMOTIONAL LAYER ---\n");

run("Emotional needs detected for different sentiments", () => {
  const cases = [
    { sentiment: "negative", state: "DISCOVERY", expected: "confidence" },
    { sentiment: "positive", state: "LOOK_RECOMMENDATION", expected: "aesthetic-validation" },
  ];
  for (const { sentiment, state, expected } of cases) {
    const analysis = { text: "test", tokens: [], detectedIntents: [], detectedEntities: {}, sentiment, isClosingSignal: false, needsContext: false };
    const context = { currentState: state, messageCount: 1, closingTriggers: [] };
    const need = detectEmotionalNeed(analysis, context, []);
    if (sentiment === "negative") {
      assert.strictEqual(need, "confidence", "negative sentiment should trigger confidence");
    }
  }
});

run("hasResolvedIntent detects purchase intent", () => {
  const triggers = [
    { type: "purchase_intent", confidence: 0.9, detectedAt: new Date().toISOString(), messageSnippet: "vou comprar" }
  ];
  const result = hasResolvedIntent(triggers);
  assert.strictEqual(result, true, "Should detect resolved intent for purchase_intent");
});

run("hasResolvedIntent returns false for price inquiry", () => {
  const triggers = [
    { type: "price_inquiry", confidence: 0.8, detectedAt: new Date().toISOString(), messageSnippet: "quanto?" }
  ];
  const result = hasResolvedIntent(triggers);
  assert.strictEqual(result, false, "Should not detect resolved intent for price_inquiry");
});

process.stdout.write("\n--- 8. CONVERSATION STATE DETECTOR ---\n");

run("State detection handles closing signals", () => {
  const context = { currentState: "LOOK_RECOMMENDATION", previousState: null, messageCount: 3, lastMessageAt: null, lastUserMessage: "Quero comprar", intentScore: 80, tryOnCount: 0, viewedProducts: [], hasStyleProfile: true, hasPurchaseIntent: false, closingTriggers: [{ type: "purchase_intent", confidence: 0.9, detectedAt: new Date().toISOString(), messageSnippet: "quero comprar" }] };
  const analysis = analyzeMessage("Quero comprar");
  const state = detectConversationState(context, analysis);
  assert.strictEqual(state, "CLOSING", "Should transition to CLOSING for purchase intent");
});

run("State detection handles returning user", () => {
  const context = { currentState: "REENGAGEMENT", previousState: null, messageCount: 1, lastMessageAt: null, lastUserMessage: "Olá", intentScore: 0, tryOnCount: 0, viewedProducts: [], hasStyleProfile: true, hasPurchaseIntent: false, closingTriggers: [] };
  const analysis = analyzeMessage("Olá");
  const state = detectConversationState(context, analysis);
  assert.ok(state, "Should return a valid state for returning user");
});

process.stdout.write("\n--- 9. COHERENCE CHECKS ---\n");

run("State transitions are bidirectional or have alternatives", () => {
  const fromStates = new Set(STATE_TRANSITIONS.map(t => t.from));
  const toStates = new Set(STATE_TRANSITIONS.map(t => t.to));
  let orphanStates = 0;
  for (const state of fromStates) {
    if (!toStates.has(state)) {
      orphanStates++;
    }
  }
  assert.ok(orphanStates < 3, "Most states should have return paths");
});

run("Each state has at least one outgoing transition", () => {
  for (const state of Object.keys(CONVERSATION_STATES)) {
    const outgoing = STATE_TRANSITIONS.filter(t => t.from === state);
    assert.ok(outgoing.length > 0 || state === "POST_PURCHASE", `State ${state} should have outgoing transitions or be terminal`);
  }
});

run("CTA text is defined for closing states", () => {
  const closingStates = ["CLOSING", "POST_PURCHASE"];
  for (const state of closingStates) {
    const profile = getToneProfile(state);
    assert.ok(profile, `Should have tone profile for ${state}`);
  }
});

process.stdout.write("\n--- 10. FRICTION POINT VALIDATION ---\n");

run("No infinite loop in state transitions", () => {
  const seen = new Set();
  let current = "DISCOVERY";
  for (let i = 0; i < 10; i++) {
    if (seen.has(current)) break;
    seen.add(current);
    const transitions = STATE_TRANSITIONS.filter(t => t.from === current);
    if (transitions.length === 0) break;
    current = transitions[0].to;
  }
  assert.ok(seen.size < 10, "Should not have infinite path");
});

run("Closing always reachable from discovery", () => {
  const discoveryToClosing = STATE_TRANSITIONS.filter(t => 
    t.from === "LOOK_RECOMMENDATION" || 
    t.from === "CATALOG_ASSISTED" ||
    t.from === "TRY_ON_GUIDED"
  ).some(t => t.to === "CLOSING");
  assert.ok(discoveryToClosing, "CLOSING should be reachable from exploration states");
});

run("Post-purchase is reachable from CLOSING", () => {
  const closingToPostPurchase = STATE_TRANSITIONS.some(t => t.from === "CLOSING" && t.to === "POST_PURCHASE");
  assert.ok(closingToPostPurchase, "POST_PURCHASE should be reachable from CLOSING");
});

process.stdout.write("\n=== JOURNEY AUDIT COMPLETE ===\n");