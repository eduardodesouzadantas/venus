/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const {
  LEAD_STATUSES,
  createEmptyLeadStatusCounts,
  getLeadStatusEventType,
  resolveLeadStatus,
} = require("../src/lib/leads/index.ts");
const {
  createLeadStateIdempotencyKey,
  createProcessAndPersistLeadIdempotencyKey,
  stripOnboardingBinaryArtifacts,
  stableStringify,
} = require("../src/lib/reliability/idempotency.ts");
const {
  collectOperationalSignalSummary,
} = require("../src/lib/agency/operational-signals.ts");
const {
  buildAgencyOperationalRecommendations,
  buildOrgOperationalRecommendations,
  formatOperationalPriorityLabel,
  formatOperationalReasonLabel,
} = require("../src/lib/agency/operational-recommendations.ts");
const {
  buildCatalogAwareFallbackResult,
  normalizeOpenAIRecommendationPayload,
  summarizeOnboardingProfile,
} = require("../src/lib/ai/result-normalizer.ts");
const {
  buildResultSurface,
  hasLegacyTryOnProducts,
} = require("../src/lib/result/surface.ts");
const {
  buildVenusStylistAudit,
} = require("../src/lib/venus/stylist-audit.ts");
const {
  buildWhatsAppStylistCommercePlan,
} = require("../src/lib/whatsapp/stylist-engine.ts");
const {
  ensureTryOnProductId,
  isValidTryOnProductId,
} = require("../src/lib/tryon/product-id.ts");
const {
  classifyTryOnQuality,
  evaluateTryOnStructural,
  evaluateTryOnVisual,
} = require("../src/lib/tryon/result-quality.ts");
const {
  buildWhatsAppHandoffMessage,
} = require("../src/lib/whatsapp/handoff.ts");
const {
  buildCatalogEnrichmentSignals,
  deriveVisualSignalsFromMetrics,
} = require("../src/lib/ai/catalog-enricher.ts");
const {
  PRODUCT_IMAGE_MAX_BYTES,
  validateProductImageFile,
} = require("../src/lib/catalog/product-enrichment.ts");
const {
  buildInventoryAlerts,
  resolveProductStockSnapshot,
} = require("../src/lib/catalog/stock.ts");
const {
  buildAgencyResourceControlRows,
  canAccessAgencyResourceControl,
  RESOURCE_CONTROL_FIELD_DEFINITIONS,
} = require("../src/lib/agency/resource-control.ts");
const {
  buildGamificationOverview,
  canAccessGamificationPanel,
  gamificationResourceLabel,
  gamificationRuleLabel,
} = require("../src/lib/gamification/index.ts");
const {
  buildGamificationTriggerEventKey,
  summariseGamificationAutomation,
} = require("../src/lib/gamification/events.ts");
const {
  buildMerchantActionPanel,
  canAccessMerchantActionPanel,
} = require("../src/lib/merchant/action-panel.ts");
const {
  loadMerchantRoiMetrics,
} = require("../src/lib/merchant/roi.ts");
const {
  buildTenantPrivacyExportBundle,
} = require("../src/lib/privacy/tenant-data.ts");
const {
  sanitizePrivacyLogEntry,
  stripUrlQuery,
  maskPhone,
  maskEmail,
} = require("../src/lib/privacy/logging.ts");
const {
  orchestrateExperience,
} = require("../src/lib/ai/orchestrator.ts");
const {
  buildOperationalValueSummary,
  collectOperationalValueSummary,
  formatOperationalValueRate,
} = require("../src/lib/agency/value-summary.ts");
const {
  buildOperationalAgingSummary,
  mergeOperationalAgingSummaries,
  formatOperationalAgeDays,
} = require("../src/lib/agency/aging-summary.ts");
const {
  captureOperationalTiming,
  createOperationalEventDedupeKey,
  formatOperationalReason,
} = require("../src/lib/reliability/observability.ts");
const {
  checkInMemoryRateLimit,
  clearInMemoryRateLimitState,
  logSecurityEvent,
} = require("../src/lib/reliability/security.ts");
const {
  isProcessingReservationClaimable,
  shouldWaitOnProcessingReservation,
} = require("../src/lib/reliability/processing.ts");
const {
  getPolicyRules,
  matchRule,
  evaluateCondition,
  applyAdjustmentAction,
  conditionsToLabels,
} = require("../src/lib/optimization/policy-engine.ts");
const {
  runAutoLimitsJob,
  getOptimizationRecommendations,
} = require("../src/lib/optimization/auto-limits.ts");
const {
  recordOptimizationAudit,
  queryOptimizationAudit,
  getOptimizationStats,
  getOrgOptimizationHistory,
} = require("../src/lib/optimization/audit.ts");

require("./catalog-query/presentation.test.ts");
require("./assisted-recommendation.presentation.test.ts");
require("./onboarding/public-surface.test.ts");
require("./onboarding/style-direction.test.ts");
require("./onboarding/wow-surface.test.ts");
require("./security/cross-tenant.test.ts");

const sampleOnboarding = {
  intent: {
    imageGoal: "Autoridade",
    satisfaction: 9,
    mainPain: "Ruído visual",
  },
  lifestyle: {
    environments: ["loja", "evento"],
    purchaseDna: "curadoria",
    purchaseBehavior: "consulta",
  },
  colors: {
    favoriteColors: ["preto"],
    avoidColors: ["amarelo"],
    metal: "Prateado",
  },
  colorimetry: {
    skinTone: "médio",
    undertone: "neutro",
    contrast: "médio",
    colorSeason: "Inverno Puro",
    faceShape: "oval",
    idealNeckline: "Decote em V",
    idealFit: "Caimento slim com ombro estruturado",
    idealFabrics: ["crepe", "lã fria", "algodão encorpado"],
    avoidFabrics: ["malha muito fina", "tecido muito brilhante"],
  },
  body: {
    highlight: ["ombros"],
    camouflage: ["abdômen"],
    fit: "Slim",
    faceLines: "Marcantes",
    hairLength: "Curto",
  },
  scanner: {
    facePhoto: "data:image/png;base64,AAAABBBBCCCC",
    bodyPhoto: "data:image/png;base64,DDDDEEEEFFFF",
    skipped: false,
  },
  contact: {
    name: "Cliente Exemplo",
    phone: "+55 (11) 99999-9999",
    email: "cliente@exemplo.com",
  },
};

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

function buildSupabaseQueryResult(resolveResult) {
  const filters = [];
  const chain = {
    select() {
      return chain;
    },
    eq(column, value) {
      filters.push({ type: "eq", column, value });
      return chain;
    },
    gte(column, value) {
      filters.push({ type: "gte", column, value });
      return chain;
    },
    not(column, operator, value) {
      filters.push({ type: "not", column, operator, value });
      return chain;
    },
    limit() {
      return chain;
    },
    order() {
      return chain;
    },
    then(resolve, reject) {
      const result = typeof resolveResult === "function" ? resolveResult(filters) : resolveResult;
      return Promise.resolve(result).then(resolve, reject);
    },
  };

  return chain;
}

async function withMockedModules(mockMap, fn) {
  const originalLoad = Module._load;

  Module._load = function mockedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mockMap, request)) {
      return mockMap[request];
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return await fn();
  } finally {
    Module._load = originalLoad;
  }
}

function loadFresh(modulePath) {
  const resolved = require.resolve(modulePath);
  delete require.cache[resolved];
  return require(modulePath);
}

async function withTempEnv(values, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined || value === null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function createGamificationMemoryRepo(initial = {}) {
  const state = {
    orgs: initial.orgs ? [...initial.orgs] : [],
    rules: initial.rules ? [...initial.rules] : [],
    events: initial.events ? [...initial.events] : [],
    ruleSeq: 0,
    eventSeq: 0,
  };

  const nowIso = () => new Date().toISOString();
  const clone = (value) => JSON.parse(JSON.stringify(value));

  return {
    state,
    async loadOrg(orgId) {
      return clone(state.orgs.find((org) => org.id === orgId) || null);
    },
    async listRules(orgId) {
      return clone(
        state.rules
          .filter((rule) => rule.org_id === orgId)
          .sort((left, right) => right.created_at.localeCompare(left.created_at))
          .map((rule) => ({
            trigger_mode: "manual",
            trigger_event_type: null,
            ...rule,
          }))
      );
    },
    async getRule(orgId, ruleId) {
      const rule = state.rules.find((item) => item.org_id === orgId && item.id === ruleId);
      return clone(rule ? { trigger_mode: "manual", trigger_event_type: null, ...rule } : null);
    },
    async insertRule(input) {
      const row = {
        id: `rule-${++state.ruleSeq}`,
        org_id: input.org_id,
        rule_type: input.rule_type,
        trigger_mode: input.trigger_mode || "manual",
        trigger_event_type: input.trigger_event_type || null,
        benefit_resource_type: input.benefit_resource_type,
        benefit_amount: input.benefit_amount,
        active: input.active,
        per_customer_limit: input.per_customer_limit,
        per_customer_period_days: input.per_customer_period_days,
        valid_from: input.valid_from,
        valid_until: input.valid_until || null,
        label: input.label,
        description: input.description || null,
        created_by_user_id: input.created_by_user_id || null,
        updated_by_user_id: input.updated_by_user_id || null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      state.rules.unshift(row);
      return clone(row);
    },
    async updateRule(orgId, ruleId, input) {
      const row = state.rules.find((item) => item.org_id === orgId && item.id === ruleId);
      if (!row) return null;
      Object.assign(row, input, { updated_at: input.updated_at || nowIso() });
      return clone(row);
    },
    async listEvents(orgId, limit = 40) {
      return clone(
        state.events
          .filter((event) => event.org_id === orgId)
          .sort((left, right) => right.created_at.localeCompare(left.created_at))
          .slice(0, limit)
      );
    },
    async listCustomerRuleEvents(orgId, customerKey, ruleId, sinceIso) {
      return clone(
        state.events
          .filter((event) => event.org_id === orgId)
          .filter((event) => event.customer_key === customerKey)
          .filter((event) => event.rule_id === ruleId)
          .filter((event) => event.created_at >= sinceIso)
          .sort((left, right) => right.created_at.localeCompare(left.created_at))
      );
    },
    async listCustomerEvents(orgId, customerKey, limit = 50) {
      return clone(
        state.events
          .filter((event) => event.org_id === orgId)
          .filter((event) => event.customer_key === customerKey)
          .sort((left, right) => right.created_at.localeCompare(left.created_at))
          .slice(0, limit)
      );
    },
    async insertEvent(input) {
      const row = {
        id: `event-${++state.eventSeq}`,
        org_id: input.org_id,
        rule_id: input.rule_id || null,
        customer_key: input.customer_key || null,
        customer_label: input.customer_label || null,
        event_type: input.event_type,
        status: input.status || "success",
        resource_type: input.resource_type || null,
        amount: input.amount || 0,
        reason: input.reason || null,
        actor_user_id: input.actor_user_id || null,
        source_event_type: input.source_event_type || null,
        source_event_key: input.source_event_key || null,
        metadata: input.metadata || {},
        expires_at: input.expires_at || null,
        created_at: input.created_at || nowIso(),
      };
      state.events.unshift(row);
      return clone(row);
    },
    async findEventBySourceEventKey(orgId, ruleId, sourceEventKey) {
      return clone(
        state.events.find(
          (event) => event.org_id === orgId && event.rule_id === ruleId && event.source_event_key === sourceEventKey
        ) || null
      );
    },
    async updateEvent(orgId, eventId, input) {
      const row = state.events.find((event) => event.org_id === orgId && event.id === eventId);
      if (!row) return null;
      Object.assign(row, input);
      return clone(row);
    },
  };
}

run("lead statuses include closing and keep counters aligned", () => {
  assert.ok(LEAD_STATUSES.includes("closing"));

  const counts = createEmptyLeadStatusCounts();
  assert.equal(counts.closing, 0);
  assert.equal(counts.won, 0);
  assert.equal(counts.lost, 0);
});

run("resolveLeadStatus preserves terminal states and order", () => {
  assert.equal(resolveLeadStatus("closing", "qualified"), "closing");
  assert.equal(resolveLeadStatus("won", "lost"), "won");
  assert.equal(resolveLeadStatus("lost", "won"), "lost");
  assert.equal(resolveLeadStatus("qualified", "closing"), "closing");
  assert.equal(resolveLeadStatus("new", "engaged"), "engaged");
});

run("lead status event types map terminal states", () => {
  assert.equal(getLeadStatusEventType("closing"), "lead.closing_started");
  assert.equal(getLeadStatusEventType("won"), "lead.closed_won");
  assert.equal(getLeadStatusEventType("lost"), "lead.closed_lost");
});

run("binary onboarding artifacts are stripped before persistence", () => {
  const sanitized = stripOnboardingBinaryArtifacts(sampleOnboarding);

  assert.equal(sanitized.scanner.facePhoto, "[IMAGE_REFERENCE_STRIPPED_FOR_STORAGE]");
  assert.equal(sanitized.scanner.bodyPhoto, "[IMAGE_REFERENCE_STRIPPED_FOR_STORAGE]");
  assert.equal(sanitized.contact?.email, sampleOnboarding.contact.email);
});

run("process idempotency key stays stable for equal sanitized payloads", () => {
  const keyOne = createProcessAndPersistLeadIdempotencyKey({
    orgId: "org-1",
    source: "app",
    userData: sampleOnboarding,
  });

  const keyTwo = createProcessAndPersistLeadIdempotencyKey({
    orgId: "org-1",
    source: "app",
    userData: {
      ...sampleOnboarding,
      scanner: {
        ...sampleOnboarding.scanner,
        facePhoto: "different-base64-value",
        bodyPhoto: "another-different-base64-value",
      },
    },
  });

  assert.equal(keyOne, keyTwo);
});

run("lead state idempotency key changes when requested state changes", () => {
  const keyOne = createLeadStateIdempotencyKey({
    orgId: "org-1",
    leadId: "lead-1",
    hasStatus: true,
    status: "closing",
    hasNextFollowUpAt: true,
    nextFollowUpAt: "2026-04-06T15:00:00.000Z",
    expectedUpdatedAt: "2026-04-06T14:00:00.000Z",
  });

  const keyTwo = createLeadStateIdempotencyKey({
    orgId: "org-1",
    leadId: "lead-1",
    hasStatus: true,
    status: "won",
    hasNextFollowUpAt: true,
    nextFollowUpAt: "2026-04-06T15:00:00.000Z",
    expectedUpdatedAt: "2026-04-06T14:00:00.000Z",
  });

  assert.notEqual(keyOne, keyTwo);
});

run("stableStringify sorts object keys deterministically", () => {
  const a = stableStringify({ b: 2, a: 1, nested: { d: 4, c: 3 } });
  const b = stableStringify({ nested: { c: 3, d: 4 }, a: 1, b: 2 });

  assert.equal(a, b);
});

run("processing reservation waits while busy and becomes claimable on failure or expiration", () => {
  const now = new Date("2026-04-06T12:00:00.000Z");

  assert.equal(
    shouldWaitOnProcessingReservation({
      reservation_key: "k",
      status: "in_progress",
      saved_result_id: null,
      owner_token: "owner-a",
      expires_at: "2026-04-06T12:05:00.000Z",
      error_message: null,
    }, now),
    true
  );

  assert.equal(
    isProcessingReservationClaimable({
      reservation_key: "k",
      status: "failed",
      saved_result_id: null,
      owner_token: "owner-a",
      expires_at: "2026-04-06T12:05:00.000Z",
      error_message: "boom",
    }, now),
    true
  );

  assert.equal(
    isProcessingReservationClaimable({
      reservation_key: "k",
      status: "in_progress",
      saved_result_id: null,
      owner_token: "owner-a",
      expires_at: "2026-04-06T11:59:59.000Z",
      error_message: null,
    }, now),
    true
  );

  assert.equal(
    isProcessingReservationClaimable({
      reservation_key: "k",
      status: "completed",
      saved_result_id: "result-1",
      owner_token: "owner-a",
      expires_at: "2026-04-06T12:05:00.000Z",
      error_message: null,
    }, now),
    false
  );
});

run("operational reasons and timings stay canonical", () => {
  assert.equal(formatOperationalReason("single_flight", "expired reclaimed"), "single_flight:expired_reclaimed");
  assert.equal(formatOperationalReason("tenant_blocked", "kill switch on"), "tenant_blocked:kill_switch_on");

  const timing = captureOperationalTiming(1_000, 1_750);
  assert.equal(timing.started_at, "1970-01-01T00:00:01.000Z");
  assert.equal(timing.completed_at, "1970-01-01T00:00:01.750Z");
  assert.equal(timing.duration_ms, 750);
});

run("operational event dedupe keys stay stable for equivalent inputs", () => {
  const keyOne = createOperationalEventDedupeKey([
    "saved_result.process_and_persist_succeeded",
    "org-1",
    "lead-1",
    "result-1",
  ]);
  const keyTwo = createOperationalEventDedupeKey([
    "saved_result.process_and_persist_succeeded",
    "org-1",
    "lead-1",
    "result-1",
  ]);
  const keyThree = createOperationalEventDedupeKey([
    "saved_result.process_and_persist_failed",
    "org-1",
    "lead-1",
    "result-1",
  ]);

  assert.equal(keyOne, keyTwo);
  assert.notEqual(keyOne, keyThree);
});

run("operational signal summary aggregates reasons, waits and latency", () => {
  const summary = collectOperationalSignalSummary([
    {
      org_id: "org-a",
      event_type: "billing.hard_cap_blocked",
      created_at: "2026-04-06T12:00:00.000Z",
      payload: {
        reason_code: "hard_cap:saved_results",
        duration_ms: 120,
      },
    },
    {
      org_id: "org-a",
      event_type: "saved_result.processing_reservation_wait",
      created_at: "2026-04-06T12:01:00.000Z",
      payload: {
        reason_code: "single_flight:busy",
        wait_duration_ms: 230,
      },
    },
    {
      org_id: "org-b",
      event_type: "lead.update_conflict",
      created_at: "2026-04-06T12:02:00.000Z",
      payload: {
        reason_code: "conflict:stale_snapshot",
        duration_ms: 40,
      },
    },
  ], { limit: 3 });

  assert.equal(summary.total_events, 3);
  assert.equal(summary.blocked_count, 1);
  assert.equal(summary.conflict_count, 1);
  assert.equal(summary.wait_count, 1);
  assert.equal(summary.top_reason_codes[0].key, "hard_cap:saved_results");
  assert.equal(summary.top_orgs[0].key, "org-a");
  assert.equal(summary.top_orgs[0].friction_score, 2);
  assert.equal(summary.avg_duration_ms, (120 + 230 + 40) / 3);
});

run("operational recommendations stay deterministic and actionable", () => {
  const summary = {
    total_events: 8,
    blocked_count: 3,
    conflict_count: 1,
    wait_count: 2,
    failed_count: 0,
    reclaimed_count: 0,
    avg_duration_ms: 1680,
    max_duration_ms: 4200,
    top_reason_codes: [
      { key: "hard_cap:saved_results", count: 3 },
      { key: "single_flight:busy", count: 2 },
      { key: "conflict:stale_snapshot", count: 1 },
    ],
    top_event_types: [
      {
        key: "saved_result.process_and_persist_succeeded",
        count: 3,
        avg_duration_ms: 1680,
        max_duration_ms: 4200,
      },
      {
        key: "lead.update_conflict",
        count: 1,
        avg_duration_ms: 40,
        max_duration_ms: 60,
      },
    ],
    top_orgs: [
      {
        key: "org-a",
        count: 4,
        friction_score: 6,
        blocked_count: 2,
        conflict_count: 1,
        wait_count: 1,
        failed_count: 0,
        avg_duration_ms: 1500,
        max_duration_ms: 4200,
        top_reason_code: "hard_cap:saved_results",
        top_event_type: "saved_result.process_and_persist_succeeded",
      },
    ],
  };

  const leadSummary = {
    total: 5,
    by_status: createEmptyLeadStatusCounts(),
    followup_overdue: 2,
    followup_today: 1,
    followup_upcoming: 1,
    followup_without: 1,
  };

  assert.equal(formatOperationalReasonLabel("hard_cap:saved_results"), "hard cap em saved results");
  assert.equal(formatOperationalPriorityLabel("high"), "Alta");

  const orgRecs = buildOrgOperationalRecommendations(summary, leadSummary, "Org A", 3);
  assert.equal(orgRecs[0].kind, "commercial_risk");
  assert.equal(orgRecs[0].priority, "high");
  assert.equal(orgRecs[0].org_name, "Org A");
  assert.ok(orgRecs[0].evidence.some((value) => value.includes("hard cap")));

  const rootRecsOne = buildAgencyOperationalRecommendations(
    summary,
    [
      {
        id: "org-a",
        name: "Org A",
        lead_summary: leadSummary,
        operational_summary: summary.top_orgs[0],
      },
    ],
    3
  );
  const rootRecsTwo = buildAgencyOperationalRecommendations(
    summary,
    [
      {
        id: "org-a",
        name: "Org A",
        lead_summary: leadSummary,
        operational_summary: summary.top_orgs[0],
      },
    ],
    3
  );

  assert.equal(rootRecsOne[0].kind, "commercial_risk");
  assert.deepEqual(rootRecsOne, rootRecsTwo);
  assert.equal(rootRecsOne.length, 3);
});

run("ai profile summary stays deterministic and grounded", () => {
  const summaryOne = summarizeOnboardingProfile(sampleOnboarding);
  const summaryTwo = summarizeOnboardingProfile(sampleOnboarding);

  assert.equal(summaryOne, summaryTwo);
  assert.ok(summaryOne.includes("goal: Autoridade"));
  assert.ok(summaryOne.includes("metal=Prateado"));
  assert.ok(summaryOne.includes("face=yes"));
  assert.ok(summaryOne.includes("body=yes"));
});

run("result surface stays personal, hierarchical and action oriented", () => {
  const surface = buildResultSurface(sampleOnboarding);

  assert.ok(surface.hero.dominantStyle.length > 0);
  assert.ok(surface.hero.subtitle.includes("fit"));
  assert.ok(surface.palette.description.includes("leitura") || surface.palette.description.includes("contraste"));
  assert.equal(surface.lookHierarchy[0].label, "Base");
  assert.equal(surface.lookHierarchy.length, 3);
  assert.equal(surface.primaryCtaLabel, "Continuar no WhatsApp");
  assert.equal(surface.secondaryCtaLabel, "Ver meus looks");
  assert.ok(surface.footerLabel.length > 0);
});

run("result surface preserves UUID product ids and keeps UI ids separate", () => {
  const uuid = "11111111-1111-4111-8111-111111111111";
  const surface = buildResultSurface(sampleOnboarding, null, {
    looks: [
      {
        id: "surface-look-1-1",
        product_id: uuid,
        name: "Look 1",
        intention: "Entrada limpa",
        type: "Híbrido Seguro",
        items: [
          {
            id: "surface-look-1-1",
            product_id: uuid,
            photoUrl: "https://example.com/item.jpg",
            brand: "Acervo real",
            name: "Blazer estruturado",
          },
        ],
        accessories: [],
        explanation: "Entrada limpa",
        whenToWear: "Rotina",
      },
    ],
  });

  assert.equal(surface.looks[0].id, "surface-look-1-1");
  assert.equal(surface.looks[0].product_id, uuid);
  assert.equal(surface.looks[0].items[0].product_id, uuid);
  assert.notEqual(surface.looks[0].product_id, surface.looks[0].id);
  assert.equal(hasLegacyTryOnProducts(surface.looks), false);
});

run("venus stylist audit keeps buy-now scoped to real product ids", () => {
  const uuid = "11111111-1111-4111-8111-111111111111";
  const surface = buildResultSurface(sampleOnboarding, null, {
    looks: [
      {
        id: "surface-look-1-1",
        product_id: uuid,
        name: "Look 1",
        intention: "Entrada limpa",
        type: "Híbrido Seguro",
        items: [
          {
            id: "surface-look-1-1",
            product_id: uuid,
            photoUrl: "https://example.com/item.jpg",
            brand: "Acervo real",
            name: "Blazer estruturado",
          },
        ],
        accessories: [],
        explanation: "Entrada limpa",
        whenToWear: "Rotina",
      },
      {
        id: "surface-look-2-1",
        name: "Look legado",
        intention: "Fallback",
        type: "Híbrido Seguro",
        items: [
          {
            id: "surface-look-2-1",
            photoUrl: "https://example.com/item-2.jpg",
            brand: "Acervo legado",
            name: "Peça sintética",
          },
        ],
        accessories: [],
        explanation: "Fallback",
        whenToWear: "Rotina",
      },
    ],
  });

  const heroQuality = classifyTryOnQuality({
    hasGeneratedImage: true,
    hasPersonImage: true,
    hasRealProduct: true,
    isLegacyLook: false,
    isPreviousLook: false,
    hasTryOnError: false,
    primaryLookItemCount: 2,
    hasBeforeAfter: true,
    hasHeroFrame: true,
    hasNarrative: true,
    hasContextualCTA: true,
    hasPremiumBadge: true,
  });

  const audit = buildVenusStylistAudit({
    surface,
    tryOnQuality: heroQuality,
    onboardingData: sampleOnboarding,
    contactName: "Ana",
    resultId: "550e8400-e29b-41d4-a716-446655440000",
    orgName: "Maison Elite",
  });

  assert.equal(audit.buyNow.looks.length, 1);
  assert.equal(audit.buyNow.looks[0].productId, uuid);
  assert.ok(audit.whatsapp.leadIn.includes("Ana"));
  assert.ok(audit.whatsapp.leadIn.includes("Resultado"));
  assert.ok(audit.social.prompt.includes("Maison Elite"));

  const message = buildWhatsAppHandoffMessage({
    contactName: "Ana",
    resultState: "hero",
    styleIdentity: surface.essence.label,
    imageGoal: sampleOnboarding.intent.imageGoal,
    lookSummary: surface.looks,
    audit,
  });

  assert.ok(message.includes("Continuar com minha stylist") || message.includes("Continuar com Venus Stylist"));
  assert.ok(message.includes("Blazer estruturado"));
});

run("synthetic result surface does not invent product ids", () => {
  const surface = buildResultSurface(sampleOnboarding);

  assert.equal(surface.looks[0].id, "surface-look-1");
  assert.equal(surface.looks[0].product_id, "");
  assert.equal(surface.looks[0].items[0].product_id, "");
  assert.equal(hasLegacyTryOnProducts(surface.looks), true);
});

run("legacy saved_result looks without product ids remain blocked", () => {
  const legacySurface = buildResultSurface(sampleOnboarding, null, {
    looks: [
      {
        id: "surface-look-1-1",
        name: "Look legado",
        intention: "Entrada limpa",
        type: "HÃ­brido Seguro",
        items: [
          {
            id: "surface-look-1-1",
            photoUrl: "https://example.com/item.jpg",
            brand: "Acervo legado",
            name: "Blazer estruturado",
          },
        ],
        accessories: [],
        explanation: "Entrada limpa",
        whenToWear: "Rotina",
      },
    ],
  });

  assert.equal(legacySurface.looks[0].product_id, "");
  assert.equal(legacySurface.looks[0].items[0].product_id, "");
  assert.equal(hasLegacyTryOnProducts(legacySurface.looks), true);
});

run("try-on UUID helper rejects UI ids and accepts real UUIDs", () => {
  const uuid = "11111111-1111-4111-8111-111111111111";

  assert.equal(isValidTryOnProductId(uuid), true);
  assert.equal(isValidTryOnProductId("surface-look-1-1"), false);
  assert.equal(ensureTryOnProductId(uuid), uuid);
  assert.equal(ensureTryOnProductId("surface-look-1-1"), null);
});

run("try-on quality combines structural and visual signals", () => {
  const structuralStrong = evaluateTryOnStructural({
    hasGeneratedImage: true,
    hasPersonImage: true,
    hasRealProduct: true,
    isLegacyLook: false,
    isPreviousLook: false,
    hasTryOnError: false,
    primaryLookItemCount: 2,
  });

  const structuralBorderline = evaluateTryOnStructural({
    hasGeneratedImage: true,
    hasPersonImage: true,
    hasRealProduct: true,
    isLegacyLook: false,
    isPreviousLook: true,
    hasTryOnError: false,
    primaryLookItemCount: 1,
  });

  const visualWeak = evaluateTryOnVisual({
    hasGeneratedImage: true,
    hasBeforeAfter: false,
    hasHeroFrame: false,
    hasNarrative: false,
    hasContextualCTA: false,
    hasPremiumBadge: false,
    isPreviousLook: false,
    hasTryOnError: false,
  });

  const visualBorderline = evaluateTryOnVisual({
    hasGeneratedImage: true,
    hasBeforeAfter: true,
    hasHeroFrame: true,
    hasNarrative: true,
    hasContextualCTA: false,
    hasPremiumBadge: false,
    isPreviousLook: false,
    hasTryOnError: false,
  });

  const visualStrong = evaluateTryOnVisual({
    hasGeneratedImage: true,
    hasBeforeAfter: true,
    hasHeroFrame: true,
    hasNarrative: true,
    hasContextualCTA: true,
    hasPremiumBadge: true,
    isPreviousLook: false,
    hasTryOnError: false,
  });

  const hero = classifyTryOnQuality({
    hasGeneratedImage: true,
    hasPersonImage: true,
    hasRealProduct: true,
    isLegacyLook: false,
    isPreviousLook: false,
    hasTryOnError: false,
    primaryLookItemCount: 2,
    hasBeforeAfter: true,
    hasHeroFrame: true,
    hasNarrative: true,
    hasContextualCTA: true,
    hasPremiumBadge: true,
  });

  const preview = classifyTryOnQuality({
    hasGeneratedImage: true,
    hasPersonImage: true,
    hasRealProduct: true,
    isLegacyLook: false,
    isPreviousLook: false,
    hasTryOnError: false,
    primaryLookItemCount: 2,
    hasBeforeAfter: false,
    hasHeroFrame: false,
    hasNarrative: false,
    hasContextualCTA: true,
    hasPremiumBadge: false,
  });

  const retry = classifyTryOnQuality({
    hasGeneratedImage: false,
    hasPersonImage: true,
    hasRealProduct: false,
    isLegacyLook: true,
    isPreviousLook: false,
    hasTryOnError: false,
    primaryLookItemCount: 1,
    hasBeforeAfter: false,
    hasHeroFrame: false,
    hasNarrative: false,
    hasContextualCTA: false,
    hasPremiumBadge: false,
  });

  assert.equal(structuralStrong.state, "hero");
  assert.equal(structuralBorderline.state, "preview");
  assert.equal(visualWeak.state, "preview");
  assert.equal(visualBorderline.state, "preview");
  assert.equal(visualStrong.state, "hero");
  assert.equal(hero.state, "hero");
  assert.equal(hero.showWhatsappCta, true);
  assert.equal(hero.showRetryPhotoCta, false);

  assert.equal(preview.state, "preview");
  assert.equal(preview.showWhatsappCta, true);
  assert.equal(preview.showRetryPhotoCta, true);
  assert.equal(preview.structural.state, "hero");
  assert.equal(preview.visual.state, "preview");
  assert.ok(preview.reason.length > 0);
  assert.ok(preview.score < hero.score);

  const borderlineHero = classifyTryOnQuality({
    hasGeneratedImage: true,
    hasPersonImage: true,
    hasRealProduct: true,
    isLegacyLook: false,
    isPreviousLook: false,
    hasTryOnError: false,
    primaryLookItemCount: 2,
    hasBeforeAfter: true,
    hasHeroFrame: true,
    hasNarrative: true,
    hasContextualCTA: false,
    hasPremiumBadge: false,
  });

  assert.equal(borderlineHero.state, "preview");
  assert.equal(borderlineHero.structural.state, "hero");
  assert.equal(borderlineHero.visual.state, "preview");

  assert.equal(retry.state, "retry_required");
  assert.equal(retry.showWhatsappCta, false);
  assert.equal(retry.showRetryPhotoCta, true);
  assert.equal(retry.structural.state, "retry_required");
  assert.equal(retry.visual.state, "retry_required");

  const errorPenalty = classifyTryOnQuality({
    hasGeneratedImage: true,
    hasPersonImage: true,
    hasRealProduct: true,
    isLegacyLook: false,
    isPreviousLook: false,
    hasTryOnError: true,
    primaryLookItemCount: 2,
    hasBeforeAfter: true,
    hasHeroFrame: true,
    hasNarrative: true,
    hasContextualCTA: true,
    hasPremiumBadge: true,
  });

  assert.equal(errorPenalty.state, "retry_required");
  assert.equal(errorPenalty.structural.state, "retry_required");
  assert.equal(errorPenalty.visual.state, "retry_required");
});

run("catalog enrichment stays grounded and role aware", () => {
  const signals = buildCatalogEnrichmentSignals("Blazer Lã Merino Arquitetural", "Vestuário Premium");
  const fallback = buildCatalogEnrichmentSignals("", "Categoria informada");
  const visualSignals = deriveVisualSignalsFromMetrics({
    brightness: 0.18,
    saturation: 0.08,
    contrast: 0.22,
    texture: 0.12,
  });
  const visualEnriched = buildCatalogEnrichmentSignals("Camisa de Algodão", "Camisa", visualSignals);

  assert.equal(signals.role, "anchor");
  assert.equal(signals.premiumTitle, "Blazer Lã Merino Arquitetural");
  assert.ok(signals.styleTags.includes("Base forte"));
  assert.ok(signals.styleTags.includes("Estruturado"));
  assert.ok(signals.functionalBenefit.includes("estrutura"));
  assert.ok(signals.sellerSuggestions.pairsBestWith.includes("Camisa limpa"));
  assert.ok(signals.conversionCopy.length > 0);

  assert.equal(fallback.role, "unknown");
  assert.equal(fallback.premiumTitle, "Peça principal");
  assert.ok(fallback.persuasiveDescription.length > 0);
  assert.ok(fallback.sellerSuggestions.pairsBestWith.includes("Peças neutras"));

  assert.equal(visualSignals.pattern, "liso");
  assert.equal(visualSignals.contrast, "baixo");
  assert.equal(visualSignals.roleHint, "anchor");
  assert.equal(visualEnriched.role, "anchor");
  assert.ok(visualEnriched.baseDescription.includes("leitura"));
  assert.ok(visualEnriched.colorTags.length > 0);
});

run("catalog enrichment improves visual confidence without inventing detail", () => {
  const strongVisual = deriveVisualSignalsFromMetrics({
    brightness: 0.62,
    saturation: 0.48,
    contrast: 0.58,
    texture: 0.41,
  });
  const enriched = buildCatalogEnrichmentSignals("Vestido Fluido", "Vestido", strongVisual);

  assert.equal(strongVisual.pattern, "estampado");
  assert.equal(strongVisual.vibe, "statement");
  assert.equal(strongVisual.contrast, "alto");
  assert.equal(enriched.role, "statement");
  assert.ok(enriched.styleTags.includes("Statement"));
  assert.ok(enriched.colorTags.length > 0);
  assert.ok(enriched.persuasiveDescription.includes("presença") || enriched.persuasiveDescription.includes("catálogo"));
  assert.ok(enriched.sellerSuggestions.bestContext.length > 0);
});

if (false) {
run("product upload validation rejects invalid files", () => {
  const validFile = { size: PRODUCT_IMAGE_MAX_BYTES - 1, type: "image/png", name: "photo.png" };
  const oversizedFile = { size: PRODUCT_IMAGE_MAX_BYTES + 1, type: "image/png", name: "photo.png" };
  const wrongTypeFile = { size: 1024, type: "text/plain", name: "note.txt" };

  assert.equal(validateProductImageFile(validFile).valid, true);
  assert.equal(validateProductImageFile(oversizedFile).reason, "image_too_large");
  assert.equal(validateProductImageFile(wrongTypeFile).reason, "image_invalid_type");
});

run("product enrichment route returns ai payload and fallback", async () => {
  const originalFetch = global.fetch;

  try {
    await withTempEnv({ GEMINI_API_KEY: "test-key" }, async () => {
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      name: "Blazer Lino Cru",
                      category: "roupa",
                      primary_color: "Bege",
                      style: "alfaiataria",
                      description: "Descricao objetiva da peca.",
                      persuasive_description: "Descricao persuasiva da peca.",
                      emotional_copy: "Copy emocional da peca.",
                      tags: ["base forte", "alfaiataria", "neutro"],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      const route = loadFresh("../src/app/api/products/enrich/route.ts");
      const response = await route.POST(
        new Request("https://example.com/api/products/enrich", {
          method: "POST",
          body: JSON.stringify({
            image_base64: "data:image/png;base64,AAAA",
            file_name: "blazer.png",
            name: "",
            category: "roupa",
          }),
        })
      );

      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.fallback_used, false);
      assert.equal(payload.name, "Blazer Lino Cru");
      assert.equal(payload.primary_color, "Bege");
      assert.equal(payload.tags.length, 3);
    });
  } finally {
    global.fetch = originalFetch;
  }

  try {
    await withTempEnv({ GEMINI_API_KEY: "test-key" }, async () => {
      global.fetch = async () => ({
        ok: false,
        status: 502,
        text: async () => "upstream failed",
      });

      const route = loadFresh("../src/app/api/products/enrich/route.ts");
      const response = await route.POST(
        new Request("https://example.com/api/products/enrich", {
          method: "POST",
          body: JSON.stringify({
            image_base64: "data:image/png;base64,AAAA",
            file_name: "blazer.png",
            name: "",
            category: "roupa",
          }),
        })
      );

      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.fallback_used, true);
      assert.ok(payload.name.length > 0);
      assert.ok(payload.description.length > 0);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

run("product create action persists enriched fields for an authorized tenant", async () => {
  const inserts = [];
  const uploadedFiles = [];

  const admin = {
    storage: {
      listBuckets: async () => ({ data: [{ name: "products", public: true }], error: null }),
      createBucket: async () => ({ error: null }),
      updateBucket: async () => ({ error: null }),
      from: () => ({
        upload: async (path, buffer, options) => {
          uploadedFiles.push({ path, size: buffer.length, options });
          return { error: null };
        },
        getPublicUrl: () => ({ data: { publicUrl: "https://cdn.example.com/product.png" } }),
      }),
    },
    from: (table) => {
      if (table === "products") {
        return {
          insert: (rows) => {
            inserts.push({ table, rows });
            return {
              select: () => ({
                single: async () => ({
                  data: { id: "prod-1", name: rows[0].name, category: rows[0].category, type: rows[0].type },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      if (table === "product_variants") {
        return { insert: async () => ({ error: null }) };
      }

      if (table === "tenant_events") {
        return { insert: async () => ({ error: null }) };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  try {
    await withMockedModules(
      {
        "next/navigation": {
          redirect: (url) => {
            throw new Error(`REDIRECT:${url}`);
          },
        },
        "next/cache": {
          revalidatePath: () => {},
        },
        "@/lib/supabase/server": {
          createClient: async () => ({
            auth: {
              getUser: async () => ({ data: { user: { id: "user-1" } } }),
            },
          }),
        },
        "@/lib/supabase/admin": {
          createAdminClient: () => admin,
        },
        "@/lib/tenant/core": {
          assertMerchantWritableOrgAccess: async () => ({
            user: { id: "user-1" },
            org: { id: "org-1", slug: "org-one" },
          }),
          bumpTenantUsageDaily: async () => null,
        },
        "@/lib/tenant/enforcement": {
          enforceTenantOperationalState: async () => ({ allowed: true }),
        },
        "@/lib/billing/enforcement": {
          enforceOrgHardCap: async () => ({ allowed: true }),
        },
      },
      async () => {
        const actions = loadFresh("../src/app/b2b/product/new/actions.ts");
        const formData = new FormData();
        formData.set("name", "Blazer de Linho");
        formData.set("category", "roupa");
        formData.set("primary_color", "Bege");
        formData.set("style", "alfaiataria");
        formData.set("description", "Descricao objetiva");
        formData.set("persuasive_description", "Descricao persuasiva");
        formData.set("emotional_copy", "Copy emocional");
        formData.set("stock_qty", "8");
        formData.set("reserved_qty", "2");
        formData.set("stock_status", "in_stock");
        formData.set("tags_json", JSON.stringify(["alfaiataria", "base forte"]));
        formData.set("return_to", "/merchant");
        formData.set("image_file", new File(["fake-image"], "product.png", { type: "image/png" }));

        await actions.createProduct(formData);
      }
    );
    throw new Error("Expected redirect from createProduct");
  } catch (error) {
    assert.ok(String(error.message || error).includes("REDIRECT:/merchant?created=true"));
  }

  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].rows[0].description, "Descricao objetiva");
  assert.equal(inserts[0].rows[0].persuasive_description, "Descricao persuasiva");
  assert.equal(inserts[0].rows[0].emotional_copy, "Copy emocional");
  assert.equal(inserts[0].rows[0].stock_qty, 8);
  assert.equal(inserts[0].rows[0].reserved_qty, 2);
  assert.equal(inserts[0].rows[0].stock_status, "in_stock");
  assert.equal(inserts[0].rows[0].stock, 6);
  assert.equal(uploadedFiles.length, 1);
});

run("product create action rejects unauthorized tenant access before insert", async () => {
  let inserted = false;

  try {
    await withMockedModules(
      {
        "next/navigation": {
          redirect: (url) => {
            throw new Error(`REDIRECT:${url}`);
          },
        },
        "next/cache": {
          revalidatePath: () => {},
        },
        "@/lib/supabase/server": {
          createClient: async () => ({
            auth: {
              getUser: async () => ({ data: { user: { id: "user-1" } } }),
            },
          }),
        },
        "@/lib/supabase/admin": {
          createAdminClient: () => ({
            storage: {
              listBuckets: async () => ({ data: [], error: null }),
              createBucket: async () => ({ error: null }),
              updateBucket: async () => ({ error: null }),
              from: () => ({
                upload: async () => ({ error: null }),
                getPublicUrl: () => ({ data: { publicUrl: "https://cdn.example.com/product.png" } }),
              }),
            },
            from: (table) => {
              if (table === "products") {
                inserted = true;
                return {
                  insert: () => ({
                    select: () => ({
                      single: async () => ({ data: null, error: null }),
                    }),
                  }),
                };
              }
              return { insert: async () => ({ error: null }) };
            },
          }),
        },
        "@/lib/tenant/core": {
          assertMerchantWritableOrgAccess: async () => {
            throw new Error("forbidden");
          },
          bumpTenantUsageDaily: async () => null,
        },
        "@/lib/tenant/enforcement": {
          enforceTenantOperationalState: async () => ({ allowed: true }),
        },
        "@/lib/billing/enforcement": {
          enforceOrgHardCap: async () => ({ allowed: true }),
        },
      },
      async () => {
        const actions = loadFresh("../src/app/b2b/product/new/actions.ts");
        const formData = new FormData();
        formData.set("name", "Blazer de Linho");
        formData.set("category", "roupa");
        formData.set("primary_color", "Bege");
        formData.set("style", "alfaiataria");
        formData.set("description", "Descricao objetiva");
        formData.set("persuasive_description", "Descricao persuasiva");
        formData.set("emotional_copy", "Copy emocional");
        formData.set("return_to", "/merchant");
        formData.set("image_file", new File(["fake-image"], "product.png", { type: "image/png" }));

        await actions.createProduct(formData);
      }
    );
  } catch (error) {
    assert.ok(String(error.message || error).includes("REDIRECT:/merchant?error=tenant"));
  }

  assert.equal(inserted, false);
});

}

run("catalog fallback prefers real products over invented placeholders", () => {
  const catalog = [
    {
      id: "prod-1",
      org_id: "org-1",
      name: "Blazer Estruturado",
      category: "Blazer",
      primary_color: "Preto",
      style: "Alfaiataria",
      type: "roupa",
      price_range: "R$ 500-700",
      image_url: "https://example.com/blazer.jpg",
      external_url: null,
      created_at: "2026-04-06T00:00:00.000Z",
    },
    {
      id: "prod-2",
      org_id: "org-1",
      name: "Camisa Algodão",
      category: "Camisa",
      primary_color: "Branco",
      style: "Clássico",
      type: "roupa",
      price_range: "R$ 200-300",
      image_url: "https://example.com/camisa.jpg",
      external_url: null,
      created_at: "2026-04-06T00:00:00.000Z",
    },
    {
      id: "prod-3",
      org_id: "org-1",
      name: "Cinto Couro",
      category: "Acessório",
      primary_color: "Marrom",
      style: "Minimalista",
      type: "acessorio",
      price_range: "R$ 120-180",
      image_url: "https://example.com/cinto.jpg",
      external_url: null,
      created_at: "2026-04-06T00:00:00.000Z",
    },
  ];

  const result = buildCatalogAwareFallbackResult(sampleOnboarding, catalog);

  assert.equal(result.looks.length, 3);
  assert.ok(result.looks.every((look) => look.items.every((item) => !String(item.id).startsWith("fallback-"))));
  assert.ok(result.looks.some((look) => look.items.some((item) => item.id === "prod-1")));
  assert.ok(result.palette.family.length > 0);
  assert.ok(result.palette.description.includes("contraste") || result.palette.description.includes("metais"));
  assert.ok(result.diagnostic.gapSolution.length > 0);
  assert.ok(result.diagnostic.currentPerception.includes("estrutura"));
  assert.ok(result.hero.subtitle.includes("fit"));
  assert.ok(result.looks[0].explanation.includes("base") || result.looks[0].explanation.includes("presença"));
});

run("openai payload normalization replaces fake items with catalog-backed looks", () => {
  const catalog = [
    {
      id: "prod-1",
      org_id: "org-1",
      name: "Blazer Estruturado",
      category: "Blazer",
      primary_color: "Preto",
      style: "Alfaiataria",
      type: "roupa",
      price_range: "R$ 500-700",
      image_url: "https://example.com/blazer.jpg",
      external_url: null,
      created_at: "2026-04-06T00:00:00.000Z",
    },
    {
      id: "prod-2",
      org_id: "org-1",
      name: "Camisa Algodão",
      category: "Camisa",
      primary_color: "Branco",
      style: "Clássico",
      type: "roupa",
      price_range: "R$ 200-300",
      image_url: "https://example.com/camisa.jpg",
      external_url: null,
      created_at: "2026-04-06T00:00:00.000Z",
    },
    {
      id: "prod-3",
      org_id: "org-1",
      name: "Cinto Couro",
      category: "Acessório",
      primary_color: "Marrom",
      style: "Minimalista",
      type: "acessorio",
      price_range: "R$ 120-180",
      image_url: "https://example.com/cinto.jpg",
      external_url: null,
      created_at: "2026-04-06T00:00:00.000Z",
    },
  ];

  const normalized = normalizeOpenAIRecommendationPayload(
    {
      hero: {
        dominantStyle: "Transformação Imediata",
        subtitle: "texto genérico",
        coverImageUrl: "",
      },
      palette: {
        family: "luxo silencioso",
        description: "texto genérico",
        colors: [
          { hex: "#FFFFFF", name: "Branco" },
          { hex: "#000000", name: "Preto" },
          { hex: "#999999", name: "Cinza" },
        ],
        metal: "Prateado",
        contrast: "Alto",
      },
      diagnostic: {
        currentPerception: "texto genérico",
        desiredGoal: "texto genérico",
        gapSolution: "texto genérico",
      },
      bodyVisagism: {
        shoulders: "texto genérico",
        face: "texto genérico",
        generalFit: "texto genérico",
      },
      accessories: {
        scale: "texto genérico",
        focalPoint: "texto genérico",
        advice: "texto genérico",
      },
      looks: [
        {
          id: "1",
          name: "Look Criado",
          intention: "texto genérico",
          type: "Híbrido Seguro",
          items: [
            {
              id: "fake-1",
              brand: "Marca Fantasma",
              name: "Produto Inventado",
              photoUrl: "",
              premiumTitle: "Produto Inventado",
              impactLine: "transformação imediata",
            },
          ],
          accessories: ["Acessório inventado"],
          explanation: "texto genérico",
          whenToWear: "texto genérico",
        },
      ],
      toAvoid: ["texto genérico"],
    },
    sampleOnboarding,
    catalog
  );

  assert.equal(normalized.looks.length, 3);
  assert.ok(normalized.looks[0].items.some((item) => item.id === "prod-1" || item.id === "prod-2"));
  assert.ok(normalized.looks[0].product_id === "prod-1" || normalized.looks[0].product_id === "prod-2");
  assert.ok(normalized.looks[0].items[0].product_id === "prod-1" || normalized.looks[0].items[0].product_id === "prod-2");
  assert.ok(normalized.hero.subtitle.length > 0);
  assert.ok(normalized.looks.every((look) => look.explanation.length > 0));
  assert.ok(normalized.toAvoid.length > 0);
});

run("experience ranking uses views and stays stable on ties", () => {
  const looks = [
    { id: "beta", name: "Beta", intention: "", type: "Híbrido Seguro", items: [], accessories: [], explanation: "", whenToWear: "" },
    { id: "alpha", name: "Alpha", intention: "", type: "Híbrido Seguro", items: [], accessories: [], explanation: "", whenToWear: "" },
  ];

  const higherViews = orchestrateExperience(
    {
      views: { beta: 10, alpha: 2 },
      clicks: {},
      shares: {},
      bundles: {},
      timeSpent: 20,
      tryOnUsed: false,
    },
    looks
  );

  assert.equal(higherViews.rankedLooks[0].id, "beta");

  const tied = orchestrateExperience(
    {
      views: { beta: 5, alpha: 5 },
      clicks: {},
      shares: {},
      bundles: {},
      timeSpent: 20,
      tryOnUsed: false,
    },
    looks
  );

  assert.equal(tied.rankedLooks[0].id, "alpha");
  assert.equal(higherViews.aiInsight.nextBestAction, "discovery");
});

run("operational value summary stays deterministic and exposes the main bottleneck", () => {
  const source = {
    total: 12,
    by_status: createEmptyLeadStatusCounts(),
  };

  source.by_status.new = 2;
  source.by_status.engaged = 5;
  source.by_status.qualified = 2;
  source.by_status.offer_sent = 1;
  source.by_status.closing = 0;
  source.by_status.won = 1;
  source.by_status.lost = 1;

  const summary = buildOperationalValueSummary(source);
  const summaryAgain = buildOperationalValueSummary(source);
  const collected = collectOperationalValueSummary([source, source]);

  assert.deepEqual(summary, summaryAgain);
  assert.equal(summary.total_leads, 12);
  assert.equal(summary.active_pipeline, 8);
  assert.equal(summary.advanced_pipeline, 2);
  assert.equal(summary.terminal_pipeline, 2);
  assert.equal(summary.bottleneck_stage, "engaged");
  assert.equal(summary.bottleneck_label, "muito lead engajado, pouca qualificação");
  assert.equal(summary.state_label, "muito lead engajado, pouca qualificação (3 de gap)");
  assert.equal(summary.win_rate, 0.5);
  assert.equal(formatOperationalValueRate(summary.advanced_pipeline_rate), "17%");
  assert.equal(collected.total_leads, 24);
  assert.equal(collected.active_pipeline, 16);
});

run("operational aging summary respects timestamp precedence and exposes the slowest stage", () => {
  const now = new Date("2026-04-06T12:00:00.000Z");
  const rows = [
    {
      status: "engaged",
      last_interaction_at: "2026-04-04T12:00:00.000Z",
      updated_at: "2026-04-01T12:00:00.000Z",
      created_at: "2026-03-01T12:00:00.000Z",
    },
    {
      status: "qualified",
      last_interaction_at: null,
      updated_at: "2026-03-29T12:00:00.000Z",
      created_at: "2026-03-25T12:00:00.000Z",
    },
    {
      status: "offer_sent",
      last_interaction_at: null,
      updated_at: null,
      created_at: "2026-03-22T12:00:00.000Z",
    },
    {
      status: "closing",
      last_interaction_at: "2026-03-21T12:00:00.000Z",
      updated_at: "2026-03-20T12:00:00.000Z",
      created_at: "2026-03-19T12:00:00.000Z",
    },
    {
      status: "won",
      last_interaction_at: "2026-03-01T12:00:00.000Z",
      updated_at: "2026-03-01T12:00:00.000Z",
      created_at: "2026-02-01T12:00:00.000Z",
    },
  ];

  const summary = buildOperationalAgingSummary(rows, now);
  const merged = mergeOperationalAgingSummaries([summary, summary]);

  assert.equal(summary.total_leads, 4);
  assert.equal(summary.stage_summaries[0].key, "closing");
  assert.equal(summary.bottleneck_stage, "closing");
  assert.equal(summary.bottleneck_label, "closing lento");
  assert.equal(summary.bottleneck_action, "Revisar o fechamento e destravar a decisão.");
  assert.equal(summary.stage_summaries.find((row) => row.key === "engaged").avg_age_days, 2);
  assert.equal(summary.stage_summaries.find((row) => row.key === "qualified").avg_age_days, 8);
  assert.equal(summary.stage_summaries.find((row) => row.key === "offer_sent").avg_age_days, 15);
  assert.equal(summary.stage_summaries.find((row) => row.key === "closing").avg_age_days, 16);
  assert.equal(formatOperationalAgeDays(summary.average_age_days), "10d");
  assert.equal(merged.total_leads, 8);
  assert.equal(merged.critical_count, 4);
  assert.equal(merged.stage_summaries[0].key, "closing");
});

run("merchant action panel prioritizes hot leads and preserves history", () => {
  const panel = buildMerchantActionPanel({
    orgId: "org-1",
    orgSlug: "loja-venus",
    now: Date.parse("2026-04-14T12:00:00.000Z"),
    leads: [
      {
        id: "lead-hot",
        org_id: "org-1",
        name: "Ana",
        phone: "5511999999999",
        status: "qualified",
        saved_result_id: "result-1",
        intent_score: 92,
        whatsapp_key: "5511999999999",
        next_follow_up_at: "2026-04-13T12:00:00.000Z",
        notes: null,
        owner_user_id: null,
        conversation_id: "conv-1",
        created_at: "2026-04-10T12:00:00.000Z",
        updated_at: "2026-04-14T11:30:00.000Z",
        last_interaction_at: "2026-04-14T11:55:00.000Z",
      },
      {
        id: "lead-follow-up",
        org_id: "org-1",
        name: "Bruna",
        phone: "5511888888888",
        status: "engaged",
        saved_result_id: null,
        intent_score: 58,
        whatsapp_key: "5511888888888",
        next_follow_up_at: "2026-04-12T09:00:00.000Z",
        notes: null,
        owner_user_id: null,
        conversation_id: null,
        created_at: "2026-04-08T12:00:00.000Z",
        updated_at: "2026-04-14T09:00:00.000Z",
        last_interaction_at: "2026-04-14T09:00:00.000Z",
      },
      {
        id: "lead-noise",
        org_id: "org-1",
        name: "Caio",
        phone: "5511777777777",
        status: "new",
        saved_result_id: null,
        intent_score: 5,
        whatsapp_key: null,
        next_follow_up_at: null,
        notes: null,
        owner_user_id: null,
        conversation_id: null,
        created_at: "2026-04-01T12:00:00.000Z",
        updated_at: "2026-04-01T12:00:00.000Z",
        last_interaction_at: null,
      },
    ],
    conversations: [
      {
        id: "conv-1",
        org_slug: "loja-venus",
        user_phone: "5511999999999",
        user_name: "Ana",
        status: "human_required",
        priority: "high",
        last_message: "Quero fechar hoje",
        last_updated: "2026-04-14T11:58:00.000Z",
        unread_count: 2,
        user_context: null,
      },
    ],
    leadTimeline: [
      {
        id: "timeline-1",
        lead_id: "lead-follow-up",
        org_id: "org-1",
        actor_user_id: "user-1",
        event_type: "follow_up_scheduled",
        event_data: { next_follow_up_at: "2026-04-15T10:00:00.000Z" },
        created_at: "2026-04-14T09:00:00.000Z",
      },
      {
        id: "timeline-2",
        lead_id: "lead-hot",
        org_id: "org-1",
        actor_user_id: "user-1",
        event_type: "status_changed",
        event_data: { previous: "engaged", current: "qualified" },
        created_at: "2026-04-14T11:30:00.000Z",
      },
    ],
    whatsappMessages: [
      {
        id: "msg-1",
        conversation_id: "conv-1",
        org_slug: "loja-venus",
        sender: "merchant",
        text: "Oi, Ana. Separei a proxima opcao.",
        type: "text",
        created_at: "2026-04-14T11:59:00.000Z",
      },
    ],
    tryons: [
      {
        id: "try-1",
        org_id: "org-1",
        saved_result_id: "result-1",
        product_id: "product-1",
        status: "completed",
        result_image_url: "https://example.com/result.png",
        created_at: "2026-04-14T11:45:00.000Z",
      },
    ],
    savedResults: [
      {
        id: "result-1",
        payload: {
          finalResult: { looks: [{ name: "Vestido Solar" }] },
          whatsappHandoff: { lookSummary: [{ name: "Vestido Solar" }] },
          last_tryon: { product_name: "Vestido Solar" },
        },
        created_at: "2026-04-14T11:40:00.000Z",
      },
    ],
  });

  assert.equal(panel.cards[0].leadId, "lead-hot");
  assert.equal(panel.cards[0].kind, "open_conversation");
  assert.equal(panel.cards[1].leadId, "lead-follow-up");
  assert.equal(panel.cards[1].kind, "send_follow_up");
  assert.equal(panel.cards[0].score > panel.cards[1].score, true);
  assert.ok(panel.cards[0].recommendationReasons.includes("Atendimento humano pedido"));
  assert.ok(panel.cards[0].recommendationReasons.includes("Try-on recente"));
  assert.ok(panel.cards[1].recommendationReasons.includes("Follow-up vencido"));
  assert.equal(panel.summary.hot >= 1, true);
  assert.equal(panel.summary.followUpsDue >= 1, true);
  assert.equal(panel.history[0].kind, "whatsapp");
  assert.ok(panel.cards[0].resultHref?.includes("result-1"));
});

run("merchant action panel access is tenant scoped", () => {
  assert.equal(
    canAccessMerchantActionPanel({
      orgId: "org-1",
      orgSlug: "loja-venus",
      userOrgSlug: "loja-venus",
      role: "merchant_manager",
      tenantActive: true,
    }),
    true
  );

  assert.equal(
    canAccessMerchantActionPanel({
      orgId: "org-1",
      orgSlug: "loja-venus",
      userOrgSlug: "outra-loja",
      role: "merchant_manager",
      tenantActive: true,
    }),
    false
  );

  assert.equal(
    canAccessMerchantActionPanel({
      orgId: "org-1",
      orgSlug: "loja-venus",
      userOrgSlug: "qualquer",
      role: "agency_owner",
      tenantActive: true,
    }),
    true
  );

  assert.equal(
    canAccessMerchantActionPanel({
      orgId: "org-1",
      orgSlug: "loja-venus",
      userOrgSlug: "loja-venus",
      role: "merchant_manager",
      tenantActive: false,
    }),
    false
  );
});

run("agency resource control prioritizes critical stores and ignores foreign tenants", () => {
  assert.deepEqual(
    RESOURCE_CONTROL_FIELD_DEFINITIONS.map((definition) => definition.monthlyFieldName),
    ["monthly_tokens_limit", "monthly_tryons_limit", "monthly_messages_limit"]
  );

  const rows = buildAgencyResourceControlRows({
    orgs: [
      {
        id: "org-critical",
        slug: "loja-critica",
        name: "Loja Critica",
        status: "active",
        kill_switch: false,
        plan_id: "scale",
        limits: {
          ai_tokens_monthly: 100000,
          whatsapp_messages_daily: 10,
        },
        owner_user_id: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
      {
        id: "org-attention",
        slug: "loja-atencao",
        name: "Loja Atencao",
        status: "active",
        kill_switch: false,
        plan_id: "growth",
        limits: {
          ai_tokens_monthly: 100000,
          whatsapp_messages_daily: 10,
        },
        owner_user_id: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
      {
        id: "org-normal",
        slug: "loja-normal",
        name: "Loja Normal",
        status: "active",
        kill_switch: false,
        plan_id: "starter",
        limits: {
          ai_tokens_monthly: 100000,
          whatsapp_messages_daily: 10,
        },
        owner_user_id: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
      {
        id: "org-no-data",
        slug: "loja-sem-base",
        name: "Loja Sem Base",
        status: "active",
        kill_switch: false,
        plan_id: "starter",
        limits: {
          ai_tokens_monthly: 100000,
          whatsapp_messages_daily: 10,
        },
        owner_user_id: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
    ],
    usageRows: [
      {
        org_id: "org-critical",
        usage_date: "2026-04-14",
        ai_tokens: 120000,
        messages_sent: 300,
        revenue_cents: 300000,
        cost_cents: 100000,
        leads: 30,
        tryon_calls: 60,
        updated_at: "2026-04-14T12:00:00.000Z",
      },
      {
        org_id: "org-attention",
        usage_date: "2026-04-14",
        ai_tokens: 82000,
        messages_sent: 120,
        revenue_cents: 240000,
        cost_cents: 120000,
        leads: 20,
        tryon_calls: 41,
        updated_at: "2026-04-14T11:00:00.000Z",
      },
      {
        org_id: "org-normal",
        usage_date: "2026-04-14",
        ai_tokens: 20000,
        messages_sent: 20,
        revenue_cents: 100000,
        cost_cents: 30000,
        leads: 5,
        tryon_calls: 10,
        updated_at: "2026-04-14T10:00:00.000Z",
      },
      {
        org_id: "org-foreign",
        usage_date: "2026-04-14",
        ai_tokens: 999999,
        messages_sent: 999,
        revenue_cents: 1,
        cost_cents: 1,
        leads: 1,
        tryon_calls: 1,
        updated_at: "2026-04-14T09:00:00.000Z",
      },
    ],
    limitRows: [
      {
        org_id: "org-critical",
        resource_type: "ai_tokens",
        limit_monthly: 100000,
        limit_override: null,
        created_by_user_id: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
      {
        org_id: "org-critical",
        resource_type: "try_on",
        limit_monthly: 50,
        limit_override: null,
        created_by_user_id: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
      {
        org_id: "org-critical",
        resource_type: "whatsapp_message",
        limit_monthly: 1000,
        limit_override: null,
        created_by_user_id: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
      {
        org_id: "org-attention",
        resource_type: "ai_tokens",
        limit_monthly: 100000,
        limit_override: null,
        created_by_user_id: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
      {
        org_id: "org-attention",
        resource_type: "try_on",
        limit_monthly: 50,
        limit_override: null,
        created_by_user_id: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
      {
        org_id: "org-attention",
        resource_type: "whatsapp_message",
        limit_monthly: 1000,
        limit_override: null,
        created_by_user_id: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
      {
        org_id: "org-normal",
        resource_type: "ai_tokens",
        limit_monthly: 100000,
        limit_override: null,
        created_by_user_id: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
      {
        org_id: "org-normal",
        resource_type: "try_on",
        limit_monthly: 50,
        limit_override: null,
        created_by_user_id: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
      {
        org_id: "org-normal",
        resource_type: "whatsapp_message",
        limit_monthly: 1000,
        limit_override: null,
        created_by_user_id: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
      {
        org_id: "org-foreign",
        resource_type: "ai_tokens",
        limit_monthly: 1,
        limit_override: null,
        created_by_user_id: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
    ],
    billingRows: [
      {
        org_id: "org-critical",
        billing_status: "active",
        billing_provider: "stripe",
        stripe_current_period_end: "2026-05-01T00:00:00.000Z",
        stripe_synced_at: "2026-04-14T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
      {
        org_id: "org-attention",
        billing_status: "active",
        billing_provider: "stripe",
        stripe_current_period_end: "2026-05-01T00:00:00.000Z",
        stripe_synced_at: "2026-04-14T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
      {
        org_id: "org-normal",
        billing_status: "active",
        billing_provider: "stripe",
        stripe_current_period_end: "2026-05-01T00:00:00.000Z",
        stripe_synced_at: "2026-04-14T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
    ],
    referenceDate: new Date("2026-04-14T12:00:00.000Z"),
  });

  assert.equal(rows.length, 4);
  assert.deepEqual(
    rows.map((row) => row.id),
    ["org-critical", "org-attention", "org-normal", "org-no-data"]
  );
  assert.equal(rows[0].risk, "critical");
  assert.equal(rows[1].risk, "attention");
  assert.equal(rows[2].risk, "normal");
  assert.equal(rows[3].usage_month.ai_tokens, null);
  assert.equal(rows[3].resources.every((resource) => resource.status === "no_data"), true);
  assert.equal(rows[3].projection_note, "Sem dados suficientes para projetar");
  assert.equal(rows[2].alerts.includes("Operacao normal"), true);
});

run("agency resource control authorizes only agency roles", () => {
  assert.equal(canAccessAgencyResourceControl("agency_owner"), true);
  assert.equal(canAccessAgencyResourceControl("agency_admin"), true);
  assert.equal(canAccessAgencyResourceControl("merchant_manager"), false);
  assert.equal(canAccessAgencyResourceControl("merchant_viewer"), false);
  assert.equal(canAccessAgencyResourceControl(null), false);
});

run("gamification overview aggregates budgets and ignores foreign or expired data", () => {
  assert.equal(gamificationRuleLabel("share_bonus"), "Bônus por share");
  assert.equal(gamificationResourceLabel("try_on"), "Try-on extra");
  assert.equal(canAccessGamificationPanel("merchant_manager"), true);
  assert.equal(canAccessGamificationPanel("agency_owner"), false);

  const overview = buildGamificationOverview({
    org: {
      id: "org-1",
      slug: "loja-venus",
      name: "Loja Venus",
      status: "active",
      kill_switch: false,
      plan_id: "growth",
      limits: {
        ai_tokens_monthly: 100000,
        whatsapp_messages_daily: 100,
        products: 100,
        leads: 100,
      },
      owner_user_id: null,
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-14T00:00:00.000Z",
    },
    rules: [
      {
        id: "rule-1",
        org_id: "org-1",
        rule_type: "share_bonus",
        benefit_resource_type: "try_on",
        benefit_amount: 1,
        active: true,
        per_customer_limit: 2,
        per_customer_period_days: 30,
        valid_from: "2026-04-01T00:00:00.000Z",
        valid_until: null,
        label: "Share com bônus",
        description: null,
        created_by_user_id: null,
        updated_by_user_id: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
      {
        id: "rule-foreign",
        org_id: "other-org",
        rule_type: "share_bonus",
        benefit_resource_type: "try_on",
        benefit_amount: 1,
        active: true,
        per_customer_limit: 1,
        per_customer_period_days: 30,
        valid_from: "2026-04-01T00:00:00.000Z",
        valid_until: null,
        label: "Foreign",
        description: null,
        created_by_user_id: null,
        updated_by_user_id: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
      },
    ],
    events: [
      {
        id: "event-1",
        org_id: "org-1",
        rule_id: "rule-1",
        customer_key: "cust-1",
        customer_label: "Ana",
        event_type: "grant",
        status: "success",
        resource_type: "try_on",
        amount: 2,
        reason: "share confirmado",
        actor_user_id: "user-1",
        metadata: { rule_label: "Share com bônus" },
        expires_at: "2026-05-01T00:00:00.000Z",
        created_at: "2026-04-10T12:00:00.000Z",
      },
      {
        id: "event-2",
        org_id: "org-1",
        rule_id: "rule-1",
        customer_key: "cust-1",
        customer_label: "Ana",
        event_type: "consume",
        status: "success",
        resource_type: "try_on",
        amount: 1,
        reason: "uso do benefício",
        actor_user_id: "user-1",
        metadata: {},
        expires_at: null,
        created_at: "2026-04-11T12:00:00.000Z",
      },
      {
        id: "event-3",
        org_id: "org-1",
        rule_id: "rule-1",
        customer_key: "cust-expired",
        customer_label: "Bia",
        event_type: "grant",
        status: "success",
        resource_type: "whatsapp_message",
        amount: 1,
        reason: "expirado",
        actor_user_id: "user-1",
        metadata: {},
        expires_at: "2026-04-01T00:00:00.000Z",
        created_at: "2026-04-01T12:00:00.000Z",
      },
      {
        id: "event-foreign",
        org_id: "other-org",
        rule_id: "rule-foreign",
        customer_key: "cust-foreign",
        customer_label: "Foreign",
        event_type: "grant",
        status: "success",
        resource_type: "try_on",
        amount: 9,
        reason: "ignorar",
        actor_user_id: "user-9",
        metadata: {},
        expires_at: null,
        created_at: "2026-04-12T12:00:00.000Z",
      },
    ],
    referenceDate: new Date("2026-04-14T12:00:00.000Z"),
  });

  assert.equal(overview.active_rule_count, 1);
  assert.equal(overview.inactive_rule_count, 0);
  assert.equal(overview.budget.total_granted, 2);
  assert.equal(overview.budget.total_consumed, 1);
  assert.equal(overview.budget.total_available, 1);
  assert.equal(overview.recent_customers.length, 1);
  assert.equal(overview.recent_customers[0].customer_key, "cust-1");
  assert.equal(overview.recent_customers[0].resources.try_on.available, 1);
  assert.equal(overview.has_data, true);
});

run("privacy sanitizer redacts identifiers and urls", () => {
  const sanitized = sanitizePrivacyLogEntry({
    email: "cliente@exemplo.com",
    phone: "+55 (11) 99999-9999",
    url: "https://example.com/image.png?token=abc",
    nested: {
      name: "Cliente Exemplo",
      token: "secret-token",
    },
  });

  assert.equal(maskEmail("cliente@exemplo.com"), "c***@exemplo.com");
  assert.equal(maskPhone("+55 (11) 99999-9999"), "***9999");
  assert.equal(stripUrlQuery("https://example.com/image.png?token=abc"), "https://example.com/image.png");
  assert.equal(sanitized.email, "c***@exemplo.com");
  assert.equal(sanitized.phone, "***9999");
  assert.equal(sanitized.url, "https://example.com/image.png");
  assert.equal(sanitized.nested.name, "[REDACTED]");
  assert.equal(sanitized.nested.token, "[REDACTED]");
});

run("tenant privacy export bundle keeps counts and strips sensitive urls", () => {
  const bundle = buildTenantPrivacyExportBundle({
    organization: {
      id: "org-1",
      slug: "maison-elite",
      name: "Maison Elite",
      branch_name: "Centro",
      status: "active",
      plan_id: "growth",
    },
    products: [
      {
        id: "prod-1",
        image_url: "https://cdn.example.com/product.png?token=abc",
      },
    ],
    savedResults: [
      {
        id: "result-1",
        payload: {
          email: "cliente@exemplo.com",
          photoUrl: "https://cdn.example.com/result.png?token=abc",
        },
      },
    ],
  });

  assert.equal(bundle.counts.products, 1);
  assert.equal(bundle.counts.saved_results, 1);
  assert.equal(bundle.data.products[0].image_url, "https://cdn.example.com/product.png");
  assert.equal(bundle.data.saved_results[0].payload.email, "c***@exemplo.com");
  assert.equal(bundle.data.saved_results[0].payload.photoUrl, "https://cdn.example.com/result.png");
});

async function runAsync(name, fn) {
  try {
    await fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

const VALID_RESULT_ID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_ORG_ID = "org-123";
const FRONTEND_ORG_ID = "frontend-org";

;(async () => {
  await runAsync("gamification rule creation and edition stay tenant scoped", async () => {
    const auditActions = [];
    const operationalEvents = [];
    const repo = createGamificationMemoryRepo({
      orgs: [
        {
          id: "org-1",
          slug: "loja-venus",
          name: "Loja Venus",
          status: "active",
          kill_switch: false,
          plan_id: "growth",
          limits: {},
          owner_user_id: null,
          created_at: "2026-04-01T00:00:00.000Z",
          updated_at: "2026-04-14T00:00:00.000Z",
        },
      ],
    });

    await withMockedModules(
      {
        "@/lib/supabase/admin": { createAdminClient: () => ({}) },
        "@/lib/security/audit": {
          logAudit: async (input) => {
            auditActions.push(input.action);
          },
        },
        "@/lib/reliability/observability": {
          recordOperationalTenantEvent: async (_supabase, input) => {
            operationalEvents.push(input.eventType);
            return true;
          },
        },
        "@/lib/resource-control": {
          canConsumeResource: async () => ({ allowed: true }),
          consumeResource: async () => ({ success: true }),
        },
      },
      async () => {
        const {
          createGamificationRule,
          updateGamificationRule,
        } = loadFresh("../src/lib/gamification/index.ts");

        const created = await createGamificationRule(
          {
            orgId: "org-1",
            actorUserId: "user-1",
            ruleType: "share_bonus",
            benefitResourceType: "try_on",
            benefitAmount: 1,
            perCustomerLimit: 2,
            perCustomerPeriodDays: 30,
            active: true,
            label: "Share com bônus",
            description: "Bônus de try-on",
          },
          { repository: repo, now: new Date("2026-04-14T12:00:00.000Z") }
        );

        const updated = await updateGamificationRule(
          {
            orgId: "org-1",
            actorUserId: "user-1",
            ruleId: created.id,
            ruleType: "share_bonus",
            benefitResourceType: "try_on",
            benefitAmount: 1,
            perCustomerLimit: 2,
            perCustomerPeriodDays: 30,
            active: false,
            label: "Share com bônus",
            description: "Bônus de try-on",
          },
          { repository: repo, now: new Date("2026-04-14T12:00:00.000Z") }
        );

        assert.equal(created.org_id, "org-1");
        assert.equal(updated.active, false);
        assert.ok(auditActions.includes("gamification_rule_create"));
        assert.ok(auditActions.includes("gamification_rule_update"));
        assert.ok(operationalEvents.includes("gamification.rule_created"));
        assert.ok(operationalEvents.includes("gamification.rule_deactivated"));
      }
    );
  });

  await runAsync("gamification grants consume budget and block when exhausted", async () => {
    const auditActions = [];
    const operationalEvents = [];
    const consumeCalls = [];
    const repo = createGamificationMemoryRepo({
      orgs: [
        {
          id: "org-1",
          slug: "loja-venus",
          name: "Loja Venus",
          status: "active",
          kill_switch: false,
          plan_id: "growth",
          limits: {},
          owner_user_id: null,
          created_at: "2026-04-01T00:00:00.000Z",
          updated_at: "2026-04-14T00:00:00.000Z",
        },
      ],
      rules: [
        {
          id: "rule-1",
          org_id: "org-1",
          rule_type: "share_bonus",
          benefit_resource_type: "try_on",
          benefit_amount: 1,
          active: true,
          per_customer_limit: 3,
          per_customer_period_days: 30,
          valid_from: "2026-04-01T00:00:00.000Z",
          valid_until: null,
          label: "Share com bônus",
          description: null,
          created_by_user_id: null,
          updated_by_user_id: null,
          created_at: "2026-04-01T00:00:00.000Z",
          updated_at: "2026-04-14T00:00:00.000Z",
        },
      ],
    });

    await withMockedModules(
      {
        "@/lib/supabase/admin": { createAdminClient: () => ({}) },
        "@/lib/security/audit": {
          logAudit: async (input) => {
            auditActions.push(input.action);
          },
        },
        "@/lib/reliability/observability": {
          recordOperationalTenantEvent: async (_supabase, input) => {
            operationalEvents.push(input.eventType);
            return true;
          },
        },
        "@/lib/resource-control": {
          canConsumeResource: async (_orgId, resourceType, amount) => {
            consumeCalls.push({ kind: "check", resourceType, amount });
            return { allowed: true };
          },
          consumeResource: async (_orgId, resourceType, amount) => {
            consumeCalls.push({ kind: "consume", resourceType, amount });
            return { success: true };
          },
        },
      },
      async () => {
        const { grantGamificationBenefit } = loadFresh("../src/lib/gamification/index.ts");

        const granted = await grantGamificationBenefit(
          {
            orgId: "org-1",
            actorUserId: "user-1",
            customerKey: "cust-1",
            customerLabel: "Ana",
            ruleId: "rule-1",
            amount: 1,
            reason: "share confirmado",
          },
          { repository: repo, now: new Date("2026-04-14T12:00:00.000Z") }
        );

        assert.equal(granted.granted, true);
        assert.equal(granted.event.status, "success");
        assert.equal(repo.state.events.filter((event) => event.event_type === "grant" && event.status === "success").length, 1);
        assert.deepEqual(consumeCalls[0], { kind: "check", resourceType: "try_on", amount: 1 });
        assert.deepEqual(consumeCalls[1], { kind: "consume", resourceType: "try_on", amount: 1 });
        assert.ok(auditActions.includes("gamification_benefit_grant"));
        assert.ok(operationalEvents.includes("gamification.benefit_granted"));
      }
    );

    consumeCalls.length = 0;
    auditActions.length = 0;
    operationalEvents.length = 0;

    await withMockedModules(
      {
        "@/lib/supabase/admin": { createAdminClient: () => ({}) },
        "@/lib/security/audit": {
          logAudit: async (input) => {
            auditActions.push(input.action);
          },
        },
        "@/lib/reliability/observability": {
          recordOperationalTenantEvent: async (_supabase, input) => {
            operationalEvents.push(input.eventType);
            return true;
          },
        },
        "@/lib/resource-control": {
          canConsumeResource: async () => ({ allowed: false }),
          consumeResource: async () => ({ success: false }),
        },
      },
      async () => {
        const { grantGamificationBenefit: grantAgain } = loadFresh("../src/lib/gamification/index.ts");

        const denied = await grantAgain(
          {
            orgId: "org-1",
            actorUserId: "user-1",
            customerKey: "cust-2",
            customerLabel: "Bia",
            ruleId: "rule-1",
            amount: 1,
            reason: "share confirmado",
          },
          { repository: repo, now: new Date("2026-04-14T12:00:00.000Z") }
        );

        assert.equal(denied.granted, false);
        assert.equal(denied.reason, "Budget promocional insuficiente");
        assert.ok(auditActions.includes("gamification_benefit_blocked"));
        assert.ok(operationalEvents.includes("gamification.benefit_blocked"));
      }
    );
  });

  await runAsync("gamification benefit consumption updates saldo and blocks when insufficient", async () => {
    const auditActions = [];
    const repo = createGamificationMemoryRepo({
      orgs: [
        {
          id: "org-1",
          slug: "loja-venus",
          name: "Loja Venus",
          status: "active",
          kill_switch: false,
          plan_id: "growth",
          limits: {},
          owner_user_id: null,
          created_at: "2026-04-01T00:00:00.000Z",
          updated_at: "2026-04-14T00:00:00.000Z",
        },
      ],
      events: [
        {
          id: "event-1",
          org_id: "org-1",
          rule_id: "rule-1",
          customer_key: "cust-1",
          customer_label: "Ana",
          event_type: "grant",
          status: "success",
          resource_type: "try_on",
          amount: 2,
          reason: "grant",
          actor_user_id: "user-1",
          metadata: {},
          expires_at: null,
          created_at: "2026-04-14T12:00:00.000Z",
        },
      ],
    });

    await withMockedModules(
      {
        "@/lib/supabase/admin": { createAdminClient: () => ({}) },
        "@/lib/security/audit": {
          logAudit: async (input) => {
            auditActions.push(input.action);
          },
        },
        "@/lib/reliability/observability": {
          recordOperationalTenantEvent: async () => true,
        },
        "@/lib/resource-control": {
          canConsumeResource: async () => ({ allowed: true }),
          consumeResource: async () => ({ success: true }),
        },
      },
      async () => {
        const { consumeGamificationBenefit } = loadFresh("../src/lib/gamification/index.ts");

        const consumed = await consumeGamificationBenefit(
          {
            orgId: "org-1",
            actorUserId: "user-1",
            customerKey: "cust-1",
            customerLabel: "Ana",
            resourceType: "try_on",
            amount: 1,
            reason: "uso confirmado",
          },
          { repository: repo, now: new Date("2026-04-14T12:00:00.000Z") }
        );

        assert.equal(consumed.consumed, true);
        assert.equal(consumed.balance.resources.try_on.available, 1);
        assert.ok(auditActions.includes("gamification_benefit_consume"));

        const blocked = await consumeGamificationBenefit(
          {
            orgId: "org-1",
            actorUserId: "user-1",
            customerKey: "cust-1",
            customerLabel: "Ana",
            resourceType: "try_on",
            amount: 10,
            reason: "uso exagerado",
          },
          { repository: repo, now: new Date("2026-04-14T12:00:00.000Z") }
        );

        assert.equal(blocked.consumed, false);
        assert.equal(blocked.reason, "Saldo promocional insuficiente");
        assert.ok(auditActions.includes("gamification_benefit_blocked"));
      }
    );
  });

  await runAsync("gamification route rejects unauthorized access", async () => {
    await withMockedModules(
      {
        "@/lib/merchant/access": {
          resolveMerchantOrgAccess: async () => {
            throw new Error("Forbidden");
          },
        },
        "@/lib/supabase/admin": { createAdminClient: () => ({}) },
        "@/lib/security/audit": { logAudit: async () => {} },
        "@/lib/reliability/observability": { recordOperationalTenantEvent: async () => true },
        "@/lib/resource-control": {
          canConsumeResource: async () => ({ allowed: true }),
          consumeResource: async () => ({ success: true }),
        },
      },
      async () => {
        const { POST } = loadFresh("../src/app/api/org/[slug]/gamification/route.ts");
        const form = new FormData();
        form.set("intent", "create_rule");
        form.set("label", "Share com bônus");
        form.set("rule_type", "share_bonus");
        form.set("benefit_resource_type", "try_on");
        form.set("benefit_amount", "1");
        form.set("per_customer_limit", "1");
        form.set("per_customer_period_days", "30");

        const response = await POST(
          new Request("https://example.com/api/org/loja-venus/gamification", {
            method: "POST",
            headers: {
              accept: "application/json",
            },
            body: form,
          }),
          { params: Promise.resolve({ slug: "loja-venus" }) }
        );

        assert.equal(response.status, 403);
      }
    );
  });

  await runAsync("gamification automatic triggers grant once per source event", async () => {
    const auditActions = [];
    const operationalEvents = [];
    const repo = createGamificationMemoryRepo({
      orgs: [
        {
          id: "org-1",
          slug: "loja-venus",
          name: "Loja Venus",
          status: "active",
          kill_switch: false,
          plan_id: "growth",
          limits: {},
          owner_user_id: null,
          created_at: "2026-04-01T00:00:00.000Z",
          updated_at: "2026-04-14T00:00:00.000Z",
        },
      ],
      rules: [
        {
          id: "rule-auto-1",
          org_id: "org-1",
          rule_type: "share_bonus",
          trigger_mode: "automatic",
          trigger_event_type: "onboarding_completed",
          benefit_resource_type: "try_on",
          benefit_amount: 1,
          active: true,
          per_customer_limit: 2,
          per_customer_period_days: 30,
          valid_from: "2026-04-01T00:00:00.000Z",
          valid_until: null,
          label: "Onboarding com bônus",
          description: null,
          created_by_user_id: null,
          updated_by_user_id: null,
          created_at: "2026-04-01T00:00:00.000Z",
          updated_at: "2026-04-14T00:00:00.000Z",
        },
      ],
    });

    await withMockedModules(
      {
        "@/lib/supabase/admin": { createAdminClient: () => ({}) },
        "@/lib/security/audit": {
          logAudit: async (input) => {
            auditActions.push(input.action);
          },
        },
        "@/lib/reliability/observability": {
          recordOperationalTenantEvent: async (_supabase, input) => {
            operationalEvents.push(input.eventType);
            return true;
          },
        },
        "@/lib/resource-control": {
          canConsumeResource: async () => ({ allowed: true }),
          consumeResource: async () => ({ success: true }),
        },
      },
      async () => {
        loadFresh("../src/lib/gamification/index.ts");
        const { processGamificationTriggerEvent: processAuto } = loadFresh("../src/lib/gamification/events.ts");
        const sourceEventKey = buildGamificationTriggerEventKey({
          orgId: "org-1",
          eventType: "onboarding_completed",
          customerKey: "lead-1",
          customerLabel: "Ana",
          payload: { saved_result_id: "result-1" },
        });

        assert.ok(sourceEventKey);

        const first = await processAuto(
          {
            orgId: "org-1",
            eventType: "onboarding_completed",
            customerKey: "lead-1",
            customerLabel: "Ana",
            eventKey: sourceEventKey,
            payload: { saved_result_id: "result-1" },
          },
          { repository: repo, now: new Date("2026-04-14T12:00:00.000Z") }
        );

        assert.equal(first.granted, 1);
        assert.equal(first.duplicates, 0);
        assert.equal(repo.state.events.filter((event) => event.event_type === "grant" && event.status === "success").length, 1);

        const second = await processAuto(
          {
            orgId: "org-1",
            eventType: "onboarding_completed",
            customerKey: "lead-1",
            customerLabel: "Ana",
            eventKey: sourceEventKey,
            payload: { saved_result_id: "result-1" },
          },
          { repository: repo, now: new Date("2026-04-14T12:00:00.000Z") }
        );

        assert.equal(second.granted, 0);
        assert.equal(second.duplicates, 1);
        assert.equal(repo.state.events.filter((event) => event.event_type === "grant" && event.status === "success").length, 1);

        const { loadGamificationOverview: loadOverview } = loadFresh("../src/lib/gamification/index.ts");
        const overview = await loadOverview("org-1", { repository: repo, now: new Date("2026-04-14T12:00:00.000Z") });
        const automation = summariseGamificationAutomation(overview);
        assert.equal(automation.automatic_rules, 1);
        assert.equal(automation.recent_automatic_events.length, 1);
        assert.ok(auditActions.includes("gamification_benefit_grant"));
        assert.ok(operationalEvents.includes("gamification.benefit_granted"));
      }
    );
  });

  await runAsync("gamification automatic triggers block when budget is exhausted", async () => {
    const auditActions = [];
    const operationalEvents = [];
    const repo = createGamificationMemoryRepo({
      orgs: [
        {
          id: "org-1",
          slug: "loja-venus",
          name: "Loja Venus",
          status: "active",
          kill_switch: false,
          plan_id: "growth",
          limits: {},
          owner_user_id: null,
          created_at: "2026-04-01T00:00:00.000Z",
          updated_at: "2026-04-14T00:00:00.000Z",
        },
      ],
      rules: [
        {
          id: "rule-auto-2",
          org_id: "org-1",
          rule_type: "share_bonus",
          trigger_mode: "automatic",
          trigger_event_type: "result_shared",
          benefit_resource_type: "try_on",
          benefit_amount: 1,
          active: true,
          per_customer_limit: 2,
          per_customer_period_days: 30,
          valid_from: "2026-04-01T00:00:00.000Z",
          valid_until: null,
          label: "Share com bônus",
          description: null,
          created_by_user_id: null,
          updated_by_user_id: null,
          created_at: "2026-04-01T00:00:00.000Z",
          updated_at: "2026-04-14T00:00:00.000Z",
        },
      ],
    });

    await withMockedModules(
      {
        "@/lib/supabase/admin": { createAdminClient: () => ({}) },
        "@/lib/security/audit": {
          logAudit: async (input) => {
            auditActions.push(input.action);
          },
        },
        "@/lib/reliability/observability": {
          recordOperationalTenantEvent: async (_supabase, input) => {
            operationalEvents.push(input.eventType);
            return true;
          },
        },
        "@/lib/resource-control": {
          canConsumeResource: async () => ({ allowed: false }),
          consumeResource: async () => ({ success: false }),
        },
      },
      async () => {
        loadFresh("../src/lib/gamification/index.ts");
        const { processGamificationTriggerEvent: processAuto } = loadFresh("../src/lib/gamification/events.ts");

        const result = await processAuto(
          {
            orgId: "org-1",
            eventType: "result_shared",
            customerKey: "user-1",
            customerLabel: "Cliente",
            eventKey: "result_shared:org-1:ref-1",
            payload: { ref_code: "ref-1" },
          },
          { repository: repo, now: new Date("2026-04-14T12:00:00.000Z") }
        );

        assert.equal(result.granted, 0);
        assert.equal(result.blocked, 1);
        assert.equal(result.duplicates, 0);
        assert.equal(repo.state.events.filter((event) => event.status === "blocked").length, 1);
        assert.ok(auditActions.includes("gamification_benefit_blocked"));
        assert.ok(operationalEvents.includes("gamification.benefit_blocked"));
      }
    );
  });

  await runAsync("gamification automatic triggers skip inactive rules", async () => {
    const repo = createGamificationMemoryRepo({
      orgs: [
        {
          id: "org-1",
          slug: "loja-venus",
          name: "Loja Venus",
          status: "active",
          kill_switch: false,
          plan_id: "growth",
          limits: {},
          owner_user_id: null,
          created_at: "2026-04-01T00:00:00.000Z",
          updated_at: "2026-04-14T00:00:00.000Z",
        },
      ],
      rules: [
        {
          id: "rule-auto-3",
          org_id: "org-1",
          rule_type: "recurring_interaction",
          trigger_mode: "automatic",
          trigger_event_type: "lead_reengaged",
          benefit_resource_type: "whatsapp_message",
          benefit_amount: 1,
          active: false,
          per_customer_limit: 2,
          per_customer_period_days: 30,
          valid_from: "2026-04-01T00:00:00.000Z",
          valid_until: null,
          label: "Reengajamento",
          description: null,
          created_by_user_id: null,
          updated_by_user_id: null,
          created_at: "2026-04-01T00:00:00.000Z",
          updated_at: "2026-04-14T00:00:00.000Z",
        },
      ],
    });

    const { processGamificationTriggerEvent: processAuto } = loadFresh("../src/lib/gamification/events.ts");

    const result = await processAuto(
      {
        orgId: "org-1",
        eventType: "lead_reengaged",
        customerKey: "lead-1",
        customerLabel: "Ana",
        eventKey: "lead_reengaged:org-1:lead-1:2026-04-14T12:00:00.000Z",
        payload: { lead_id: "lead-1" },
      },
      { repository: repo, now: new Date("2026-04-14T12:00:00.000Z") }
    );

    assert.equal(result.skipped, true);
    assert.equal(result.skippedReason, "no_matching_rule");
    assert.equal(repo.state.events.length, 0);
  });

  await runAsync("product upload validation rejects invalid files", async () => {
    const validFile = { size: PRODUCT_IMAGE_MAX_BYTES - 1, type: "image/png", name: "photo.png" };
    const oversizedFile = { size: PRODUCT_IMAGE_MAX_BYTES + 1, type: "image/png", name: "photo.png" };
    const wrongTypeFile = { size: 1024, type: "text/plain", name: "note.txt" };

    assert.equal(validateProductImageFile(validFile).valid, true);
    assert.equal(validateProductImageFile(oversizedFile).reason, "image_too_large");
    assert.equal(validateProductImageFile(wrongTypeFile).reason, "image_invalid_type");
  });

  await runAsync("security rate limiter blocks repeated requests and resets per window", async () => {
    clearInMemoryRateLimitState();
    const request = new Request("https://example.com/api/security", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
      },
    });

    const first = checkInMemoryRateLimit({
      scope: "security:test",
      request,
      limit: 2,
      windowMs: 1_000,
      keyParts: ["org-1"],
      nowMs: 1_000,
    });
    const second = checkInMemoryRateLimit({
      scope: "security:test",
      request,
      limit: 2,
      windowMs: 1_000,
      keyParts: ["org-1"],
      nowMs: 1_200,
    });
    const third = checkInMemoryRateLimit({
      scope: "security:test",
      request,
      limit: 2,
      windowMs: 1_000,
      keyParts: ["org-1"],
      nowMs: 1_300,
    });
    const reset = checkInMemoryRateLimit({
      scope: "security:test",
      request,
      limit: 2,
      windowMs: 1_000,
      keyParts: ["org-1"],
      nowMs: 2_250,
    });

    assert.equal(first.allowed, true);
    assert.equal(second.allowed, true);
    assert.equal(third.allowed, false);
    assert.ok((third.retryAfterSeconds || 0) > 0);
    assert.equal(reset.allowed, true);
  });

  await runAsync("security structured logs sanitize pii", async () => {
    const originalWarn = console.warn;
    const captured = [];

    console.warn = (...args) => {
      captured.push(args);
    };

    try {
      logSecurityEvent("warn", "pii_check", {
        email: "cliente@exemplo.com",
        phone: "+55 (11) 99999-9999",
        url: "https://example.com/image.png?token=abc",
        nested: {
          token: "secret-token",
        },
      });
    } finally {
      console.warn = originalWarn;
    }

    assert.equal(captured.length > 0, true);
    assert.equal(captured[0][0], "[SECURITY]");
    assert.equal(captured[0][1].email, "c***@exemplo.com");
    assert.equal(captured[0][1].phone, "***9999");
    assert.equal(captured[0][1].url, "https://example.com/image.png");
    assert.equal(captured[0][1].nested.token, "[REDACTED]");
  });

  await runAsync("roi metrics use crm and campaign engine data with conservative fallback", async () => {
    const commissionRows = [
      { sale_amount: 1200 },
      { sale_amount: "800" },
      { sale_amount: null },
    ];

    const supabase = {
      from(table) {
        if (table === "crm_leads") {
          return buildSupabaseQueryResult((queryFilters) =>
            queryFilters.some((entry) => entry.type === "eq" && entry.column === "status" && entry.value === "won")
              ? { count: 3, data: [], error: null }
              : { count: 12, data: [], error: null }
          );
        }

        if (table === "campaign_logs") {
          return buildSupabaseQueryResult({ count: 7, data: [], error: null });
        }

        if (table === "commission_events") {
          return buildSupabaseQueryResult({ count: null, data: commissionRows, error: null });
        }

        throw new Error(`Unexpected table ${table}`);
      },
    };

    const metrics = await loadMerchantRoiMetrics(supabase, "org-1");
    assert.equal(metrics.leadsGenerated, 12);
    assert.equal(metrics.leadsConverted, 3);
    assert.equal(metrics.campaignsExecuted, 7);
    assert.equal(metrics.dataConfidence, "high");
    assert.equal(metrics.estimatedSalesImpact, 3000);
    assert.equal(metrics.estimatedRevenueRange.low, 2550);
    assert.equal(metrics.estimatedRevenueRange.high, 3450);
    assert.ok(metrics.notes.some((note) => note.includes("Ticket médio observado")));

    const emptySupabase = {
      from() {
        return buildSupabaseQueryResult({ count: 0, data: [], error: null });
      },
    };

    const fallbackMetrics = await loadMerchantRoiMetrics(emptySupabase, "org-2");
    assert.equal(fallbackMetrics.leadsGenerated, 0);
    assert.equal(fallbackMetrics.leadsConverted, 0);
    assert.equal(fallbackMetrics.campaignsExecuted, 0);
    assert.equal(fallbackMetrics.estimatedSalesImpact, null);
    assert.equal(fallbackMetrics.estimatedRevenueRange.low, null);
    assert.equal(fallbackMetrics.dataConfidence, "low");
    assert.ok(fallbackMetrics.notes.some((note) => note.includes("Sem vendas confirmadas")));
  });

  await runAsync("stock helpers keep legacy rows and alerts consistent", async () => {
    const legacySnapshot = resolveProductStockSnapshot({ stock: 8, reserved_qty: 2, stock_status: null });
    assert.equal(legacySnapshot.availableQty, 6);
    assert.equal(legacySnapshot.totalQty, 8);
    assert.equal(legacySnapshot.stockStatus, "in_stock");

    const lowSnapshot = resolveProductStockSnapshot({ stock: 0, reserved_qty: 0, stock_status: null });
    const alerts = buildInventoryAlerts({
      productId: "prod-1",
      productName: "Blazer",
      stockSnapshot: lowSnapshot,
      tryons7d: 4,
      tryons30d: 0,
    });

    assert.equal(alerts[0].type, "rupture");
    assert.ok(alerts.some((alert) => alert.type === "demand_reprimida"));
  });

  await runAsync("stock migration stays backward safe", async () => {
    const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260414000003_stock_v1.sql"), "utf8");
    assert.ok(migration.includes("ADD COLUMN IF NOT EXISTS stock_qty"));
    assert.ok(migration.includes("ADD COLUMN IF NOT EXISTS reserved_qty"));
    assert.ok(migration.includes("ADD COLUMN IF NOT EXISTS stock_status"));
    assert.ok(migration.includes("COALESCE(stock_qty, stock, 0)"));
  });

  await runAsync("product enrichment route returns ai payload and fallback", async () => {
    const originalFetch = global.fetch;

    try {
      await withTempEnv({ GEMINI_API_KEY: "test-key" }, async () => {
        global.fetch = async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        name: "Blazer Lino Cru",
                        category: "roupa",
                        primary_color: "Bege",
                        style: "alfaiataria",
                        description: "Descricao objetiva da peca.",
                        persuasive_description: "Descricao persuasiva da peca.",
                        emotional_copy: "Copy emocional da peca.",
                        tags: ["base forte", "alfaiataria", "neutro"],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        });

        const route = loadFresh("../src/app/api/products/enrich/route.ts");
        const response = await route.POST(
          new Request("https://example.com/api/products/enrich", {
            method: "POST",
            body: JSON.stringify({
              image_base64: "data:image/png;base64,AAAA",
              file_name: "blazer.png",
              name: "",
              category: "roupa",
            }),
          })
        );

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.fallback_used, false);
        assert.equal(payload.name, "Blazer Lino Cru");
        assert.equal(payload.primary_color, "Bege");
        assert.equal(payload.tags.length, 3);
      });
    } finally {
      global.fetch = originalFetch;
    }

    try {
      await withTempEnv({ GEMINI_API_KEY: "test-key" }, async () => {
        global.fetch = async () => ({
          ok: false,
          status: 502,
          text: async () => "upstream failed",
        });

        const route = loadFresh("../src/app/api/products/enrich/route.ts");
        const response = await route.POST(
          new Request("https://example.com/api/products/enrich", {
            method: "POST",
            body: JSON.stringify({
              image_base64: "data:image/png;base64,AAAA",
              file_name: "blazer.png",
              name: "",
              category: "roupa",
            }),
          })
        );

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.fallback_used, true);
        assert.ok(payload.name.length > 0);
        assert.ok(payload.description.length > 0);
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  await runAsync("product create action persists enriched fields for an authorized tenant", async () => {
    const inserts = [];
    const uploadedFiles = [];

    const admin = {
      storage: {
        listBuckets: async () => ({ data: [{ name: "products", public: true }], error: null }),
        createBucket: async () => ({ error: null }),
        updateBucket: async () => ({ error: null }),
        from: () => ({
          upload: async (path, buffer, options) => {
            uploadedFiles.push({ path, size: buffer.length, options });
            return { error: null };
          },
          getPublicUrl: () => ({ data: { publicUrl: "https://cdn.example.com/product.png" } }),
        }),
      },
      from: (table) => {
        if (table === "products") {
          return {
            insert: (rows) => {
              inserts.push({ table, rows });
              return {
                select: () => ({
                  single: async () => ({
                    data: { id: "prod-1", name: rows[0].name, category: rows[0].category, type: rows[0].type },
                    error: null,
                  }),
                }),
              };
            },
          };
        }

        if (table === "product_variants") {
          return { insert: async () => ({ error: null }) };
        }

        if (table === "tenant_events") {
          return { insert: async () => ({ error: null }) };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    };

    try {
      await withTempEnv(
        {
          NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        },
        async () =>
          withMockedModules(
            {
              "next/navigation": {
                redirect: (url) => {
                  throw new Error(`REDIRECT:${url}`);
                },
              },
              "next/cache": {
                revalidatePath: () => {},
              },
              "@/lib/supabase/server": {
                createClient: async () => ({
                  auth: {
                    getUser: async () => ({ data: { user: { id: "user-1" } } }),
                  },
                }),
              },
              "@/lib/supabase/admin": {
                createAdminClient: () => admin,
              },
              "@/lib/tenant/core": {
                assertMerchantWritableOrgAccess: async () => ({
                  user: { id: "user-1" },
                  org: { id: "org-1", slug: "org-one" },
                }),
                bumpTenantUsageDaily: async () => null,
              },
              "@/lib/tenant/enforcement": {
                enforceTenantOperationalState: async () => ({ allowed: true }),
              },
              "@/lib/billing/enforcement": {
                enforceOrgHardCap: async () => ({ allowed: true }),
              },
            },
            async () => {
              const actions = loadFresh("../src/app/b2b/product/new/actions.ts");
              const formData = new FormData();
              formData.set("name", "Blazer de Linho");
              formData.set("category", "roupa");
              formData.set("primary_color", "Bege");
              formData.set("style", "alfaiataria");
              formData.set("description", "Descricao objetiva");
              formData.set("persuasive_description", "Descricao persuasiva");
              formData.set("emotional_copy", "Copy emocional");
              formData.set("stock_qty", "8");
              formData.set("reserved_qty", "2");
              formData.set("stock_status", "in_stock");
              formData.set("tags_json", JSON.stringify(["alfaiataria", "base forte"]));
              formData.set("return_to", "/merchant");
              formData.set("image_file", new File(["fake-image"], "product.png", { type: "image/png" }));

              await actions.createProduct(formData);
            }
          )
      );
      throw new Error("Expected redirect from createProduct");
    } catch (error) {
      assert.ok(String(error.message || error).includes("REDIRECT:/merchant?created=true"));
    }

    assert.equal(inserts.length, 1);
    assert.equal(inserts[0].rows[0].description, "Descricao objetiva");
    assert.equal(inserts[0].rows[0].persuasive_description, "Descricao persuasiva");
    assert.equal(inserts[0].rows[0].emotional_copy, "Copy emocional");
    assert.equal(inserts[0].rows[0].stock_qty, 8);
    assert.equal(inserts[0].rows[0].reserved_qty, 2);
    assert.equal(inserts[0].rows[0].stock_status, "in_stock");
    assert.equal(inserts[0].rows[0].stock, 6);
    assert.equal(uploadedFiles.length, 1);
  });

  await runAsync("product create action rejects unauthorized tenant access before insert", async () => {
    let inserted = false;

    try {
      await withTempEnv(
        {
          NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        },
        async () =>
          withMockedModules(
            {
              "next/navigation": {
                redirect: (url) => {
                  throw new Error(`REDIRECT:${url}`);
                },
              },
              "next/cache": {
                revalidatePath: () => {},
              },
              "@/lib/supabase/server": {
                createClient: async () => ({
                  auth: {
                    getUser: async () => ({ data: { user: { id: "user-1" } } }),
                  },
                }),
              },
              "@/lib/supabase/admin": {
                createAdminClient: () => ({
                  storage: {
                    listBuckets: async () => ({ data: [], error: null }),
                    createBucket: async () => ({ error: null }),
                    updateBucket: async () => ({ error: null }),
                    from: () => ({
                      upload: async () => ({ error: null }),
                      getPublicUrl: () => ({ data: { publicUrl: "https://cdn.example.com/product.png" } }),
                    }),
                  },
                  from: (table) => {
                    if (table === "products") {
                      inserted = true;
                      return {
                        insert: () => ({
                          select: () => ({
                            single: async () => ({ data: null, error: null }),
                          }),
                        }),
                      };
                    }
                    return { insert: async () => ({ error: null }) };
                  },
                }),
              },
              "@/lib/tenant/core": {
                assertMerchantWritableOrgAccess: async () => {
                  throw new Error("forbidden");
                },
                bumpTenantUsageDaily: async () => null,
              },
              "@/lib/tenant/enforcement": {
                enforceTenantOperationalState: async () => ({ allowed: true }),
              },
              "@/lib/billing/enforcement": {
                enforceOrgHardCap: async () => ({ allowed: true }),
              },
            },
            async () => {
              const actions = loadFresh("../src/app/b2b/product/new/actions.ts");
              const formData = new FormData();
              formData.set("name", "Blazer de Linho");
              formData.set("category", "roupa");
              formData.set("primary_color", "Bege");
              formData.set("style", "alfaiataria");
              formData.set("description", "Descricao objetiva");
              formData.set("persuasive_description", "Descricao persuasiva");
              formData.set("emotional_copy", "Copy emocional");
              formData.set("return_to", "/merchant");
              formData.set("image_file", new File(["fake-image"], "product.png", { type: "image/png" }));

              await actions.createProduct(formData);
            }
          )
      );
    } catch (error) {
      assert.ok(String(error.message || error).includes("REDIRECT:/b2b/product/new?error=tenant"));
    }

    assert.equal(inserted, false);
  });

  await runAsync("stock update action rejects products outside the tenant scope", async () => {
    let updated = false;

    try {
      await withTempEnv(
        {
          NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        },
        async () =>
          withMockedModules(
            {
              "next/navigation": {
                redirect: (url) => {
                  throw new Error(`REDIRECT:${url}`);
                },
              },
              "@/lib/supabase/server": {
                createClient: async () => ({
                  auth: {
                    getUser: async () => ({ data: { user: { id: "user-1" } } }),
                  },
                }),
              },
              "@/lib/supabase/admin": {
                createAdminClient: () => ({
                  from: (table) => {
                    if (table === "products") {
                      return {
                        select: () => ({
                          eq: () => ({
                            eq: () => ({
                              maybeSingle: async () => ({ data: null, error: null }),
                            }),
                          }),
                        }),
                        update: () => {
                          updated = true;
                          return { eq: () => ({ eq: () => ({ error: null }) }) };
                        },
                      };
                    }

                    if (table === "tenant_events") {
                      return { insert: async () => ({ error: null }) };
                    }

                    return { insert: async () => ({ error: null }) };
                  },
                }),
              },
              "@/lib/tenant/core": {
                assertMerchantWritableOrgAccess: async () => ({
                  user: { id: "user-1" },
                  org: { id: "org-1", slug: "org-one" },
                }),
                bumpTenantUsageDaily: async () => null,
              },
            },
            async () => {
              const actions = loadFresh("../src/app/b2b/product/new/actions.ts");
              const formData = new FormData();
              formData.set("product_id", "prod-missing");
              formData.set("stock_qty", "4");
              formData.set("reserved_qty", "0");
              formData.set("stock_status", "low_stock");
              formData.set("return_to", "/org/org-one/catalog");

              await actions.updateProductStock(formData);
            }
          )
      );
      throw new Error("Expected redirect from updateProductStock");
    } catch (error) {
      assert.ok(String(error.message || error).includes("REDIRECT:/org/org-one/catalog?error=product_not_found"));
    }

    assert.equal(updated, false);
  });

  await runAsync("privacy export route rejects cross-tenant access", async () => {
    await withMockedModules(
      {
        "@/lib/merchant/access": {
          resolveMerchantOrgAccess: async () => {
            throw new Error("Forbidden");
          },
        },
        "@/lib/supabase/admin": {
          createAdminClient: () => {
            throw new Error("unexpected admin access");
          },
        },
      },
      async () => {
        const route = loadFresh("../src/app/api/org/[slug]/privacy/export/route.ts");
        const response = await route.GET(
          new Request("https://example.com/api/org/other/privacy/export"),
          {
            params: Promise.resolve({ slug: "other" }),
          }
        );

        assert.equal(response.status, 403);
        const payload = await response.json();
        assert.equal(payload.error, "Forbidden");
      }
    );
  });

  await runAsync("tenant privacy delete purges rows and records audit", async () => {
    const deleteCalls = [];
    const insertCalls = [];
    const storageCalls = [];

    const admin = {
      storage: {
        from: (bucket) => ({
          list: async (prefix) => {
            storageCalls.push({ bucket, prefix, op: "list" });
            return { data: [], error: null };
          },
          remove: async (paths) => {
            storageCalls.push({ bucket, paths, op: "remove" });
            return { error: null };
          },
        }),
      },
      from: (table) => {
        if (table === "privacy_audit_events") {
          return {
            insert: async (row) => {
              insertCalls.push(row);
              return { error: null };
            },
          };
        }

        const makeDeleteChain = () => ({
          eq: (column, value) => {
            deleteCalls.push({ table, column, value });
            return {
              select: async () => ({
                data: [{ id: `${table}-1` }],
                error: null,
              }),
            };
          },
        });

        if (
          [
            "saved_results",
            "products",
            "tryon_events",
            "leads",
            "lead_context",
            "whatsapp_messages",
            "whatsapp_conversations",
            "orgs",
          ].includes(table)
        ) {
          return {
            delete: () => makeDeleteChain(),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    };

    await withMockedModules(
      {
        "@/lib/merchant/access": {
          resolveMerchantOrgAccess: async () => ({
            user: { id: "user-1" },
            org: {
              id: "org-1",
              slug: "maison-elite",
              name: "Maison Elite",
              branch_name: "Centro",
              status: "active",
              plan_id: "growth",
            },
            source: "merchant",
          }),
        },
        "@/lib/supabase/admin": {
          createAdminClient: () => admin,
        },
      },
      async () => {
        const route = loadFresh("../src/app/api/org/[slug]/privacy/delete/route.ts");
        const response = await route.POST(
          new Request("https://example.com/api/org/maison-elite/privacy/delete", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ confirm: true }),
          }),
          {
            params: Promise.resolve({ slug: "maison-elite" }),
          }
        );

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.ok, true);
        assert.equal(payload.deleted.organization.slug, "maison-elite");
        assert.equal(payload.deleted.deleted.saved_results, 1);
        assert.ok(deleteCalls.some((entry) => entry.table === "saved_results" && entry.column === "org_id" && entry.value === "org-1"));
        assert.ok(deleteCalls.some((entry) => entry.table === "whatsapp_messages" && entry.column === "org_slug" && entry.value === "maison-elite"));
        assert.ok(deleteCalls.some((entry) => entry.table === "orgs" && entry.column === "id" && entry.value === "org-1"));
        assert.ok(insertCalls.some((row) => row.action === "tenant_delete_completed"));
        assert.ok(storageCalls.some((entry) => entry.op === "list" && entry.prefix === "org-1"));
      }
    );
  });

  await runAsync("scenario 1 - normal flow contract accepts valid ids and serves persisted results", async () => {
    const resultIdModule = loadFresh("../src/lib/result/id.ts");

    assert.equal(resultIdModule.isValidResultId(VALID_RESULT_ID), true);
    assert.equal(resultIdModule.isValidResultId("MOCK_DB_FAIL"), false);

    const supabase = {
      from(table) {
        if (table !== "saved_results") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          select() {
            return {
              eq(column, value) {
                assert.equal(column, "id");
                assert.equal(value, VALID_RESULT_ID);
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: VALID_RESULT_ID,
                      payload: {
                        visualAnalysis: { essence: { label: "Autora", reason: "Teste" } },
                        finalResult: { looks: [] },
                        tenant: { orgId: VALID_ORG_ID, orgSlug: "maison-elite" },
                      },
                      created_at: "2026-04-06T12:00:00.000Z",
                      updated_at: "2026-04-06T12:00:00.000Z",
                    },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      },
    };

    const resultResponse = await withMockedModules({
      "server-only": {},
      "@/lib/supabase/admin": {
        createAdminClient: () => supabase,
      },
    }, async () => {
      const resultRoute = loadFresh("../src/app/api/result/[id]/route.ts");
      return resultRoute.GET(new Request(`https://example.com/api/result/${VALID_RESULT_ID}`), {
        params: Promise.resolve({ id: VALID_RESULT_ID }),
      });
    });

    assert.equal(resultResponse.status, 200);
    const payload = await resultResponse.json();
    assert.equal(payload.id, VALID_RESULT_ID);
    assert.equal(payload.tenant.orgId, VALID_ORG_ID);
    assert.equal(payload.finalResult.looks.length, 0);
    assert.ok(payload.assistedRecommendations);
    assert.equal(payload.assistedRecommendations.products.length, 0);
    assert.equal(payload.assistedRecommendations.looks.length, 0);

    const processingSource = fs.readFileSync(path.join(process.cwd(), "src/app/processing/page.tsx"), "utf8");
    assert.ok(processingSource.includes("isValidResultId(dbReferenceId)"));
    assert.ok(!processingSource.includes('router.push("/result?id=MOCK_DB_FAIL")'));
  });

  await runAsync("scenario 1b - result api normalizes tenant from saved_results org_id", async () => {
    const supabase = {
      from(table) {
        if (table !== "saved_results") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          select() {
            return {
              eq(column, value) {
                assert.equal(column, "id");
                assert.equal(value, VALID_RESULT_ID);
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: VALID_RESULT_ID,
                      org_id: VALID_ORG_ID,
                      payload: {
                        visualAnalysis: { essence: { label: "Autora", reason: "Teste" } },
                        finalResult: { looks: [] },
                      },
                      created_at: "2026-04-06T12:00:00.000Z",
                      updated_at: "2026-04-06T12:00:00.000Z",
                    },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      },
    };

    const resultResponse = await withMockedModules({
      "server-only": {},
      "@/lib/supabase/admin": {
        createAdminClient: () => supabase,
      },
      "@/lib/catalog-query/engine": {
        getCatalogLink: async () => "/catalog",
      },
      "@/lib/tenant-config": {
        getTenantConfigSummary: async () => ({
          catalog_sources_count: 0,
          active_catalog_source: null,
          ai_capabilities_enabled: 0,
          ai_capabilities_disabled: 0,
          knowledge_base_enabled: false,
          knowledge_base_entries: 0,
          personality: "consultive",
        }),
      },
    }, async () => {
      const resultRoute = loadFresh("../src/app/api/result/[id]/route.ts");
      return resultRoute.GET(new Request(`https://example.com/api/result/${VALID_RESULT_ID}`), {
        params: Promise.resolve({ id: VALID_RESULT_ID }),
      });
    });

    assert.equal(resultResponse.status, 200);
    const payload = await resultResponse.json();
    assert.equal(payload.tenant.orgId, VALID_ORG_ID);
    assert.equal(payload.catalogLink, "/catalog");

    const processingSource = fs.readFileSync(path.join(process.cwd(), "src/app/processing/page.tsx"), "utf8");
    assert.ok(processingSource.includes("validationPayload?.org_id"));
    assert.ok(processingSource.includes("validationTenantOrgId"));
    assert.ok(processingSource.includes("[processing:persistence-validation-failed]"));
  });

  await runAsync("scenario 1c - version api exposes safe deployment metadata", async () => {
    const response = await withTempEnv({
      VERCEL_GIT_COMMIT_SHA: "185b6749dd045913dde3a78993ba1d7978a73c90",
      VERCEL_GIT_COMMIT_REF: "antigravity/scope-guards-observability",
      VERCEL_DEPLOYMENT_ID: "dpl_test_123",
      VERCEL_URL: "venus-engine.vercel.app",
      VERCEL_ENV: "production",
    }, async () => {
      const versionRoute = loadFresh("../src/app/api/version/route.ts");
      return versionRoute.GET(new Request("https://example.com/api/version"));
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.commitSha, "185b6749dd045913dde3a78993ba1d7978a73c90");
    assert.equal(payload.commitRef, "antigravity/scope-guards-observability");
    assert.equal(payload.deploymentId, "dpl_test_123");
    assert.equal(payload.deploymentUrl, "venus-engine.vercel.app");
    assert.equal(payload.environment, "production");
    assert.ok(typeof payload.buildTimestamp === "string");
  });

  await runAsync("scenario 1d - processing preflight blocks empty tenant and preserves photo payloads", async () => {
    const processingModule = loadFresh("../src/lib/onboarding/processing.ts");
    const onboarding = {
      tenant: {},
      contact: {},
      scanner: {
        facePhoto: "https://cdn.example.com/face.jpg",
        facePhotoUrl: "https://cdn.example.com/face.jpg",
        facePhotoPath: "onboarding-inputs/org-1/face.jpg",
        bodyPhoto: "https://cdn.example.com/body.jpg",
        bodyPhotoUrl: "https://cdn.example.com/body.jpg",
        bodyPhotoPath: "onboarding-inputs/org-1/body.jpg",
        skipped: false,
      },
      intent: { imageGoal: "Autoridade", styleDirection: "Executiva", satisfaction: 9 },
      lifestyle: {},
      colors: {},
      body: {},
    };

    const blocked = processingModule.buildProcessingPersistInput(onboarding, "", null);
    assert.equal(blocked.readiness.failureReason, "PROCESSING_MISSING_TENANT");

    const inlineBlocked = processingModule.buildProcessingPersistInput(
      {
        ...onboarding,
        scanner: {
          facePhoto: "data:image/png;base64,face-inline",
          bodyPhoto: "data:image/png;base64,body-inline",
          skipped: false,
        },
      },
      "maison-elite",
      null
    );
    assert.equal(inlineBlocked.readiness.failureReason, "PAYLOAD_TOO_LARGE_PREVENTED");

    const missingPhoto = processingModule.buildProcessingPersistInput(
      {
        ...onboarding,
        scanner: {
          facePhoto: "",
          bodyPhoto: "",
          facePhotoUrl: "",
          bodyPhotoUrl: "",
          facePhotoPath: "",
          bodyPhotoPath: "",
          skipped: false,
        },
      },
      "maison-elite",
      null
    );
    assert.equal(missingPhoto.readiness.failureReason, "PROCESSING_MISSING_PHOTO");

    const fallbackAllowed = processingModule.buildProcessingPersistInput(
      {
        ...onboarding,
        scanner: {
          facePhoto: "",
          bodyPhoto: "",
          facePhotoUrl: "",
          bodyPhotoUrl: "",
          facePhotoPath: "",
          bodyPhotoPath: "",
          skipped: true,
        },
      },
      "maison-elite",
      null
    );
    assert.equal(fallbackAllowed.readiness.failureReason, null);

    const allowed = processingModule.buildProcessingPersistInput(onboarding, "maison-elite", null);
    assert.equal(allowed.readiness.failureReason, null);
    assert.equal(allowed.payload.tenant.orgSlug, "maison-elite");
    assert.equal(allowed.payload.scanner.facePhoto, "https://cdn.example.com/face.jpg");
    assert.equal(allowed.payload.scanner.bodyPhoto, "https://cdn.example.com/body.jpg");
    assert.equal(allowed.payload.scanner.facePhotoUrl, "https://cdn.example.com/face.jpg");
    assert.equal(allowed.payload.scanner.bodyPhotoUrl, "https://cdn.example.com/body.jpg");
    assert.equal(allowed.payload.scanner.facePhotoPath, "onboarding-inputs/org-1/face.jpg");
    assert.equal(allowed.payload.scanner.bodyPhotoPath, "onboarding-inputs/org-1/body.jpg");

    const processingSource = fs.readFileSync(path.join(process.cwd(), "src/app/processing/page.tsx"), "utf8");
    assert.ok(processingSource.includes("PAYLOAD_TOO_LARGE"));
    assert.ok(processingSource.includes("IMAGE_UPLOAD_REQUIRED"));
    assert.ok(processingSource.includes("Não foi possível validar e salvar seu resultado com segurança."));
    assert.ok(!processingSource.includes("Body exceeded 1 MB limit"));
  });

  await runAsync("scenario 1e - onboarding storage migrates legacy session key and keeps storage key consistent", async () => {
    const storageModule = loadFresh("../src/lib/onboarding/storage.ts");
    const store = new Map();
    const storage = {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, value);
      },
      removeItem(key) {
        store.delete(key);
      },
      key(index) {
        return Array.from(store.keys())[index] || null;
      },
      get length() {
        return store.size;
      },
    };

    storage.setItem(
      "venus_onboarding",
      JSON.stringify({
        tenant: { orgSlug: "legacy-maison", branchName: "Legacy Maison" },
        scanner: { facePhoto: "", bodyPhoto: "data:image/png;base64,body", skipped: false },
        intent: { imageGoal: "Autoridade" },
      })
    );

    const snapshot = storageModule.hydrateOnboardingStorage({
      storage,
      userId: "user-123",
      queryOrgSlug: "",
    });

    assert.equal(snapshot.data.tenant.orgSlug, "legacy-maison");
    assert.equal(snapshot.sourceKey, "venus_onboarding");
    assert.equal(snapshot.migrated, true);

    const newKey = storageModule.buildOnboardingStorageKey("user-123", "legacy-maison");
    assert.equal(storage.getItem("venus_onboarding"), null);
    assert.ok(storage.getItem(newKey));

    storageModule.persistOnboardingStorage({
      storage,
      userId: "user-123",
      queryOrgSlug: "legacy-maison",
      data: snapshot.data,
    });
    assert.equal(storage.getItem(newKey) !== null, true);
  });

  await runAsync("scenario 1e2 - query org slug is reapplied into onboarding tenant state", async () => {
    const storageModule = loadFresh("../src/lib/onboarding/storage.ts");

    const patched = storageModule.applyQueryOrgSlug(
      {
        ...storageModule.mergeOnboardingData({}, ""),
        tenant: {
          orgSlug: "",
          orgId: "",
          branchName: null,
          whatsappNumber: null,
        },
      },
      "maison-elite"
    );

    assert.equal(patched.tenant.orgSlug, "maison-elite");
    assert.equal(patched.tenant.orgId, "");
  });

  await runAsync("scenario 1f - public entry resolves maison-elite canonically", async () => {
    const admin = {
      from(table) {
        assert.equal(table, "orgs");
        return {
          select() {
            return this;
          },
          eq(column, value) {
            if (column === "slug") {
              assert.ok(value === "maison-elite" || value === "invalid-tenant");
            }
            return this;
          },
          maybeSingle: async () => ({
            data: {
              id: "org-maison-elite",
              slug: "maison-elite",
              name: "Maison Elite",
              branch_name: "Maison Elite",
              logo_url: null,
              primary_color: "#D4AF37",
              status: "active",
              kill_switch: false,
            },
            error: null,
          }),
        };
      },
    };

    const publicEntryModule = await withMockedModules(
      {
        "@/lib/supabase/admin": {
          createAdminClient: () => admin,
        },
      },
      async () => loadFresh("../src/lib/onboarding/public-entry.ts")
    );

    const resolvedCanonical = await publicEntryModule.resolvePublicEntryTenant(null);
    assert.equal(resolvedCanonical.slug, "maison-elite");
    assert.equal(resolvedCanonical.status, "active");
    assert.equal(resolvedCanonical.kill_switch, false);

    const resolvedExplicit = await publicEntryModule.resolvePublicEntryTenant("maison-elite");
    assert.equal(resolvedExplicit.slug, "maison-elite");

    const invalidAdmin = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: null, error: null }),
        };
      },
    };

    const missingModule = await withMockedModules(
      {
        "@/lib/supabase/admin": {
          createAdminClient: () => invalidAdmin,
        },
      },
      async () => loadFresh("../src/lib/onboarding/public-entry.ts")
    );

    const missingTenant = await missingModule.resolvePublicEntryTenant("invalid-tenant");
    assert.equal(missingTenant, null);
  });

  await runAsync("scenario 1g - root page redirects to canonical maison-elite entry", async () => {
    const redirectCalls = [];
    const admin = {
      from() {
        return {
          select() {
            return this;
          },
          eq(column, value) {
            assert.equal(column, "slug");
            assert.equal(value, "maison-elite");
            return this;
          },
          maybeSingle: async () => ({
            data: {
              id: "org-maison-elite",
              slug: "maison-elite",
              name: "Maison Elite",
              branch_name: "Maison Elite",
              logo_url: null,
              primary_color: "#D4AF37",
              status: "active",
              kill_switch: false,
            },
            error: null,
          }),
        };
      },
    };

    delete require.cache[require.resolve("next/navigation")];
    delete require.cache[require.resolve("../src/lib/onboarding/public-entry.ts")];

    const pageModule = await withMockedModules(
      {
        "next/navigation": {
          redirect: (url) => {
            redirectCalls.push(url);
            throw new Error(`REDIRECT:${url}`);
          },
        },
        "@/lib/supabase/admin": {
          createAdminClient: () => admin,
        },
      },
      async () => loadFresh("../src/app/page.tsx")
    );

    try {
      await pageModule.default({ searchParams: Promise.resolve({}) });
      throw new Error("Expected redirect from root page");
    } catch (error) {
      assert.ok(String(error.message || error).includes("REDIRECT:/onboarding/chat?org=maison-elite"));
    }

    assert.equal(redirectCalls[0], "/onboarding/chat?org=maison-elite");
  });

  await runAsync("scenario 1h - onboarding photo upload stores file and returns lightweight references", async () => {
    const bucketUpdates = [];
    const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
    const createAdminClient = () => ({
      storage: {
        async listBuckets() {
          return { data: [{ name: "onboarding-photos", public: true }], error: null };
        },
        async createBucket(name, options) {
          bucketUpdates.push({ kind: "create", name, options });
          return { error: null };
        },
        async updateBucket(name, options) {
          bucketUpdates.push({ kind: "update", name, options });
          return { error: null };
        },
        from() {
          return {
            async upload() {
              return { error: null };
            },
            async createSignedUrl(storagePath, expiresIn) {
              return {
                data: {
                  signedUrl: `https://cdn.example.com/${storagePath}?signed=1&expires=${expiresIn}`,
                },
                error: null,
              };
            },
          };
        },
      },
    });

    const module = await withMockedModules(
      {
        "@/lib/supabase/admin": {
          createAdminClient,
        },
        "@/lib/reliability/security": {
          checkInMemoryRateLimit: () => ({
            allowed: true,
            retryAfterSeconds: 0,
            limit: 10,
          }),
          logSecurityEvent: () => null,
          recordSecurityAlert: async () => null,
        },
      },
      async () => loadFresh("../src/app/api/onboarding/photo-upload/route.ts")
    );

    const formData = new FormData();
    formData.set("file", new File([pngBytes], "photo.png", { type: "image/png" }));
    formData.set("org_id", "org-123");
    formData.set("org_slug", "maison-elite");
    formData.set("kind", "body");
    formData.set("journey_id", "journey-123");

    const response = await module.POST(new Request("https://example.com/api/onboarding/photo-upload", {
      method: "POST",
      body: formData,
    }));

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.bucket, "onboarding-photos");
    assert.equal(typeof payload.storagePath, "string");
    assert.equal(typeof payload.signedUrl, "string");
    assert.ok(payload.signedUrl.includes(payload.storagePath));
    assert.equal(payload.expiresInSeconds, 600);
    assert.ok(bucketUpdates.some((entry) => entry.kind === "update" && entry.options?.public === false));
    assert.ok(bucketUpdates.some((entry) => entry.kind === "create" || entry.kind === "update"));
  });

  await runAsync("scenario 1i - onboarding photo upload rejects invalid mime and unsafe path inputs", async () => {
    const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
    const module = await withMockedModules(
      {
        "@/lib/supabase/admin": {
          createAdminClient: () => ({
            storage: {
              async listBuckets() {
                return { data: [{ name: "onboarding-photos", public: false }], error: null };
              },
              async updateBucket() {
                return { error: null };
              },
              async createBucket() {
                return { error: null };
              },
              from() {
                return {
                  async upload() {
                    return { error: null };
                  },
                  async createSignedUrl() {
                    return { data: { signedUrl: "https://cdn.example.com/signed" }, error: null };
                  },
                };
              },
            },
          }),
        },
        "@/lib/reliability/security": {
          checkInMemoryRateLimit: () => ({
            allowed: true,
            retryAfterSeconds: 0,
            limit: 10,
          }),
          logSecurityEvent: () => null,
          recordSecurityAlert: async () => null,
        },
      },
      async () => loadFresh("../src/app/api/onboarding/photo-upload/route.ts")
    );

    const invalidMimeForm = new FormData();
    invalidMimeForm.set("file", new File(["plain-text"], "photo.txt", { type: "text/plain" }));
    invalidMimeForm.set("org_id", "org-123");
    invalidMimeForm.set("kind", "face");

    const invalidMimeResponse = await module.POST(new Request("https://example.com/api/onboarding/photo-upload", {
      method: "POST",
      body: invalidMimeForm,
    }));

    assert.equal(invalidMimeResponse.status, 400);
    assert.equal((await invalidMimeResponse.json()).error, "invalid_file_type");

    const missingOrgForm = new FormData();
    missingOrgForm.set("file", new File([pngBytes], "photo.png", { type: "image/png" }));
    missingOrgForm.set("kind", "body");

    const missingOrgResponse = await module.POST(new Request("https://example.com/api/onboarding/photo-upload", {
      method: "POST",
      body: missingOrgForm,
    }));

    assert.equal(missingOrgResponse.status, 400);
    assert.equal((await missingOrgResponse.json()).error, "invalid_storage_path");

    const unsafePathForm = new FormData();
    unsafePathForm.set("file", new File([pngBytes], "photo.png", { type: "image/png" }));
    unsafePathForm.set("org_id", "../evil");
    unsafePathForm.set("kind", "body");

    const unsafePathResponse = await module.POST(new Request("https://example.com/api/onboarding/photo-upload", {
      method: "POST",
      body: unsafePathForm,
    }));

    assert.equal(unsafePathResponse.status, 200);
    const sanitizedPayload = await unsafePathResponse.json();
    assert.ok(String(sanitizedPayload.storagePath || "").includes("onboarding-inputs/evil/"));
    assert.ok(!String(sanitizedPayload.storagePath || "").includes(".."));
  });

  await runAsync("scenario 1j - onboarding photo signed url route returns short-lived access", async () => {
    const module = await withMockedModules(
      {
        "@/lib/supabase/admin": {
          createAdminClient: () => ({
            storage: {
              from() {
                return {
                  async createSignedUrl(storagePath, expiresIn) {
                    return {
                      data: {
                        signedUrl: `https://cdn.example.com/${storagePath}?expires=${expiresIn}`,
                      },
                      error: null,
                    };
                  },
                };
              },
            },
          }),
        },
      },
      async () => loadFresh("../src/app/api/onboarding/photo-signed-url/route.ts")
    );

    const response = await module.POST(new Request("https://example.com/api/onboarding/photo-signed-url", {
      method: "POST",
      body: JSON.stringify({
        storagePath: "onboarding-inputs/org-123/body/journey-123-abc123.jpg",
        orgId: "org-123",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    }));

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.expiresInSeconds, 600);
    assert.ok(String(payload.signedUrl || "").includes("expires=600"));
  });

  await runAsync("scenario 1k - onboarding photo upload rejects oversized images before storage", async () => {
    const module = await withMockedModules(
      {
        "@/lib/supabase/admin": {
          createAdminClient: () => ({
            storage: {
              async listBuckets() {
                return { data: [{ name: "onboarding-photos", public: false }], error: null };
              },
              async updateBucket() {
                return { error: null };
              },
              from() {
                return {
                  async upload() {
                    return { error: null };
                  },
                  async createSignedUrl() {
                    return { data: { signedUrl: "https://cdn.example.com/ok" }, error: null };
                  },
                };
              },
            },
          }),
        },
        "@/lib/reliability/security": {
          checkInMemoryRateLimit: () => ({
            allowed: true,
            retryAfterSeconds: 0,
            limit: 10,
          }),
          logSecurityEvent: () => null,
          recordSecurityAlert: async () => null,
        },
      },
      async () => loadFresh("../src/app/api/onboarding/photo-upload/route.ts")
    );

    const oversizedBytes = new Uint8Array(6 * 1024 * 1024 + 1);
    oversizedBytes[0] = 0xff;
    oversizedBytes[1] = 0xd8;
    oversizedBytes[2] = 0xff;
    const oversizedForm = new FormData();
    oversizedForm.set("file", new File([oversizedBytes], "photo.jpg", { type: "image/jpeg" }));
    oversizedForm.set("org_id", "org-123");
    oversizedForm.set("kind", "face");

    const response = await module.POST(new Request("https://example.com/api/onboarding/photo-upload", {
      method: "POST",
      body: oversizedForm,
    }));

    assert.equal(response.status, 413);
    assert.equal((await response.json()).error, "file_too_large");
  });

  await runAsync("scenario 1l - tryon upload stores private files and returns signed urls", async () => {
    const bucketUpdates = [];
    const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
    const module = await withMockedModules(
      {
        "@/lib/supabase/admin": {
          createAdminClient: () => ({
            storage: {
              async listBuckets() {
                return { data: [{ name: "tryon-inputs", public: true }], error: null };
              },
              async createBucket(name, options) {
                bucketUpdates.push({ kind: "create", name, options });
                return { error: null };
              },
              async updateBucket(name, options) {
                bucketUpdates.push({ kind: "update", name, options });
                return { error: null };
              },
              from() {
                return {
                  async upload() {
                    return { error: null };
                  },
                  async createSignedUrl(storagePath, expiresIn) {
                    return {
                      data: { signedUrl: `https://cdn.example.com/${storagePath}?expires=${expiresIn}` },
                      error: null,
                    };
                  },
                };
              },
            },
          }),
        },
        "@/lib/reliability/security": {
          checkInMemoryRateLimit: () => ({
            allowed: true,
            retryAfterSeconds: 0,
            limit: 12,
          }),
          logSecurityEvent: () => null,
          recordSecurityAlert: async () => null,
        },
      },
      async () => loadFresh("../src/app/api/tryon/upload/route.ts")
    );

    const formData = new FormData();
    formData.set("file", new File([pngBytes], "tryon.png", { type: "image/png" }));
    formData.set("org_id", "org-123");

    const response = await module.POST(new Request("https://example.com/api/tryon/upload", {
      method: "POST",
      body: formData,
    }));

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.bucket, "tryon-inputs");
    assert.equal(typeof payload.storagePath, "string");
    assert.equal(typeof payload.signedUrl, "string");
    assert.equal(payload.expiresInSeconds, 600);
    assert.ok(payload.signedUrl.includes(payload.storagePath));
    assert.ok(bucketUpdates.some((entry) => entry.kind === "update" && entry.options?.public === false));
  });

  await runAsync("scenario 2 - tenant resolution failure throws before navigation", async () => {
    const onboarding = {
      contact: { name: "Cliente", phone: "+5511999999999", email: "cliente@exemplo.com" },
      tenant: {},
      scanner: {
        facePhoto: "https://cdn.example.com/face.jpg",
        facePhotoUrl: "https://cdn.example.com/face.jpg",
        bodyPhoto: "https://cdn.example.com/body.jpg",
        bodyPhotoUrl: "https://cdn.example.com/body.jpg",
      },
      intent: { imageGoal: "Autoridade", styleDirection: "Executiva", satisfaction: 9 },
      lifestyle: {},
      colors: {},
      body: {},
    };

    const actions = await withMockedModules({
      "server-only": {},
      "@/lib/supabase/admin": {
        createAdminClient: () => ({
          from() {
            return {
              select() {
                return {
                  eq() {
                    return { maybeSingle: async () => ({ data: null, error: null }) };
                  },
                };
              },
            };
          },
        }),
      },
      "@/lib/tenant/core": {
        fetchTenantBySlug: async () => null,
        isTenantActive: () => true,
        normalizeTenantSlug: (value) => (value || "").trim(),
        resolveAppTenantOrg: async () => ({ org: null, source: "none" }),
      },
      "@/lib/ai": {
        generateOpenAIRecommendation: async () => {
          throw new Error("should_not_run");
        },
      },
      "@/lib/ai/result-normalizer": {
        buildCatalogAwareFallbackResult: () => ({})
      },
      "@/lib/leads": {
        extractLeadSignalsFromSavedResultPayload: () => ({ intentScore: 0 }),
        persistSavedResultAndLead: async () => {
          throw new Error("should_not_run");
        },
      },
      "@/lib/lead-context": {
        buildLeadContextProfileFromOnboarding: () => ({}),
        upsertLeadContextByLeadId: async () => null,
      },
      "@/lib/decision-engine": {
        decideNextAction: () => ({ chosenAction: "WAIT", reason: "test", adaptiveConfidence: 0.5, weightAdjustments: {} }),
      },
      "@/lib/reliability/idempotency": {
        createProcessAndPersistLeadIdempotencyKey: () => "key",
        stripOnboardingBinaryArtifacts: (value) => value,
      },
      "@/lib/reliability/observability": {
        captureOperationalTiming: () => ({ duration_ms: 0, started_at: "", completed_at: "" }),
        formatOperationalReason: () => "reason",
        recordOperationalTenantEvent: async () => null,
      },
      "@/lib/reliability/processing": {
        completeProcessingReservation: async () => null,
        createProcessingOwnerToken: () => "owner",
        failProcessingReservation: async () => null,
        reserveProcessingReservation: async () => ({ acquired: false, should_wait: false, status: "busy", saved_result_id: null }),
        waitForProcessingReservation: async () => ({ acquired: false, should_wait: false, status: "busy", saved_result_id: null }),
      },
      "@/lib/analysis/visual-profile": {
        generateVisualProfileAnalysis: async () => ({}),
      },
      "@/lib/catalog": {
        getB2BProducts: async () => [],
      },
    }, async () => {
      return loadFresh("../src/lib/recommendation/actions.ts");
    });

    await assert.rejects(
      () => actions.processAndPersistLead(onboarding),
      (error) => error instanceof Error && error.message === "TENANT_RESOLUTION_FAILED"
    );

    const processingSource = fs.readFileSync(path.join(process.cwd(), "src/app/processing/page.tsx"), "utf8");
    assert.ok(processingSource.includes("isValidResultId(dbReferenceId)"));
    assert.ok(processingSource.includes("RESULT_PERSISTENCE_MISSING_ORG"));
    assert.ok(!processingSource.includes('router.push("/result?id=MOCK_DB_FAIL")'));
  });

  await runAsync("scenario 2b - processAndPersistLead resolves tenant by orgId when slug is absent", async () => {
    const onboarding = {
      contact: { name: "Cliente", phone: "+5511999999999", email: "cliente@exemplo.com" },
      tenant: { orgId: "org-123" },
      scanner: {
        facePhoto: "https://cdn.example.com/face.jpg",
        facePhotoUrl: "https://cdn.example.com/face.jpg",
        facePhotoPath: "onboarding-inputs/org-123/face.jpg",
        bodyPhoto: "https://cdn.example.com/body.jpg",
        bodyPhotoUrl: "https://cdn.example.com/body.jpg",
        bodyPhotoPath: "onboarding-inputs/org-123/body.jpg",
      },
      intent: { imageGoal: "Autoridade", styleDirection: "Executiva", satisfaction: 9 },
      lifestyle: {},
      colors: {},
      body: {},
    };

    const actions = await withMockedModules({
      "server-only": {} ,
      "@/lib/supabase/admin": {
        createAdminClient: () => ({
          from(table) {
            if (table === "saved_results") {
              return {
                select() {
                  return {
                    eq() {
                      return {
                        eq() {
                          return {
                            maybeSingle: async () => ({ data: { id: "result-1" }, error: null }),
                          };
                        },
                        maybeSingle: async () => ({ data: { id: "result-1" }, error: null }),
                      };
                    },
                  };
                },
              };
            }

            if (table === "tenant_events") {
              return { insert: async () => ({ error: null }) };
            }

            return {
              select() {
                return {
                  eq() {
                    return { maybeSingle: async () => ({ data: null, error: null }) };
                  },
                };
              },
            };
          },
        }),
      },
      "@/lib/tenant/core": {
        fetchTenantById: async (supabase, id) => ({
          org: { id, slug: "maison-elite", status: "active", kill_switch: false, plan_id: "starter" },
          error: null,
        }),
        fetchTenantBySlug: async () => ({ org: null, error: null }),
        isTenantActive: () => true,
        normalizeTenantSlug: (value) => (value || "").trim(),
        resolveAppTenantOrg: async () => ({ org: null, source: "none" }),
      },
      "@/lib/ai": {
        generateOpenAIRecommendation: async () => {
          throw new Error("should_not_run");
        },
      },
      "@/lib/ai/result-normalizer": {
        buildCatalogAwareFallbackResult: () => ({}),
      },
      "@/lib/leads": {
        extractLeadSignalsFromSavedResultPayload: () => ({ intentScore: 0 }),
        persistSavedResultAndLead: async () => ({ id: "result-1" }),
      },
      "@/lib/lead-context": {
        buildLeadContextProfileFromOnboarding: () => ({}),
        upsertLeadContextByLeadId: async () => null,
      },
      "@/lib/decision-engine": {
        decideNextAction: () => ({ chosenAction: "WAIT", reason: "test", adaptiveConfidence: 0.5, weightAdjustments: {} }),
      },
      "@/lib/reliability/idempotency": {
        createProcessAndPersistLeadIdempotencyKey: () => "key",
        stripOnboardingBinaryArtifacts: (value) => value,
      },
      "@/lib/reliability/observability": {
        captureOperationalTiming: () => ({ duration_ms: 0, started_at: "", completed_at: "" }),
        formatOperationalReason: () => "reason",
        recordOperationalTenantEvent: async () => null,
      },
      "@/lib/reliability/processing": {
        completeProcessingReservation: async () => null,
        createProcessingOwnerToken: () => "owner",
        failProcessingReservation: async () => null,
        reserveProcessingReservation: async () => ({ acquired: false, should_wait: false, status: "busy", saved_result_id: null }),
        waitForProcessingReservation: async () => ({ acquired: false, should_wait: false, status: "busy", saved_result_id: null }),
      },
      "@/lib/analysis/visual-profile": {
        generateVisualProfileAnalysis: async () => ({}),
      },
      "@/lib/catalog": {
        getB2BProducts: async () => [],
      },
    }, async () => {
      return loadFresh("../src/lib/recommendation/actions.ts");
    });

    await assert.doesNotReject(async () => {
      const resultId = await actions.processAndPersistLead(onboarding);
      assert.equal(resultId, "result-1");
    });
  });

  await runAsync("scenario 2c - processAndPersistLead blocks inline image payload before persistence", async () => {
    const onboarding = {
      contact: { name: "Cliente", phone: "+5511999999999", email: "cliente@exemplo.com" },
      tenant: { orgId: "org-123", orgSlug: "maison-elite" },
      scanner: { facePhoto: "data:image/png;base64,aaa", bodyPhoto: "data:image/png;base64,bbb" },
      intent: { imageGoal: "Autoridade", styleDirection: "Executiva", satisfaction: 9 },
      lifestyle: {},
      colors: {},
      body: {},
    };

    const actions = await withMockedModules({
      "server-only": {},
      "@/lib/supabase/admin": {
        createAdminClient: () => ({
          from() {
            return {
              select() {
                return {
                  eq() {
                    return { maybeSingle: async () => ({ data: null, error: null }) };
                  },
                };
              },
            };
          },
          storage: {
            from() {
              return {
                async upload() {
                  return { error: null };
                },
              };
            },
          },
        }),
      },
      "@/lib/tenant/core": {
        fetchTenantById: async () => ({ org: null, error: null }),
        fetchTenantBySlug: async () => ({ org: null, error: null }),
        isTenantActive: () => true,
        normalizeTenantSlug: (value) => (value || "").trim(),
        resolveAppTenantOrg: async () => ({ org: null, source: "none" }),
      },
      "@/lib/ai": {
        generateOpenAIRecommendation: async () => {
          throw new Error("should_not_run");
        },
      },
      "@/lib/ai/result-normalizer": {
        buildCatalogAwareFallbackResult: () => ({}),
      },
      "@/lib/leads": {
        extractLeadSignalsFromSavedResultPayload: () => ({ intentScore: 0 }),
        persistSavedResultAndLead: async () => ({ id: "result-1" }),
      },
      "@/lib/lead-context": {
        buildLeadContextProfileFromOnboarding: () => ({}),
        upsertLeadContextByLeadId: async () => null,
      },
      "@/lib/decision-engine": {
        decideNextAction: () => ({ chosenAction: "WAIT", reason: "test", adaptiveConfidence: 0.5, weightAdjustments: {} }),
      },
      "@/lib/reliability/idempotency": {
        createProcessAndPersistLeadIdempotencyKey: () => "key",
        stripOnboardingBinaryArtifacts: (value) => value,
      },
      "@/lib/reliability/observability": {
        captureOperationalTiming: () => ({ duration_ms: 0, started_at: "", completed_at: "" }),
        formatOperationalReason: () => "reason",
        recordOperationalTenantEvent: async () => null,
      },
      "@/lib/reliability/processing": {
        completeProcessingReservation: async () => null,
        createProcessingOwnerToken: () => "owner",
        failProcessingReservation: async () => null,
        reserveProcessingReservation: async () => ({ acquired: false, should_wait: false, status: "busy", saved_result_id: null }),
        waitForProcessingReservation: async () => ({ acquired: false, should_wait: false, status: "busy", saved_result_id: null }),
      },
      "@/lib/analysis/visual-profile": {
        generateVisualProfileAnalysis: async () => ({}),
      },
      "@/lib/catalog": {
        getB2BProducts: async () => [],
      },
    }, async () => loadFresh("../src/lib/recommendation/actions.ts"));

    await assert.rejects(
      () => actions.processAndPersistLead(onboarding),
      (error) => error instanceof Error && error.message === "PAYLOAD_TOO_LARGE_PREVENTED"
    );
  });

  await runAsync("scenario 3 - invalid result ids are rejected immediately", async () => {
    const resultIdModule = loadFresh("../src/lib/result/id.ts");

    const invalidIds = ["MOCK_DB_FAIL", "abc", "invalid-id", ""];
    for (const value of invalidIds) {
      assert.equal(resultIdModule.isValidResultId(value), false);
    }

    const resultSource = fs.readFileSync(path.join(process.cwd(), "src/app/result/page.tsx"), "utf8");
    assert.ok(resultSource.includes("router.replace(restartTarget)"));
    assert.ok(resultSource.includes("lead-context/recovery?result_id="));
    assert.ok(!resultSource.includes("&org_id="));
    assert.ok(!resultSource.includes("Finalizando sintonização"));
  });

  await runAsync("scenario 4 - recovery derives org_id server-side", async () => {
    let capturedIdentity = null;

    const supabase = {
      from(table) {
        if (table === "saved_results") {
          return {
            select() {
              return {
                eq(column, value) {
                  assert.equal(column, "id");
                  assert.equal(value, VALID_RESULT_ID);
                  return {
                    maybeSingle: async () => ({
                      data: { id: VALID_RESULT_ID, org_id: VALID_ORG_ID },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        }

        if (table === "leads") {
          return {
            select() {
              return {
                eq(column, value) {
                  if (column === "saved_result_id") {
                    assert.equal(value, VALID_RESULT_ID);
                    return {
                      maybeSingle: async () => ({
                        data: { id: "lead-1", org_id: VALID_ORG_ID, saved_result_id: VALID_RESULT_ID },
                        error: null,
                      }),
                    };
                  }

                  if (column === "org_id") {
                    return {
                      order() {
                        return {
                          limit() {
                            return {
                              maybeSingle: async () => ({
                                data: { id: "lead-1", payload: {} },
                                error: null,
                              }),
                            };
                          },
                        };
                      },
                    };
                  }

                  throw new Error(`Unexpected column ${column}`);
                },
              };
            },
          };
        }

        if (table === "lead_context") {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({
                      data: {
                        last_tryon: { generatedImageUrl: "https://example.com/tryon.jpg" },
                        style_profile: { label: "Executiva" },
                        profile_data: { orgId: VALID_ORG_ID },
                      },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    };

    const response = await withMockedModules({
      "@/lib/supabase/admin": {
        createAdminClient: () => supabase,
      },
      "@/lib/lead-context": {
        loadLeadContextByIdentity: async (_supabase, identity) => {
          capturedIdentity = identity;
          return {
            lead: { id: "lead-1", org_id: VALID_ORG_ID },
            context: {
              last_tryon: { generatedImageUrl: "https://example.com/tryon.jpg" },
              style_profile: { label: "Executiva" },
              profile_data: { orgId: VALID_ORG_ID },
            },
          };
        },
      },
    }, async () => {
      const route = loadFresh("../src/app/api/lead-context/recovery/route.ts");
      return route.GET(new Request(`https://example.com/api/lead-context/recovery?result_id=${VALID_RESULT_ID}&org_id=${FRONTEND_ORG_ID}`));
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.resolvedOrgId, VALID_ORG_ID);
    assert.equal(capturedIdentity.orgId, VALID_ORG_ID);
    assert.equal(capturedIdentity.savedResultId, VALID_RESULT_ID);
    assert.notEqual(capturedIdentity.orgId, FRONTEND_ORG_ID);
  });

  await runAsync("lead-context route records onboarding conversion events in tenant_events", async () => {
    const insertedEvents = [];

    const supabase = {
      from(table) {
        if (table === "tenant_events") {
          return {
            insert: async (row) => {
              insertedEvents.push(row);
              return { error: null };
            },
          };
        }

        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: null, error: null }),
        };
      },
    };

    const response = await withMockedModules({
      "@/lib/supabase/admin": {
        createAdminClient: () => supabase,
      },
      "@/lib/lead-context": {
        loadLeadContextByIdentity: async () => ({
          lead: { id: "lead-1", org_id: "org-1", intent_score: 3 },
          context: {
            updated_at: new Date().toISOString(),
            intent_score: 3,
          },
        }),
        updateLeadContextIntent: async () => ({ ok: true }),
        updateLeadContextProducts: async () => ({ ok: true }),
        updateLeadContextTryOn: async () => ({ ok: true }),
        upsertLeadContext: async () => ({ ok: true }),
        updateIntentScore: (eventType, currentScore) => currentScore + (eventType === "photo_sent" ? 2 : 0),
      },
      "@/lib/gamification/events": {
        processGamificationTriggerEvent: async () => ({ processed: false }),
      },
      "@/lib/decision-engine/learning": {
        recordDecisionOutcome: async () => ({ ok: true }),
      },
    }, async () => {
      const route = loadFresh("../src/app/api/lead-context/route.ts");
      return route.POST(
        new Request("https://example.com/api/lead-context", {
          method: "POST",
          body: JSON.stringify({
            orgId: "org-1",
            leadId: "lead-1",
            eventType: "photo_sent",
            timestamp: "2026-04-15T12:00:00.000Z",
            eventMeta: {
              surface: "onboarding_chat",
              cta: "send_photo",
            },
          }),
        })
      );
    });

    assert.equal(response.status, 200);
    assert.equal(insertedEvents.length, 1);
    assert.equal(insertedEvents[0].event_type, "photo_sent");
    assert.equal(insertedEvents[0].payload.event_meta.surface, "onboarding_chat");
    assert.equal(insertedEvents[0].payload.action, "UPLOAD_PHOTO");
    assert.equal(insertedEvents[0].payload.outcome, "PHOTO_SENT");
  });

  await runAsync("scenario 5 - regression scan keeps dangerous sentinel navigation out", async () => {
    const processingSource = fs.readFileSync(path.join(process.cwd(), "src/app/processing/page.tsx"), "utf8");
    const resultSource = fs.readFileSync(path.join(process.cwd(), "src/app/result/page.tsx"), "utf8");
    const recoverySource = fs.readFileSync(path.join(process.cwd(), "src/app/api/lead-context/recovery/route.ts"), "utf8");

    assert.ok(!processingSource.includes('router.push("/result?id=MOCK_DB_FAIL")'));
    assert.ok(!processingSource.includes("router.push(`/result?id=MOCK_DB_FAIL`)"));
    assert.ok(!resultSource.includes("org_id=${encodeURIComponent(orgId || \"\")}"));
    assert.ok(!resultSource.includes("Finalizando sintonização"));
    assert.ok(recoverySource.includes("resolvedOrgId"));
    assert.ok(!recoverySource.includes("org_id=${encodeURIComponent(orgId || \"\")}"));
  });

  await runAsync("whatsapp stylist commerce plan stays store scoped and composes bundles", async () => {
    const plan = await buildWhatsAppStylistCommercePlan({
      orgId: "org-123",
      contactName: "Ana",
      styleIdentity: "Autoridade limpa",
      imageGoal: "Autoridade",
      paletteFamily: "Neutros Refinados",
      fit: "Slim",
      metal: "Prateado",
      intentScore: 82,
      resultState: "hero",
      catalog: [
        {
          id: "prod-anchor",
          org_id: "org-123",
          name: "Blazer estruturado",
          category: "Blazer",
          primary_color: "Marinho",
          style: "Alfaiataria",
          type: "top",
          price_range: "R$ 480-620",
          image_url: "https://example.com/blazer.jpg",
          external_url: null,
          created_at: new Date().toISOString(),
          style_direction: "Feminina",
          style_tags: ["Autoridade"],
          category_tags: ["Base forte"],
          fit_tags: ["Estrutura"],
          color_tags: ["Marinho"],
          target_profile: ["Executiva"],
          use_cases: ["Trabalho"],
          occasion_tags: ["Trabalho"],
          season_tags: ["Ano todo"],
          body_effect: "Estrutura e organiza a silhueta",
          face_effect: "Mantém a leitura limpa",
          visual_weight: "Alta",
          formality: "Alta",
          catalog_notes: "Estrutura para autoridade",
        },
        {
          id: "prod-support",
          org_id: "org-123",
          name: "Blusa de seda",
          category: "Blusa",
          primary_color: "Off white",
          style: "Elegante",
          type: "top",
          price_range: "R$ 220-280",
          image_url: "https://example.com/blusa.jpg",
          external_url: null,
          created_at: new Date().toISOString(),
          style_direction: "Feminina",
          style_tags: ["Minimalismo"],
          category_tags: ["Base"],
          fit_tags: ["Conforto"],
          color_tags: ["Off white"],
          target_profile: ["Executiva"],
          use_cases: ["Trabalho"],
          occasion_tags: ["Trabalho"],
          season_tags: ["Ano todo"],
          body_effect: "Sustenta a leitura com conforto",
          face_effect: "Mantém a leitura limpa",
          visual_weight: "Media",
          formality: "Media alta",
          catalog_notes: "Acabamento refinado",
        },
      ],
    });

    assert.equal(plan.available, true);
    assert.equal(plan.orgId, "org-123");
    assert.equal(plan.completeLooks[0].items.length >= 1, true);
    assert.ok(plan.openingLine.includes("Ana"));
    assert.ok(plan.summaryLine.includes("Look montado"));
    assert.ok(plan.upsellLine.length > 0);
    assert.ok(plan.crossSellLine.length > 0);
    assert.ok(plan.alternativeLine.length > 0);

    const message = buildWhatsAppHandoffMessage({
      contactName: "Ana",
      resultState: "hero",
      styleIdentity: "Autoridade limpa",
      imageGoal: "Autoridade",
      lookSummary: [
        {
          id: "look-1",
          name: "Look assinatura",
          intention: "Autoridade",
          type: "Hero",
          explanation: "Peça que sustenta presença.",
          whenToWear: "Trabalho",
          items: [],
        },
      ],
      audit: null,
      commerce: plan,
    });

    assert.ok(message.includes("Blazer estruturado"));
    assert.ok(message.includes("levar isso para as peças certas") || message.includes("conjunto"));
  });

  await runAsync("whatsapp stylist commerce plan fails safely without org scope", async () => {
    const plan = await buildWhatsAppStylistCommercePlan({ orgId: "" });
    assert.equal(plan.available, false);
    assert.equal(plan.fallbackReason, "missing_org_id");
    assert.equal(plan.completeLooks.length, 0);
  });

  await runAsync("stripe helpers resolve prices, statuses and subscription blocking", async () => {
    await withTempEnv(
      {
        STRIPE_SECRET_KEY: "sk_test_venus",
        STRIPE_PRICE_ID_STARTER: "price_starter",
        STRIPE_PRICE_ID_GROWTH: "price_growth",
      },
      async () => {
        const stripeBilling = loadFresh("../src/lib/billing/stripe.ts");

        assert.equal(stripeBilling.normalizeStripeBillingStatus("active"), "active");
        assert.equal(stripeBilling.normalizeStripeBillingStatus("past_due"), "past_due");
        assert.equal(stripeBilling.isStripeBillingStatusBlocking("past_due"), true);
        assert.equal(stripeBilling.isStripeBillingStatusBlocking("active"), false);
        assert.equal(stripeBilling.resolveStripePriceId("starter"), "price_starter");
        assert.equal(stripeBilling.resolvePlanIdFromStripePriceId("price_growth"), "growth");

        const checkoutParams = stripeBilling.buildStripeCheckoutSessionParams({
          orgId: "org-1",
          orgSlug: "maison-elite",
          planId: "starter",
          customerEmail: "cliente@exemplo.com",
          successUrl: "https://venus.example/success",
          cancelUrl: "https://venus.example/cancel",
        });

        assert.equal(checkoutParams.mode, "subscription");
        assert.equal(checkoutParams.client_reference_id, "org-1");
        assert.equal(checkoutParams.line_items?.[0]?.price, "price_starter");
        assert.equal(checkoutParams.metadata?.org_id, "org-1");
        assert.equal(checkoutParams.subscription_data?.metadata?.plan_id, "starter");
        assert.equal(checkoutParams.customer_email, "cliente@exemplo.com");
      }
    );
  });

  await runAsync("billing enforcement falls back safely and blocks Stripe past_due", async () => {
    const billingSummary = {
      plan_id: "starter",
      plan_soft_caps: {
        saved_results: 40,
        leads: 20,
        products: 100,
        whatsapp_messages: 250,
        estimated_cost_today_cents: 300,
        estimated_cost_total_cents: 9_000,
      },
      total_saved_results: 0,
      total_leads: 0,
      total_products: 0,
      total_whatsapp_messages: 0,
      estimated_cost_today_cents: 0,
      estimated_cost_total_cents: 0,
      billing_status: null,
    };

    const fallbackModule = await withMockedModules(
      {
        "@/lib/billing": {
          getOrgBillingSummary: async () => null,
        },
        "@/lib/supabase/admin": {
          createAdminClient: () => ({
            from: () => ({
              insert: async () => ({ error: null }),
            }),
          }),
        },
        "@/lib/reliability/observability": {
          createOperationalEventDedupeKey: () => "dedupe",
          formatOperationalReason: () => "reason",
          recordOperationalTenantEvent: async () => null,
        },
      },
      async () => loadFresh("../src/lib/billing/enforcement.ts")
    );

    const fallbackDecision = await fallbackModule.enforceOrgHardCap({
      orgId: "org-1",
      operation: "saved_result_generation",
    });
    assert.equal(fallbackDecision.allowed, true);

    const blockedModule = await withMockedModules(
      {
        "@/lib/billing": {
          getOrgBillingSummary: async () => ({
            ...billingSummary,
            billing_status: "past_due",
          }),
        },
        "@/lib/supabase/admin": {
          createAdminClient: () => ({
            from: () => ({
              insert: async () => ({ error: null }),
            }),
          }),
        },
        "@/lib/reliability/observability": {
          createOperationalEventDedupeKey: () => "dedupe",
          formatOperationalReason: () => "reason",
          recordOperationalTenantEvent: async () => null,
        },
      },
      async () => loadFresh("../src/lib/billing/enforcement.ts")
    );

    const blockedDecision = await blockedModule.enforceOrgHardCap({
      orgId: "org-1",
      operation: "saved_result_generation",
    });
    assert.equal(blockedDecision.allowed, false);
    assert.equal(blockedDecision.metric, "billing_status");
  });

  run("tenant scope guard rejects empty org_id", () => {
    const scopedGuards = loadFresh("../src/lib/catalog/scoped-guards.ts");
    const assertScope = loadFresh("../src/lib/tenant/assert-scope.ts");

    assert.equal(scopedGuards.hasValidTenantScope(null, "catalog_read"), false);
    assert.equal(scopedGuards.hasValidTenantScope("", "catalog_read"), false);
    assert.equal(scopedGuards.hasValidTenantScope("org-123", "recommendation"), true);

    const emptyResult = assertScope.validateTenantContext(null, true);
    assert.equal(emptyResult.allowed, false);
    assert.ok(emptyResult.reason.includes("ausente"));

    const validResult = assertScope.validateTenantContext("org-123", true);
    assert.equal(validResult.allowed, true);
  });

  run("catalog scoped guards filter products by org_id", () => {
    const scopedGuards = loadFresh("../src/lib/catalog/scoped-guards.ts");

    const products = [
      { id: "p1", org_id: "org-a", name: "Produto A", category: "Blazer", primary_color: "Preto", style: "Alfaiataria", type: "roupa", price_range: "R$ 500", image_url: null, external_url: null, created_at: "2026-04-01" },
      { id: "p2", org_id: "org-a", name: "Produto B", category: "Camisa", primary_color: "Branco", style: "Clássico", type: "roupa", price_range: "R$ 200", image_url: null, external_url: null, created_at: "2026-04-01" },
      { id: "p3", org_id: "org-b", name: "Produto C", category: "Blazer", primary_color: "Preto", style: "Alfaiataria", type: "roupa", price_range: "R$ 500", image_url: null, external_url: null, created_at: "2026-04-01" },
    ];

    const sameOrgResult = scopedGuards.filterProductsByScope(products, "org-a");
    assert.equal(sameOrgResult.valid, true);
    assert.equal(sameOrgResult.scopedProducts.length, 2);
    assert.equal(sameOrgResult.rejectedCount, 1);

    const crossStoreResult = scopedGuards.filterProductsByScope(products, "org-b");
    assert.equal(crossStoreResult.valid, true);
    assert.equal(crossStoreResult.scopedProducts.length, 1);
    assert.equal(crossStoreResult.rejectedCount, 2);
  });

  run("catalog scope fails safely without org_id", () => {
    const scopedGuards = loadFresh("../src/lib/catalog/scoped-guards.ts");

    const products = [
      { id: "p1", org_id: "org-a", name: "Produto A", category: "Blazer", primary_color: "Preto", style: "Alfaiataria", type: "roupa", price_range: "", image_url: null, external_url: null, created_at: "2026-04-01" },
    ];

    const noOrgResult = scopedGuards.filterProductsByScope(products, "");
    assert.equal(noOrgResult.valid, false);
    assert.ok(noOrgResult.reason.includes("ausente"));
    assert.equal(noOrgResult.scopedProducts.length, 0);
  });

  run("collection targeting generates segments per profile", () => {
    const targeting = loadFresh("../src/lib/campaigns/collection-targeting.ts");

    const products = [
      { id: "prod-1", org_id: "org-1", name: "Blazer Exec", category: "Blazer", primary_color: "Preto", style: "Alfaiataria", type: "roupa", price_range: "", image_url: null, external_url: null, created_at: "2026-04-01", target_profile: ["executiva"] },
      { id: "prod-2", org_id: "org-1", name: "Camisa Minimal", category: "Camisa", primary_color: "Branco", style: "Minimalista", type: "roupa", price_range: "", image_url: null, external_url: null, created_at: "2026-04-01", target_profile: ["minimalista"] },
      { id: "prod-3", org_id: "org-1", name: "Blazer Classic", category: "Blazer", primary_color: "Preto", style: "Clássico", type: "roupa", price_range: "", image_url: null, external_url: null, created_at: "2026-04-01", target_profile: ["clássica"] },
      { id: "prod-4", org_id: "org-1", name: "Acessorio", category: "Acessório", primary_color: "Preto", style: "Neutro", type: "acessorio", price_range: "", image_url: null, external_url: null, created_at: "2026-04-01", target_profile: [] },
    ];

    const result = targeting.generateCollectionTargeting({
      orgId: "org-1",
      collection: products,
      profileSignals: { imageGoal: "Autoridade" },
    });

    assert.equal(result.orgId, "org-1");
    assert.ok(result.collectionId.startsWith("col-org-1-"));
    assert.ok(result.segments.length >= 2);
    assert.ok(result.criteriaApplied.some((c) => c.includes("org_id validado")));
  });

  run("collection targeting fails without org_id", () => {
    const targeting = loadFresh("../src/lib/campaigns/collection-targeting.ts");

    const result = targeting.generateCollectionTargeting({
      orgId: "",
      collection: [],
    });

    assert.equal(result.orgId, "");
    assert.equal(result.segments.length, 0);
    assert.ok(result.criteriaApplied.includes("org_id ausente"));
  });

  run("collection targeting uses only same org products", () => {
    const targeting = loadFresh("../src/lib/campaigns/collection-targeting.ts");

    const products = [
      { id: "prod-1", org_id: "org-1", name: "Produto", category: "Blazer", primary_color: "Preto", style: "Alfaiataria", type: "roupa", price_range: "", image_url: null, external_url: null, created_at: "2026-04-01", target_profile: ["executiva"] },
      { id: "prod-2", org_id: "org-2", name: "Produto Outro", category: "Blazer", primary_color: "Preto", style: "Alfaiataria", type: "roupa", price_range: "", image_url: null, external_url: null, created_at: "2026-04-01", target_profile: ["executiva"] },
    ];

    const result = targeting.generateCollectionTargeting({
      orgId: "org-1",
      collection: products,
    });

    const allProductIds = result.segments.flatMap((s) => s.productIds);
    assert.ok(allProductIds.includes("prod-1"));
    assert.ok(!allProductIds.includes("prod-2"));
  });

  run("policy-engine exports required functions", () => {
    assert.equal(typeof getPolicyRules, "function");
    assert.equal(typeof matchRule, "function");
    assert.equal(typeof evaluateCondition, "function");
    assert.equal(typeof applyAdjustmentAction, "function");
  });

  run("getPolicyRules returns non-empty array", () => {
    const rules = getPolicyRules();
    assert.equal(Array.isArray(rules), true);
    assert.equal(rules.length > 0, true);
  });

  run("policy rules have required fields", () => {
    const rules = getPolicyRules();
    for (const rule of rules) {
      assert.equal(typeof rule.id, "string");
      assert.equal(typeof rule.name, "string");
      assert.equal(Array.isArray(rule.conditions), true);
      assert.equal(typeof rule.action, "string");
      assert.equal(typeof rule.factor, "number");
      assert.equal(typeof rule.priority, "number");
      assert.equal(typeof rule.description, "string");
    }
  });

  run("policy rules are sorted by priority descending", () => {
    const rules = getPolicyRules();
    for (let i = 1; i < rules.length; i++) {
      assert.equal(rules[i - 1].priority >= rules[i].priority, true);
    }
  });

  run("evaluateCondition margin_percent lt 0", () => {
    const metrics = {
      org_id: "test",
      margin_percent: -5,
      margin_cents: -500,
      roi: 1,
      usage_pct: { ai_tokens: 50, try_on: 50, whatsapp_message: 50 },
      usage: { ai_tokens: 100, try_on: 10, whatsapp_message: 100 },
      limits: { ai_tokens: 200, try_on: 20, whatsapp_message: 200 },
      risk: "normal",
      billing_status: null,
      is_billing_blocked: false,
      has_manual_override: false,
    };

    const result = evaluateCondition("margin_percent", "lt", 0, metrics);
    assert.equal(result, true);
  });

  run("evaluateCondition margin_percent gte 30", () => {
    const metrics = {
      org_id: "test",
      margin_percent: 35,
      margin_cents: 3500,
      roi: 4,
      usage_pct: { ai_tokens: 50, try_on: 50, whatsapp_message: 50 },
      usage: { ai_tokens: 100, try_on: 10, whatsapp_message: 100 },
      limits: { ai_tokens: 200, try_on: 20, whatsapp_message: 200 },
      risk: "normal",
      billing_status: null,
      is_billing_blocked: false,
      has_manual_override: false,
    };

    const result = evaluateCondition("margin_percent", "gte", 30, metrics);
    assert.equal(result, true);
  });

  run("evaluateCondition roi gte 3", () => {
    const metrics = {
      org_id: "test",
      margin_percent: 20,
      margin_cents: 2000,
      roi: 5,
      usage_pct: { ai_tokens: 50, try_on: 50, whatsapp_message: 50 },
      usage: { ai_tokens: 100, try_on: 10, whatsapp_message: 100 },
      limits: { ai_tokens: 200, try_on: 20, whatsapp_message: 200 },
      risk: "normal",
      billing_status: null,
      is_billing_blocked: false,
      has_manual_override: false,
    };

    const result = evaluateCondition("roi", "gte", 3, metrics);
    assert.equal(result, true);
  });

  run("evaluateCondition usage_pct gte 80", () => {
    const metrics = {
      org_id: "test",
      margin_percent: 10,
      margin_cents: 1000,
      roi: 2,
      usage_pct: { ai_tokens: 85, try_on: 90, whatsapp_message: 70 },
      usage: { ai_tokens: 170, try_on: 18, whatsapp_message: 140 },
      limits: { ai_tokens: 200, try_on: 20, whatsapp_message: 200 },
      risk: "normal",
      billing_status: null,
      is_billing_blocked: false,
      has_manual_override: false,
    };

    const result = evaluateCondition("usage_pct", "gte", 80, metrics);
    assert.equal(result, true);
  });

  run("evaluateCondition risk eq critical", () => {
    const metrics = {
      org_id: "test",
      margin_percent: -20,
      margin_cents: -2000,
      roi: 0.5,
      usage_pct: { ai_tokens: 50, try_on: 50, whatsapp_message: 50 },
      usage: { ai_tokens: 100, try_on: 10, whatsapp_message: 100 },
      limits: { ai_tokens: 200, try_on: 20, whatsapp_message: 200 },
      risk: "critical",
      billing_status: null,
      is_billing_blocked: true,
      has_manual_override: false,
    };

    const result = evaluateCondition("risk", "eq", 2, metrics);
    assert.equal(result, true);
  });

  run("matchRule returns true when conditions match", () => {
    const rule = {
      id: "test",
      name: "Test",
      conditions: [{ metric: "margin_percent", operator: "lt", value: 0 }],
      action: "reduce_limits",
      factor: 0.7,
      priority: 100,
      description: "Test rule",
    };

    const metrics = {
      org_id: "test",
      margin_percent: -5,
      margin_cents: -500,
      roi: 1,
      usage_pct: { ai_tokens: 50, try_on: 50, whatsapp_message: 50 },
      usage: { ai_tokens: 100, try_on: 10, whatsapp_message: 100 },
      limits: { ai_tokens: 200, try_on: 20, whatsapp_message: 200 },
      risk: "normal",
      billing_status: null,
      is_billing_blocked: false,
      has_manual_override: false,
    };

    const result = matchRule(rule, metrics);
    assert.equal(result, true);
  });

  run("matchRule returns false when conditions don't match", () => {
    const rule = {
      id: "test",
      name: "Test",
      conditions: [{ metric: "margin_percent", operator: "lt", value: 0 }],
      action: "reduce_limits",
      factor: 0.7,
      priority: 100,
      description: "Test rule",
    };

    const metrics = {
      org_id: "test",
      margin_percent: 20,
      margin_cents: 2000,
      roi: 3,
      usage_pct: { ai_tokens: 50, try_on: 50, whatsapp_message: 50 },
      usage: { ai_tokens: 100, try_on: 10, whatsapp_message: 100 },
      limits: { ai_tokens: 200, try_on: 20, whatsapp_message: 200 },
      risk: "normal",
      billing_status: null,
      is_billing_blocked: false,
      has_manual_override: false,
    };

    const result = matchRule(rule, metrics);
    assert.equal(result, false);
  });

  run("matchRule requires all conditions to match", () => {
    const rule = {
      id: "test",
      name: "Test",
      conditions: [
        { metric: "margin_percent", operator: "gte", value: 10 },
        { metric: "roi", operator: "gte", value: 3 },
      ],
      action: "increase_limits",
      factor: 1.2,
      priority: 50,
      description: "Test rule",
    };

    const metrics = {
      org_id: "test",
      margin_percent: 15,
      margin_cents: 1500,
      roi: 2,
      usage_pct: { ai_tokens: 50, try_on: 50, whatsapp_message: 50 },
      usage: { ai_tokens: 100, try_on: 10, whatsapp_message: 100 },
      limits: { ai_tokens: 200, try_on: 20, whatsapp_message: 200 },
      risk: "normal",
      billing_status: null,
      is_billing_blocked: false,
      has_manual_override: false,
    };

    const result = matchRule(rule, metrics);
    assert.equal(result, false);
  });

  run("applyAdjustmentAction increase_limits", () => {
    const result = applyAdjustmentAction(100, "increase_limits", 1.2, 1000, 10);
    assert.equal(result, 120);
  });

  run("applyAdjustmentAction reduce_limits", () => {
    const result = applyAdjustmentAction(100, "reduce_limits", 0.7, 1000, 10);
    assert.equal(result, 70);
  });

  run("applyAdjustmentAction throttle", () => {
    const result = applyAdjustmentAction(100, "throttle", 0.5, 1000, 10);
    assert.equal(result, 50);
  });

  run("applyAdjustmentAction emergency_reduce", () => {
    const result = applyAdjustmentAction(100, "emergency_reduce", 0.5, 1000, 10);
    assert.equal(result, 50);
  });

  run("applyAdjustmentAction maintain", () => {
    const result = applyAdjustmentAction(100, "maintain", 1.0, 1000, 10);
    assert.equal(result, 100);
  });

  run("applyAdjustmentAction respects max limit", () => {
    const result = applyAdjustmentAction(500, "increase_limits", 2, 800, 10);
    assert.equal(result, 800);
  });

  run("applyAdjustmentAction respects min limit", () => {
    const result = applyAdjustmentAction(10, "reduce_limits", 0.5, 1000, 20);
    assert.equal(result, 20);
  });

  run("conditionsToLabels formats correctly", () => {
    const conditions = [
      { metric: "margin_percent", operator: "lt", value: 0 },
      { metric: "roi", operator: "gte", value: 3 },
    ];

    const labels = conditionsToLabels(conditions);
    assert.equal(labels[0], "margin_percent < 0");
    assert.equal(labels[1], "roi >= 3");
  });

  run("auto-limits exports required functions", () => {
    assert.equal(typeof runAutoLimitsJob, "function");
    assert.equal(typeof getOptimizationRecommendations, "function");
  });

  run("audit exports required functions", () => {
    assert.equal(typeof recordOptimizationAudit, "function");
    assert.equal(typeof queryOptimizationAudit, "function");
    assert.equal(typeof getOptimizationStats, "function");
    assert.equal(typeof getOrgOptimizationHistory, "function");
  });

  run("flow events log with correlation", () => {
    const events = loadFresh("../src/lib/reliability/events.ts");

    const correlation = events.createFlowCorrelation({
      orgId: "org-test",
      leadId: "lead-1",
      sessionId: "session-1",
    });

    assert.equal(correlation.orgId, "org-test");
    assert.equal(correlation.leadId, "lead-1");
    assert.equal(events.isCorrelationComplete(correlation), true);
  });

  process.stdout.write("all reliability checks passed\n");
})().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
