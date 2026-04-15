const assert = require("node:assert/strict");

const {
  getToneProfile,
  adaptToneForMessageCount,
  adaptToneForSentiment,
  adaptToneForMemory,
  getBrandVoice,
  adaptVocabularyWithBrand,
  applyVoiceIntensity,
  applyFormality,
  refineResponse,
} = require("../../src/lib/ai/tone-engine");

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

run("getToneProfile returns correct profile for DISCOVERY state", () => {
  const profile = getToneProfile("DISCOVERY");
  assert.strictEqual(profile.tone, "friendly");
  assert.strictEqual(profile.maxLength, 180);
  assert.strictEqual(profile.persuasionLevel, "minimal");
});

run("getToneProfile returns correct profile for CLOSING state", () => {
  const profile = getToneProfile("CLOSING");
  assert.strictEqual(profile.tone, "direct");
  assert.strictEqual(profile.maxLength, 150);
  assert.strictEqual(profile.persuasionLevel, "high");
});

run("getToneProfile returns correct profile for POST_PURCHASE state", () => {
  const profile = getToneProfile("POST_PURCHASE");
  assert.strictEqual(profile.greetingPrefix, "Parabéns!");
  assert.strictEqual(profile.emotionalTone, "warm");
});

run("adaptToneForMessageCount increases persuasion after 4 messages in DISCOVERY", () => {
  const profile = getToneProfile("DISCOVERY");
  const context = {
    currentState: "DISCOVERY",
    messageCount: 5,
  };
  const adapted = adaptToneForMessageCount(profile, 5, context);
  assert.strictEqual(adapted.persuasionLevel, "soft");
});

run("adaptToneForSentiment increases enthusiasm on positive sentiment", () => {
  const profile = getToneProfile("DISCOVERY");
  const adapted = adaptToneForSentiment(profile, "positive");
  assert.strictEqual(adapted.emotionalTone, "enthusiastic");
});

run("adaptToneForSentiment uses warm tone on negative sentiment", () => {
  const profile = getToneProfile("DISCOVERY");
  const adapted = adaptToneForSentiment(profile, "negative");
  assert.strictEqual(adapted.emotionalTone, "warm");
  assert.strictEqual(adapted.ctaStyle, "open_question");
});

run("adaptToneForMemory becomes more consultive with returning user", () => {
  const profile = getToneProfile("DISCOVERY");
  const memory = {
    userId: "user-1",
    orgId: "org-1",
    styleIdentity: "clássico",
    conversationCount: 5,
    totalTryOns: 0,
    converted: false,
    tags: [],
  };
  const adapted = adaptToneForMemory(profile, memory);
  assert.strictEqual(adapted.tone, "consultive");
  assert.strictEqual(adapted.emotionalTone, "warm");
});

run("getBrandVoice returns default voice for unknown brand type", () => {
  const voice = getBrandVoice("unknown");
  assert.strictEqual(voice.formality, "friendly");
  assert.strictEqual(voice.intensity, "moderate");
});

run("getBrandVoice returns premium voice for premium brand", () => {
  const voice = getBrandVoice("premium");
  assert.strictEqual(voice.formality, "formal");
  assert.strictEqual(voice.intensity, "subtle");
});

run("getBrandVoice returns casual voice for casual brand", () => {
  const voice = getBrandVoice("casual");
  assert.strictEqual(voice.formality, "casual");
});

run("adaptVocabularyWithBrand replaces vocabulary", () => {
  const voice = getBrandVoice("default");
  const text = "Quero comprar esse produto";
  const adapted = adaptVocabularyWithBrand(text, voice);
  assert.strictEqual(adapted, "Quero garantir esse peça");
});

run("applyVoiceIntensity reduces intensity for subtle", () => {
  const text = "Quero algo muito diferente";
  const result = applyVoiceIntensity(text, "subtle");
  assert.strictEqual(result, "Quero algo um pouco diferente");
});

run("applyFormality applies formal transformations", () => {
  const text = "Queria saber se pode";
  const result = applyFormality(text, "formal");
  assert.strictEqual(result, "Gostaria saber se consegue");
});

run("refineResponse respects max length for state", () => {
  const context = {
    currentState: "DISCOVERY",
    messageCount: 1,
    intentScore: 0,
    tryOnCount: 0,
    viewedProducts: [],
    hasStyleProfile: false,
    hasPurchaseIntent: false,
    closingTriggers: [],
    lastUserMessage: "",
    lastMessageAt: null,
    previousState: null,
  };
  const analysis = {
    text: "Olá",
    tokens: ["olá"],
    detectedIntents: [],
    detectedEntities: {},
    sentiment: "neutral",
    isClosingSignal: false,
    needsContext: true,
  };

  const longResponse =
    "Esta é uma resposta muito longa que deve ser truncada porque excede o limite máximo permitido para o estado de descoberta. Precisamos garantir que o texto seja curto e objetivo.";
  const refined = refineResponse(longResponse, "DISCOVERY", context, analysis, null, "default");

  assert.strictEqual(refined.length < 200, true);
});