/**
 * Catalog enrichment helper.
 * Uses sparse product data plus a minimal visual read to build useful catalog metadata.
 */

import { LookItem } from "@/types/result";

type ProductRole = "anchor" | "statement" | "support" | "accessory" | "unknown";

export type VisualFrameMetrics = {
  brightness: number;
  saturation: number;
  contrast: number;
  texture: number;
};

export type VisualSignals = {
  dominantColor?: string;
  secondaryColor?: string;
  pattern: "liso" | "texturizado" | "estampado";
  vibe: "clean" | "casual" | "elegante" | "statement" | "versatile";
  contrast: "baixo" | "medio" | "alto";
  roleHint: ProductRole;
  confidence: number;
  summary: string;
};

type ProductSignals = {
  role: ProductRole;
  styleTags: string[];
  categoryTags: string[];
  fitTags: string[];
  colorTags: string[];
  targetProfile: string[];
  useCases: string[];
  premiumTitle: string;
  baseDescription: string;
  persuasiveDescription: string;
  impactLine: string;
  functionalBenefit: string;
  socialEffect: string;
  contextOfUse: string;
  authorityRationale: string;
  conversionCopy: string;
  sellerSuggestions: NonNullable<LookItem["sellerSuggestions"]>;
};

const COLOR_WORDS: Array<[string, string]> = [
  ["preto", "Preto"],
  ["black", "Preto"],
  ["branco", "Branco"],
  ["white", "Branco"],
  ["cinza", "Cinza"],
  ["gray", "Cinza"],
  ["grafite", "Grafite"],
  ["marinho", "Marinho"],
  ["navy", "Marinho"],
  ["azul", "Azul"],
  ["vermelho", "Vermelho"],
  ["vinho", "Vinho"],
  ["bege", "Bege"],
  ["off white", "Off White"],
  ["offwhite", "Off White"],
  ["marrom", "Marrom"],
  ["verde", "Verde"],
  ["dourado", "Dourado"],
  ["prata", "Prata"],
];

const ROLE_KEYWORDS: Array<[ProductRole, string[]]> = [
  ["anchor", ["blazer", "alfaiataria", "camisa", "shirt", "calca", "calça", "saia", "dress", "casaco"]],
  ["statement", ["statement", "impacto", "vibrante", "destaque", "bordado", "textura", "pattern"]],
  ["accessory", ["acessor", "bag", "cinto", "belt", "óculos", "oculos", "bracelete", "brinco", "colar", "anel"]],
  ["support", ["base", "neutro", "neutral", "basic", "tee", "tshirt", "t-shirt", "regata", "cardigan", "tricot", "jean", "jeans"]],
];

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function matchText(value: string): string {
  return stripDiacritics(normalizeText(value)).toLowerCase();
}

function compactText(value: unknown, fallback: string, maxLength: number): string {
  const text = normalizeText(value);
  if (!text) return fallback;
  if (text.length > maxLength) return `${text.slice(0, maxLength - 1).trimEnd()}…`;
  return text;
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function inferRole(title: string, category: string): ProductRole {
  const source = `${matchText(title)} ${matchText(category)}`;

  for (const [role, keywords] of ROLE_KEYWORDS) {
    if (keywords.some((keyword) => source.includes(keyword))) return role;
  }

  return "unknown";
}

function inferColors(title: string, category: string): string[] {
  const source = `${matchText(title)} ${matchText(category)}`;
  return uniq(
    COLOR_WORDS.filter(([keyword]) => source.includes(keyword)).map(([, label]) => label),
  ).slice(0, 3);
}

function inferStyleTags(role: ProductRole, title: string, category: string): string[] {
  const source = `${matchText(title)} ${matchText(category)}`;
  const tags = [
    role === "anchor" ? "Base forte" : null,
    role === "statement" ? "Ponto de impacto" : null,
    role === "accessory" ? "Complemento" : null,
    role === "support" ? "Uso diario" : null,
    source.includes("alfaiat") ? "Alfaiataria" : null,
    source.includes("casaco") || source.includes("blazer") ? "Estruturado" : null,
    source.includes("tricot") || source.includes("cardigan") ? "Camadas" : null,
    source.includes("jeans") || source.includes("denim") ? "Casual" : null,
    source.includes("couro") ? "Material forte" : null,
  ];

  return uniq(tags.filter((tag): tag is string => Boolean(tag))).slice(0, 4);
}

function inferCategoryTags(category: string, role: ProductRole): string[] {
  return uniq([
    compactText(category, "Produto", 32),
    role === "accessory" ? "Acessório" : role === "anchor" ? "Peça principal" : role === "support" ? "Base" : "Peça de apoio",
  ]);
}

function inferFitTags(role: ProductRole, title: string, category: string): string[] {
  const source = `${matchText(title)} ${matchText(category)}`;
  const tags = [
    role === "anchor" ? "Estrutura" : null,
    role === "support" ? "Conforto" : null,
    role === "accessory" ? "Finalização" : null,
    source.includes("slim") ? "Slim" : null,
    source.includes("oversized") ? "Oversized" : null,
    source.includes("relax") ? "Relaxado" : null,
    source.includes("reto") || source.includes("straight") ? "Reto" : null,
  ];

  return uniq(tags.filter((tag): tag is string => Boolean(tag))).slice(0, 3);
}

function inferTargetProfile(role: ProductRole, title: string, category: string, visual: VisualSignals | null): string[] {
  const source = `${matchText(title)} ${matchText(category)}`;

  if (role === "accessory") {
    return ["Busca acabamento", "Quer elevar o look", "Precisa de ponto de contraste"];
  }

  if (role === "anchor") {
    return ["Busca presença", "Valoriza base forte", "Precisa de peça central"];
  }

  if (role === "statement") {
    return ["Quer destaque", "Aceita mais intenção visual", "Busca impacto controlado"];
  }

  const profiles = [
    source.includes("work") || source.includes("office") || source.includes("blazer") ? "Uso profissional" : null,
    source.includes("casual") || source.includes("basic") ? "Uso cotidiano" : null,
    source.includes("event") || source.includes("party") ? "Ocasiões sociais" : null,
    visual?.vibe === "clean" ? "Prefere leitura limpa" : null,
    visual?.vibe === "statement" ? "Aceita mais presença visual" : null,
    "Busca praticidade",
  ];

  return uniq(profiles.filter((profile): profile is string => Boolean(profile))).slice(0, 3);
}

function inferUseCases(role: ProductRole, title: string, category: string, visual: VisualSignals | null): string[] {
  const source = `${matchText(title)} ${matchText(category)}`;

  if (role === "accessory") return ["Finalização de looks", "Ponto de apoio visual", "Complemento comercial"];
  if (role === "anchor") return ["Reuniões", "Rotina de trabalho", "Momentos de presença"];
  if (role === "statement") return ["Evento social", "Ocasião de destaque", "Look com intenção"];

  const useCases = [
    source.includes("work") || source.includes("office") ? "Uso profissional" : null,
    source.includes("casual") ? "Uso diário" : null,
    source.includes("event") ? "Ocasiões especiais" : null,
    visual?.vibe === "versatile" ? "Uso versátil" : null,
    "Rotina",
  ];

  return uniq(useCases.filter((item): item is string => Boolean(item))).slice(0, 3);
}

function buildTitle(name: string, category: string, role: ProductRole): string {
  if (name) return name;
  if (role === "accessory") return `Acessório de ${category.toLowerCase()}`;
  if (role === "anchor") return `Peça central de ${category.toLowerCase()}`;
  if (role === "statement") return `Peça de impacto de ${category.toLowerCase()}`;
  return `Peça de ${category.toLowerCase()}`;
}

function buildVisualTags(visual: VisualSignals | null): { styleTags: string[]; colorTags: string[]; extraTargetProfile: string[]; extraUseCases: string[] } {
  if (!visual || visual.confidence < 0.45) {
    return { styleTags: [], colorTags: [], extraTargetProfile: [], extraUseCases: [] };
  }

  const styleTags = uniq([
    visual.pattern === "liso" ? "Liso" : visual.pattern === "texturizado" ? "Texturizado" : "Estampado",
    visual.vibe === "clean" ? "Clean" : null,
    visual.vibe === "casual" ? "Casual" : null,
    visual.vibe === "elegante" ? "Elegante" : null,
    visual.vibe === "statement" ? "Statement" : null,
    visual.vibe === "versatile" ? "Versátil" : null,
    visual.contrast === "alto" ? "Alto contraste" : visual.contrast === "medio" ? "Contraste medio" : "Baixo contraste",
  ].filter((tag): tag is string => Boolean(tag)));

  const colorTags = uniq([visual.dominantColor, visual.secondaryColor].filter((value): value is string => Boolean(value)));

  const extraTargetProfile = uniq([
    visual.vibe === "clean" ? "Prefere leitura limpa" : null,
    visual.vibe === "statement" ? "Aceita mais presença visual" : null,
    visual.vibe === "casual" ? "Busca uso diário" : null,
    visual.vibe === "elegante" ? "Valoriza leitura refinada" : null,
    visual.vibe === "versatile" ? "Quer mais combinações" : null,
  ].filter((item): item is string => Boolean(item)));

  const extraUseCases = uniq([
    visual.vibe === "clean" ? "Combinação de base" : null,
    visual.vibe === "statement" ? "Look com destaque" : null,
    visual.vibe === "casual" ? "Uso diário" : null,
    visual.vibe === "elegante" ? "Contexto mais arrumado" : null,
    visual.vibe === "versatile" ? "Uso versátil" : null,
  ].filter((item): item is string => Boolean(item)));

  return { styleTags, colorTags, extraTargetProfile, extraUseCases };
}

function buildVisualCopy(visual: VisualSignals | null, role: ProductRole, title: string, category: string): {
  baseDescription: string;
  persuasiveDescription: string;
  impactLine: string;
  functionalBenefit: string;
  socialEffect: string;
  contextOfUse: string;
  authorityRationale: string;
  conversionCopy: string;
  sellerSuggestions: NonNullable<LookItem["sellerSuggestions"]>;
} {
  const roleLabel =
    role === "anchor" ? "peça central" :
    role === "statement" ? "peça de destaque" :
    role === "accessory" ? "acessório de apoio" :
    "peça de apoio";

  const conservative = !visual || visual.confidence < 0.45;

  const visualPhrase = visual
    ? `${visual.vibe} com leitura ${visual.pattern}${visual.dominantColor ? ` e cor dominante ${visual.dominantColor}` : ""}`
    : "leitura visual conservadora";

  return {
    baseDescription: conservative
      ? `${title} em ${category.toLowerCase()} descrito de forma simples para uso real e combinação fácil.`
      : `${title} em ${category.toLowerCase()} com leitura ${visualPhrase}.`,
    persuasiveDescription: conservative
      ? "A peça ajuda a compor o catálogo com clareza e sem exagero."
      : `A imagem sugere uma peça ${roleLabel} com sinais visuais úteis para combinar melhor no catálogo.`,
    impactLine: conservative
      ? "Ajuda o look a fazer sentido."
      : `Leitura ${visual?.vibe || "versátil"} com foco em ${visual?.dominantColor || "uso real"}.`,
    functionalBenefit: conservative
      ? role === "accessory"
        ? "Adiciona acabamento e melhora a leitura final do conjunto."
        : role === "anchor"
          ? "Entrega estrutura e dá direção visual ao look."
          : role === "statement"
            ? "Cria um ponto de destaque com controle."
            : "Ajuda a compor sem roubar a cena."
      : role === "accessory"
        ? "Fecha o conjunto com clareza visual."
        : role === "anchor"
          ? "Sustenta a composição e ajuda a organizar o look."
          : role === "statement"
            ? "Coloca um ponto de presença sem perder coerência."
            : "Facilita a combinação com outras peças.",
    socialEffect: conservative
      ? "Sustenta uma leitura coerente sem parecer forçada."
      : visual?.vibe === "statement"
        ? "Aumenta a percepção de intenção e diferenciação."
        : visual?.vibe === "elegante"
          ? "Passa leitura mais arrumada sem exagero."
          : "Deixa a composição mais intencional e fácil de ler.",
    contextOfUse: conservative
      ? role === "accessory"
        ? "Use como ponto final do look, sem disputar atenção com a peça principal."
        : role === "anchor"
          ? "Funciona como base da composição e sustenta a leitura do look."
          : role === "statement"
            ? "Use quando a peça precisa chamar atenção sem perder coerência."
            : "Use como apoio para completar o look com mais clareza."
      : visual?.vibe === "statement"
        ? "Use em momentos em que a peça precisa aparecer mais."
        : visual?.vibe === "clean"
          ? "Use quando a leitura precisa ficar limpa e fácil."
          : "Use quando a peça tiver que funcionar bem em mais de um contexto.",
    authorityRationale: conservative
      ? role === "accessory"
        ? "Classificada como apoio final porque o título e a categoria apontam para complemento."
        : role === "anchor"
          ? "Classificada como peça central porque o título e a categoria apontam para base forte."
          : role === "statement"
            ? "Classificada como peça de impacto porque o título e a categoria indicam presença visual."
            : "Classificada com cautela a partir do título e da categoria informados."
      : `A imagem sugere ${visual?.pattern || "uma leitura simples"} e ${visual?.dominantColor || "uma cor neutra"}, então a classificação foi feita com cautela.`,
    conversionCopy: conservative
      ? role === "accessory"
        ? "Use para fechar a proposta do look com mais intenção."
        : role === "anchor"
          ? "Use quando precisar de uma base que venda presença."
          : role === "statement"
            ? "Use quando a peça precisar se destacar sem perder uso real."
            : "Use quando quiser ampliar a combinação com segurança."
      : role === "accessory"
        ? "Use para terminar o look com melhor leitura."
        : role === "anchor"
          ? "Use como base forte para organizar a composição."
          : role === "statement"
            ? "Use quando quiser presença sem perder controle."
            : "Use quando quiser ampliar a combinação com segurança.",
    sellerSuggestions: {
      pairsBestWith:
        role === "accessory"
          ? ["Peças neutras", "Bases lisas", "Looks já montados"]
          : role === "anchor"
            ? ["Camisa limpa", "Calça de base", "Sapatos discretos"]
            : role === "statement"
              ? ["Base neutra", "Peças simples", "Acessórios discretos"]
              : ["Peças neutras", "Camadas leves", "Acessórios simples"],
      idealFor:
        role === "accessory"
          ? "Clientes que precisam terminar o look com melhor leitura."
          : role === "anchor"
            ? "Clientes que precisam de uma peça central para organizar a composição."
            : role === "statement"
              ? "Clientes que querem mais presença sem perder controle visual."
              : "Clientes que buscam praticidade e coerência no uso.",
      buyerProfiles:
        role === "accessory"
          ? ["Prático", "Orientado a uso real"]
          : role === "anchor"
            ? ["Busca presença", "Valoriza base forte"]
            : role === "statement"
              ? ["Quer destaque", "Aceita mais intenção visual"]
              : ["Busca praticidade", "Prefere leitura limpa"],
      bestContext:
        role === "accessory"
          ? "Venda complementar e finalização de conjunto"
          : role === "anchor"
            ? "Base comercial do look"
            : role === "statement"
              ? "Momento de destaque controlado"
              : "Uso cotidiano com baixo risco",
    },
  };
}

function buildImageRoles(images: string[]): Record<string, "front" | "back" | "side" | "detail" | "texture"> {
  const mapping: Record<string, "front" | "back" | "side" | "detail" | "texture"> = {};
  const roles: Array<"front" | "back" | "side" | "detail" | "texture"> = ["front", "back", "detail", "texture"];

  images.filter(Boolean).forEach((image, index) => {
    mapping[image] = roles[index] || "side";
  });

  return mapping;
}

export function deriveVisualSignalsFromMetrics(metrics: VisualFrameMetrics): VisualSignals {
  const brightness = Math.max(0, Math.min(1, metrics.brightness));
  const saturation = Math.max(0, Math.min(1, metrics.saturation));
  const contrast = Math.max(0, Math.min(1, metrics.contrast));
  const texture = Math.max(0, Math.min(1, metrics.texture));

  const dominantColor =
    brightness < 0.2 ? "Preto"
    : brightness > 0.82 && saturation < 0.2 ? "Branco"
    : saturation < 0.12 ? (brightness > 0.55 ? "Cinza" : "Grafite")
    : saturation > 0.38 && brightness < 0.45 ? "Vinho"
    : saturation > 0.38 && brightness >= 0.45 ? "Azul"
    : brightness > 0.7 ? "Bege"
    : "Marinho";

  const secondaryColor =
    contrast > 0.45 && brightness > 0.55 ? "Branco"
    : contrast > 0.45 && brightness <= 0.55 ? "Preto"
    : saturation < 0.14 ? "Cinza"
    : undefined;

  const pattern =
    saturation > 0.3 && (texture > 0.28 || contrast > 0.35) ? "estampado"
    : texture > 0.22 ? "texturizado"
    : "liso";

  const vibe =
    saturation > 0.35 || contrast > 0.5 ? "statement"
    : brightness > 0.74 && saturation < 0.16 ? "clean"
    : texture > 0.26 ? "elegante"
    : brightness < 0.35 ? "casual"
    : "versatile";

  const roleHint =
    pattern === "estampado" || vibe === "statement" ? "statement"
    : saturation < 0.14 && brightness > 0.5 ? "support"
    : brightness < 0.28 ? "anchor"
    : "unknown";

  const contrastLabel = contrast > 0.5 ? "alto" : contrast > 0.25 ? "medio" : "baixo";
  const confidence = Math.min(0.95, 0.35 + contrast * 0.3 + texture * 0.2 + saturation * 0.15);

  return {
    dominantColor,
    secondaryColor,
    pattern,
    vibe,
    contrast: contrastLabel,
    roleHint,
    confidence,
    summary: `${dominantColor}${secondaryColor ? ` com apoio ${secondaryColor}` : ""}, ${pattern}, ${vibe}, contraste ${contrastLabel}`,
  };
}

function isBrowserImageContext(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load image: ${source}`));
    image.src = source;
  });
}

function sampleVisualMetrics(image: HTMLImageElement): VisualFrameMetrics {
  const canvas = document.createElement("canvas");
  const size = 32;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return { brightness: 0.5, saturation: 0.1, contrast: 0.1, texture: 0.05 };
  }

  context.drawImage(image, 0, 0, size, size);
  const { data } = context.getImageData(0, 0, size, size);

  let totalBrightness = 0;
  let totalSaturation = 0;
  let totalContrast = 0;
  let totalTexture = 0;
  let pixelCount = 0;

  const luminances: number[] = [];

  for (let index = 0; index < data.length; index += 4) {
    const r = data[index] / 255;
    const g = data[index + 1] / 255;
    const b = data[index + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const brightness = (r + g + b) / 3;
    const saturation = max === 0 ? 0 : (max - min) / max;

    totalBrightness += brightness;
    totalSaturation += saturation;
    luminances.push(brightness);
    pixelCount += 1;
  }

  const meanBrightness = totalBrightness / Math.max(1, pixelCount);
  const meanSaturation = totalSaturation / Math.max(1, pixelCount);

  for (let y = 1; y < size; y += 1) {
    for (let x = 1; x < size; x += 1) {
      const current = luminances[y * size + x];
      const left = luminances[y * size + (x - 1)];
      const top = luminances[(y - 1) * size + x];
      totalContrast += Math.abs(current - left) + Math.abs(current - top);
      totalTexture += Math.abs(current - left) + Math.abs(current - top);
    }
  }

  const normalizedContrast = Math.min(1, totalContrast / (size * size * 0.75));
  const normalizedTexture = Math.min(1, totalTexture / (size * size * 0.75));

  return {
    brightness: meanBrightness,
    saturation: meanSaturation,
    contrast: normalizedContrast,
    texture: normalizedTexture,
  };
}

export async function extractVisualSignalsFromImages(images: string[]): Promise<VisualSignals | null> {
  if (!isBrowserImageContext() || images.length === 0) return null;

  for (const source of images) {
    try {
      const image = await loadImage(source);
      const metrics = sampleVisualMetrics(image);
      return deriveVisualSignalsFromMetrics(metrics);
    } catch {
      // Try the next image. If none work, fall back conservatively.
    }
  }

  return null;
}

export function buildCatalogEnrichmentSignals(
  name: string,
  category: string,
  visualSignals?: VisualSignals | null,
): ProductSignals {
  const cleanName = compactText(name, "Peça principal", 80);
  const cleanCategory = compactText(category, "Categoria informada", 48);
  const roleFromText = inferRole(cleanName, cleanCategory);
  const role = roleFromText === "unknown" && visualSignals?.roleHint ? visualSignals.roleHint : roleFromText;
  const title = buildTitle(cleanName, cleanCategory, role);
  const visual = visualSignals && visualSignals.confidence >= 0.45 ? visualSignals : null;
  const colorTags = uniq([
    ...inferColors(title, cleanCategory),
    ...(visual ? [visual.dominantColor, visual.secondaryColor].filter((value): value is string => Boolean(value)) : []),
  ]).slice(0, 3);
  const visualTags = buildVisualTags(visual);

  const styleTags = uniq([
    ...inferStyleTags(role, title, cleanCategory),
    ...visualTags.styleTags,
  ]).slice(0, 5);

  const categoryTags = inferCategoryTags(cleanCategory, role);
  const fitTags = inferFitTags(role, title, cleanCategory);
  const targetProfile = uniq([
    ...inferTargetProfile(role, title, cleanCategory, visual),
    ...visualTags.extraTargetProfile,
  ]).slice(0, 4);
  const useCases = uniq([
    ...inferUseCases(role, title, cleanCategory, visual),
    ...visualTags.extraUseCases,
  ]).slice(0, 4);
  const copy = buildVisualCopy(visual, role, title, cleanCategory);

  return {
    role,
    styleTags,
    categoryTags,
    fitTags,
    colorTags: colorTags.length > 0 ? colorTags : ["Neutro"],
    targetProfile,
    useCases,
    premiumTitle: title,
    baseDescription: copy.baseDescription,
    persuasiveDescription: copy.persuasiveDescription,
    impactLine: copy.impactLine,
    functionalBenefit: copy.functionalBenefit,
    socialEffect: copy.socialEffect,
    contextOfUse: copy.contextOfUse,
    authorityRationale: copy.authorityRationale,
    conversionCopy: copy.conversionCopy,
    sellerSuggestions: copy.sellerSuggestions,
  };
}

export async function enrichProductWithAI(
  images: string[],
  rawName?: string,
  rawCategory?: string
): Promise<Partial<LookItem>> {
  const signals = await extractVisualSignalsFromImages(images);
  const enriched = buildCatalogEnrichmentSignals(rawName || "Peça principal", rawCategory || "Categoria informada", signals);

  return {
    premiumTitle: enriched.premiumTitle,
    baseDescription: enriched.baseDescription,
    persuasiveDescription: enriched.persuasiveDescription,
    impactLine: enriched.impactLine,
    functionalBenefit: enriched.functionalBenefit,
    socialEffect: enriched.socialEffect,
    contextOfUse: enriched.contextOfUse,
    styleTags: enriched.styleTags,
    categoryTags: enriched.categoryTags,
    fitTags: enriched.fitTags,
    colorTags: enriched.colorTags,
    targetProfile: enriched.targetProfile,
    useCases: enriched.useCases,
    imageRoles: buildImageRoles(images),
    authorityRationale: enriched.authorityRationale,
    conversionCopy: enriched.conversionCopy,
    sellerSuggestions: enriched.sellerSuggestions,
  };
}
