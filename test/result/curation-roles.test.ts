import assert from "node:assert/strict";

import {
  buildCurationByPieceRole,
  normalizeConsultivePieceRole,
  type BuildCurationByPieceRoleInput,
  type PremiumCurationPieceRole,
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

const CONSULTIVE_ROLES: PremiumCurationPieceRole[] = [
  "hero",
  "base",
  "equilibrio",
  "ponto_focal",
  "acabamento",
  "alternativa",
];

const FORBIDDEN_BODY_JUDGMENT = [
  /disfar[cç]a/i,
  /esconde/i,
  /mais magr/i,
  /engorda/i,
  /imperfei[cç][aã]o/i,
  /barriga/i,
  /quadril/i,
  /afina o corpo/i,
  /corrig/i,
  /corpo n[aã]o/i,
];

const SENSITIVE_VALUES = [
  "+55 11 99999-1234",
  "cliente.real@example.com",
  "Nome Completo",
  "data:image/png;base64",
  "https://signed.example.com",
  "SECRET_TOKEN",
  "raw_ai_response",
];

function assertNoForbiddenBody(value: unknown) {
  const text = JSON.stringify(value);
  for (const pattern of FORBIDDEN_BODY_JUDGMENT) {
    assert.doesNotMatch(text, pattern);
  }
}

function assertNoSensitiveValues(value: unknown) {
  const text = JSON.stringify(value).toLowerCase();
  for (const sensitive of SENSITIVE_VALUES) {
    assert.doesNotMatch(
      text,
      new RegExp(sensitive.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
  assert.doesNotMatch(text, /base64|secret_token|raw_ai_response|signed\.example/);
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const blazer = {
  id: "sku-blazer",
  name: "Blazer preto de alfaiataria",
  category: "blazer",
  role: "hero",
  reason: "Define a presenca e estrutura o look.",
};

const calca = {
  id: "sku-calca",
  name: "Calca reta marinho",
  category: "calca",
  role: "base",
  reason: "Sustenta a linha do look.",
};

const bolsa = {
  id: "sku-bolsa",
  name: "Bolsa media couro",
  category: "bolsa",
  role: "acabamento",
  reason: "Fecha a leitura com acabamento.",
};

const sapato = {
  id: "sku-sapato",
  name: "Sapato preto classico",
  category: "sapato",
};

// ── Tests ────────────────────────────────────────────────────────────────────

run("mounts ready curation when there are enough products", () => {
  const model = buildCurationByPieceRole({
    looks: [
      {
        title: "Base de Presenca Limpa",
        items: [blazer, calca, bolsa],
      },
    ],
  });

  assert.equal(model.status, "ready");
  assert.equal(model.looks.length, 1);
  assert.equal(model.looks[0].pieces.length, 3);
  assert.equal(model.missingSlots.length, 0);
  assert.ok(model.counts.pieces >= 3);
});

run("mounts partial when required roles are missing", () => {
  const model = buildCurationByPieceRole({
    looks: [
      {
        title: "Look parcial",
        items: [blazer, calca],
      },
    ],
  });

  assert.equal(model.status, "partial");
  assert.ok(model.missingSlots.includes("acabamento"), "acabamento must be in missingSlots");
  assert.ok(model.warnings.some((w) => w.includes("partial")));
});

run("returns insufficient_catalog when there are too few products", () => {
  const model = buildCurationByPieceRole({
    looks: [{ title: "Um item", items: [blazer] }],
  });

  assert.equal(model.status, "insufficient_catalog");
  assert.ok(model.missingSlots.length > 0);
  assert.ok(model.warnings.some((w) => w.includes("insufficient")));
});

run("empty catalog does not throw and returns insufficient_catalog", () => {
  const model = buildCurationByPieceRole({ looks: [] });

  assert.equal(model.status, "insufficient_catalog");
  assert.equal(model.looks.length, 0);
  assert.equal(model.counts.pieces, 0);
});

run("undefined input does not throw", () => {
  const model = buildCurationByPieceRole();

  assert.equal(model.status, "insufficient_catalog");
  assert.equal(model.looks.length, 0);
});

run("preserves source order within look", () => {
  const model = buildCurationByPieceRole({
    looks: [{ title: "Look ordenado", items: [blazer, calca, bolsa] }],
  });

  const indices = model.looks[0].pieces.map((p) => p.sourceIndex);
  assert.deepEqual(indices, [0, 1, 2]);
});

run("classifies blazer as hero by category", () => {
  const model = buildCurationByPieceRole({
    products: [{ id: "b1", name: "Blazer claro", category: "blazer" }],
  });

  assert.equal(model.looks[0].pieces[0].role, "hero");
  assert.equal(model.looks[0].pieces[0].slot, "layer");
});

run("classifies calca as base by category", () => {
  const model = buildCurationByPieceRole({
    products: [
      { id: "b1", name: "Blazer claro", category: "blazer" },
      { id: "c1", name: "Calca reta", category: "calca" },
    ],
  });

  const baseRole = model.looks[0].pieces.find((p) => p.slot === "bottom");
  assert.ok(baseRole, "must have a bottom-slot piece");
  assert.equal(baseRole.role, "base");
});

run("classifies bolsa/acessorio as acabamento by category", () => {
  const model = buildCurationByPieceRole({
    products: [
      { id: "b1", name: "Blazer claro", category: "blazer" },
      { id: "c1", name: "Calca reta", category: "calca" },
      { id: "a1", name: "Bolsa media", category: "bolsa" },
    ],
  });

  const piece = model.looks[0].pieces.find((p) => p.slot === "accessory");
  assert.ok(piece, "must have accessory slot");
  assert.equal(piece.role, "acabamento");
});

run("uses alternativa role when ideal role is already assigned", () => {
  const model = buildCurationByPieceRole({
    products: [
      { id: "b1", name: "Blazer preto", category: "blazer" },
      { id: "b2", name: "Blazer branco", category: "blazer" },
      { id: "c1", name: "Calca reta", category: "calca" },
      { id: "a1", name: "Bolsa media", category: "bolsa" },
    ],
  });

  const roles = model.looks[0].pieces.map((p) => p.role);
  assert.ok(roles.includes("hero"), "hero must be present");
  const heroCount = roles.filter((r) => r === "hero").length;
  assert.equal(heroCount, 1, "only one hero per look");
});

run("curation does not depend on try-on", () => {
  const input: BuildCurationByPieceRoleInput = {
    looks: [
      {
        title: "Look sem try-on",
        items: [blazer, calca, bolsa],
      },
    ],
  };

  const model = buildCurationByPieceRole(input);

  assert.equal(model.status, "ready");
  assert.ok(model.looks[0].pieces.length >= 3);
  const serialized = JSON.stringify(model);
  assert.doesNotMatch(serialized, /tryOn|try_on|tryon/i);
});

run("curation does not depend on image", () => {
  const model = buildCurationByPieceRole({
    looks: [{ title: "Look sem imagem", items: [blazer, calca, bolsa] }],
  });

  const serialized = JSON.stringify(model);
  assert.doesNotMatch(serialized, /imageUrl|image_url|signedUrl|base64|photo/i);
  assert.equal(model.status, "ready");
});

run("output contains no PII or sensitive values", () => {
  const model = buildCurationByPieceRole({
    looks: [
      {
        title: "Look com dados hostis",
        rationale: "cliente.real@example.com data:image/png;base64,AAAA",
        items: [
          {
            id: "sku-safe",
            name: "Blazer preto",
            reason: "+55 11 99999-1234 SECRET_TOKEN raw_ai_response",
            category: "blazer",
          },
          {
            id: "sku-base",
            name: "Calca reta",
            reason: "Sustenta a composicao",
            category: "calca",
          },
          {
            id: "sku-finish",
            name: "Bolsa media",
            reason: "Acaba o look",
            category: "bolsa",
          },
        ],
      },
    ],
  });

  assertNoSensitiveValues(model);
  assert.equal(model.status, "ready");
});

run("rationale does not contain body judgment language", () => {
  const model = buildCurationByPieceRole({
    looks: [{ title: "Look consultivo", items: [blazer, calca, bolsa] }],
  });

  assertNoForbiddenBody(model);
});

run("fallback rationale is used when piece has no reason/description", () => {
  const model = buildCurationByPieceRole({
    products: [
      { id: "item-no-reason", name: "Peca sem razao", category: "blazer" },
      { id: "item-no-reason-2", name: "Peca sem razao 2", category: "calca" },
      { id: "item-no-reason-3", name: "Peca sem razao 3", category: "bolsa" },
    ],
  });

  for (const piece of model.looks[0].pieces) {
    assert.ok(piece.reason.length > 0, "reason must never be empty");
    assert.doesNotMatch(piece.reason, /undefined|null/i);
  }
});

run("piece roles are compatible with venus_whatsapp_consultive_v1 roles", () => {
  const model = buildCurationByPieceRole({
    looks: [{ title: "Look compativel", items: [blazer, calca, bolsa, sapato] }],
  });

  for (const piece of model.looks.flatMap((l) => l.pieces)) {
    assert.ok(
      CONSULTIVE_ROLES.includes(piece.role),
      `role "${piece.role}" must be a valid VenusWhatsAppConsultiveRole`,
    );
  }
});

run("normalizeConsultivePieceRole maps all known role aliases", () => {
  assert.equal(normalizeConsultivePieceRole("hero"), "hero");
  assert.equal(normalizeConsultivePieceRole("anchor"), "hero");
  assert.equal(normalizeConsultivePieceRole("protagonista"), "hero");
  assert.equal(normalizeConsultivePieceRole("base"), "base");
  assert.equal(normalizeConsultivePieceRole("support"), "equilibrio");
  assert.equal(normalizeConsultivePieceRole("apoio"), "equilibrio");
  assert.equal(normalizeConsultivePieceRole("destaque"), "ponto_focal");
  assert.equal(normalizeConsultivePieceRole("focal"), "ponto_focal");
  assert.equal(normalizeConsultivePieceRole("accessory"), "acabamento");
  assert.equal(normalizeConsultivePieceRole("acessorio"), "acabamento");
  assert.equal(normalizeConsultivePieceRole("finish"), "acabamento");
  assert.equal(normalizeConsultivePieceRole("alternativa"), "alternativa");
  assert.equal(normalizeConsultivePieceRole("substituicao"), "alternativa");
});

run("normalizeConsultivePieceRole uses index fallback for unknown roles", () => {
  assert.equal(normalizeConsultivePieceRole("unknown_role", 0), "hero");
  assert.equal(normalizeConsultivePieceRole("unknown_role", 1), "base");
  assert.equal(normalizeConsultivePieceRole("unknown_role", 2), "acabamento");
  assert.equal(normalizeConsultivePieceRole("unknown_role", 5), "alternativa");
});

run("buildCurationByPieceRole is deterministic for equal input", () => {
  const input: BuildCurationByPieceRoleInput = {
    looks: [{ title: "Determinism check", items: [blazer, calca, bolsa] }],
  };

  const first = buildCurationByPieceRole(input);
  const second = buildCurationByPieceRole(input);

  assert.deepEqual(first, second);
});

run("incomplete metadata produces safe fallback piece names and reasons", () => {
  const model = buildCurationByPieceRole({
    products: [
      { id: "p1" },
      { id: "p2", name: "" },
      { id: "p3", name: "Peca valida", category: "bolsa" },
    ],
  });

  for (const piece of model.looks[0].pieces) {
    assert.ok(typeof piece.name === "string" && piece.name.length > 0);
    assert.ok(typeof piece.reason === "string" && piece.reason.length > 0);
    assert.ok(typeof piece.productId === "string" && piece.productId.length > 0);
  }
});

run("products array shortcut maps flat list to single look", () => {
  const model = buildCurationByPieceRole({
    products: [blazer, calca, bolsa],
  });

  assert.equal(model.looks.length, 1);
  assert.equal(model.looks[0].pieces.length, 3);
  assert.equal(model.status, "ready");
});

run("counts reflect actual piece distribution", () => {
  const model = buildCurationByPieceRole({
    looks: [{ title: "Count test", items: [blazer, calca, bolsa] }],
  });

  assert.equal(model.counts.looks, 1);
  assert.equal(model.counts.pieces, 3);
  const totalFromRoles = Object.values(model.counts.roles).reduce((s, n) => s + n, 0);
  assert.equal(totalFromRoles, 3);
});

run("missingSlots is empty when all required roles are present", () => {
  const model = buildCurationByPieceRole({
    looks: [{ title: "Full look", items: [blazer, calca, bolsa] }],
  });

  assert.equal(model.missingSlots.length, 0);
});

run("multiple looks each get independent role assignment", () => {
  const model = buildCurationByPieceRole({
    looks: [
      { title: "Look 1", items: [blazer, calca, bolsa] },
      { title: "Look 2", items: [blazer, calca, bolsa] },
    ],
  });

  assert.equal(model.looks.length, 2);
  for (const look of model.looks) {
    const roles = look.pieces.map((p) => p.role);
    assert.ok(roles.includes("hero"), "each look must have a hero");
    assert.ok(roles.includes("base"), "each look must have a base");
  }
});

// ── PR 7 regression: unified role normalization ───────────────────────────────

run("PR7 — normalizeConsultivePieceRole covers all former mapConsultiveRole aliases", () => {
  // These aliases existed in the private mapConsultiveRole in consultive-payload.ts
  assert.equal(normalizeConsultivePieceRole("statement"), "hero");
  assert.equal(normalizeConsultivePieceRole("equilibrium"), "equilibrio");
  assert.equal(normalizeConsultivePieceRole("accessorio"), "acabamento");
  assert.equal(normalizeConsultivePieceRole("alternative"), "alternativa");
  // Plus the richer aliases from curation-roles that are now canonical
  assert.equal(normalizeConsultivePieceRole("protagonista"), "hero");
  assert.equal(normalizeConsultivePieceRole("apoio"), "equilibrio");
  assert.equal(normalizeConsultivePieceRole("destaque"), "ponto_focal");
  assert.equal(normalizeConsultivePieceRole("substituicao"), "alternativa");
});

run("PR7 — every PremiumCurationPieceRole value is a valid VenusWhatsAppConsultiveRole", () => {
  // PremiumCurationPieceRole and VenusWhatsAppConsultiveRole are now the same type.
  // This test verifies they agree on the canonical set at runtime.
  const canonicalRoles = CONSULTIVE_ROLES;
  for (const role of canonicalRoles) {
    // normalizeConsultivePieceRole should return itself when passed its own canonical value
    assert.equal(normalizeConsultivePieceRole(role), role);
  }
});

run("PR7 — roles from buildCurationByPieceRole are all in the canonical set", () => {
  const model = buildCurationByPieceRole({
    looks: [
      {
        title: "Cross-compat look",
        items: [
          { id: "s1", name: "Blazer preto", category: "blazer", role: "anchor" },
          { id: "s2", name: "Calca reta", category: "calca", role: "base" },
          { id: "s3", name: "Bolsa media", category: "bolsa", role: "accessory" },
          { id: "s4", name: "Camiseta branca", category: "camiseta" },
        ],
      },
    ],
  });

  for (const piece of model.looks.flatMap((l) => l.pieces)) {
    assert.ok(CONSULTIVE_ROLES.includes(piece.role), `"${piece.role}" must be canonical`);
  }
});

run("PR7 — unknown role at index 3+ now maps to alternativa (unified behavior)", () => {
  assert.equal(normalizeConsultivePieceRole("zzzunknown", 3), "alternativa");
  assert.equal(normalizeConsultivePieceRole("zzzunknown", 10), "alternativa");
});

process.stdout.write("\n--- Premium curation by piece role tests passed ---\n");
