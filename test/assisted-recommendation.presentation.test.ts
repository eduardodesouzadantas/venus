import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { buildAssistedRecommendationSurface } from "../src/lib/catalog-query/presentation.ts";
import {
  buildWhatsAppFollowUpPresentation,
  buildWhatsAppFollowUpMessagePreview,
} from "../src/lib/whatsapp/look-followup.ts";
import { AssistedRecommendationSurface } from "../src/components/catalog/AssistedRecommendationSurface.tsx";

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

run("buildAssistedRecommendationSurface limits the surface to three recommendations", () => {
  const surface = buildAssistedRecommendationSurface(
    [createLook(1), createLook(2), createLook(3), createLook(4)],
    { sourceLabel: "Loja Aurora" }
  );

  assert.equal(surface.products.length, 3);
  assert.equal(surface.looks.length, 3);
  assert.ok(surface.reinforcement.length > 0);
  assert.equal(surface.actions.moreOptionsLabel, "Ver mais 1 opcao");
  assert.equal(surface.actions.talkToVenusLabel, "Falar com a Venus sobre esse look");
});

run("AssistedRecommendationSurface renders assistant CTAs and look strip", () => {
  const surface = buildAssistedRecommendationSurface(
    [createLook(1), createLook(2)],
    { sourceLabel: "Loja Aurora" }
  );

  const html = renderToStaticMarkup(
    React.createElement(AssistedRecommendationSurface, {
      surface,
      catalogAction: {
        label: surface.actions.catalogLabel,
        href: "https://catalog.example.com",
      },
      continueAction: {
        label: surface.actions.continueLabel,
        onClick: () => {},
      },
      saveAction: {
        label: surface.actions.saveLabel,
        onClick: () => {},
      },
      onOpenProduct: () => {},
      onAskOpinion: () => {},
      onSaveLook: () => {},
      onSelectLook: () => {},
      onMoreOptions: () => {},
      onTalkToVenus: () => {},
    })
  );

  assert.ok(html.includes("Ver mais 1 opcao"));
  assert.ok(html.includes("Falar com a Venus sobre esse look"));
  assert.ok(html.includes("Abrir"));
  assert.ok(html.includes("Variações de look"));
});

run("buildWhatsAppFollowUpPresentation produces a compact follow-up surface", () => {
  const presentation = buildWhatsAppFollowUpPresentation(
    {
      orgId: "org-1",
      conversationId: "conv-1",
      customerPhone: "+5511999999999",
      viewedLooks: [],
      purchasedLooks: [],
      messageCount: 2,
    },
    [
      {
        type: "alternative_look",
        priority: 9,
        message: "Uma alternativa elegante para manter a mesma leitura.",
        reasoning: "Essa leitura sobe a presença sem exagero.",
        products: [
          {
            id: "product-1",
            name: "Blazer premium",
          },
        ],
      },
      {
        type: "complementary_piece",
        priority: 8,
        message: "Uma peça complementar que fecha a proposta.",
        reasoning: "Completa a imagem com mais equilíbrio.",
        products: [
          {
            id: "product-2",
            name: "Camisa clean",
          },
        ],
      },
    ]
  );

  const message = buildWhatsAppFollowUpMessagePreview(
    {
      orgId: "org-1",
      conversationId: "conv-1",
      customerPhone: "+5511999999999",
      viewedLooks: [],
      purchasedLooks: [],
      messageCount: 2,
    },
    presentation
  );

  assert.equal(presentation.suggestions.length, 2);
  assert.equal(presentation.actions.catalogLabel.length > 0, true);
  assert.ok(message.includes("Mais opções para você"));
  assert.ok(message.includes("Ver mais 1 opcao"));
});

console.log("\n--- Assisted recommendation tests passed ---");
