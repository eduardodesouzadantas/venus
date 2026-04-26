import assert from "node:assert/strict";

import {
  buildVenusWhatsAppConsultivePayload,
  sanitizeVenusWhatsAppConsultivePayloadForLogs,
  type VenusWhatsAppConsultiveLogPayload,
  VENUS_WHATSAPP_CONSULTIVE_PAYLOAD_VERSION,
} from "../../src/lib/whatsapp/consultive-payload.ts";
import { buildWhatsAppHandoffMessage } from "../../src/lib/whatsapp/handoff.ts";
import type { WhatsAppLookSummary } from "../../src/types/whatsapp.ts";
import {
  buildCurationByPieceRole,
  normalizeConsultivePieceRole,
} from "../../src/lib/result/curation-roles.ts";

function run(name: string, fn: () => void) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

const orgId = "08105310-a61d-40fd-82b9-b9142643867c";
const sensitiveValues = [
  "+55 11 99999-1234",
  "99999-1234",
  "maria silva",
  "maria@example.com",
  "data:image/jpeg;base64",
  "cdn.example.com",
  "signed.example.com",
  "token-value",
  "secret-value",
  "raw-model-output",
  "external-payload-value",
];

function assertNoSensitiveValues(value: unknown) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const sensitiveValue of sensitiveValues) {
    assert.doesNotMatch(serialized, new RegExp(sensitiveValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
}

const commercePlan = {
  available: true,
  orgId,
  openingLine: "Eu manteria a leitura e fecharia com pecas reais da loja.",
  summaryLine: "Look montado com 3 pecas do catalogo ligado a esta sessao.",
  completeLooks: [
    {
      title: "Autoridade Silenciosa",
      reason: "Base neutra com terceira peca estruturada.",
      stylePositioning: "Presenca limpa e segura.",
      items: [
        {
          productId: "sku-hero",
          name: "Blazer preto",
          role: "anchor",
          reason: "Estrutura a presenca.",
          score: 92,
          imageUrl: "https://cdn.example.com/private.jpg?token=abc",
        },
        {
          productId: "sku-base",
          name: "Calca reta",
          role: "base",
          reason: "Sustenta a linha vertical.",
          score: 88,
        },
        {
          productId: "sku-accessory",
          name: "Bolsa media",
          role: "accessory",
          reason: "Fecha a leitura com acabamento.",
          score: 81,
        },
      ],
    },
  ],
  upsellLine: "A proxima peca certa e o blazer.",
  crossSellLine: "Para complementar, eu adicionaria a bolsa.",
  alternativeLine: "Se precisar reduzir o valor, troco por uma base mais simples.",
  targetSignals: ["autoridade", "preto"],
};

run("buildVenusWhatsAppConsultivePayload creates valid v1 payload", () => {
  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    orgSlug: "maison-elite",
    isInternalShowroom: true,
    commerce: commercePlan,
    resultState: "hero",
    payload: {
      styleIdentity: "Autoridade Silenciosa",
      paletteFamily: "Preto e off white",
      contrast: "medio_alto",
      contactPhone: "+55 11 99999-9999",
      facePhoto: "data:image/jpeg;base64,AAAA",
      signedUrl: "https://signed.example.com/photo?token=secret",
    },
    source: "test",
    generatedAt: "2026-04-26T12:00:00.000Z",
  });

  assert.equal(payload.version, VENUS_WHATSAPP_CONSULTIVE_PAYLOAD_VERSION);
  assert.equal(payload.tenant.orgId, orgId);
  assert.equal(payload.tenant.slug, "maison-elite");
  assert.equal(payload.tenant.isInternalShowroom, true);
  assert.equal(payload.curation.status, "ready");
  assert.equal(payload.curation.looks[0].pieces.length, 3);
  assert.equal(payload.tryOn?.state, "hero");
  assert.equal(payload.tryOn?.shouldShow, true);
  assert.equal(payload.diagnostics.source, "test");
});

run("consultive payload does not include raw photo/base64/imageUrl/signedUrl/token/secret", () => {
  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    payload: {
      styleIdentity: "Elegancia Direta",
      facePhoto: "data:image/jpeg;base64,AAAA",
      bodyPhoto: "data:image/jpeg;base64,BBBB",
      signedUrl: "https://signed.example.com/photo?token=secret",
      rawAiResponse: { text: "raw" },
    },
    commerce: commercePlan,
  });
  const serialized = JSON.stringify(payload).toLowerCase();

  assert.doesNotMatch(serialized, /base64|signedurl|signed_url|token=|rawairesponse|private\.jpg/);
});

run("consultive payload works when try-on is not available", () => {
  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    payload: {
      styleIdentity: "Classico Luminoso",
    },
    commerce: commercePlan,
  });

  assert.equal(payload.tryOn?.state, "not_requested");
  assert.equal(payload.tryOn?.shouldShow, false);
  assert.equal(payload.curation.status, "ready");
});

run("consultive payload works when catalog is insufficient", () => {
  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    payload: {
      styleIdentity: "Presenca Natural",
      missingSlots: ["layer", "shoes"],
    },
    commerce: {
      ...commercePlan,
      available: false,
      completeLooks: [],
      fallbackReason: "empty_catalog",
    },
  });

  assert.equal(payload.curation.status, "insufficient_catalog");
  assert.deepEqual(payload.curation.missingSlots, ["layer", "shoes"]);
  assert.ok(payload.handoff.nextBestActions.includes("chamar_humano"));
});

run("consultive payload preserves tenant org_id", () => {
  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    orgSlug: "internal-showroom",
    payload: {},
    commerce: commercePlan,
  });

  assert.equal(payload.tenant.orgId, orgId);
  assert.equal(payload.tenant.slug, "internal-showroom");
});

run("consultive payload maps product stylist roles to consultive roles", () => {
  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    payload: {},
    commerce: commercePlan,
  });

  const roles = payload.curation.looks[0].pieces.map((piece) => piece.role);
  assert.deepEqual(roles, ["hero", "base", "acabamento"]);
});

run("sanitized consultive log payload masks and removes sensitive fields", () => {
  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    payload: { styleIdentity: "Autoridade", contactPhone: "+55 11 99999-1234" },
    commerce: commercePlan,
  });
  const sanitized = sanitizeVenusWhatsAppConsultivePayloadForLogs({
    ...payload,
    contactPhone: "+55 11 99999-1234",
    customerName: "Maria Silva",
    customerEmail: "maria@example.com",
    imageUrl: "https://cdn.example.com/image.jpg",
    signedUrl: "https://signed.example.com/image.jpg",
    token: "token-value",
    secret: "secret-value",
    rawAiResponse: { text: "raw-model-output" },
    externalPayload: "external-payload-value",
  });
  const logPayload: VenusWhatsAppConsultiveLogPayload = sanitized;

  assert.equal(logPayload.version, VENUS_WHATSAPP_CONSULTIVE_PAYLOAD_VERSION);
  assertNoSensitiveValues(logPayload);
  assert.equal(logPayload.curation.pieceCount, 3);
});

run("operational consultive event payload contains only sanitized summary", () => {
  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    orgSlug: "maison-elite",
    isInternalShowroom: true,
    payload: {
      styleIdentity: "Autoridade Silenciosa",
      contactName: "Maria Silva",
      contactPhone: "+55 11 99999-1234",
      userEmail: "maria@example.com",
      facePhoto: "data:image/jpeg;base64,AAAA",
      signedUrl: "https://signed.example.com/photo?token=token-value",
      rawResponse: "raw-model-output",
      externalPayload: "external-payload-value",
    },
    commerce: commercePlan,
    source: "api_whatsapp_handoff",
  });
  const eventPayload = sanitizeVenusWhatsAppConsultivePayloadForLogs(payload);
  const operationalEvent = {
    orgId,
    eventType: "whatsapp.consultive_handoff_prepared",
    eventSource: "whatsapp",
    dedupeKeyParts: [orgId, "saved-result-id", payload.version],
    payload: eventPayload,
  };

  assert.equal(operationalEvent.payload.version, VENUS_WHATSAPP_CONSULTIVE_PAYLOAD_VERSION);
  assert.equal(operationalEvent.payload.curation.lookCount, 1);
  assert.equal(operationalEvent.payload.curation.pieceCount, 3);
  assertNoSensitiveValues(operationalEvent.payload);
});

run("legacy WhatsApp handoff behavior remains compatible", () => {
  const message = buildWhatsAppHandoffMessage({
    contactName: "Ana",
    resultState: "preview",
    styleIdentity: "Autoridade Silenciosa",
    imageGoal: "trabalho",
    lookSummary: [{ name: "Look principal", explanation: "estrutura a presenca" }],
  });
  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    payload: {
      contactName: "Ana",
      styleIdentity: "Autoridade Silenciosa",
      imageGoal: "trabalho",
      lookSummary: [{ name: "Look principal", explanation: "estrutura a presenca" }],
    },
    lookSummary: [{ name: "Look principal", explanation: "estrutura a presenca" }],
  });

  assert.match(message, /Ana|Look principal|Autoridade/i);
  assert.equal(payload.version, VENUS_WHATSAPP_CONSULTIVE_PAYLOAD_VERSION);
  assert.equal(payload.tryOn?.state, "not_requested");
});

// ── PR 5.2 regression: WhatsAppLookSummary type compatibility ─────────────────

run("PR5.2 — buildVenusWhatsAppConsultivePayload accepts WhatsAppLookSummary with typed items", () => {
  const lookSummaryWithItems: WhatsAppLookSummary[] = [
    {
      id: "look-typed-1",
      name: "Autoridade Estruturada",
      intention: "transmitir presenca profissional",
      type: "editorial",
      explanation: "Composicao limpa com terceira peca estruturada.",
      whenToWear: "trabalho e encontros casuais elegantes",
      items: [
        {
          id: "sku-hero-item",
          name: "Blazer navy",
          role: "hero",
          impactLine: "Estrutura a presenca com autoridade.",
          conversionCopy: "Entra como peca central.",
        },
        {
          id: "sku-base-item",
          name: "Calca reta",
          role: "base",
          impactLine: "Sustenta a linha vertical do look.",
        },
      ],
    },
  ];

  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    payload: { styleIdentity: "Autoridade Estruturada" },
    lookSummary: lookSummaryWithItems,
  });

  assert.equal(payload.version, VENUS_WHATSAPP_CONSULTIVE_PAYLOAD_VERSION);
  assert.equal(payload.curation.looks.length, 1);
  assert.equal(payload.curation.looks[0].title, "Autoridade Estruturada");
  assert.equal(payload.curation.looks[0].pieces.length, 2);
  assert.equal(payload.curation.looks[0].pieces[0].productId, "sku-hero-item");
  assert.equal(payload.curation.looks[0].pieces[0].role, "hero");
  assert.equal(payload.curation.looks[0].pieces[1].productId, "sku-base-item");
  assert.equal(payload.curation.looks[0].pieces[1].role, "base");
});

run("PR5.2 — WhatsAppLookItemContext role maps correctly via typed lookSummary", () => {
  const typedLooks: WhatsAppLookSummary[] = [
    {
      id: "look-typed-2",
      name: "Look Tipado",
      intention: "testar compatibilidade de tipos",
      type: "regression",
      explanation: "Verifica que WhatsAppLookSummary e aceito sem cast externo.",
      whenToWear: "testes de regressao",
      items: [
        { id: "item-hero", name: "Peca hero", role: "anchor" },
        { id: "item-base", name: "Peca base", role: "base" },
        { id: "item-finish", name: "Peca acabamento", role: "accessory" },
      ],
    },
  ];

  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    payload: {},
    lookSummary: typedLooks,
  });

  const roles = payload.curation.looks[0].pieces.map((p) => p.role);
  assert.deepEqual(roles, ["hero", "base", "acabamento"]);
});

run("PR5.2 — typed lookSummary items without productId field use id field correctly", () => {
  const lookSummary: WhatsAppLookSummary[] = [
    {
      id: "look-id-test",
      name: "Look ID Fallback",
      intention: "testar fallback de id",
      type: "test",
      explanation: "WhatsAppLookItemContext usa id, nao productId.",
      whenToWear: "never",
      items: [{ id: "canonical-id", name: "Peca com id", role: "hero" }],
    },
  ];

  const payload = buildVenusWhatsAppConsultivePayload({ orgId, payload: {}, lookSummary });

  assert.equal(payload.curation.looks[0].pieces[0].productId, "canonical-id");
});

run("PR5.2 — consultive payload is not try-on dependent when lookSummary has items", () => {
  const lookSummary: WhatsAppLookSummary[] = [
    {
      id: "look-no-tryon",
      name: "Look sem try-on",
      intention: "curadoria independente",
      type: "consultive",
      explanation: "A curadoria deve funcionar sem try-on.",
      whenToWear: "qualquer ocasiao",
      items: [{ id: "item-1", name: "Peca consultiva", role: "hero" }],
    },
  ];

  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    payload: { styleIdentity: "Presenca Natural" },
    lookSummary,
  });

  assert.equal(payload.tryOn?.state, "not_requested");
  assert.equal(payload.tryOn?.shouldShow, false);
  assert.equal(payload.curation.looks[0].pieces.length, 1);
  assert.equal(payload.curation.status, "partial");
});

// ── PR 8 integration: functional curation in WhatsApp payload ─────────────────

run("PR8 — buildVenusWhatsAppConsultivePayload uses slot-inferred roles when items have no explicit role", () => {
  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    payload: { styleIdentity: "Autoridade Silenciosa" },
    lookSummary: [
      {
        name: "Look inferido",
        explanation: "Composicao sem roles explícitos.",
        items: [
          { id: "b1", name: "Blazer preto", category: "blazer" },
          { id: "c1", name: "Calca reta", category: "calca" },
          { id: "a1", name: "Bolsa media", category: "bolsa" },
        ],
      },
    ],
  });

  assert.equal(payload.version, VENUS_WHATSAPP_CONSULTIVE_PAYLOAD_VERSION);
  const roles = payload.curation.looks[0].pieces.map((p) => p.role);
  assert.ok(roles.includes("hero"), "must infer hero from blazer category");
  assert.ok(roles.includes("base"), "must infer base from calca category");
  assert.ok(roles.includes("acabamento"), "must infer acabamento from bolsa category");
});

run("PR8 — payload curation status is partial when required roles are missing", () => {
  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    payload: {},
    lookSummary: [
      {
        name: "Look incompleto",
        items: [
          { id: "b1", name: "Blazer", category: "blazer" },
          { id: "c1", name: "Calca", category: "calca" },
        ],
      },
    ],
  });

  assert.equal(payload.curation.status, "partial");
  assert.ok(Array.isArray(payload.curation.missingSlots) && payload.curation.missingSlots.length > 0);
});

run("PR8 — payload curation status is insufficient_catalog for empty lookSummary", () => {
  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    payload: {},
    lookSummary: [],
  });

  assert.equal(payload.curation.status, "insufficient_catalog");
  assert.equal(payload.curation.looks.length, 0);
});

run("PR8 — internal catalog roles anchor/support are adapted to consultive roles", () => {
  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    payload: {},
    lookSummary: [
      {
        name: "Look com roles internos",
        items: [
          { id: "i1", name: "Peca principal", role: "anchor" },
          { id: "i2", name: "Peca suporte", role: "support" },
          { id: "i3", name: "Peca acabamento", role: "accessory" },
        ],
      },
    ],
  });

  const roles = payload.curation.looks[0].pieces.map((p) => p.role);
  assert.equal(roles[0], "hero", "anchor must map to hero");
  assert.equal(roles[1], "equilibrio", "support must map to equilibrio");
  assert.equal(roles[2], "acabamento", "accessory must map to acabamento");
});

run("PR8 — curation does not depend on try-on state in payload", () => {
  const withTryOn = buildVenusWhatsAppConsultivePayload({
    orgId,
    payload: {},
    resultState: "hero",
    lookSummary: [
      {
        name: "Look com try-on",
        items: [
          { id: "p1", name: "Blazer", category: "blazer" },
          { id: "p2", name: "Calca", category: "calca" },
          { id: "p3", name: "Bolsa", category: "bolsa" },
        ],
      },
    ],
  });

  const withoutTryOn = buildVenusWhatsAppConsultivePayload({
    orgId,
    payload: {},
    lookSummary: [
      {
        name: "Look sem try-on",
        items: [
          { id: "p1", name: "Blazer", category: "blazer" },
          { id: "p2", name: "Calca", category: "calca" },
          { id: "p3", name: "Bolsa", category: "bolsa" },
        ],
      },
    ],
  });

  assert.equal(withTryOn.curation.status, withoutTryOn.curation.status);
  assert.equal(withTryOn.curation.looks[0].pieces.length, withoutTryOn.curation.looks[0].pieces.length);
  assert.deepEqual(
    withTryOn.curation.looks[0].pieces.map((p) => p.role),
    withoutTryOn.curation.looks[0].pieces.map((p) => p.role),
  );
});

run("PR8 — commerce completeLooks path still works and is not affected by curation change", () => {
  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    commerce: commercePlan,
    payload: {},
  });

  assert.equal(payload.curation.status, "ready");
  assert.equal(payload.curation.looks[0].pieces.length, 3);
  assert.deepEqual(
    payload.curation.looks[0].pieces.map((p) => p.role),
    ["hero", "base", "acabamento"],
  );
});

run("PR8 — legacy WhatsApp payload format is preserved after integration", () => {
  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    orgSlug: "test-store",
    commerce: commercePlan,
    resultState: "hero",
    payload: { styleIdentity: "Elegancia Direta" },
  });

  assert.equal(payload.version, VENUS_WHATSAPP_CONSULTIVE_PAYLOAD_VERSION);
  assert.equal(typeof payload.tenant.orgId, "string");
  assert.ok("curation" in payload);
  assert.ok("handoff" in payload);
  assert.ok("diagnostics" in payload);
  assert.ok("tryOn" in payload);
});

// ── PR 7 regression: unified role source ──────────────────────────────────────

run("PR7 — buildVenusWhatsAppConsultivePayload accepts pieces from buildCurationByPieceRole", () => {
  const curation = buildCurationByPieceRole({
    looks: [
      {
        title: "Look cruzado",
        items: [
          { id: "sku-layer", name: "Blazer preto", category: "blazer" },
          { id: "sku-bottom", name: "Calca reta", category: "calca" },
          { id: "sku-access", name: "Bolsa media", category: "bolsa" },
        ],
      },
    ],
  });

  // Map PremiumCurationPiece → WhatsAppLookSummary items format
  const lookSummary: WhatsAppLookSummary[] = curation.looks.map((look) => ({
    id: look.title,
    name: look.title,
    intention: "curadoria consultiva",
    type: "editorial",
    explanation: look.rationale,
    whenToWear: "uso profissional",
    items: look.pieces.map((p) => ({
      id: p.productId,
      name: p.name,
      role: p.role,
      conversionCopy: p.reason,
    })),
  }));

  const payload = buildVenusWhatsAppConsultivePayload({
    orgId,
    payload: { styleIdentity: "Autoridade Silenciosa" },
    lookSummary,
  });

  assert.equal(payload.version, VENUS_WHATSAPP_CONSULTIVE_PAYLOAD_VERSION);
  assert.equal(payload.curation.looks.length, 1);
  assert.equal(payload.curation.looks[0].pieces.length, 3);
  assert.equal(payload.curation.looks[0].pieces[0].role, "hero");
  assert.equal(payload.curation.looks[0].pieces[1].role, "base");
  assert.equal(payload.curation.looks[0].pieces[2].role, "acabamento");
});

run("PR7 — normalizeConsultivePieceRole is identical in curadoria and payload contexts", () => {
  const aliases = [
    ["hero", "hero"],
    ["anchor", "hero"],
    ["statement", "hero"],
    ["protagonista", "hero"],
    ["base", "base"],
    ["support", "equilibrio"],
    ["equilibrio", "equilibrio"],
    ["apoio", "equilibrio"],
    ["destaque", "ponto_focal"],
    ["focal", "ponto_focal"],
    ["focus", "ponto_focal"],
    ["accessory", "acabamento"],
    ["acessorio", "acabamento"],
    ["accessorio", "acabamento"],
    ["finish", "acabamento"],
    ["alternativa", "alternativa"],
    ["alternative", "alternativa"],
    ["substituicao", "alternativa"],
  ] as const;

  for (const [alias, expected] of aliases) {
    assert.equal(
      normalizeConsultivePieceRole(alias),
      expected,
      `"${alias}" must normalize to "${expected}"`,
    );
  }
});

run("PR7 — VenusWhatsAppConsultiveRole and PremiumCurationPieceRole share the same canonical values", () => {
  // Structural test: after PR 7, VenusWhatsAppConsultiveRole = PremiumCurationPieceRole.
  // Verify that pieces produced by the curadoria layer are accepted by the payload without type errors.
  const curation = buildCurationByPieceRole({
    products: [
      { id: "p1", name: "Blazer", category: "blazer" },
      { id: "p2", name: "Calca", category: "calca" },
      { id: "p3", name: "Bolsa", category: "bolsa" },
    ],
  });

  const curationRoles = curation.looks.flatMap((l) => l.pieces).map((p) => p.role);
  const VALID_ROLES = ["hero", "base", "equilibrio", "ponto_focal", "acabamento", "alternativa"];

  for (const role of curationRoles) {
    assert.ok(VALID_ROLES.includes(role), `"${role}" must be a valid VenusWhatsAppConsultiveRole`);
  }
});

process.stdout.write("\n--- WhatsApp consultive payload tests passed ---\n");
