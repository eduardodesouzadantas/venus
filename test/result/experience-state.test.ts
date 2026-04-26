import assert from "node:assert/strict";

import {
  deriveVenusPremiumExperienceState,
  type VenusPremiumExperienceStateInput,
} from "../../src/lib/result/experience-state.ts";

function run(name: string, fn: () => void) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

const readyBase: VenusPremiumExperienceStateInput = {
  visualAnalysis: { status: "ready", hasSignature: true },
  curation: { status: "ready", lookCount: 1, productCount: 3 },
  whatsapp: { available: true, hasConsultivePayload: true, hasSuggestedMessage: true },
  share: { hasSignatureCard: true },
};

const sensitiveInput: VenusPremiumExperienceStateInput = {
  ...readyBase,
  warnings: [
    "+55 11 99999-1234",
    "cliente.real@example.com",
    "Nome Completo Cliente",
    "data:image/png;base64,ABC123",
    "https://signed.example.com/private.png?token=SECRET",
    "SECRET_TOKEN_123",
    "RAW_AI_RESPONSE_PRIVATE",
    "safe_warning_code",
  ],
  errors: ["rawResponse:RAW_AI_RESPONSE_PRIVATE"],
};

function assertNoSensitiveValues(value: unknown) {
  const serialized = JSON.stringify(value).toLowerCase();
  assert.doesNotMatch(serialized, /\+55 11 99999-1234|99999-1234/);
  assert.doesNotMatch(serialized, /cliente\.real@example\.com|nome completo cliente/);
  assert.doesNotMatch(serialized, /data:image\/png;base64|abc123|signed\.example|secret_token_123|raw_ai_response_private/);
}

run("premium_ready does not require try-on", () => {
  const state = deriveVenusPremiumExperienceState(readyBase);

  assert.equal(state.overallStatus, "premium_ready");
  assert.equal(state.tryOn, "not_requested");
  assert.equal(state.uiFlags.showTryOn, false);
  assert.equal(state.uiFlags.showWhatsAppCta, true);
  assert.equal(state.recommendedNextAction, "open_whatsapp_consultive_handoff");
});

run("premium_ready tolerates try-on blocked by quality gate", () => {
  const state = deriveVenusPremiumExperienceState({
    ...readyBase,
    tryOn: { state: "retry_required", enabled: true, qualityGatePassed: false },
  });

  assert.equal(state.overallStatus, "premium_ready");
  assert.equal(state.tryOn, "quality_blocked");
  assert.equal(state.uiFlags.showTryOn, false);
  assert.equal(state.uiFlags.showPhotoRetry, true);
  assert.ok(state.warnings.includes("tryon:quality_blocked"));
});

run("insufficient catalog produces controlled consultive fallback", () => {
  const state = deriveVenusPremiumExperienceState({
    ...readyBase,
    curation: { status: "insufficient_catalog", lookCount: 0, productCount: 0, missingSlots: ["layer"] },
  });

  assert.equal(state.overallStatus, "fallback_consultive");
  assert.equal(state.curation, "insufficient_catalog");
  assert.equal(state.uiFlags.showCatalogFallback, true);
  assert.equal(state.recommendedNextAction, "open_whatsapp_consultive_handoff");
});

run("missing WhatsApp produces fallback_message_only when a safe message exists", () => {
  const state = deriveVenusPremiumExperienceState({
    ...readyBase,
    whatsapp: { available: false, fallbackMessageAvailable: true },
  });

  assert.equal(state.whatsapp, "fallback_message_only");
  assert.equal(state.overallStatus, "premium_partial");
  assert.equal(state.uiFlags.showWhatsAppCta, true);
});

run("failed visual analysis produces safe error state without fallback channel", () => {
  const state = deriveVenusPremiumExperienceState({
    visualAnalysis: { status: "failed", failed: true },
    curation: { status: "not_available" },
    whatsapp: { available: false },
    share: { available: false },
  });

  assert.equal(state.overallStatus, "error");
  assert.equal(state.visualAnalysis, "failed");
  assert.equal(state.recommendedNextAction, "request_new_photo");
  assert.equal(state.uiFlags.showPhotoRetry, true);
});

run("share is ready without complete catalog when signature exists", () => {
  const state = deriveVenusPremiumExperienceState({
    visualAnalysis: { status: "ready", hasSignature: true },
    curation: { status: "insufficient_catalog", missingSlots: ["bottom"] },
    whatsapp: { available: false },
    share: {},
  });

  assert.equal(state.share, "ready");
  assert.equal(state.uiFlags.showShareCard, true);
  assert.equal(state.overallStatus, "fallback_consultive");
});

run("experience state output does not contain PII or sensitive fields", () => {
  const state = deriveVenusPremiumExperienceState(sensitiveInput);

  assertNoSensitiveValues(state);
  assert.deepEqual(state.warnings, ["safe_warning_code"]);
});

run("reasons and warnings are safe codes", () => {
  const state = deriveVenusPremiumExperienceState(sensitiveInput);
  const allCodes = [...state.reasons, ...state.warnings];

  assert.ok(allCodes.length > 0);
  for (const code of allCodes) {
    assert.match(code, /^[a-z0-9:_-]+$/);
    assert.doesNotMatch(code, /@|base64|https?:|token|secret|phone|email|raw|payload/i);
  }
});

run("tenant org id is not hardcoded or emitted by experience state", () => {
  const state = deriveVenusPremiumExperienceState({
    ...readyBase,
    warnings: ["tenant:maison-elite", "08105310-a61d-40fd-82b9-b9142643867c"],
  });
  const serialized = JSON.stringify(state);

  assert.doesNotMatch(serialized, /maison-elite|08105310-a61d-40fd-82b9-b9142643867c/);
});

run("deriveVenusPremiumExperienceState is deterministic for equal input", () => {
  const first = deriveVenusPremiumExperienceState(readyBase);
  const second = deriveVenusPremiumExperienceState(readyBase);

  assert.deepEqual(first, second);
});

process.stdout.write("\n--- Venus premium experience state tests passed ---\n");
