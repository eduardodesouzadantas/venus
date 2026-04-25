export const STYLE_DIRECTION_VALUES = [
  "masculine",
  "feminine",
  "neutral",
  "streetwear",
  "casual",
  "social",
  "no_preference",
] as const;

export type StyleDirectionPreference = (typeof STYLE_DIRECTION_VALUES)[number];

export type StyleDirectionChoice = {
  value: StyleDirectionPreference;
  label: string;
};

export const STYLE_DIRECTION_CHOICES: StyleDirectionChoice[] = [
  { value: "masculine", label: "Masculina" },
  { value: "feminine", label: "Feminina" },
  { value: "neutral", label: "Neutra" },
  { value: "streetwear", label: "Streetwear" },
  { value: "casual", label: "Casual" },
  { value: "social", label: "Social" },
  { value: "no_preference", label: "Sem preferência" },
];

const STYLE_DIRECTION_LABELS: Record<StyleDirectionPreference, string> = {
  masculine: "Masculina",
  feminine: "Feminina",
  neutral: "Neutra",
  streetwear: "Streetwear",
  casual: "Casual",
  social: "Social",
  no_preference: "Sem preferência",
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function containsAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

function hasAnySignal(text: string, signals: string[]) {
  const tokens = text.split(/[^a-z0-9]+/g).filter(Boolean);
  return signals.some((signal) => {
    const normalizedSignal = stripDiacritics(signal).toLowerCase();
    if (!normalizedSignal) return false;
    if (normalizedSignal.includes(" ")) {
      return text.includes(normalizedSignal);
    }
    return tokens.includes(normalizedSignal);
  });
}

const MASCULINE_CONFLICT_SIGNALS = [
  "women",
  "womens",
  "woman",
  "female",
  "feminine",
  "feminino",
  "ladies",
  "girl",
  "girls",
  "wedge",
  "wedges",
  "handbag",
  "purse",
  "clutch",
  "pump",
  "heel",
  "heels",
];

const FEMININE_CONFLICT_SIGNALS = [
  "men",
  "mens",
  "man",
  "male",
  "masculine",
  "masculino",
  "brogue",
  "oxford",
  "loafer",
  "tie",
  "ties",
];

export function getStyleDirectionConflictCode(
  targetDirection: unknown,
  productDirection: unknown,
  productSignals: string[] = [],
): "PROFILE_DIRECTION_CONFLICT" | null {
  const preference = normalizeStyleDirectionPreference(targetDirection);
  const direction = normalizeStyleDirectionPreference(productDirection);
  const signalText = stripDiacritics(productSignals.join(" ").toLowerCase());

  if (preference === "masculine") {
    if (direction === "feminine" || hasAnySignal(signalText, MASCULINE_CONFLICT_SIGNALS)) {
      return "PROFILE_DIRECTION_CONFLICT";
    }
    return null;
  }

  if (preference === "feminine") {
    if (direction === "masculine" || hasAnySignal(signalText, FEMININE_CONFLICT_SIGNALS)) {
      return "PROFILE_DIRECTION_CONFLICT";
    }
    return null;
  }

  if (preference === "neutral" || preference === "no_preference") {
    if (direction === "masculine" || direction === "feminine") {
      return "PROFILE_DIRECTION_CONFLICT";
    }
    return null;
  }

  return null;
}

export function normalizeStyleDirectionPreference(value: unknown): StyleDirectionPreference {
  const text = stripDiacritics(normalizeText(value).toLowerCase());

  if (!text) return "no_preference";
  if (text.includes("sem prefer") || text.includes("no_preference") || text.includes("no preference")) return "no_preference";
  if (text.includes("unisex") || text.includes("unissex")) return "neutral";
  if (text.includes("femin")) return "feminine";
  if (text.includes("mascul")) return "masculine";
  if (text.includes("street")) return "streetwear";
  if (text.includes("casual")) return "casual";
  if (text.includes("social") || text.includes("evento") || text.includes("formal")) return "social";
  if (text.includes("neut")) return "neutral";

  return "no_preference";
}

export function isGenderedStyleDirection(value: unknown) {
  const direction = normalizeStyleDirectionPreference(value);
  return direction === "masculine" || direction === "feminine";
}

export function isExplicitFeminineStyleDirection(value: unknown) {
  return normalizeStyleDirectionPreference(value) === "feminine";
}

export function isExplicitMasculineStyleDirection(value: unknown) {
  return normalizeStyleDirectionPreference(value) === "masculine";
}

export function isExplicitNeutralStyleDirection(value: unknown) {
  const direction = normalizeStyleDirectionPreference(value);
  return direction === "neutral" || direction === "no_preference";
}

export function getStyleDirectionDisplayLabel(value: unknown): string {
  const direction = normalizeStyleDirectionPreference(value);
  return STYLE_DIRECTION_LABELS[direction];
}

export function getStyleDirectionNarrativeLabel(value: unknown): string {
  const direction = normalizeStyleDirectionPreference(value);

  switch (direction) {
    case "masculine":
      return "presença masculina";
    case "feminine":
      return "presença feminina";
    case "streetwear":
      return "presença streetwear";
    case "casual":
      return "casual refinado";
    case "social":
      return "social elegante";
    case "neutral":
    case "no_preference":
    default:
      return "linha neutra";
  }
}

export function getStyleDirectionToneProfile(value: unknown) {
  const direction = normalizeStyleDirectionPreference(value);

  switch (direction) {
    case "masculine":
      return {
        title: "Presença urbana",
        language: ["presença", "estrutura", "proporção", "sobriedade", "impacto", "casual refinado", "urbano", "moderno"],
      };
    case "feminine":
      return {
        title: "Força visual limpa",
        language: ["presença", "leveza", "proporção", "acabamento", "impacto", "refino", "elegância", "delicadeza"],
      };
    case "streetwear":
      return {
        title: "Casual de impacto",
        language: ["urbano", "atitude", "camadas", "movimento", "contraste", "presença", "contemporâneo", "moderno"],
      };
    case "casual":
      return {
        title: "Look de presença",
        language: ["conforto", "uso real", "proporção", "leveza", "refino", "presença", "versatilidade", "moderno"],
      };
    case "social":
      return {
        title: "Minimalismo marcante",
        language: ["sofisticação", "eventos", "presença", "acabamento", "equilíbrio", "impacto", "refino", "moderno"],
      };
    case "neutral":
    case "no_preference":
    default:
      return {
        title: "Linha neutra",
        language: ["presença", "equilíbrio", "proporção", "sobriedade", "versatilidade", "acabamento", "limpeza", "neutro"],
      };
  }
}

export function getStyleDirectionCatalogSignals(value: unknown): string[] {
  const direction = normalizeStyleDirectionPreference(value);

  switch (direction) {
    case "masculine":
      return ["masculino", "masculina", "male", "tailored", "alfaiataria", "estrutura", "neutro", "unissex"];
    case "feminine":
      return ["feminino", "feminina", "female", "romantico", "romantica", "delicado", "neutro", "unissex"];
    case "streetwear":
      return ["streetwear", "street", "urbano", "casual", "neutro", "unissex"];
    case "casual":
      return ["casual", "daily", "uso real", "neutro", "unissex"];
    case "social":
      return ["social", "evento", "night", "elegante", "neutro", "unissex"];
    case "neutral":
    case "no_preference":
    default:
      return ["neutro", "unissex", "genderless", "minimalista", "safe", "base neutra"];
  }
}

export function isProductCompatibleWithStyleDirection(
  targetDirection: unknown,
  productDirection: unknown,
  productSignals: string[] = [],
) {
  const preference = normalizeStyleDirectionPreference(targetDirection);
  const direction = normalizeStyleDirectionPreference(productDirection);
  const signalText = stripDiacritics(productSignals.join(" ").toLowerCase());
  const hasSignal = (keywords: string[]) => containsAny(signalText, keywords);

  if (getStyleDirectionConflictCode(preference, direction, productSignals)) {
    return false;
  }

  if (preference === "masculine") {
    return direction !== "feminine" && (direction === "masculine" || direction === "neutral" || direction === "no_preference" || hasSignal(getStyleDirectionCatalogSignals("masculine")));
  }

  if (preference === "feminine") {
    return direction !== "masculine" && (direction === "feminine" || direction === "neutral" || direction === "no_preference" || hasSignal(getStyleDirectionCatalogSignals("feminine")));
  }

  if (preference === "neutral" || preference === "no_preference") {
    if (direction === "masculine" || direction === "feminine") {
      return false;
    }

    return direction === "neutral" || direction === "no_preference" || hasSignal(getStyleDirectionCatalogSignals("neutral"));
  }

  const preferenceSignals = getStyleDirectionCatalogSignals(preference);
  if (direction === preference) return true;
  if (direction === "neutral" || direction === "no_preference") return true;
  return hasSignal(preferenceSignals);
}
