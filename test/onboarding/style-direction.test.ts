import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { buildResultSurface } from "../../src/lib/result/surface.ts";
import { buildShareableLookCardModel } from "../../src/lib/tryon/share-card.ts";
import { buildVenusResultNarrative } from "../../src/lib/venus/brand.ts";
import { buildVenusStylistAudit } from "../../src/lib/venus/audit/engine.ts";
import { buildAssistedCatalogProductCards, buildAssistedLookStripItems } from "../../src/lib/catalog-query/presentation.ts";
import {
  buildCatalogAwareFallbackResult,
  filterCatalogForRecommendation,
  detectMojibake,
  normalizeOpenAIRecommendationPayload,
  validateProfileDirectionConflict,
  validateHeroRole,
  validateOutfitComposition,
  RECOMMENDATION_REASON_CODES,
} from "../../src/lib/ai/result-normalizer.ts";
import { rankProducts } from "../../src/lib/catalog-query/ranking.ts";
import { buildLeadContextProfileFromOnboarding } from "../../src/lib/lead-context/index.ts";
import { buildOnboardingSeedFromSnapshot, buildUserProfileUpsert } from "../../src/lib/user/profile.ts";
import { deriveEssenceProfile } from "../../src/lib/result/essence.ts";
import { getConsultationQuestions } from "../../src/lib/onboarding/consultation-flow.ts";
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
      consultation: {
        styleDirection,
        desiredPerception: "Autoridade clara",
        occasion: "Trabalho",
        boldness: "medium",
        restrictions: ["Sem transparência"],
        preferredColors: ["Marinho intenso"],
        avoidColors: ["Amarelo"],
        bodyFocus: "Rosto",
        aestheticVibe: "Clássica",
        confidenceSource: "conversation",
      },
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
    style_direction: "masculine",
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
    style_direction: "feminine",
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
    style_direction: "neutral",
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
  {
    id: "prod-wedges",
    org_id: "org-1",
    name: "Catwalk Women Slim Casual Beige Wedges",
    category: "Wedges",
    primary_color: "Bege",
    style: "feminine",
    type: "look",
    price_range: "R$ 499",
    image_url: "",
    external_url: "",
    stock: null,
    stock_qty: null,
    reserved_qty: null,
    stock_status: "available",
    description: "",
    persuasive_description: "",
    emotional_copy: "",
    tags: ["women", "feminine"],
    size_type: "",
    created_at: new Date().toISOString(),
    style_direction: null,
    style_tags: ["feminine"],
    category_tags: ["footwear"],
    fit_tags: ["slim"],
    color_tags: ["bege"],
    target_profile: ["feminine"],
    use_cases: ["casual"],
    occasion_tags: ["casual"],
    season_tags: ["all"],
    body_effect: "",
    face_effect: "",
    visual_weight: "",
    formality: "",
    catalog_notes: "",
  },
  {
    id: "prod-handbag",
    org_id: "org-1",
    name: "Murcia Women Casual Brown Handbag",
    category: "Handbags",
    primary_color: "Brown",
    style: "feminine",
    type: "look",
    price_range: "R$ 699",
    image_url: "",
    external_url: "",
    stock: null,
    stock_qty: null,
    reserved_qty: null,
    stock_status: "available",
    description: "",
    persuasive_description: "",
    emotional_copy: "",
    tags: ["women"],
    size_type: "",
    created_at: new Date().toISOString(),
    style_direction: null,
    style_tags: ["feminine"],
    category_tags: ["accessory"],
    fit_tags: ["structured"],
    color_tags: ["brown"],
    target_profile: ["feminine"],
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
  assert.equal(normalizeStyleDirectionPreference("Masculina"), "masculine");
  assert.equal(normalizeStyleDirectionPreference("Feminina"), "feminine");
  assert.equal(normalizeStyleDirectionPreference(""), "no_preference");
  assert.equal(normalizeStyleDirectionPreference("streetwear"), "streetwear");
});

run("buildVenusResultNarrative does not emit feminine wording without explicit feminine preference", () => {
  const noPref = buildVenusResultNarrative({ state: "hero", styleDirection: "no_preference" });
  const masculine = buildVenusResultNarrative({ state: "hero", styleDirection: "masculine" });

  assert.doesNotMatch(noPref.title, /femin/i);
  assert.match(noPref.title, /Linha neutra/);
  assert.doesNotMatch(masculine.title, /femin/i);
  assert.match(masculine.title, /Presença urbana|Look de presença|Casual de impacto|Minimalismo marcante|Força visual limpa/);
  assert.equal(noPref.primaryCta, "Ver minha curadoria");
  assert.equal(masculine.primaryCta, "Ver minha curadoria");
});

run("buildVenusResultNarrative uses editorial CTA for preview instead of refazer foto", () => {
  const preview = buildVenusResultNarrative({ state: "preview", styleDirection: "masculine" });

  assert.equal(preview.primaryCta, "Gerar versão editorial");
  assert.doesNotMatch(preview.primaryCta, /refazer foto/i);
});

run("styleDirection is persisted in the journey and result surfaces", () => {
  const onboarding = buildOnboarding("masculine");
  const essence = deriveEssenceProfile(onboarding);
  const resultSurface = buildResultSurface(onboarding, null, null);
  const profileUpsert = buildUserProfileUpsert("user-1", onboarding);
  const seed = buildOnboardingSeedFromSnapshot(
    {
      profile: {
        id: "user-1",
        body_type: "Slim",
        color_profile: profileUpsert.color_profile,
        style_profile: profileUpsert.style_profile,
        preferences: profileUpsert.preferences,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      orgProfile: null,
      tags: [],
    },
    { id: "org-1", slug: "maison-elite" },
  );
  const leadContext = buildLeadContextProfileFromOnboarding({
    data: onboarding,
    result: resultSurface as any,
    orgId: "org-1",
    orgSlug: "maison-elite",
    savedResultId: "result-1",
  });

  assert.equal(essence.styleDirection, "masculine");
  assert.equal(resultSurface.essence.styleDirection, "masculine");
  assert.equal(leadContext.styleProfile.styleDirection, "masculine");
  assert.equal(seed.intent?.styleDirection, "masculine");
  assert.equal(profileUpsert.style_profile.styleDirection, "masculine");
  assert.equal(profileUpsert.style_profile.consultationProfile.desiredPerception, "Autoridade clara");
  assert.equal(seed.consultation?.occasion, "Trabalho");
});

run("consultation profile questions stay adaptive and short by default", () => {
  const onboarding = {
    ...buildOnboarding("masculine"),
    intent: {
      ...buildOnboarding("masculine").intent,
      styleDirection: "",
      imageGoal: "",
    },
    lifestyle: {
      environments: [],
      purchaseDna: "",
      purchaseBehavior: "",
    },
    colors: {
      favoriteColors: [],
      avoidColors: [],
      metal: "",
      colorSeason: "",
      skinTone: "",
      undertone: "",
      contrast: "",
      faceShape: "",
      idealNeckline: "",
      idealFit: "",
      idealFabrics: [],
      avoidFabrics: [],
    },
    body: {
      highlight: [],
      camouflage: [],
      fit: "",
      faceLines: "",
      hairLength: "",
    },
    colorimetry: {
      ...buildOnboarding("masculine").colorimetry,
      favoriteColors: [],
      avoidColors: [],
      colorSeason: "",
      skinTone: "",
      undertone: "",
      contrast: "",
      faceShape: "",
      idealNeckline: "",
      idealFit: "",
      idealFabrics: [],
      avoidFabrics: [],
      justification: "",
    },
    consultation: {
      styleDirection: "",
      desiredPerception: "",
      occasion: "",
      boldness: "",
      restrictions: [],
      preferredColors: [],
      avoidColors: [],
      bodyFocus: "",
      aestheticVibe: "",
      confidenceSource: "conversation",
    },
  } as OnboardingData;
  const questions = getConsultationQuestions(onboarding);

  assert.ok(questions.some((step) => step.key === "styleDirection"));
  assert.ok(questions.some((step) => step.key === "desiredPerception"));
  assert.ok(questions.some((step) => step.key === "occasion"));
  assert.ok(!questions.some((step) => step.key === "restrictions"));
});

run("conditional consultation questions appear when the profile is ambiguous", () => {
  const onboarding = buildOnboarding("neutral");
  const questions = getConsultationQuestions({
    ...onboarding,
    consultation: {
      ...onboarding.consultation,
      styleDirection: "neutral",
      desiredPerception: "Autoridade clara",
      occasion: "Trabalho",
      boldness: "",
      restrictions: [],
      preferredColors: [],
      avoidColors: [],
      bodyFocus: "",
      aestheticVibe: "",
      confidenceSource: "",
    },
  });

  assert.ok(questions.some((step) => step.key === "boldness"));
  assert.ok(questions.some((step) => step.key === "aestheticVibe"));
});

run("catalog filtering rejects feminine recommendations for masculine preference", () => {
  const masculineCatalog = filterCatalogForRecommendation(sampleCatalog as any, buildOnboarding("masculine"));
  const neutralCatalog = filterCatalogForRecommendation(sampleCatalog as any, buildOnboarding("neutral"));

  assert.ok(masculineCatalog.some((item) => item.id === "prod-m"));
  assert.ok(masculineCatalog.some((item) => item.id === "prod-n"));
  assert.ok(!masculineCatalog.some((item) => item.id === "prod-f"));
  assert.ok(neutralCatalog.some((item) => item.id === "prod-n"));
  assert.ok(!neutralCatalog.some((item) => item.id === "prod-f"));
  assert.ok(!neutralCatalog.some((item) => item.id === "prod-m"));
});

run("catalog filtering rejects masculine recommendations for feminine preference", () => {
  const feminineCatalog = filterCatalogForRecommendation(sampleCatalog as any, buildOnboarding("feminine"));

  assert.ok(feminineCatalog.some((item) => item.id === "prod-f"));
  assert.ok(feminineCatalog.some((item) => item.id === "prod-n"));
  assert.ok(!feminineCatalog.some((item) => item.id === "prod-m"));
});

run("profile direction conflict validator blocks real feminine cues in masculine profiles", () => {
  const wedges = sampleCatalog.find((item) => item.id === "prod-wedges");
  const handbag = sampleCatalog.find((item) => item.id === "prod-handbag");

  const wedgesConflict = validateProfileDirectionConflict(wedges as any, "masculine");
  const handbagConflict = validateProfileDirectionConflict(handbag as any, "masculine");

  assert.equal(wedgesConflict.valid, false);
  assert.equal(wedgesConflict.code, RECOMMENDATION_REASON_CODES.PROFILE_DIRECTION_CONFLICT);
  assert.equal(handbagConflict.valid, false);
  assert.equal(handbagConflict.code, RECOMMENDATION_REASON_CODES.PROFILE_DIRECTION_CONFLICT);
});

run("masculine filtering and ranking exclude women wedges and handbags before promotion", () => {
  const masculineCatalog = filterCatalogForRecommendation(sampleCatalog as any, buildOnboarding("masculine"));

  assert.ok(!masculineCatalog.some((item) => item.id === "prod-wedges"));
  assert.ok(!masculineCatalog.some((item) => item.id === "prod-handbag"));

  const ranked = rankProducts(
    sampleCatalog as any,
    {
      org_id: "org-1",
      context: { user_style_direction: "masculine" },
    } as any,
  );

  const topProductIds = ranked.slice(0, 3).map((item) => item.product.id);
  assert.ok(topProductIds.includes("prod-m"));
  assert.ok(!topProductIds.includes("prod-wedges"));
  assert.ok(!topProductIds.includes("prod-handbag"));
  assert.ok(ranked.find((item) => item.product.id === "prod-wedges")?.reasons.includes(RECOMMENDATION_REASON_CODES.PROFILE_DIRECTION_CONFLICT));
  assert.ok(ranked.find((item) => item.product.id === "prod-handbag")?.reasons.includes(RECOMMENDATION_REASON_CODES.PROFILE_DIRECTION_CONFLICT));
});

run("neutral and no preference keep neutral language", () => {
  const neutralNarrative = buildVenusResultNarrative({ state: "hero", styleDirection: "neutral" });
  const noPreferenceNarrative = buildVenusResultNarrative({ state: "hero", styleDirection: "no_preference" });
  const neutralSurface = buildResultSurface(buildOnboarding("neutral"), null, null);

  assert.doesNotMatch(neutralNarrative.title, /femin/i);
  assert.doesNotMatch(noPreferenceNarrative.title, /femin/i);
  assert.match(neutralSurface.palette.family, /Base neutra/);
});

run("unisex items remain eligible for explicit style directions", () => {
  const masculineCatalog = filterCatalogForRecommendation(sampleCatalog as any, buildOnboarding("masculine"));
  const feminineCatalog = filterCatalogForRecommendation(sampleCatalog as any, buildOnboarding("feminine"));

  assert.ok(masculineCatalog.some((item) => item.id === "prod-n"));
  assert.ok(feminineCatalog.some((item) => item.id === "prod-n"));
});

run("missing compatible catalog match falls back safely", () => {
  const fallback = buildCatalogAwareFallbackResult(
    buildOnboarding("masculine"),
    sampleCatalog.filter((item) => item.id === "prod-f") as any,
  );

  assert.equal(fallback.recommendationFallbackCode, "CATALOG_NO_MATCH_FOR_STYLE_DIRECTION");
  assert.equal(fallback.looks.length, 0);
  assert.equal(fallback.curationFallback?.reason, RECOMMENDATION_REASON_CODES.INVALID_OUTFIT_COMPOSITION);
  assert.match(fallback.curationFallback?.message || "", /composição completa forte o suficiente/);
});

run("fallback result keeps conflicting feminine items out of hero and looks", () => {
  const fallback = buildCatalogAwareFallbackResult(
    buildOnboarding("masculine"),
    sampleCatalog.filter((item) => item.id === "prod-wedges" || item.id === "prod-handbag") as any,
  );

  assert.equal(fallback.recommendationFallbackCode, "CATALOG_NO_MATCH_FOR_STYLE_DIRECTION");
  assert.ok(
    fallback.looks.every((look) =>
      look.items.every((item) => item.product_id !== "prod-wedges" && item.product_id !== "prod-handbag"),
    ),
  );
});

run("normalized recommendation payload repairs mojibake in rendered strings", () => {
  const payload = {
    hero: {
      dominantStyle: "JÃ¡",
      subtitle: "direÃ§Ã£o clara",
      coverImageUrl: "",
    },
    palette: {
      family: "RevelaÃ§Ã£o",
      description: "Â base",
      contrast: "MÃ©dio",
      colors: [],
      evidence: {},
    },
    diagnostic: {
      currentPerception: "JÃ¡",
      desiredGoal: "direÃ§Ã£o",
      gapSolution: "RevelaÃ§Ã£o",
    },
    bodyVisagism: {
      shoulders: "JÃ¡",
      face: "direÃ§Ã£o",
      generalFit: "Â",
    },
    accessories: {
      scale: "JÃ¡",
      focalPoint: "direÃ§Ã£o",
      advice: "RevelaÃ§Ã£o",
    },
    looks: [
      {
        id: "1",
        name: "Look JÃ¡",
        intention: "direÃ§Ã£o",
        type: "HÃ­brido Seguro",
        items: [
          {
            id: "1",
            product_id: "prod-n",
            photoUrl: "",
            brand: "Marca JÃ¡",
            name: "Camisa JÃ¡",
            premiumTitle: "JÃ¡",
            impactLine: "direÃ§Ã£o",
            functionalBenefit: "RevelaÃ§Ã£o",
            socialEffect: "Â",
            contextOfUse: "JÃ¡",
          },
        ],
        accessories: ["JÃ¡"],
        explanation: "RevelaÃ§Ã£o",
        whenToWear: "Â",
      },
    ],
    toAvoid: ["JÃ¡"],
  } as any;

  const result = normalizeOpenAIRecommendationPayload(payload, buildOnboarding("masculine"), sampleCatalog.filter((item) => item.id === "prod-n") as any);
  const rendered = [
    result.hero.dominantStyle,
    result.hero.subtitle,
    result.palette.family,
    result.diagnostic.currentPerception,
    result.diagnostic.desiredGoal,
    result.looks[0]?.name,
    result.looks[0]?.items[0]?.premiumTitle,
    result.looks[0]?.items[0]?.impactLine,
    result.looks[0]?.explanation,
  ].join(" ");

  assert.ok(!detectMojibake(rendered));
  assert.doesNotMatch(rendered, /JÃ|direÃ|RevelaÃ|Â|�/);
});

run("recommendation ranking uses consultation profile for restrictions and perception", () => {
  const ranked = rankProducts(
    [
      {
        id: "clean",
        source_type: "manual",
        source_id: "1",
        title: "Camisa clean",
        description: "Peça limpa e elegante para trabalho",
        image_url: "",
        price: 399,
        currency: "BRL",
        colors: ["Branco"],
        sizes: ["M"],
        category: "Camisas",
        style_tags: ["clean", "discreto"],
        availability: "available",
        product_url: "",
        raw_metadata: { style_direction: "neutral", occasion_tags: ["trabalho"] },
      },
      {
        id: "noisy",
        source_type: "manual",
        source_id: "2",
        title: "Blusa transparente statement",
        description: "Peça mais ousada e com transparência",
        image_url: "",
        price: 499,
        currency: "BRL",
        colors: ["Amarelo"],
        sizes: ["M"],
        category: "Blusas",
        style_tags: ["statement", "ousado"],
        availability: "available",
        product_url: "",
        raw_metadata: { style_direction: "feminine", occasion_tags: ["evento"] },
      },
    ] as any,
    {
      org_id: "org-1",
      context: {
        user_style_direction: "neutral",
        user_desired_perception: "Discrição sofisticada",
        user_occasion: "trabalho",
        user_boldness: "low",
        user_restrictions: ["transparência"],
        user_preferred_colors: ["Branco"],
        user_avoid_colors: ["Amarelo"],
        user_body_focus: "Rosto",
        user_aesthetic_vibe: "clean",
        user_confidence_source: "conversation",
      },
    } as any,
  );

  assert.equal(ranked[0].product.id, "clean");
  assert.ok(ranked[0].reasons.some((reason) => /percep|ocasi|segura/i.test(reason)));
});

run("result audit includes the requested report sections", () => {
  const onboarding = buildOnboarding("masculine");
  const surface = buildResultSurface(onboarding, null, {
    looks: [
      {
        id: "complete-authority-look",
        product_id: "complete-authority-look",
        name: "Look completo de presenca",
        intention: "autoridade social",
        type: "Hibrido Seguro",
        items: [
          {
            id: "shirt",
            product_id: "shirt",
            name: "Camisa azul",
            premiumTitle: "Camisa azul",
            category: "Camisas",
          },
          {
            id: "trouser",
            product_id: "trouser",
            name: "Calca reta",
            premiumTitle: "Calca reta",
            category: "Calcas",
          },
        ],
        accessories: [],
        explanation: "Composicao completa para presenca firme.",
        whenToWear: "Reunioes e eventos sociais.",
      },
    ],
  });
  const audit = buildVenusStylistAudit({
    surface,
    tryOnQuality: {
      state: "hero",
      reason: "ok",
      badgeLabel: "Hero",
      score: 100,
      reasons: [],
      showBeforeAfter: true,
      showWhatsappCta: true,
      structural: { score: 100, reasons: [] },
      visual: { score: 100, reasons: [] },
    } as any,
    onboardingData: onboarding,
  });

  const reportTitles = audit.report.sections.map((section) => section.eyebrow);

  assert.ok(reportTitles.includes("Essência de estilo"));
  assert.ok(reportTitles.includes("Leitura visual"));
  assert.ok(reportTitles.includes("Cores base / acentos / cautela"));
  assert.ok(reportTitles.includes("O que valorizar"));
  assert.ok(reportTitles.includes("O que evitar"));
  assert.ok(reportTitles.includes("Curadoria da loja"));
  assert.ok(reportTitles.includes("Próximo look recomendado"));
});

run("share card uses premium neutral copy instead of soft power feminino for non-feminine preferences", () => {
  const surface = buildResultSurface(buildOnboarding("masculine"), null, null);
  const model = buildShareableLookCardModel({
    surface,
    look: surface.looks[0],
    looks: surface.looks,
    storeHandle: "maison-elite",
  });

  assert.doesNotMatch(model.styleName, /soft power feminino/i);
  assert.match(model.styleName, /Presença urbana|Look de presença|Casual de impacto|Minimalismo marcante|Força visual limpa/);
  assert.match(model.brandNote, /@maisonelite/);
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

run("detectMojibake detects mojibake strings and passes clean text", () => {
  assert.ok(detectMojibake("JÃ¡ estava"), "Ã¡ is mojibake for á");
  assert.ok(detectMojibake("direÃ§Ã£o clara"), "multiple mojibake sequences");
  assert.ok(!detectMojibake("Já estava"), "clean Portuguese passes");
  assert.ok(!detectMojibake("direção"), "clean diacritics pass");
  assert.ok(!detectMojibake("Plain ASCII text"), "ASCII passes");
});

run("detectMojibake also flags lone encoding artifacts and replacement chars", () => {
  assert.ok(detectMojibake("JÃ"), "dangling accent artifact");
  assert.ok(detectMojibake("Â"), "lone Â artifact");
  assert.ok(detectMojibake("�"), "replacement character artifact");
});

run("hero role gate rejects accessories as look principal", () => {
  const accessoryProduct = {
    ...sampleCatalog[0],
    id: "prod-accessory",
    name: "Bolsa de couro",
    category: "Acessórios",
    type: "Acessório",
    style_direction: "neutral" as const,
    tags: ["accessory"],
  };

  const result = validateHeroRole(accessoryProduct as any);
  assert.equal(result.valid, false);
  assert.equal(result.code, RECOMMENDATION_REASON_CODES.INVALID_HERO_SLOT);

  const shirtResult = validateHeroRole(sampleCatalog[0] as any);
  assert.equal(shirtResult.valid, true);
});

run("outfit composition gate rejects two shoes in a look", () => {
  const shoe1 = { ...sampleCatalog[0], id: "shoe-1", name: "Tênis branco", category: "Calçados", type: "Tênis", tags: ["shoes"] };
  const shoe2 = { ...sampleCatalog[0], id: "shoe-2", name: "Oxford preto", category: "Calçados", type: "Sapato", tags: ["shoes"] };

  const result = validateOutfitComposition([shoe1, shoe2] as any);
  assert.equal(result.valid, false);
  assert.equal(result.code, RECOMMENDATION_REASON_CODES.INVALID_OUTFIT_COMPOSITION);
});

run("same-slot conflict gate rejects two tops in a look", () => {
  const top1 = { ...sampleCatalog[0], id: "top-1", name: "Camisa azul", tags: ["top"] };
  const top2 = { ...sampleCatalog[0], id: "top-2", name: "Camiseta branca", tags: ["top"] };

  const result = validateOutfitComposition([top1, top2] as any);
  assert.equal(result.valid, false);
  assert.equal(result.code, RECOMMENDATION_REASON_CODES.SAME_SLOT_CONFLICT);
});

run("outfit composition allows valid top+bottom combination", () => {
  const top = { ...sampleCatalog[0], id: "valid-top", name: "Camisa estruturada", tags: ["top"] };
  const bottom = { ...sampleCatalog[0], id: "valid-bottom", name: "Calça slim", tags: ["bottom"] };

  const result = validateOutfitComposition([top, bottom] as any);
  assert.equal(result.valid, true);
});

run("copy guard emits curadoria assistida for invalid composition", () => {
  const allShoes = sampleCatalog.map((item) => ({ ...item, tags: ["shoes"] }));

  const fallback = buildCatalogAwareFallbackResult(buildOnboarding("masculine"), allShoes as any);

  assert.equal(fallback.looks.length, 0);
  assert.match(fallback.curationFallback?.message || "", /composição completa forte o suficiente/);
  assert.doesNotMatch(fallback.curationFallback?.message || "", /INVALID_OUTFIT_COMPOSITION|SAME_SLOT_CONFLICT|INVALID_HERO_SLOT/);
});

run("technical reason codes stay out of rendered result UI copy", () => {
  const surface = buildResultSurface(buildOnboarding("masculine"), null, {
    looks: [
      {
        id: "invalid",
        product_id: "shoe-1",
        name: "INVALID_OUTFIT_COMPOSITION",
        intention: "SAME_SLOT_CONFLICT",
        type: "Híbrido Seguro",
        items: [
          { id: "shoe-1", product_id: "shoe-1", name: "Flip Flops", category: "Flip Flops", photoUrl: "", brand: "Store" },
        ],
        accessories: ["INVALID_HERO_SLOT"],
        explanation: "INVALID_OUTFIT_COMPOSITION",
        whenToWear: "PROFILE_DIRECTION_CONFLICT",
      },
    ],
  } as any);
  const audit = buildVenusStylistAudit({
    surface,
    tryOnQuality: {
      state: "retry_required",
      reason: "INVALID_OUTFIT_COMPOSITION",
      badgeLabel: "Ajuste",
      score: 10,
      reasons: ["INVALID_OUTFIT_COMPOSITION"],
      showBeforeAfter: false,
      showWhatsappCta: true,
      structural: { score: 0, reasons: [] },
      visual: { score: 0, reasons: [] },
    } as any,
    onboardingData: buildOnboarding("masculine"),
  });

  const renderedCopy = JSON.stringify({
    helper: audit.tryOn.helper,
    report: audit.report.sections,
    buyNow: audit.buyNow,
    fallbackMessage: surface.curationFallback?.message,
  });

  assert.equal(surface.looks.length, 0);
  assert.doesNotMatch(renderedCopy, /INVALID_OUTFIT_COMPOSITION|SAME_SLOT_CONFLICT|INVALID_HERO_SLOT|PROFILE_DIRECTION_CONFLICT/);
  assert.match(renderedCopy, /composição completa forte o suficiente/);
});

run("context formality gate excludes flip flops from authority and social curation", () => {
  const top = { ...sampleCatalog[0], id: "formal-top", name: "Camisa social branca", category: "Camisas", type: "Camisa", tags: ["top"], style_tags: ["social"] };
  const bottom = { ...sampleCatalog[0], id: "formal-bottom", name: "Calça de alfaiataria", category: "Calças", type: "Calça", tags: ["bottom"], style_tags: ["alfaiataria"] };
  const flipFlop = { ...sampleCatalog[0], id: "flip-flop", name: "Beach Flip Flops", category: "Flip Flops", type: "Flip Flops", tags: ["shoes"], style_tags: ["beachwear", "casual"] };

  const result = buildCatalogAwareFallbackResult(buildOnboarding("masculine"), [flipFlop, top, bottom] as any);
  const rendered = JSON.stringify(result.looks);

  assert.ok(result.looks.length > 0);
  assert.doesNotMatch(rendered, /flip-flop|Beach Flip Flops|Flip Flops/i);
});

run("invalid and shoe-only looks are not promoted to cards or next look", () => {
  const shoeOnlyLook = {
    id: "shoe-only",
    product_id: "shoe-1",
    name: "Assinatura de comando",
    intention: "Autoridade",
    type: "Híbrido Seguro",
    items: [
      { id: "shoe-1", product_id: "shoe-1", name: "Flip Flops", category: "Flip Flops", photoUrl: "", brand: "Store" },
    ],
    accessories: [],
    explanation: "INVALID_OUTFIT_COMPOSITION",
    whenToWear: "social",
  } as any;

  const surface = buildResultSurface(buildOnboarding("masculine"), null, { looks: [shoeOnlyLook] });
  const audit = buildVenusStylistAudit({
    surface,
    tryOnQuality: {
      state: "hero",
      reason: "ok",
      badgeLabel: "Hero",
      score: 100,
      reasons: [],
      showBeforeAfter: true,
      showWhatsappCta: true,
      structural: { score: 100, reasons: [] },
      visual: { score: 100, reasons: [] },
    } as any,
    onboardingData: buildOnboarding("masculine"),
  });

  assert.equal(surface.looks.length, 0);
  assert.equal(buildAssistedCatalogProductCards([shoeOnlyLook]).length, 0);
  assert.equal(buildAssistedLookStripItems([shoeOnlyLook]).length, 0);
  assert.ok(!audit.report.sections.some((section) => section.eyebrow === "Próximo look recomendado"));
});

run("complete top and bottom look remains renderable", () => {
  const completeLook = {
    id: "complete",
    product_id: "top-1",
    name: "Base social completa",
    intention: "Autoridade",
    type: "Híbrido Seguro",
    items: [
      { id: "top-1", product_id: "top-1", name: "Camisa social", category: "Camisas", photoUrl: "", brand: "Store" },
      { id: "bottom-1", product_id: "bottom-1", name: "Calça de alfaiataria", category: "Calças", photoUrl: "", brand: "Store" },
    ],
    accessories: [],
    explanation: "Camisa e calça fecham uma base social real.",
    whenToWear: "trabalho",
  } as any;

  const surface = buildResultSurface(buildOnboarding("masculine"), null, { looks: [completeLook] });

  assert.equal(surface.looks.length, 1);
  assert.equal(buildAssistedLookStripItems(surface.looks).length, 1);
});

run("result page and surface keep mojibake out of visible header and top card copy", () => {
  const pageSource = fs.readFileSync(path.join(process.cwd(), "src/app/result/page.tsx"), "utf8");
  const surface = buildResultSurface(
    buildOnboarding("masculine"),
    {
      source: "ai",
      essenceLabel: "RevelaÃƒÂ§ÃƒÂ£o",
      essenceSummary: "JÃƒÂ¡ existe direÃƒÂ§ÃƒÂ£o",
      confidenceLabel: "MÃƒÂ©dio",
      keySignals: ["direÃƒÂ§ÃƒÂ£o"],
      lookNames: ["JÃƒÂ¡", "RevelaÃƒÂ§ÃƒÂ£o", "direÃƒÂ§ÃƒÂ£o"],
      toAvoid: ["Ã‚"],
      hero: { dominantStyle: "RevelaÃƒÂ§ÃƒÂ£o", subtitle: "JÃƒÂ¡ existe direÃƒÂ§ÃƒÂ£o", coverImageUrl: "" },
      paletteFamily: "RevelaÃƒÂ§ÃƒÂ£o",
      paletteDescription: "direÃƒÂ§ÃƒÂ£o",
      metal: "Prateado",
      contrast: "MÃƒÂ©dio",
      diagnostic: { currentPerception: "JÃƒÂ¡", desiredGoal: "direÃƒÂ§ÃƒÂ£o", gapSolution: "RevelaÃƒÂ§ÃƒÂ£o" },
      bodyVisagism: { shoulders: "JÃƒÂ¡", face: "direÃƒÂ§ÃƒÂ£o", generalFit: "RevelaÃƒÂ§ÃƒÂ£o" },
    } as any,
    null,
  );
  const rendered = JSON.stringify({
    pageSource,
    hero: surface.hero,
    headline: surface.headline,
    subheadline: surface.subheadline,
    hierarchy: surface.lookHierarchy,
  });

  assert.ok(!detectMojibake(rendered));
  assert.doesNotMatch(rendered, /RevelaÃ|JÃ|direÃ|Ãƒ|Ã‚|�/);
});

run("RECOMMENDATION_REASON_CODES has expected string values", () => {
  assert.equal(RECOMMENDATION_REASON_CODES.PROFILE_DIRECTION_CONFLICT, "PROFILE_DIRECTION_CONFLICT");
  assert.equal(RECOMMENDATION_REASON_CODES.INVALID_HERO_SLOT, "INVALID_HERO_SLOT");
  assert.equal(RECOMMENDATION_REASON_CODES.INVALID_OUTFIT_COMPOSITION, "INVALID_OUTFIT_COMPOSITION");
  assert.equal(RECOMMENDATION_REASON_CODES.SAME_SLOT_CONFLICT, "SAME_SLOT_CONFLICT");
  assert.equal(RECOMMENDATION_REASON_CODES.CONTEXT_FORMALITY_CONFLICT, "CONTEXT_FORMALITY_CONFLICT");
  assert.equal(RECOMMENDATION_REASON_CODES.ENCODING_GUARD_FAILED, "ENCODING_GUARD_FAILED");
});

console.log("\n--- Style direction tests passed ---");
