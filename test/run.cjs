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
  ensureTryOnProductId,
  isValidTryOnProductId,
} = require("../src/lib/tryon/product-id.ts");
const {
  buildCatalogEnrichmentSignals,
  deriveVisualSignalsFromMetrics,
} = require("../src/lib/ai/catalog-enricher.ts");
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
  isProcessingReservationClaimable,
  shouldWaitOnProcessingReservation,
} = require("../src/lib/reliability/processing.ts");

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

  assert.equal(sanitized.scanner.facePhoto, "[BASE64_IMAGE_STRIPPED_FOR_STORAGE]");
  assert.equal(sanitized.scanner.bodyPhoto, "[BASE64_IMAGE_STRIPPED_FOR_STORAGE]");
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

    const processingSource = fs.readFileSync(path.join(process.cwd(), "src/app/processing/page.tsx"), "utf8");
    assert.ok(processingSource.includes("isValidResultId(dbReferenceId)"));
    assert.ok(!processingSource.includes('router.push("/result?id=MOCK_DB_FAIL")'));
  });

  await runAsync("scenario 2 - tenant resolution failure throws before navigation", async () => {
    const onboarding = {
      contact: { name: "Cliente", phone: "+5511999999999", email: "cliente@exemplo.com" },
      tenant: {},
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

  process.stdout.write("all reliability checks passed\n");
})().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
