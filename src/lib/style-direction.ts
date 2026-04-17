export const STYLE_DIRECTION_VALUES = [
  "Masculina",
  "Feminina",
  "Neutra",
  "Streetwear",
  "Casual",
  "Social",
  "Sem preferência",
] as const;

export type StyleDirectionPreference = (typeof STYLE_DIRECTION_VALUES)[number];

const normalizeText = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");

export function normalizeStyleDirectionPreference(value: unknown): StyleDirectionPreference {
  const text = normalizeText(value).toLowerCase();

  if (!text) return "Sem preferência";
  if (text.includes("sem prefer") || text.includes("no_preference")) return "Sem preferência";
  if (text.includes("femin")) return "Feminina";
  if (text.includes("mascul")) return "Masculina";
  if (text.includes("street")) return "Streetwear";
  if (text.includes("casual")) return "Casual";
  if (text.includes("social") || text.includes("evento") || text.includes("formal")) return "Social";
  if (text.includes("neut")) return "Neutra";

  return "Sem preferência";
}

export function isGenderedStyleDirection(value: unknown) {
  const direction = normalizeStyleDirectionPreference(value);
  return direction === "Masculina" || direction === "Feminina";
}

export function isExplicitFeminineStyleDirection(value: unknown) {
  return normalizeStyleDirectionPreference(value) === "Feminina";
}

export function isExplicitMasculineStyleDirection(value: unknown) {
  return normalizeStyleDirectionPreference(value) === "Masculina";
}

export function isExplicitNeutralStyleDirection(value: unknown) {
  const direction = normalizeStyleDirectionPreference(value);
  return direction === "Neutra" || direction === "Sem preferência";
}

export function getStyleDirectionDisplayLabel(value: unknown): string {
  const direction = normalizeStyleDirectionPreference(value);

  switch (direction) {
    case "Masculina":
      return "Masculina";
    case "Feminina":
      return "Feminina";
    case "Neutra":
      return "Neutra";
    case "Streetwear":
      return "Streetwear";
    case "Casual":
      return "Casual";
    case "Social":
      return "Social";
    case "Sem preferência":
    default:
      return "Sem preferência";
  }
}

export function getStyleDirectionNarrativeLabel(value: unknown): string {
  const direction = normalizeStyleDirectionPreference(value);

  switch (direction) {
    case "Masculina":
      return "presença masculina";
    case "Feminina":
      return "presença feminina";
    case "Streetwear":
      return "presença streetwear";
    case "Casual":
      return "casual refinado";
    case "Social":
      return "social elegante";
    case "Neutra":
      return "linha neutra";
    case "Sem preferência":
    default:
      return "linha neutra";
  }
}

export function getStyleDirectionToneProfile(value: unknown) {
  const direction = normalizeStyleDirectionPreference(value);

  switch (direction) {
    case "Masculina":
      return {
        title: "Presença urbana",
        language: ["presença", "estrutura", "proporção", "sobriedade", "impacto", "casual refinado", "urbano", "moderno"],
      };
    case "Feminina":
      return {
        title: "Força visual limpa",
        language: ["presença", "leveza", "proporção", "acabamento", "impacto", "refino", "elegância", "delicadeza"],
      };
    case "Streetwear":
      return {
        title: "Casual de impacto",
        language: ["urbano", "atitude", "camadas", "movimento", "contraste", "presença", "contemporâneo", "moderno"],
      };
    case "Casual":
      return {
        title: "Look de presença",
        language: ["conforto", "uso real", "proporção", "leveza", "refino", "presença", "versatilidade", "moderno"],
      };
    case "Social":
      return {
        title: "Minimalismo marcante",
        language: ["sofisticação", "eventos", "presença", "acabamento", "equilíbrio", "impacto", "refino", "moderno"],
      };
    case "Neutra":
    case "Sem preferência":
    default:
      return {
        title: "Look de presença",
        language: ["presença", "equilíbrio", "proporção", "sobriedade", "versatilidade", "acabamento", "limpeza", "moderno"],
      };
  }
}

export function getStyleDirectionCatalogSignals(value: unknown): string[] {
  const direction = normalizeStyleDirectionPreference(value);

  switch (direction) {
    case "Masculina":
      return ["masculino", "masculina", "tailored", "alfaiataria", "estrutura", "neutro"];
    case "Feminina":
      return ["feminino", "feminina", "romantico", "romantica", "delicado", "neutro"];
    case "Streetwear":
      return ["streetwear", "street", "urbano", "casual", "neutro"];
    case "Casual":
      return ["casual", "daily", "uso real", "neutro"];
    case "Social":
      return ["social", "evento", "night", "elegante", "neutro"];
    case "Neutra":
    case "Sem preferência":
    default:
      return ["neutro", "unissex", "genderless", "minimalista"];
  }
}
