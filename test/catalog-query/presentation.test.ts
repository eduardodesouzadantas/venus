const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const {
  buildAssistedCatalogProductCards,
  buildAssistedLookStripItems,
  buildCatalogAccessCopy,
} = require("../../src/lib/catalog-query/presentation.ts");

const { ConversationalCatalogBlock } = require("../../src/components/catalog/ConversationalCatalogBlock.tsx");
const { AssistedLookStrip } = require("../../src/components/catalog/AssistedLookStrip.tsx");

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

function createLook(index, overrides = {}) {
  return {
    id: `look-${index}`,
    product_id: `product-${index}`,
    name: `Look ${index}`,
    intention: `Intenção ${index}`,
    type: "Híbrido Seguro",
    items: [
      {
        id: `item-${index}`,
        product_id: `product-${index}`,
        name: `Peça ${index}`,
        premiumTitle: `Peça premium ${index}`,
        brand: "Marca Aurora",
        photoUrl: index === 2 ? "" : `https://example.com/${index}.jpg`,
        price: index === 3 ? "" : "R$ 399",
        colorTags: index === 1 ? ["preto", "off white"] : [],
        fitTags: index === 1 ? ["P", "M"] : [],
        conversionCopy: `Por que ${index}`,
        authorityRationale: `Racional ${index}`,
      },
    ],
    accessories: [],
    explanation: `Explicação ${index}`,
    whenToWear: `Ocasião ${index}`,
    ...overrides,
  };
}

run("buildAssistedCatalogProductCards returns up to three cards", () => {
  const cards = buildAssistedCatalogProductCards(
    [createLook(1), createLook(2), createLook(3), createLook(4)],
    { sourceLabel: "Loja Aurora", limit: 3 }
  );

  assert.equal(cards.length, 3);
  assert.equal(cards[0].sourceLabel, "Loja Aurora");
  assert.equal(cards[0].title, "Peça premium 1");
  assert.deepEqual(cards[0].colors, ["preto", "off white"]);
  assert.deepEqual(cards[0].sizes, ["P", "M"]);
});

run("buildAssistedCatalogProductCards keeps fallback values when image and price are missing", () => {
  const cards = buildAssistedCatalogProductCards([
    createLook(2, {
      items: [
        {
          id: "item-2",
          product_id: "product-2",
          name: "Peça 2",
          premiumTitle: "Peça premium 2",
          brand: "Marca Aurora",
          photoUrl: "",
          price: "",
          colorTags: [],
          fitTags: [],
          conversionCopy: "Por que 2",
        },
      ],
    }),
  ], { sourceLabel: "Loja Aurora" });

  assert.equal(cards.length, 1);
  assert.equal(cards[0].imageUrl, "");
  assert.equal(cards[0].priceLabel, "");
});

run("buildAssistedLookStripItems creates a simple strip model", () => {
  const looks = buildAssistedLookStripItems([createLook(1), createLook(2)]);

  assert.equal(looks.length, 2);
  assert.equal(looks[0].detailLine, "Peça principal");
  assert.equal(looks[1].ctaLabel, "Ver variação");
});

run("buildCatalogAccessCopy supports explicit catalog access", () => {
  const copy = buildCatalogAccessCopy({
    sourceLabel: "Catálogo Meta",
    productCount: 2,
    explicit: true,
  });

  assert.equal(copy.eyebrow, "Catálogo solicitado");
  assert.ok(copy.openLabel.includes("Catálogo Meta"));
  assert.ok(copy.continueLabel.length > 0);
});

run("ConversationalCatalogBlock renders recommendations and catalog CTA", () => {
  const cards = buildAssistedCatalogProductCards([createLook(1), createLook(2), createLook(3)], {
    sourceLabel: "Loja Aurora",
  });
  const copy = buildCatalogAccessCopy({
    sourceLabel: "Loja Aurora",
    productCount: cards.length,
    explicit: false,
  });

  const html = renderToStaticMarkup(
    React.createElement(ConversationalCatalogBlock, {
      copy,
      products: cards,
      reinforcement: ["Baseado no seu corpo", "Cores ideais para você"],
      catalogAction: {
        label: copy.openLabel,
        href: "https://catalog.example.com",
      },
      continueAction: {
        label: copy.continueLabel,
        onClick: () => {},
      },
      saveAction: {
        label: copy.saveLabel,
        onClick: () => {},
      },
      onOpenProduct: () => {},
      onAskOpinion: () => {},
      onSaveLook: () => {},
    })
  );

  assert.ok(html.includes("Catálogo assistido"));
  assert.ok(html.includes("Loja Aurora"));
  assert.ok(html.includes("Baseado no seu corpo"));
  assert.ok(html.includes("Abrir Loja Aurora"));
  assert.ok(html.includes("Perguntar opinião"));
  assert.ok(html.includes("Salvar look"));
});

run("ConversationalCatalogBlock renders empty state", () => {
  const copy = buildCatalogAccessCopy({
    sourceLabel: "Loja Aurora",
    productCount: 0,
    explicit: false,
  });

  const html = renderToStaticMarkup(
    React.createElement(ConversationalCatalogBlock, {
      copy,
      products: [],
    })
  );

  assert.ok(html.includes("Ainda não há recomendações suficientes"));
});

run("AssistedLookStrip renders look variations", () => {
  const html = renderToStaticMarkup(
    React.createElement(AssistedLookStrip, {
      looks: buildAssistedLookStripItems([createLook(1), createLook(2)]),
      onSelectLook: () => {},
    })
  );

  assert.ok(html.includes("Variações de look"));
  assert.ok(html.includes("Look 1"));
  assert.ok(html.includes("Peça principal"));
});

console.log("\n--- Catalog presentation tests passed ---");
