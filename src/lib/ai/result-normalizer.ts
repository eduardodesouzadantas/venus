import type { OnboardingData } from "@/types/onboarding";
import type { LookData, LookItem, ResultPayload } from "@/types/result";
import type { Product } from "@/lib/catalog";
import { deriveCatalogStylistProfile } from "@/lib/catalog/stylist-profile";
import { deriveEssenceProfile } from "@/lib/result/essence";

type LookBlueprint = {
  name: string;
  type: LookData["type"];
  intention: string;
  whenToWear: string;
  keywords: string[];
};

type ProfileSignals = {
  goal: string;
  goalKey: string;
  styleDirection: "Masculina" | "Feminina" | "Neutra";
  satisfaction: number;
  mainPain: string;
  favoriteColors: string[];
  avoidColors: string[];
  skinTone: string;
  undertone: string;
  colorSeason: string;
  faceShape: string;
  idealNeckline: string;
  idealFit: string;
  idealFabrics: string[];
  avoidFabrics: string[];
  fit: string;
  faceLines: string;
  hairLength: string;
  metal: "Dourado" | "Prateado";
  contrast: string;
  keywords: string[];
};

type NormalizedProfile = ProfileSignals & {
  paletteFamily: string;
  paletteDescription: string;
  heroStyle: string;
  heroSubtitle: string;
  diagnostic: ResultPayload["diagnostic"];
  bodyVisagism: ResultPayload["bodyVisagism"];
  accessories: ResultPayload["accessories"];
  toAvoid: string[];
};

const LOOK_BLUEPRINTS: LookBlueprint[] = [
  {
    name: "Base de Confiança",
    type: "Híbrido Seguro",
    intention: "Entrada limpa com uso real e baixa fricção.",
    whenToWear: "Dias de rotina, reuniões leves e transição entre contextos.",
    keywords: ["base", "seguro", "neutro", "blazer", "camisa", "calca", "alfaiataria"],
  },
  {
    name: "Presença Clara",
    type: "Híbrido Premium",
    intention: "Mais presença sem perder coerência com o perfil.",
    whenToWear: "Reuniões decisivas, jantar importante ou momento de apresentação.",
    keywords: ["premium", "estrutura", "alfaiataria", "camisa", "casaco", "tres", "cashmere", "tricot"],
  },
  {
    name: "Contraste Direcionado",
    type: "Expansão Direcionada",
    intention: "Saída do óbvio com um ponto de impacto controlado.",
    whenToWear: "Eventos sociais, ocasiões de destaque e momentos de maior intenção.",
    keywords: ["statement", "impacto", "acessorio", "oculos", "forte", "contraste", "destaque"],
  },
];

const GOAL_KEYWORDS: Record<string, string[]> = {
  Autoridade: ["autoridade", "presença", "confiança", "estruturado"],
  Elegância: ["elegância", "sofisticado", "limpo", "refinado"],
  Atração: ["atração", "impacto", "destaque", "presença"],
  Criatividade: ["criatividade", "editorial", "vanguard", "contraste"],
  "Discrição sofisticada": ["discrição", "sofisticado", "minimalista", "neutro"],
};

const GOAL_FALLBACKS: Record<string, { style: string; paletteFamily: string; paletteDescription: string; contrast: string }> = {
  Autoridade: {
    style: "Alfaiataria Imponente",
    paletteFamily: "Inverno Frio de Autoridade",
    paletteDescription: "Contraste alto, linhas limpas e tons profundos para sustentar presença.",
    contrast: "Alto",
  },
  Elegância: {
    style: "Clássico Contemporâneo",
    paletteFamily: "Neutros Refinados",
    paletteDescription: "Cores equilibradas para uma leitura elegante e consistente.",
    contrast: "Médio Alto",
  },
  Atração: {
    style: "Presença Magnética",
    paletteFamily: "Contraste Editorial",
    paletteDescription: "Combinações de impacto para chamar atenção sem perder coerência.",
    contrast: "Alto",
  },
  Criatividade: {
    style: "Vanguarda Urbana",
    paletteFamily: "Editorial de Contraste",
    paletteDescription: "Cores mais ousadas, mas ainda legíveis e usáveis no mundo real.",
    contrast: "Alto",
  },
  "Discrição sofisticada": {
    style: "Minimalismo Preciso",
    paletteFamily: "Neutros Silenciosos",
    paletteDescription: "Baixo ruído visual, acabamento limpo e sofisticação discreta.",
    contrast: "Médio",
  },
};

const GENERIC_MARKETING_PATTERNS = [
  /transforma(ç|c)ão imediata/i,
  /luxo silencioso/i,
  /presen[çc]a inabal[áa]vel/i,
  /redefine sua presen[çc]a/i,
  /maestria/i,
  /dossi[êe] exclusivo/i,
  /potencial adormecido/i,
  /vire o jogo/i,
];

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
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
  if (GENERIC_MARKETING_PATTERNS.some((pattern) => pattern.test(text))) return fallback;
  if (text.length > maxLength) return `${text.slice(0, maxLength - 1).trimEnd()}…`;
  return text;
}

function pickGoalKey(goal: string): keyof typeof GOAL_FALLBACKS {
  const normalized = matchText(goal);
  if (normalized.includes("autor")) return "Autoridade";
  if (normalized.includes("criativ")) return "Criatividade";
  if (normalized.includes("atra")) return "Atração";
  if (normalized.includes("discri")) return "Discrição sofisticada";
  return "Elegância";
}

function normalizeMetal(value: string | undefined): "Dourado" | "Prateado" {
  const normalized = matchText(value || "");
  return normalized.includes("dour") ? "Dourado" : "Prateado";
}

function normalizeStyleDirection(value: string | undefined): "Masculina" | "Feminina" | "Neutra" {
  const normalized = matchText(value || "");
  if (normalized.includes("femin")) return "Feminina";
  if (normalized.includes("mascul")) return "Masculina";
  return "Neutra";
}

function isDirectionCompatible(
  productDirection: "Masculina" | "Feminina" | "Neutra",
  targetDirection: ProfileSignals["styleDirection"],
): boolean {
  if (targetDirection === "Masculina") {
    return productDirection === "Masculina" || productDirection === "Neutra";
  }

  if (targetDirection === "Feminina") {
    return productDirection === "Feminina" || productDirection === "Neutra";
  }

  return productDirection === "Neutra";
}

function buildPaletteColor(name: string, fallbackHex: string): { hex: string; name: string } {
  const normalized = matchText(name);
  if (!normalized) {
    return { hex: fallbackHex, name };
  }

  if (normalized.includes("preto") || normalized.includes("black")) return { hex: "#111827", name };
  if (normalized.includes("branco") || normalized.includes("off white") || normalized.includes("creme")) return { hex: "#F8FAFC", name };
  if (normalized.includes("grafite") || normalized.includes("chumbo") || normalized.includes("cinza")) return { hex: "#374151", name };
  if (normalized.includes("marinho") || normalized.includes("azul")) return { hex: "#1E3A8A", name };
  if (normalized.includes("vinho") || normalized.includes("bordo") || normalized.includes("bordô")) return { hex: "#7C2D12", name };
  if (normalized.includes("verde")) return { hex: "#14532D", name };
  if (normalized.includes("bege") || normalized.includes("areia") || normalized.includes("taupe")) return { hex: "#D6C6B8", name };
  if (normalized.includes("dour")) return { hex: "#C9A84C", name };
  if (normalized.includes("prat")) return { hex: "#94A3B8", name };
  if (normalized.includes("rosa")) return { hex: "#DB2777", name };
  if (normalized.includes("roxo")) return { hex: "#7C3AED", name };
  if (normalized.includes("laranja") || normalized.includes("coral")) return { hex: "#EA580C", name };
  return { hex: fallbackHex, name };
}

function buildOnboardingPalette(
  profile: Pick<
    ProfileSignals,
    "goal" | "goalKey" | "styleDirection" | "favoriteColors" | "avoidColors" | "metal" | "contrast" | "colorSeason" | "undertone" | "skinTone"
  >,
): ResultPayload["palette"] {
  const primaryName = profile.favoriteColors[0] || profile.goal;
  const supportName = profile.favoriteColors[1] || (profile.styleDirection === "Feminina" ? "off white" : "grafite");
  const accentName = profile.favoriteColors[2] || (profile.goalKey === "Autoridade" ? "marinho" : profile.goalKey === "Criatividade" ? "vinho profundo" : "grafite");
  const avoided = profile.avoidColors.length > 0 ? profile.avoidColors.join(", ") : "cores de ruído";
  const directionLabel = profile.styleDirection.toLowerCase();
  const metalLabel = profile.metal === "Dourado" ? "metais quentes" : "metais frios";
  const colorimetryLabel = [profile.colorSeason, profile.undertone, profile.skinTone].filter(Boolean).join(" • ");

  return {
    family: `${profile.goal} • linha ${directionLabel}`,
    description: `Favorece ${profile.favoriteColors.join(", ") || primaryName} e evita ${avoided}, sustentando ${profile.goal.toLowerCase()} com ${directionLabel} e ${metalLabel}${colorimetryLabel ? `, em sintonia com ${colorimetryLabel.toLowerCase()}` : ""}.`,
    metal: profile.metal,
    contrast: profile.contrast,
    colors: [
      buildPaletteColor(primaryName, "#1F2937"),
      buildPaletteColor(supportName, "#F8FAFC"),
      buildPaletteColor(accentName, "#7C2D12"),
    ],
  };
}

function getProfileSignals(userData: OnboardingData) {
  const goal = compactText(userData.intent.imageGoal, "Elegância", 40);
  const goalKey = pickGoalKey(goal);
  const styleDirection = normalizeStyleDirection(userData.intent.styleDirection || "");
  const fit = compactText(userData.body.fit, "Slim", 24);
  const faceLines = compactText(userData.body.faceLines, "Marcantes", 24);
  const hairLength = compactText(userData.body.hairLength, "Médio", 24);
  const mainPain = compactText(userData.intent.mainPain, "ruído visual", 40);
  const metal = normalizeMetal(userData.colors.metal || undefined);
  const favoriteColors = userData.colors.favoriteColors.map((value) => compactText(value, "", 40)).filter(Boolean);
  const avoidColors = userData.colors.avoidColors.map((value) => compactText(value, "", 40)).filter(Boolean);
  const colorimetry = userData.colorimetry || ({} as NonNullable<OnboardingData["colorimetry"]>);
  const skinTone = compactText(colorimetry.skinTone || userData.colors.skinTone, "", 24);
  const undertone = compactText(colorimetry.undertone || userData.colors.undertone, "", 24);
  const colorSeason = compactText(colorimetry.colorSeason || userData.colors.colorSeason, "", 48);
  const faceShape = compactText(colorimetry.faceShape || userData.colors.faceShape, "", 24);
  const idealNeckline = compactText(colorimetry.idealNeckline || userData.colors.idealNeckline, "", 64);
  const idealFit = compactText(colorimetry.idealFit || userData.colors.idealFit, "", 64);
  const idealFabrics = (colorimetry.idealFabrics?.length ? colorimetry.idealFabrics : userData.colors.idealFabrics)
    .map((value) => compactText(value, "", 40))
    .filter(Boolean);
  const avoidFabrics = (colorimetry.avoidFabrics?.length ? colorimetry.avoidFabrics : userData.colors.avoidFabrics)
    .map((value) => compactText(value, "", 40))
    .filter(Boolean);
  const satisfaction = Number.isFinite(userData.intent.satisfaction) ? userData.intent.satisfaction : 5;
  const contrast = GOAL_FALLBACKS[goalKey].contrast;
  const goalKeywords = GOAL_KEYWORDS[goalKey] || GOAL_KEYWORDS.Elegância;
  const environmentKeywords = userData.lifestyle.environments.map((value) => matchText(value));
  const colorKeywords = [...favoriteColors, ...avoidColors].map((value) => matchText(value));

  return {
    goal,
    goalKey,
    favoriteColors,
    avoidColors,
    fit,
    faceLines,
    hairLength,
    mainPain,
    metal,
    skinTone,
    undertone,
    colorSeason,
    faceShape,
    idealNeckline,
    idealFit,
    idealFabrics,
    avoidFabrics,
    satisfaction,
    contrast,
    keywords: [
      ...goalKeywords,
      matchText(styleDirection),
      matchText(fit),
      matchText(mainPain),
      ...environmentKeywords,
      ...colorKeywords,
      matchText(userData.lifestyle.purchaseDna),
      matchText(userData.lifestyle.purchaseBehavior),
      userData.scanner.facePhoto ? "face" : "",
      userData.scanner.bodyPhoto ? "body" : "",
      userData.scanner.skipped ? "skip" : "",
    ].filter(Boolean),
    styleDirection,
  };
}

function buildHeroStyle(goalKey: keyof typeof GOAL_FALLBACKS): string {
  return GOAL_FALLBACKS[goalKey].style;
}

function buildPaletteDescription(
  profile: Pick<ProfileSignals, "goalKey" | "metal" | "contrast" | "colorSeason" | "undertone" | "skinTone">,
): string {
  const metalLabel = profile.metal === "Dourado" ? "metais quentes" : "metais frios";
  const colorSeason = profile.colorSeason ? `A estação ${profile.colorSeason.toLowerCase()} ` : "";
  const undertone = profile.undertone ? `subtom ${profile.undertone.toLowerCase()} ` : "";
  const skinTone = profile.skinTone ? `pele ${profile.skinTone.toLowerCase()} ` : "";

  switch (profile.goalKey) {
    case "Autoridade":
      return `${colorSeason}${undertone}${skinTone}e contraste ${profile.contrast.toLowerCase()} sustentam presença; ${metalLabel} fecham a leitura sem ruído.`;
    case "Atração":
      return `${colorSeason}${undertone}${skinTone}pedem combinações com mais impacto e contraste ${profile.contrast.toLowerCase()} para reforçar presença sem parecer forçado.`;
    case "Criatividade":
      return `${colorSeason}${undertone}${skinTone}aceitam cores mais expressivas porque o contraste continua alto e o ${metalLabel} mantém a composição controlada.`;
    case "Discrição sofisticada":
      return `${colorSeason}${undertone}${skinTone}pedem baixo ruído, neutros silenciosos e ${metalLabel} discretos para deixar a imagem limpa e sofisticada.`;
    default:
      return `${colorSeason}${undertone}${skinTone}se beneficiam de neutros refinados e contraste ${profile.contrast.toLowerCase()} para manter leitura pessoal, limpa e fácil de usar.`;
  }
}

function buildPalette(profile: Pick<ProfileSignals, "goalKey" | "metal" | "contrast">) {
  return {
    family: GOAL_FALLBACKS[profile.goalKey].paletteFamily,
    description: buildPaletteDescription({
      goalKey: profile.goalKey,
      metal: profile.metal,
      contrast: profile.contrast,
      colorSeason: "",
      undertone: "",
      skinTone: "",
    }),
    metal: profile.metal,
    contrast: profile.contrast,
    colors: profile.goalKey === "Criatividade"
      ? [
          { hex: "#111827", name: "Azul Noturno" },
          { hex: "#F8FAFC", name: "Branco Óptico" },
          { hex: "#7C2D12", name: "Vinho Profundo" },
        ]
      : profile.goalKey === "Atração"
        ? [
            { hex: "#0F172A", name: "Marinho Intenso" },
            { hex: "#F5F5F4", name: "Off White" },
            { hex: "#3F3C3C", name: "Grafite" },
          ]
        : [
            { hex: "#111827", name: "Azul Marinho" },
            { hex: "#F8FAFC", name: "Branco Óptico" },
            { hex: "#374151", name: "Grafite" },
          ],
  };
}

function buildPersonalizedPalette(
  profile: Pick<
    ProfileSignals,
    "goal" | "goalKey" | "styleDirection" | "favoriteColors" | "avoidColors" | "metal" | "contrast" | "colorSeason" | "undertone" | "skinTone"
  >,
): ResultPayload["palette"] {
  return buildOnboardingPalette(profile);
}

function buildBodyVisagism(profile: Pick<ProfileSignals, "fit" | "faceLines" | "faceShape" | "idealNeckline" | "idealFit" | "idealFabrics" | "avoidFabrics">): ResultPayload["bodyVisagism"] {
  return {
    shoulders: profile.fit === "Oversized"
      ? "Se a peça vier ampla, vale equilibrar com base mais limpa para não perder linha."
      : "Estruture os ombros com peças que sustentem a presença sem pesar.",
    face: profile.idealNeckline
      ? `${profile.idealNeckline}. ${profile.faceShape ? `O rosto ${profile.faceShape.toLowerCase()} também pede leitura coerente.` : ""}`.trim()
      : profile.faceLines === "Marcantes"
        ? "Decotes em V e linhas angulares ajudam a equilibrar traços mais marcados."
        : "Linhas arredondadas e aberturas suaves deixam a leitura facial mais leve.",
    generalFit: profile.idealFit
      ? `${profile.idealFit}. ${profile.idealFabrics.length > 0 ? `Tecidos-chave: ${profile.idealFabrics.slice(0, 3).join(", ")}.` : ""}${profile.avoidFabrics.length > 0 ? ` Evite ${profile.avoidFabrics.slice(0, 2).join(", ")}.` : ""}`.trim()
      : `O caimento ${profile.fit} mantém conforto e leitura segura no uso real.`,
  };
}

function buildDiagnostic(
  profile: Pick<ProfileSignals, "goal" | "mainPain" | "fit" | "faceLines" | "faceShape" | "colorSeason" | "undertone" | "contrast">,
  selectedNames: string[],
): ResultPayload["diagnostic"] {
  const firstItem = selectedNames[0] || "o catálogo";
  return {
    currentPerception: `Seu perfil pede menos ruído e mais estrutura. Hoje o ponto sensível é ${profile.mainPain.toLowerCase()} e o caimento ${profile.fit.toLowerCase()}, com leitura de ${profile.faceLines.toLowerCase()} e contraste ${profile.contrast.toLowerCase()}.`,
    desiredGoal: `Projetar ${profile.goal.toLowerCase()} de um jeito mais limpo, pessoal e consistente, respeitando ${profile.colorSeason || "a sua estação"} e o subtom ${profile.undertone || "não informado"}.`,
    gapSolution: `Usar ${firstItem} como base e completar com peças do catálogo que respeitem seu rosto ${profile.faceLines.toLowerCase()}${profile.faceShape ? `, formato de rosto ${profile.faceShape.toLowerCase()}` : ""} e o caimento ${profile.fit.toLowerCase()}.`,
  };
}

function buildAccessories(profile: Pick<ProfileSignals, "goalKey" | "metal" | "goal">, accessoryNames: string[]): ResultPayload["accessories"] {
  const hint = accessoryNames.length > 0 ? accessoryNames.join(" • ") : profile.metal === "Dourado" ? "Metal quente em ponto único" : "Metal frio em ponto único";
  return {
    scale: profile.goalKey === "Atração" ? "Marcante" : profile.goalKey === "Criatividade" ? "Moderada" : "Minimalista",
    focalPoint: "Punhos e parte superior do tronco",
    advice: `Mantenha poucos pontos de atenção e deixe ${hint.toLowerCase()} fechar a composição sem competir com a peça principal.`,
  };
}

function buildHero(profile: Pick<ProfileSignals, "goalKey" | "goal" | "fit">): ResultPayload["hero"] {
  return {
    dominantStyle: buildHeroStyle(profile.goalKey),
    subtitle: `Seu perfil pede ${profile.goal.toLowerCase()} com leitura limpa, fit ${profile.fit.toLowerCase()} e uso real.`,
    coverImageUrl: "",
  };
}

function normalizeLookType(value: unknown, fallback: LookData["type"]): LookData["type"] {
  const text = normalizeText(value);
  if (text === "Híbrido Seguro" || text === "Híbrido Premium" || text === "Expansão Direcionada") {
    return text;
  }
  return fallback;
}

function looksGeneric(value: unknown): boolean {
  const text = normalizeText(value);
  return !text || GENERIC_MARKETING_PATTERNS.some((pattern) => pattern.test(text));
}

function scoreDirectionMatch(text: string, direction: ProfileSignals["styleDirection"]): number {
  const masculineSignals = ["mascul", "homem", "men", "male"];
  const feminineSignals = ["femin", "mulher", "women", "woman"];
  const neutralSignals = ["neutro", "unissex", "unisex", "genderless"];
  const hasMasculine = masculineSignals.some((keyword) => text.includes(keyword));
  const hasFeminine = feminineSignals.some((keyword) => text.includes(keyword));
  const hasNeutral = neutralSignals.some((keyword) => text.includes(keyword));

  if (direction === "Masculina") {
    if (hasMasculine) return 16;
    if (hasFeminine) return -28;
    return 0;
  }

  if (direction === "Feminina") {
    if (hasFeminine) return 16;
    if (hasMasculine) return -28;
    return 0;
  }

  if (hasNeutral) return 10;
  if (hasMasculine || hasFeminine) return -6;
  return 0;
}

function scoreProduct(product: Product, blueprint: LookBlueprint, profile: ProfileSignals): number {
  const stylist = deriveCatalogStylistProfile(product);
  const text = matchText([
    product.name,
    product.category,
    product.style,
    product.type,
    product.primary_color,
    product.price_range,
  ].filter(Boolean).join(" "));

  let score = 0;

  for (const keyword of blueprint.keywords) {
    if (text.includes(keyword)) score += 10;
  }

  for (const keyword of profile.keywords) {
    if (keyword && text.includes(keyword)) score += 4;
  }

  score += scoreDirectionMatch(text, profile.styleDirection);

  if (stylist.direction === profile.styleDirection) score += 8;
  if (stylist.direction !== "Neutra" && profile.styleDirection === "Neutra") score += 2;
  if (stylist.visualWeight === "Alta" && blueprint.type !== "Expansão Direcionada") score += 3;
  if (stylist.visualWeight === "Pontual" && blueprint.type === "Expansão Direcionada") score += 4;
  if (stylist.formality === "Alta" && blueprint.type === "Híbrido Premium") score += 4;
  if (stylist.formality === "Media" && blueprint.type === "Híbrido Seguro") score += 3;
  if (stylist.role === "anchor" && blueprint.type === "Híbrido Premium") score += 5;
  if (stylist.role === "statement" && blueprint.type === "Expansão Direcionada") score += 6;
  if (stylist.role === "accessory" && blueprint.type === "Expansão Direcionada") score += 5;
  if (stylist.role === "base" && blueprint.type === "Híbrido Seguro") score += 6;
  if (stylist.useCases.some((tag) => profile.keywords.some((keyword) => keyword && matchText(tag).includes(keyword)))) score += 4;
  if (stylist.bodyEffect && profile.goal && matchText(stylist.bodyEffect).includes(matchText(profile.goal))) score += 2;
  if (stylist.faceEffect && profile.goal && matchText(stylist.faceEffect).includes(matchText(profile.goal))) score += 1;

  if (product.type.toLowerCase().includes("acessor")) {
    score += blueprint.type === "Expansão Direcionada" ? 12 : 2;
  }

  if (product.type.toLowerCase().includes("roupa")) {
    score += blueprint.type === "Híbrido Premium" || blueprint.type === "Híbrido Seguro" ? 6 : 3;
  }

  if (profile.metal === "Prateado" && text.includes("prata")) score += 3;
  if (profile.metal === "Dourado" && (text.includes("ouro") || text.includes("dour"))) score += 3;

  if (blueprint.type === "Híbrido Premium" && (text.includes("alfaiataria") || text.includes("premium") || text.includes("cashmere") || text.includes("tricot"))) {
    score += 5;
  }

  if (blueprint.type === "Híbrido Seguro" && (text.includes("base") || text.includes("camisa") || text.includes("blazer") || text.includes("neutro"))) {
    score += 5;
  }

  if (blueprint.type === "Expansão Direcionada" && (text.includes("statement") || text.includes("oculos") || text.includes("acessor") || text.includes("impact"))) {
    score += 5;
  }

  return score;
}

function rankProductsForBlueprint(products: Product[], blueprint: LookBlueprint, profile: ProfileSignals): Product[] {
  return [...products].sort((a, b) => {
    const scoreDiff = scoreProduct(b, blueprint, profile) - scoreProduct(a, blueprint, profile);
    if (scoreDiff !== 0) return scoreDiff;
    return normalizeText(a.name).localeCompare(normalizeText(b.name), "pt-BR");
  });
}

function pickUniqueProducts(rankedProducts: Product[], usedIds: Set<string>, limit: number): Product[] {
  const selected: Product[] = [];

  for (const product of rankedProducts) {
    if (selected.length >= limit) break;
    if (usedIds.has(product.id)) continue;
    selected.push(product);
    usedIds.add(product.id);
  }

  if (selected.length < limit) {
    for (const product of rankedProducts) {
      if (selected.length >= limit) break;
      if (selected.some((entry) => entry.id === product.id)) continue;
      selected.push(product);
    }
  }

  return selected;
}

function buildProductLookItem(
  product: Product,
  blueprint: LookBlueprint,
  profile: Pick<ProfileSignals, "goal" | "goalKey" | "fit" | "metal" | "styleDirection">,
): LookItem {
  const stylist = deriveCatalogStylistProfile(product);
  const brand = normalizeText(product.style) || normalizeText(product.category) || "Catálogo real";
  const name = normalizeText(product.name) || "Peça real";
  const category = normalizeText(product.category);
  const roleLabel =
    blueprint.type === "Híbrido Seguro"
      ? "base"
      : blueprint.type === "Híbrido Premium"
        ? "presença"
        : "destaque";

  return {
    id: product.id,
    product_id: product.id,
    photoUrl: product.image_url || "",
    brand,
    name,
    role: stylist.role,
    direction: stylist.direction,
    visualWeight: stylist.visualWeight,
    formality: stylist.formality,
    bodyEffect: stylist.bodyEffect,
    faceEffect: stylist.faceEffect,
    category: category || undefined,
    price: product.price_range || undefined,
    premiumTitle: name,
    baseDescription: category ? `${category} do catálogo real, tratada como ${roleLabel}.` : "Peça real do catálogo.",
    impactLine: blueprint.type === "Híbrido Seguro"
      ? `${name} sustenta a base do look.`
      : blueprint.type === "Híbrido Premium"
        ? `${name} sobe a presença sem pesar.`
        : `${name} traz destaque com controle.`,
    functionalBenefit: blueprint.type === "Híbrido Seguro"
      ? "Entrega estrutura e simplifica a combinação."
      : blueprint.type === "Híbrido Premium"
        ? "Eleva a leitura sem perder coerência."
        : "Abre contraste sem perder uso real.",
    socialEffect: blueprint.type === "Híbrido Seguro"
      ? "Deixa a composição mais segura e fácil de vestir."
      : blueprint.type === "Híbrido Premium"
        ? "Passa mais presença sem exagero."
        : "Cria intenção visual na medida certa.",
    contextOfUse: blueprint.whenToWear,
    styleTags: uniq([
      ...stylist.styleTags,
      blueprint.type,
      profile.goalKey,
      profile.styleDirection,
      roleLabel,
    ]),
    categoryTags: uniq([
      ...(stylist.categoryTags || []),
      category ? category : null,
      roleLabel === "base" ? "Peça principal" : roleLabel === "presença" ? "Peça de apoio" : "Peça de destaque",
    ].filter((value): value is string => Boolean(value))),
    fitTags: uniq([
      ...(stylist.fitTags || []),
      profile.fit,
      roleLabel === "base" ? "Estrutura" : roleLabel === "presença" ? "Equilíbrio" : "Ponto de foco",
    ].filter((value): value is string => Boolean(value))),
    colorTags: uniq([
      ...(stylist.colorTags || []),
      profile.metal,
    ].filter((value): value is string => Boolean(value))),
    targetProfile: uniq([
      ...(stylist.targetProfile || []),
      profile.goal,
      profile.styleDirection,
      roleLabel,
    ].filter((value): value is string => Boolean(value))),
    useCases: uniq([
      ...(stylist.useCases || []),
      blueprint.whenToWear,
      roleLabel === "base" ? "Uso diário" : roleLabel === "presença" ? "Contexto de reunião" : "Momento de destaque",
    ].filter((value): value is string => Boolean(value))),
    authorityRationale: stylist.authorityRationale || `${name} foi escolhido por coerência com ${profile.goal.toLowerCase()} e ${profile.fit.toLowerCase()}, como peça de ${roleLabel}.`,
    conversionCopy: stylist.conversionCopy || `Peça real do catálogo para completar o look ${blueprint.name.toLowerCase()} sem perder coerência.`,
    persuasiveDescription: `${stylist.summary} ${stylist.authorityRationale}`,
    sellerSuggestions: {
      pairsBestWith: stylist.useCases.slice(0, 3),
      idealFor: stylist.summary,
      buyerProfiles: uniq([
        profile.goal,
        profile.styleDirection,
        roleLabel,
        stylist.direction,
      ]),
      bestContext: blueprint.whenToWear,
    },
    bundleCandidates: uniq([
      ...(stylist.categoryTags || []),
      ...(stylist.styleTags || []),
      ...(stylist.useCases || []),
    ]).slice(0, 5),
  };
}

function buildAccessoryHints(selectedProducts: Product[], blueprint: LookBlueprint, profile: Pick<ProfileSignals, "metal">): string[] {
  const accessoryProducts = selectedProducts.filter((product) => matchText(product.type).includes("acessor"));
  const realHints = accessoryProducts.map((product) => normalizeText(product.name)).filter(Boolean);

  if (realHints.length > 0) {
    return realHints.slice(0, 2);
  }

  const styleHint = profile.metal === "Dourado" ? "Metal quente em ponto único" : "Metal frio em ponto único";
  const fallbackHints = [...blueprint.keywords.slice(0, 2), styleHint];
  return Array.from(new Set(fallbackHints.filter(Boolean))).slice(0, 2);
}

function buildLookExplanation(
  blueprint: LookBlueprint,
  profile: Pick<ProfileSignals, "goal" | "fit" | "metal" | "faceShape" | "idealNeckline" | "idealFit" | "colorSeason" | "undertone">,
  selectedProducts: Product[],
  sourceExplanation?: unknown,
): string {
  const text = normalizeText(sourceExplanation);
  if (text && text.length <= 160 && !looksGeneric(text)) {
    return text;
  }

  const first = selectedProducts[0];
  const second = selectedProducts[1];
  const firstName = first ? normalizeText(first.name) : "a peça-base";
  const secondName = second ? normalizeText(second.name) : "a segunda peça";
  const secondClause = second ? ` e ${secondName}` : "";

  if (blueprint.type === "Híbrido Seguro") {
    return `${firstName}${secondClause} formam a base do look e sustentam ${profile.goal.toLowerCase()} com menos ruído e mais segurança${profile.idealNeckline ? `, respeitando ${profile.idealNeckline.toLowerCase()}` : ""}.`;
  }

  if (blueprint.type === "Híbrido Premium") {
    return `${firstName}${secondClause} elevam a presença sem perder coerência com ${profile.goal.toLowerCase()} e a leitura ${profile.colorSeason ? profile.colorSeason.toLowerCase() : "da sua paleta"}.`;
  }

  return `${firstName}${secondClause} abrem contraste com controle para ampliar repertório sem exagero, mantendo a linha ${profile.undertone ? profile.undertone.toLowerCase() : "neutra"} e a coerência do formato de rosto ${profile.faceShape ? profile.faceShape.toLowerCase() : "natural"}.`;
}

function buildLookIntention(
  blueprint: LookBlueprint,
  profile: Pick<ProfileSignals, "goal" | "fit" | "metal">,
  selectedProducts: Product[],
  sourceIntention?: unknown,
): string {
  const text = normalizeText(sourceIntention);
  if (text && text.length <= 120 && !looksGeneric(text)) {
    return text;
  }

  const first = selectedProducts[0];
  const primary = first ? normalizeText(first.name) : blueprint.name;
  if (blueprint.type === "Híbrido Seguro") {
    return `${primary} segura a base e deixa ${profile.goal.toLowerCase()} mais fácil de usar.`;
  }

  if (blueprint.type === "Híbrido Premium") {
    return `${primary} sobe a presença sem tirar a peça do uso real.`;
  }

  return `${primary} acrescenta contraste com controle para ampliar ${profile.goal.toLowerCase()}.`;
}

function buildFallbackLook(
  blueprint: LookBlueprint,
  profile: Pick<ProfileSignals, "goal" | "fit" | "mainPain" | "metal" | "goalKey">,
  index: number,
): LookData {
  const placeholderName = index === 0 ? "Peça-base da loja" : index === 1 ? "Peça de presença" : "Peça de contraste";
  return {
    id: String(index + 1),
    name: blueprint.name,
    intention: buildLookIntention(blueprint, profile, [], undefined),
    type: blueprint.type,
    items: [
      {
        id: `fallback-${index}-1`,
        product_id: "",
        photoUrl: "",
        brand: "Catálogo indisponível",
        name: placeholderName,
        premiumTitle: placeholderName,
        impactLine: "Peça base usada quando o catálogo real não está disponível.",
        functionalBenefit: "Mantém o fluxo funcional sem inventar produto.",
        socialEffect: "A leitura continua coerente com o perfil.",
        contextOfUse: blueprint.whenToWear,
      },
    ],
    accessories: [profile.metal === "Dourado" ? "Metal dourado" : "Metal prateado"],
    explanation: `${placeholderName} mantém o fluxo vivo até o catálogo real estar disponível.`,
    whenToWear: blueprint.whenToWear,
  };
}

function buildLookFromBlueprint(
  blueprint: LookBlueprint,
  profile: NormalizedProfile,
  products: Product[],
  usedIds: Set<string>,
  index: number,
  sourceLook?: Partial<LookData>,
): LookData {
  const ranked = rankProductsForBlueprint(products, blueprint, profile);
  const selectedProducts = pickUniqueProducts(ranked, usedIds, products.length > 1 ? 2 : 1);

  if (selectedProducts.length === 0) {
    return buildFallbackLook(blueprint, profile, index);
  }

  const sourceItems = Array.isArray(sourceLook?.items) ? sourceLook?.items : [];
  const items = selectedProducts.map((product, itemIndex) => {
    const sourceItem = sourceItems?.[itemIndex];
    const item = buildProductLookItem(product, blueprint, profile);
    if (sourceItem && !looksGeneric(sourceItem.premiumTitle)) {
      item.premiumTitle = compactText(sourceItem.premiumTitle, item.premiumTitle || item.name, 80);
    }
    if (sourceItem && !looksGeneric(sourceItem.impactLine)) {
      item.impactLine = compactText(sourceItem.impactLine, item.impactLine || "", 120);
    }
    return item;
  });

  return {
    id: String(index + 1),
    name: compactText(sourceLook?.name, blueprint.name, 60),
    intention: buildLookIntention(blueprint, profile, selectedProducts, sourceLook?.intention),
    type: normalizeLookType(sourceLook?.type, blueprint.type),
    items,
    accessories: buildAccessoryHints(selectedProducts, blueprint, profile),
    explanation: buildLookExplanation(blueprint, profile, selectedProducts, sourceLook?.explanation),
    whenToWear: compactText(sourceLook?.whenToWear, blueprint.whenToWear, 80),
    popularityRank: index + 1,
  };
}

function formatCatalogProductLine(product: Product): string {
  const stylist = deriveCatalogStylistProfile(product);
  const fields = [
    `id=${product.id}`,
    `name=${normalizeText(product.name)}`,
    `category=${normalizeText(product.category)}`,
    `style=${normalizeText(product.style) || "n/a"}`,
    `type=${normalizeText(product.type)}`,
    `color=${normalizeText(product.primary_color) || "n/a"}`,
    `role=${stylist.role}`,
    `direction=${stylist.direction}`,
    `formality=${stylist.formality}`,
    `visual_weight=${stylist.visualWeight}`,
    `body_effect=${stylist.bodyEffect}`,
    `face_effect=${stylist.faceEffect}`,
    `use_cases=${stylist.useCases.join(", ") || "n/a"}`,
    `summary=${stylist.summary}`,
    `authority=${stylist.authorityRationale}`,
    `conversion=${stylist.conversionCopy}`,
  ];
  return fields.join(" | ");
}

export function filterCatalogForRecommendation(catalog: Product[], userData: OnboardingData): Product[] {
  const profile = getProfileSignals(userData);
  return catalog.filter((product) => isDirectionCompatible(deriveCatalogStylistProfile(product).direction, profile.styleDirection));
}

export function summarizeOnboardingProfile(userData: OnboardingData): string {
  const profile = getProfileSignals(userData);
  const essence = deriveEssenceProfile(userData);
  const lines = [
    `essence: ${essence.label} | ${essence.summary}`,
    `style_direction: ${profile.styleDirection}`,
    `goal: ${profile.goal}`,
    `satisfaction: ${profile.satisfaction}/10`,
    `main_pain: ${profile.mainPain}`,
    `lifestyle: ${userData.lifestyle.environments.join(", ") || "sem ambiente informado"}`,
    `purchase_dna: ${userData.lifestyle.purchaseDna || "n/a"}`,
    `purchase_behavior: ${userData.lifestyle.purchaseBehavior || "n/a"}`,
    `colors: favorite=${userData.colors.favoriteColors.join(", ") || "n/a"} | avoid=${userData.colors.avoidColors.join(", ") || "n/a"} | metal=${profile.metal}`,
    `colorimetry: season=${profile.colorSeason || "n/a"} | skin=${profile.skinTone || "n/a"} | undertone=${profile.undertone || "n/a"} | contrast=${profile.contrast} | face_shape=${profile.faceShape || "n/a"}`,
    `body: fit=${profile.fit} | face=${profile.faceLines} | hair=${profile.hairLength} | neckline=${profile.idealNeckline || "n/a"} | ideal_fit=${profile.idealFit || "n/a"}`,
    `fabrics: ideal=${profile.idealFabrics.join(", ") || "n/a"} | avoid=${profile.avoidFabrics.join(", ") || "n/a"}`,
    `scanner: face=${userData.scanner.facePhoto ? "yes" : "no"} | body=${userData.scanner.bodyPhoto ? "yes" : "no"} | skipped=${userData.scanner.skipped ? "yes" : "no"}`,
  ];
  return lines.join("\n");
}

export function buildCatalogPromptSections(catalog: Product[], userData: OnboardingData): string {
  const filteredCatalog = filterCatalogForRecommendation(catalog, userData);
  if (filteredCatalog.length === 0) {
    return "CATALOGO REAL: nenhum produto disponível. Responda de forma conservadora e não invente marcas.";
  }

  const profile = getProfileSignals(userData);
  const sections = LOOK_BLUEPRINTS.map((blueprint) => {
    const ranked = rankProductsForBlueprint(filteredCatalog, blueprint, profile).slice(0, 6);
    const lines = ranked.map((product) => `- ${formatCatalogProductLine(product)}`);
    return [`LOOK ${blueprint.name} (${blueprint.type})`, ...lines].join("\n");
  });

  return sections.join("\n\n");
}

export function buildCatalogAwareFallbackResult(userData: OnboardingData, catalog: Product[]): ResultPayload {
  const profileSignals = getProfileSignals(userData);
  const essence = deriveEssenceProfile(userData);
  const filteredCatalog = filterCatalogForRecommendation(catalog, userData);
  const onboardingPalette = buildPersonalizedPalette(profileSignals);
  const profile: NormalizedProfile = {
    ...profileSignals,
    heroStyle: essence.label,
    heroSubtitle: essence.summary,
    paletteFamily: onboardingPalette.family,
    paletteDescription: onboardingPalette.description,
    diagnostic: {
      currentPerception: `Seu perfil pede menos ruído e mais estrutura. O ponto sensível hoje é ${profileSignals.mainPain.toLowerCase()}.`,
      desiredGoal: `Projetar ${profileSignals.goal.toLowerCase()} com mais clareza e coerência.`,
      gapSolution: `Usar o catálogo real como eixo e sustentar ${profileSignals.goal.toLowerCase()} com peças coerentes.`,
    },
    bodyVisagism: buildBodyVisagism(profileSignals),
    accessories: {
      scale: profileSignals.goalKey === "Atração" ? "Marcante" : profileSignals.goalKey === "Criatividade" ? "Moderada" : "Minimalista",
      focalPoint: "Punhos e parte superior do tronco",
      advice: `Mantenha poucos pontos de atenção e deixe ${profileSignals.metal === "Dourado" ? "metais quentes" : "metais frios"} sustentarem a leitura.`,
    },
    toAvoid: [
      "Excesso de informação no mesmo look.",
      "Contraste sem intenção clara.",
      "Peças sem relação com o catálogo real.",
    ],
  };

  const usedIds = new Set<string>();
  const looks = LOOK_BLUEPRINTS.map((blueprint, index) => buildLookFromBlueprint(blueprint, profile, filteredCatalog, usedIds, index));
  const selectedNames = looks.flatMap((look) => look.items.map((item) => item.name)).filter(Boolean);
  const accessoryNames = looks.flatMap((look) => look.accessories);

  return {
    hero: buildHero(profile),
    palette: buildPersonalizedPalette(profile),
    diagnostic: buildDiagnostic(profile, selectedNames),
    bodyVisagism: buildBodyVisagism(profile),
    accessories: buildAccessories(profile, accessoryNames),
    looks,
    toAvoid: [
      "Excesso de camadas sem função.",
      "Peças que disputam atenção ao mesmo tempo.",
      "Combinações que não existem no catálogo real.",
    ],
  };
}

export function normalizeOpenAIRecommendationPayload(
  payload: Partial<ResultPayload> | unknown,
  userData: OnboardingData,
  catalog: Product[],
): ResultPayload {
  if (!payload || typeof payload !== "object") {
    return buildCatalogAwareFallbackResult(userData, catalog);
  }

  const raw = payload as Partial<ResultPayload>;
  const profileSignals = getProfileSignals(userData);
  const essence = deriveEssenceProfile(userData);
  const filteredCatalog = filterCatalogForRecommendation(catalog, userData);
  const onboardingPalette = buildPersonalizedPalette(profileSignals);
  const profile: NormalizedProfile = {
    ...profileSignals,
    heroStyle: essence.label,
    heroSubtitle: essence.summary,
    paletteFamily: onboardingPalette.family,
    paletteDescription: onboardingPalette.description,
    diagnostic: {
      currentPerception: "",
      desiredGoal: "",
      gapSolution: "",
    },
    bodyVisagism: {
      shoulders: "",
      face: "",
      generalFit: "",
    },
    accessories: {
      scale: "Minimalista",
      focalPoint: "Punhos e parte superior do tronco",
      advice: "",
    },
    toAvoid: [],
  };

  const usedIds = new Set<string>();
  const looks = LOOK_BLUEPRINTS.map((blueprint, index) =>
    buildLookFromBlueprint(blueprint, profile, filteredCatalog, usedIds, index, raw.looks?.[index]),
  );
  const selectedNames = looks.flatMap((look) => look.items.map((item) => item.name)).filter(Boolean);
  const accessoryNames = looks.flatMap((look) => look.accessories);
  const palette = raw.palette || buildPersonalizedPalette(profile);

  return {
    hero: {
      dominantStyle: compactText(raw.hero?.dominantStyle, profile.heroStyle, 60),
      subtitle: compactText(raw.hero?.subtitle, profile.heroSubtitle, 120),
      coverImageUrl: normalizeText(raw.hero?.coverImageUrl),
    },
    palette: {
      family: compactText(palette.family, profile.paletteFamily, 60),
      description: compactText(palette.description, profile.paletteDescription, 160),
      colors: Array.isArray(palette.colors) && palette.colors.length > 0
        ? palette.colors.slice(0, 3).map((color) => ({
            hex: normalizeText(color.hex) || "#111827",
            name: compactText(color.name, "Cor estratégica", 40),
          }))
        : buildPersonalizedPalette(profile).colors,
      metal: profile.metal,
      contrast: compactText(palette.contrast, profile.contrast, 20),
    },
    diagnostic: {
      currentPerception: compactText(raw.diagnostic?.currentPerception, buildDiagnostic(profile, selectedNames).currentPerception, 160),
      desiredGoal: compactText(raw.diagnostic?.desiredGoal, buildDiagnostic(profile, selectedNames).desiredGoal, 160),
      gapSolution: compactText(raw.diagnostic?.gapSolution, buildDiagnostic(profile, selectedNames).gapSolution, 160),
    },
    bodyVisagism: {
      shoulders: compactText(raw.bodyVisagism?.shoulders, buildBodyVisagism(profile).shoulders, 120),
      face: compactText(raw.bodyVisagism?.face, buildBodyVisagism(profile).face, 120),
      generalFit: compactText(raw.bodyVisagism?.generalFit, buildBodyVisagism(profile).generalFit, 120),
    },
    accessories: {
      scale: compactText(raw.accessories?.scale, buildAccessories(profile, accessoryNames).scale, 30),
      focalPoint: compactText(raw.accessories?.focalPoint, buildAccessories(profile, accessoryNames).focalPoint, 60),
      advice: compactText(raw.accessories?.advice, buildAccessories(profile, accessoryNames).advice, 160),
    },
    looks,
    toAvoid: Array.isArray(raw.toAvoid) && raw.toAvoid.length > 0
      ? raw.toAvoid.slice(0, 3).map((item) => compactText(item, item, 120))
      : [
          "Excesso de camadas sem função.",
          "Contraste sem intenção clara.",
          "Peças sem relação com o catálogo real.",
        ],
  };
}
