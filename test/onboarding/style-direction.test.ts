import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { buildResultSurface } from "../../src/lib/result/surface.ts";
import { buildShareableLookCardModel } from "../../src/lib/tryon/share-card.ts";
import { buildVenusResultNarrative } from "../../src/lib/venus/brand.ts";
import { filterCatalogForRecommendation } from "../../src/lib/ai/result-normalizer.ts";
import { buildLeadContextProfileFromOnboarding } from "../../src/lib/lead-context/index.ts";
import { deriveEssenceProfile } from "../../src/lib/result/essence.ts";
import { normalizeStyleDirectionPreference } from "../../src/lib/style-direction.ts";
import { VenusLoadingScreen } from "../../src/components/ui/VenusLoadingScreen.tsx";

import type { OnboardingData } from "../../src/types/onboarding.ts";

function run(name: string, fn: () => void) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

function buildOnboarding(styleDirection: OnboardingData["intent"]["styleDirection"]): OnboardingData {
  return {
    ...({
      intent: {
        styleDirection,
        imageGoal: "Autoridade",
        satisfaction: 8,
        mainPain: "Ruído visual",
      },
      lifestyle: {
        environments: ["corporativo"],
        purchaseDna: "poucas & boas",
        purchaseBehavior: "compras planejadas",
      },
      colors: {
        favoriteColors: ["Marinho intenso"],
        avoidColors: ["Amarelo"],
        metal: "Prateado",
        colorSeason: "Inverno",
        skinTone: "médio",
        undertone: "neutro",
        contrast: "alto",
        faceShape: "oval",
        idealNeckline: "Decote em V",
        idealFit: "Slim",
        idealFabrics: ["Algodão"],
        avoidFabrics: ["Brilho"],
      },
      body: {
        highlight: ["ombros"],
        camouflage: ["abdômen"],
        fit: "Slim",
        faceLines: "Marcantes",
        hairLength: "Curto",
      },
      scanner: {
        facePhoto: "data:image/png;base64,face",
        bodyPhoto: "data:image/png;base64,body",
        skipped: false,
      },
      colorimetry: {
        skinTone: "médio",
        undertone: "neutro",
        contrast: "alto",
        colorSeason: "Inverno",
        favoriteColors: ["Marinho intenso"],
        avoidColors: ["Amarelo"],
        faceShape: "oval",
        idealNeckline: "Decote em V",
        idealFit: "Slim",
        idealFabrics: ["Algodão"],
        avoidFabrics: ["Brilho"],
        justification: "Leitura consistente",
      },
      favoriteColors: ["Marinho intenso"],
      avoidColors: ["Amarelo"],
      colorSeason: "Inverno",
      faceShape: "oval",
      idealNeckline: "Decote em V",
      idealFit: "Slim",
      idealFabrics: ["Algodão"],
      avoidFabrics: ["Brilho"],
      conversation: {
        line: "",
        imageGoal: "autoridade",
        styleDirection: "",
        avoidColorNote: "",
        favoriteColors: [],
        avoidColors: [],
      },
    } satisfies OnboardingData),
  };
}

const sampleCatalog = [
  {
    id: "prod-m",
    org_id: "org-1",
    name: "Blazer estruturado",
    category: "Alfaiataria",
    primary_color: "Preto",
    style: "masculino",
    type: "look",
    price_range: "R$ 799",
    image_url: "",
    external_url: "",
    stock: null,
    stock_qty: null,
    reserved_qty: null,
    stock_status: "available",
    description: "",
    persuasive_description: "",
    emotional_copy: "",
    tags: ["alfaiataria"],
    size_type: "",
    created_at: new Date().toISOString(),
    style_direction: "Masculina",
    style_tags: ["presença"],
    category_tags: ["base"],
    fit_tags: ["estrutura"],
    color_tags: ["preto"],
    target_profile: ["presença"],
    use_cases: ["trabalho"],
    occasion_tags: ["work"],
    season_tags: ["all"],
    body_effect: "",
    face_effect: "",
    visual_weight: "",
    formality: "",
    catalog_notes: "",
  },
  {
    id: "prod-f",
    org_id: "org-1",
    name: "Vestido fluido",
    category: "Vestidos",
    primary_color: "Rosa",
    style: "romântico",
    type: "look",
    price_range: "R$ 899",
    image_url: "",
    external_url: "",
    stock: null,
    stock_qty: null,
    reserved_qty: null,
    stock_status: "available",
    description: "",
    persuasive_description: "",
    emotional_copy: "",
    tags: ["romântico"],
    size_type: "",
    created_at: new Date().toISOString(),
    style_direction: "Feminina",
    style_tags: ["delicado"],
    category_tags: ["base"],
    fit_tags: ["fluido"],
    color_tags: ["rosa"],
    target_profile: ["delicado"],
    use_cases: ["evento"],
    occasion_tags: ["event"],
    season_tags: ["all"],
    body_effect: "",
    face_effect: "",
    visual_weight: "",
    formality: "",
    catalog_notes: "",
  },
  {
    id: "prod-n",
    org_id: "org-1",
    name: "Camisa clean",
    category: "Camisas",
    primary_color: "Branco",
    style: "neutro",
    type: "look",
    price_range: "R$ 399",
    image_url: "",
    external_url: "",
    stock: null,
    stock_qty: null,
    reserved_qty: null,
    stock_status: "available",
    description: "",
    persuasive_description: "",
    emotional_copy: "",
    tags: ["clean"],
    size_type: "",
    created_at: new Date().toISOString(),
    style_direction: "Neutra",
    style_tags: ["minimalista"],
    category_tags: ["base"],
    fit_tags: ["leve"],
    color_tags: ["branco"],
    target_profile: ["uso real"],
    use_cases: ["casual"],
    occasion_tags: ["casual"],
    season_tags: ["all"],
    body_effect: "",
    face_effect: "",
    visual_weight: "",
    formality: "",
    catalog_notes: "",
  },
] as const;

run("normalizeStyleDirectionPreference keeps explicit preference and safe default", () => {
  assert.equal(normalizeStyleDirectionPreference("Masculina"), "Masculina");
  assert.equal(normalizeStyleDirectionPreference("Feminina"), "Feminina");
  assert.equal(normalizeStyleDirectionPreference(""), "Sem preferência");
  assert.equal(normalizeStyleDirectionPreference("streetwear"), "Streetwear");
});

run("buildVenusResultNarrative does not emit feminine wording without explicit feminine preference", () => {
  const noPref = buildVenusResultNarrative({ state: "hero", styleDirection: "Sem preferência" });
  const masculine = buildVenusResultNarrative({ state: "hero", styleDirection: "Masculina" });

  assert.doesNotMatch(noPref.title, /femin/i);
  assert.match(noPref.title, /Presença|Look/);
  assert.doesNotMatch(masculine.title, /femin/i);
  assert.match(masculine.title, /Presença urbana|Look de presença|Casual de impacto|Minimalismo marcante|Força visual limpa/);
  assert.equal(noPref.primaryCta, "Ver minha curadoria");
  assert.equal(masculine.primaryCta, "Ver minha curadoria");
});

run("buildVenusResultNarrative uses editorial CTA for preview instead of refazer foto", () => {
  const preview = buildVenusResultNarrative({ state: "preview", styleDirection: "Masculina" });

  assert.equal(preview.primaryCta, "Gerar versão editorial");
  assert.doesNotMatch(preview.primaryCta, /refazer foto/i);
});

run("styleDirection is persisted in the journey and result surfaces", () => {
  const onboarding = buildOnboarding("Masculina");
  const essence = deriveEssenceProfile(onboarding);
  const resultSurface = buildResultSurface(onboarding, null, null);
  const leadContext = buildLeadContextProfileFromOnboarding({
    data: onboarding,
    result: resultSurface as any,
    orgId: "org-1",
    orgSlug: "maison-elite",
    savedResultId: "result-1",
  });

  assert.equal(essence.styleDirection, "Masculina");
  assert.equal(resultSurface.essence.styleDirection, "Masculina");
  assert.equal(leadContext.styleProfile.styleDirection, "Masculina");
});

run("catalog filtering rejects feminine recommendations for masculine preference", () => {
  const masculineCatalog = filterCatalogForRecommendation(sampleCatalog as any, buildOnboarding("Masculina"));
  const neutralCatalog = filterCatalogForRecommendation(sampleCatalog as any, buildOnboarding("Sem preferência"));

  assert.ok(masculineCatalog.some((item) => item.id === "prod-m"));
  assert.ok(masculineCatalog.some((item) => item.id === "prod-n"));
  assert.ok(!masculineCatalog.some((item) => item.id === "prod-f"));
  assert.ok(!neutralCatalog.some((item) => item.id === "prod-f"));
});

run("share card uses premium neutral copy instead of soft power feminino for non-feminine preferences", () => {
  const surface = buildResultSurface(buildOnboarding("Masculina"), null, null);
  const model = buildShareableLookCardModel({
    surface,
    look: surface.looks[0],
    looks: surface.looks,
    storeHandle: "maison-elite",
  });

  assert.doesNotMatch(model.styleName, /soft power feminino/i);
  assert.match(model.styleName, /Presença urbana|Look de presença|Casual de impacto|Minimalismo marcante|Força visual limpa/);
  assert.match(model.brandNote, /@maison-elite/);
  assert.match(model.poweredByLabel, /InovaCortex/);
});

run("VenusLoadingScreen renders a visible premium shell", () => {
  const markup = renderToStaticMarkup(
    React.createElement(VenusLoadingScreen, {
      title: "A Venus está preparando sua experiência",
      subtitle: "Carregando a consultoria premium da sua loja.",
    })
  );

  assert.match(markup, /A Venus está preparando sua experiência/);
  assert.match(markup, /Carregando a consultoria premium da sua loja\./);
  assert.match(markup, /Consultoria premium/);
});

console.log("\n--- Style direction tests passed ---");
