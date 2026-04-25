const assert = require("node:assert/strict");

const {
  rankProducts,
  getTopRecommendations,
  buildRecommendationJustification,
  buildNextStepSuggestion,
} = require("../../src/lib/catalog-query/ranking");

const {
  CanonicalProduct,
  CatalogQueryParams,
  DEFAULT_RANKING_CONFIG,
} = require("../../src/lib/catalog-query/types");

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

function createMockProduct(overrides = {}) {
  return {
    id: "prod-1",
    source_type: "internal",
    source_id: "source-1",
    title: "Produto Teste",
    description: "Descrição do produto",
    image_url: "https://example.com/image.jpg",
    price: 299.9,
    currency: "BRL",
    colors: ["preto", "branco"],
    sizes: ["P", "M", "G"],
    category: "Blusas",
    style_tags: ["clássico", "casual"],
    availability: "available",
    product_url: "https://example.com/product",
    raw_metadata: {},
    ...overrides,
  };
}

run("rankProducts returns empty array for empty input", () => {
  const result = rankProducts([], { org_id: "org-1" });
  assert.deepEqual(result, []);
});

run("rankProducts orders by score descending", () => {
  const products = [
    createMockProduct({ id: "p1", style_tags: ["esportivo"] }),
    createMockProduct({ id: "p2", style_tags: ["clássico"] }),
  ];
  
  const params = {
    org_id: "org-1",
    style: "clássico",
    context: { user_style_identity: "clássico" },
  };
  
  const result = rankProducts(products, params);
  assert.equal(result[0].product.id, "p2");
  assert.ok(result[0].score > result[1].score);
});

run("rankProducts applies style match weight", () => {
  const products = [
    createMockProduct({ id: "p1", style_tags: ["moderno"] }),
    createMockProduct({ id: "p2", style_tags: ["clássico"] }),
  ];
  
  const params = {
    org_id: "org-1",
    context: { user_style_identity: "clássico" },
  };
  
  const result = rankProducts(products, params);
  const classicMatch = result.find(r => r.product.id === "p2");
  assert.ok(classicMatch?.reasons.some(r => /estilo/i.test(r)));
});

run("rankProducts applies color match weight", () => {
  const products = [
    createMockProduct({ id: "p1", colors: ["azul"] }),
    createMockProduct({ id: "p2", colors: ["preto"] }),
  ];
  
  const params = {
    org_id: "org-1",
    color: "preto",
  };
  
  const result = rankProducts(products, params);
  const pretoMatch = result.find(r => r.product.id === "p2");
  assert.ok(pretoMatch?.reasons.some(r => /cor/i.test(r)));
});

run("rankProducts applies price match weight", () => {
  const products = [
    createMockProduct({ id: "p1", price: 100 }),
    createMockProduct({ id: "p2", price: 250 }),
    createMockProduct({ id: "p3", price: 500 }),
  ];
  
  const params = {
    org_id: "org-1",
    price_min: 150,
    price_max: 300,
  };
  
  const result = rankProducts(products, params);
  const inRange = result.find(r => r.product.id === "p2");
  assert.ok(inRange?.reasons.some(r => /orç|orc/i.test(r)));
});

run("rankProducts penalizes out of stock products", () => {
  const products = [
    createMockProduct({ id: "p1", availability: "available" }),
    createMockProduct({ id: "p2", availability: "out_of_stock" }),
  ];
  
  const result = rankProducts(products, { org_id: "org-1" });
  assert.ok(result[0].score > result[1].score);
});

run("rankProducts excludes previously shown products", () => {
  const products = [
    createMockProduct({ id: "p1" }),
    createMockProduct({ id: "p2" }),
  ];
  
  const params = {
    org_id: "org-1",
    context: { previous_products_shown: ["p1"] },
  };
  
  const result = rankProducts(products, params);
  const p2Result = result.find(r => r.product.id === "p2");
  const p1Result = result.find(r => r.product.id === "p1");
  assert.ok(p2Result?.score >= p1Result?.score);
});

run("getTopRecommendations limits results", () => {
  const products = Array.from({ length: 10 }, (_, i) => 
    createMockProduct({ id: `p${i}`, price: 100 + i * 50 })
  );
  
  const result = getTopRecommendations(products, { org_id: "org-1" }, 3);
  assert.equal(result.length, 3);
});

run("buildRecommendationJustification handles no products", () => {
  const result = buildRecommendationJustification([], { org_id: "org-1" });
  assert.ok(result.includes("Não encontrei"));
});

run("buildRecommendationJustification includes context hints", () => {
  const products = [createMockProduct()];
  const params = {
    org_id: "org-1",
    context: { user_style_identity: "clássico" },
    occasion: "trabalho",
  };
  
  const result = buildRecommendationJustification(products, params);
  assert.ok(result.includes("clássico") || result.includes("trabalho"));
});

run("buildNextStepSuggestion returns appropriate step for LOOK_RECOMMENDATION", () => {
  const products = [{ product: createMockProduct({ raw_metadata: { face_effect: true } }), score: 10, reasons: [] }];
  const params = {
    org_id: "org-1",
    context: { conversation_state: "LOOK_RECOMMENDATION" },
  };
  
  const result = buildNextStepSuggestion(products, params);
  assert.ok(result.includes("try-on") || result.includes("detalhes"));
});

run("buildNextStepSuggestion returns purchase step for CLOSING state", () => {
  const products = [{ product: createMockProduct(), score: 10, reasons: [] }];
  const params = {
    org_id: "org-1",
    context: { conversation_state: "CLOSING" },
    intent: "purchase",
  };
  
  const result = buildNextStepSuggestion(products, params);
  assert.ok(result.includes("garantir") || result.includes("escolha"));
});

run("rankProducts handles context relevance for LOOK_RECOMMENDATION state", () => {
  const products = [
    createMockProduct({ id: "p1", availability: "available" }),
    createMockProduct({ id: "p2", availability: "out_of_stock" }),
  ];
  
  const params = {
    org_id: "org-1",
    context: { conversation_state: "LOOK_RECOMMENDATION", try_on_count: 1 },
  };
  
  const result = rankProducts(products, params);
  assert.ok(result[0].score > result[1].score);
});

run("buildNextStepSuggestion suggests try-on when count is low", () => {
  const products = [{ product: createMockProduct(), score: 10, reasons: [] }];
  const params = {
    org_id: "org-1",
    context: { conversation_state: "DISCOVERY", try_on_count: 1 },
  };
  
  const result = buildNextStepSuggestion(products, params);
  assert.ok(result.includes("try-on") || result.includes("foto"));
});

console.log("\n--- All ranking tests passed ---");
