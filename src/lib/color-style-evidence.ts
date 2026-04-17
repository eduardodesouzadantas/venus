import type { ColorimetryAnalysisData, OnboardingData } from "@/types/onboarding";
import { getStyleDirectionDisplayLabel, getStyleDirectionToneProfile, normalizeStyleDirectionPreference, type StyleDirectionPreference } from "@/lib/style-direction";

export type PaletteConfidence = "low" | "medium" | "high";

export type PaletteTier = "base" | "accent" | "caution";

export type PaletteColorEvidence = {
  hex: string;
  name: string;
  reason: string;
  tier: PaletteTier;
};

export type ColorStyleEvidence = {
  basePalette: PaletteColorEvidence[];
  accentPalette: PaletteColorEvidence[];
  avoidOrUseCarefully: PaletteColorEvidence[];
  confidence: PaletteConfidence;
  evidence: string;
};

type ColorStyleInput = {
  styleDirection?: unknown;
  favoriteColors?: unknown[];
  avoidColors?: unknown[];
  colorSeason?: unknown;
  undertone?: unknown;
  skinTone?: unknown;
  contrast?: unknown;
  confidence?: unknown;
  evidence?: unknown;
};

const STRONG_COLOR_PATTERNS = [
  /laranja/i,
  /amarelo/i,
  /neon/i,
  /pink/i,
  /rosa\s*choque/i,
  /vermelho\s*aberto/i,
  /coral/i,
  /magenta/i,
];

const SAFE_BASE_PATTERNS = [
  /preto/i,
  /grafite/i,
  /cinza/i,
  /chumbo/i,
  /marinho/i,
  /azul\s*escuro/i,
  /off\s*white/i,
  /branco/i,
  /creme/i,
  /bege/i,
  /areia/i,
  /taupe/i,
];

const ACCENT_PATTERNS = [
  /vinho/i,
  /bord[oô]/i,
  /verde\s*oliva/i,
  /oliva/i,
  /prat/i,
  /dour/i,
  /azul\s*profundo/i,
  /verde\s*escuro/i,
  /rosa\s*fechado/i,
];

const LIMITATION_PATTERNS = [
  /pouca\s*luz/i,
  /baixa\s*luz/i,
  /sombra/i,
  /óculos/i,
  /ocul/i,
  /rosto\s*parcial/i,
  /fundo\s*dominante/i,
  /baixa\s*resolução/i,
  /resolução\s*baixa/i,
  /low\s*light/i,
  /shadow/i,
  /glasses/i,
  /blur/i,
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

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function toDisplayName(value: string): string {
  const normalized = normalizeText(value);
  return normalized ? normalized.replace(/\b\w/g, (char) => char.toUpperCase()) : "";
}

function colorHexFromName(name: string): string {
  const text = matchText(name);
  if (!text) return "#374151";
  if (text.includes("preto") || text.includes("black")) return "#111827";
  if (text.includes("grafite") || text.includes("chumbo") || text.includes("cinza")) return "#374151";
  if (text.includes("marinho") || text.includes("azul escuro") || text.includes("azul profundo")) return "#1E3A8A";
  if (text.includes("off white") || text.includes("branco") || text.includes("creme")) return "#F8FAFC";
  if (text.includes("bege") || text.includes("areia") || text.includes("taupe")) return "#D6C6B8";
  if (text.includes("vinho") || text.includes("bord")) return "#7C2D12";
  if (text.includes("verde oliva") || text.includes("oliva")) return "#365314";
  if (text.includes("verde") && text.includes("escuro")) return "#14532D";
  if (text.includes("prat")) return "#94A3B8";
  if (text.includes("dour")) return "#C9A84C";
  if (text.includes("rosa")) return "#DB2777";
  if (text.includes("roxo")) return "#7C3AED";
  if (text.includes("laranja") || text.includes("coral")) return "#EA580C";
  if (text.includes("amarelo")) return "#FACC15";
  return "#374151";
}

function isStrongColor(name: string): boolean {
  const text = matchText(name);
  return STRONG_COLOR_PATTERNS.some((pattern) => pattern.test(text));
}

function isSafeBaseColor(name: string): boolean {
  const text = matchText(name);
  return SAFE_BASE_PATTERNS.some((pattern) => pattern.test(text));
}

function isAccentColor(name: string): boolean {
  const text = matchText(name);
  return ACCENT_PATTERNS.some((pattern) => pattern.test(text));
}

function pickColorList(primary: string[], fallback: string[], limit: number): string[] {
  return uniq([...primary, ...fallback]).filter(Boolean).slice(0, limit);
}

function buildBaseCandidates(input: ColorStyleInput, direction: StyleDirectionPreference): string[] {
  const safeFavorites = (input.favoriteColors || [])
    .map((value) => normalizeText(value))
    .filter((value) => value && isSafeBaseColor(value));

  const directionDefaults: Record<StyleDirectionPreference, string[]> = {
    Masculina: ["Preto", "Grafite", "Marinho", "Off white"],
    Feminina: ["Off white", "Grafite", "Marinho", "Bege"],
    Neutra: ["Preto", "Grafite", "Marinho", "Off white"],
    Streetwear: ["Preto", "Grafite", "Marinho", "Verde oliva fechado"],
    Casual: ["Grafite", "Marinho", "Bege", "Off white"],
    Social: ["Preto", "Marinho", "Grafite", "Off white"],
    "Sem preferência": ["Preto", "Grafite", "Marinho", "Off white"],
  };

  return pickColorList(safeFavorites, directionDefaults[direction], 4);
}

function buildAccentCandidates(input: ColorStyleInput, direction: StyleDirectionPreference, confidence: PaletteConfidence): string[] {
  const preferredAccents = (input.favoriteColors || [])
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .filter((value) => isAccentColor(value) || (!isStrongColor(value) && !isSafeBaseColor(value)));

  const strongFavorites = (input.favoriteColors || [])
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .filter((value) => isStrongColor(value));

  const directionDefaults: Record<StyleDirectionPreference, string[]> = {
    Masculina: ["Verde oliva fechado", "Vinho fechado", "Prata"],
    Feminina: ["Vinho fechado", "Prata", "Dourado suave"],
    Neutra: ["Prata", "Verde oliva fechado", "Vinho fechado"],
    Streetwear: ["Azul profundo", "Verde oliva fechado", "Vinho fechado"],
    Casual: ["Vinho fechado", "Verde oliva fechado", "Prata"],
    Social: ["Dourado", "Prata", "Vinho fechado"],
    "Sem preferência": ["Prata", "Verde oliva fechado", "Vinho fechado"],
  };

  const source = confidence === "high" ? [...preferredAccents, ...strongFavorites] : preferredAccents;
  return pickColorList(source, directionDefaults[direction], 3);
}

function buildCautionCandidates(input: ColorStyleInput): string[] {
  const avoidColors = (input.avoidColors || []).map((value) => normalizeText(value)).filter(Boolean);
  const strongFavorites = (input.favoriteColors || [])
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .filter((value) => isStrongColor(value));

  const defaults = ["Laranja vivo", "Amarelo aberto", "Neon", "Rosa choque", "Vermelho aberto"];
  return pickColorList([...avoidColors, ...strongFavorites], defaults, 4);
}

function inferConfidence(input: ColorStyleInput, direction: StyleDirectionPreference, hasStrongLimitationEvidence: boolean): PaletteConfidence {
  const declared = normalizeText(input.confidence).toLowerCase();
  const evidence = matchText(normalizeText(input.evidence));

  if (declared === "low") return "low";
  if (declared === "medium") return hasStrongLimitationEvidence ? "low" : "medium";
  if (declared === "high" && hasStrongLimitationEvidence) return "medium";

  if (hasStrongLimitationEvidence) return "low";

  const contrast = matchText(normalizeText(input.contrast));
  const colorSeason = normalizeText(input.colorSeason);
  const undertone = normalizeText(input.undertone);
  const skinTone = normalizeText(input.skinTone);
  const hasEvidenceTokens = Boolean(evidence || colorSeason || undertone || skinTone);
  const strongColorExposure = uniq([...(input.favoriteColors || []), ...(input.avoidColors || [])].map((value) => normalizeText(value)))
    .filter(Boolean)
    .some((value) => isStrongColor(value));

  let score = 0;
  if (contrast === "alto") score += 2;
  if (contrast === "médio") score += 1;
  if (hasEvidenceTokens) score += 1;
  if (strongColorExposure) score += 1;
  if (direction === "Sem preferência" || direction === "Neutra") score -= 1;
  if (contrast === "baixo") score -= 2;

  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function buildEvidenceText(
  input: ColorStyleInput,
  direction: StyleDirectionPreference,
  confidence: PaletteConfidence,
  basePalette: string[],
  accentPalette: string[],
  cautionPalette: string[],
): string {
  const toneProfile = getStyleDirectionToneProfile(direction);
  const colorSeason = normalizeText(input.colorSeason);
  const undertone = normalizeText(input.undertone);
  const skinTone = normalizeText(input.skinTone);
  const contrast = normalizeText(input.contrast).toLowerCase();

  const note =
    confidence === "low"
      ? "Leitura preliminar baseada nesta foto. Uma luz frontal neutra melhora a precisão."
      : confidence === "medium"
        ? "Leitura preliminar com boa direção, mas ainda com margem de refinamento."
        : "Leitura de confiança alta com evidência visual consistente.";

  const detailParts = [
    colorSeason ? `estação ${colorSeason.toLowerCase()}` : "",
    undertone ? `subtom ${undertone.toLowerCase()}` : "",
    skinTone ? `pele ${skinTone.toLowerCase()}` : "",
    contrast ? `contraste ${contrast}` : "",
  ].filter(Boolean);

  const baseText = basePalette.slice(0, 3).join(", ");
  const accentText = accentPalette.slice(0, 3).join(", ");
  const cautionText = cautionPalette.slice(0, 3).join(", ");

  const directionText = getStyleDirectionDisplayLabel(direction).toLowerCase();
  const intro = detailParts.length > 0 ? `A foto sugere ${detailParts.join(" • ")}, com direção ${directionText}.` : `A foto sugere uma leitura ${directionText}.`;
  const paletteText = [
    baseText ? `Base segura em ${baseText}.` : "",
    accentText ? `Acentos controlados em ${accentText}.` : "",
    cautionText ? `Usar com cautela: ${cautionText}.` : "",
  ].filter(Boolean).join(" ");

  return `${note} ${intro} ${paletteText}`.trim();
}

function toPaletteEntry(name: string, tier: PaletteTier, reason: string): PaletteColorEvidence {
  return {
    hex: colorHexFromName(name),
    name: toDisplayName(name),
    reason,
    tier,
  };
}

export function buildColorStyleEvidence(input: ColorStyleInput): ColorStyleEvidence {
  const direction = normalizeStyleDirectionPreference(input.styleDirection || "Sem preferência");
  const hasStrongLimitationEvidence = LIMITATION_PATTERNS.some((pattern) => pattern.test(matchText(normalizeText(input.evidence))));
  const confidence = inferConfidence(input, direction, hasStrongLimitationEvidence);

  const baseNames = buildBaseCandidates(input, direction);
  const accentNames = buildAccentCandidates(input, direction, confidence);
  const cautionNames = buildCautionCandidates(input);

  const basePalette = baseNames.map((name) =>
    toPaletteEntry(
      name,
      "base",
      confidence === "high"
        ? `Cor central confirmada na direção ${getStyleDirectionDisplayLabel(direction).toLowerCase()}.`
        : "Base mais segura para sustentar a leitura sem exagero.",
    ));

  const accentPalette = accentNames.map((name) =>
    toPaletteEntry(
      name,
      "accent",
      isStrongColor(name)
        ? "Ponto de cor controlado; entra como acento, não como base."
        : "Acento discreto para variar a leitura sem romper o conjunto.",
    ));

  const avoidOrUseCarefully = cautionNames.map((name) =>
    toPaletteEntry(
      name,
      "caution",
      isStrongColor(name)
        ? "Cor forte sem evidência suficiente para virar base."
        : "Usar com cautela porque pode desalinhar a leitura da foto.",
    ));

  return {
    basePalette,
    accentPalette,
    avoidOrUseCarefully,
    confidence,
    evidence: buildEvidenceText(input, direction, confidence, baseNames, accentNames, cautionNames),
  };
}

export function flattenColorStyleEvidence(evidence: ColorStyleEvidence): Array<{ hex: string; name: string }> {
  return [...evidence.basePalette, ...evidence.accentPalette].slice(0, 5).map((entry) => ({
    hex: entry.hex,
    name: entry.name,
  }));
}

export function buildColorStyleEvidenceInputFromOnboarding(data: OnboardingData): ColorStyleInput {
  const intent = data.intent || ({} as OnboardingData["intent"]);
  const conversation = data.conversation || ({} as OnboardingData["conversation"]);
  const colors = data.colors || ({} as OnboardingData["colors"]);
  const colorimetry = (data.colorimetry || {}) as Partial<ColorimetryAnalysisData>;
  return {
    styleDirection: intent.styleDirection || conversation.styleDirection || "Sem preferência",
    favoriteColors: colorimetry.basePalette?.length ? colorimetry.basePalette : colors.favoriteColors,
    avoidColors: colorimetry.avoidOrUseCarefully?.length ? colorimetry.avoidOrUseCarefully : colors.avoidColors,
    colorSeason: colorimetry.colorSeason || colors.colorSeason,
    undertone: colorimetry.undertone || colors.undertone,
    skinTone: colorimetry.skinTone || colors.skinTone,
    contrast: colorimetry.contrast || colors.contrast,
    confidence: colorimetry.confidence || "",
    evidence: colorimetry.evidence || colorimetry.justification || "",
  };
}
