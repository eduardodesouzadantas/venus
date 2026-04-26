import assert from "node:assert/strict";

import { deriveVenusPremiumExperienceState } from "../../src/lib/result/experience-state.ts";
import {
  buildExperienceStateInputFromResultData,
  buildExperienceStateTelemetry,
} from "../../src/lib/result/experience-state-adapter.ts";

function run(name: string, fn: () => void) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

const resultSurface = {
  essence: { label: "Autoridade Silenciosa" },
  hero: { title: "Look principal" },
  looks: [
    {
      items: [
        { product_id: "sku-hero", name: "Blazer" },
        { product_id: "sku-base", name: "Calca" },
        { product_id: "sku-finish", name: "Bolsa" },
      ],
    },
  ],
};

const sensitiveCanaries = [
  "+55 11 99999-1234",
  "cliente.real@example.com",
  "Nome Completo Cliente",
  "data:image/png;base64,ABC123",
  "https://signed.example.com/private.png?token=SECRET",
  "SECRET_TOKEN_123",
  "RAW_AI_RESPONSE_PRIVATE",
];

function assertNoSensitiveValues(value: unknown) {
  const serialized = JSON.stringify(value).toLowerCase();

  for (const canary of sensitiveCanaries) {
    assert.doesNotMatch(serialized, new RegExp(canary.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(serialized, /99999-1234|cliente\.real@example\.com|nome completo cliente/);
  assert.doesNotMatch(serialized, /data:image\/png;base64|abc123|signed\.example|secret_token_123|raw_ai_response_private/);
}

run("adapter converts current result data into valid experience state input", () => {
  const input = buildExperienceStateInputFromResultData({
    surface: resultSurface,
    loading: false,
    whatsappUrl: "https://wa.me/5511999999999?text=mensagem",
    tryOnQualityState: null,
    tryOnEnabled: false,
    hasTryOnArtifact: false,
  });
  const state = deriveVenusPremiumExperienceState(input);

  assert.equal(input.visualAnalysis?.status, "ready");
  assert.equal(input.curation?.lookCount, 1);
  assert.equal(input.curation?.productCount, 3);
  assert.equal(input.whatsapp?.available, true);
  assert.equal(state.overallStatus, "premium_ready");
});

run("absence of try-on does not prevent premium_ready", () => {
  const input = buildExperienceStateInputFromResultData({
    surface: resultSurface,
    loading: false,
    whatsappUrl: "https://wa.me/5511999999999",
    tryOnQualityState: null,
    tryOnEnabled: true,
    hasTryOnArtifact: false,
  });
  const state = deriveVenusPremiumExperienceState(input);

  assert.equal(state.overallStatus, "premium_ready");
  assert.equal(state.tryOn, "not_requested");
  assert.equal(state.uiFlags.showTryOn, false);
});

run("catalog fallback without products becomes controlled insufficient_catalog", () => {
  const input = buildExperienceStateInputFromResultData({
    surface: {
      essence: { label: "Assinatura suficiente" },
      curationFallback: { message: "catalogo curto" },
      looks: [],
    },
    loading: false,
    whatsappUrl: "https://wa.me/5511999999999",
    tryOnQualityState: null,
  });
  const state = deriveVenusPremiumExperienceState(input);

  assert.equal(state.curation, "insufficient_catalog");
  assert.equal(state.overallStatus, "fallback_consultive");
  assert.equal(state.uiFlags.showCatalogFallback, true);
  assert.equal(state.recommendedNextAction, "open_whatsapp_consultive_handoff");
});

run("missing WhatsApp URL uses fallback_message_only when message copy exists", () => {
  const input = buildExperienceStateInputFromResultData({
    surface: resultSurface,
    loading: false,
    whatsappUrl: "",
    hasWhatsAppFallbackMessage: true,
    tryOnQualityState: null,
  });
  const state = deriveVenusPremiumExperienceState(input);

  assert.equal(state.whatsapp, "fallback_message_only");
  assert.equal(state.uiFlags.showWhatsAppCta, true);
  assert.equal(state.overallStatus, "premium_partial");
});

run("adapter and telemetry omit PII and sensitive values from result data", () => {
  const input = buildExperienceStateInputFromResultData({
    surface: {
      essence: { label: "Nome Completo Cliente" },
      hero: { title: "cliente.real@example.com" },
      looks: [{ items: [{ imageUrl: "https://signed.example.com/private.png?token=SECRET" }] }],
      curationFallback: { message: "RAW_AI_RESPONSE_PRIVATE" },
    },
    loading: false,
    error: "+55 11 99999-1234 cliente.real@example.com RAW_AI_RESPONSE_PRIVATE",
    whatsappUrl: "https://wa.me/5511999999999?text=Nome%20Completo%20Cliente&token=SECRET_TOKEN_123",
    tryOnQualityState: "retry_required",
    hasTryOnError: true,
    hasTryOnArtifact: true,
  });
  const state = deriveVenusPremiumExperienceState(input);
  const telemetry = buildExperienceStateTelemetry(state);

  assertNoSensitiveValues(input);
  assertNoSensitiveValues(telemetry);
});

run("state telemetry is safe for result page logs", () => {
  const input = buildExperienceStateInputFromResultData({
    surface: resultSurface,
    loading: false,
    whatsappUrl: "https://wa.me/5511999999999?text=cliente.real@example.com",
    tryOnQualityState: "preview",
    hasTryOnArtifact: true,
  });
  const state = deriveVenusPremiumExperienceState(input);
  const telemetry = buildExperienceStateTelemetry(state);

  assert.deepEqual(Object.keys(telemetry).sort(), [
    "counts",
    "curation",
    "overallStatus",
    "reasons",
    "recommendedNextAction",
    "share",
    "tryOn",
    "uiFlags",
    "visualAnalysis",
    "warnings",
    "whatsapp",
  ]);
  assertNoSensitiveValues(telemetry);
});

run("legacy result data without look items stays controlled", () => {
  const input = buildExperienceStateInputFromResultData({
    surface: {
      essence: { label: "Leitura legada" },
      looks: [{ items: null }],
    },
    loading: false,
    whatsappUrl: "",
    hasWhatsAppFallbackMessage: true,
  });
  const state = deriveVenusPremiumExperienceState(input);

  assert.equal(state.visualAnalysis, "ready");
  assert.equal(state.curation, "partial");
  assert.equal(state.whatsapp, "fallback_message_only");
  assert.equal(state.overallStatus, "premium_partial");
});

run("adapter does not emit hardcoded tenant identifiers or final state decisions", () => {
  const input = buildExperienceStateInputFromResultData({
    surface: resultSurface,
    loading: false,
    whatsappUrl: "https://wa.me/5511999999999",
  });
  const serialized = JSON.stringify(input);

  assert.doesNotMatch(serialized, /maison-elite|08105310-a61d-40fd-82b9-b9142643867c/);
  assert.equal(Object.prototype.hasOwnProperty.call(input, "overallStatus"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(input, "uiFlags"), false);
});

run("adapter is deterministic for equal result data", () => {
  const first = buildExperienceStateInputFromResultData({
    surface: resultSurface,
    loading: false,
    whatsappUrl: "https://wa.me/5511999999999",
    tryOnQualityState: "hero",
  });
  const second = buildExperienceStateInputFromResultData({
    surface: resultSurface,
    loading: false,
    whatsappUrl: "https://wa.me/5511999999999",
    tryOnQualityState: "hero",
  });

  assert.deepEqual(first, second);
});

process.stdout.write("\n--- Venus premium experience state adapter tests passed ---\n");
