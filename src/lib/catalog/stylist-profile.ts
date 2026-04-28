import type { Product } from "@/lib/catalog";
import {
  getStyleDirectionCatalogSignals,
  getStyleDirectionDisplayLabel,
  normalizeStyleDirectionPreference,
  type StyleDirectionPreference,
} from "@/lib/style-direction";

export type CatalogStylistRole = "base" | "support" | "anchor" | "statement" | "accessory";

export type CatalogStylistProfile = {
  role: CatalogStylistRole;
  direction: StyleDirectionPreference;
  title: string;
  summary: string;
  keySignals: string[];
  styleTags: string[];
  categoryTags: string[];
  fitTags: string[];
  colorTags: string[];
  targetProfile: string[];
  useCases: string[];
  bodyEffect: string;
  faceEffect: string;
  visualWeight: string;
  formality: string;
  occasionTags: string[];
  seasonTags: string[];
  authorityRationale: string;
  conversionCopy: string;
};

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

function inferRole(product: Product): CatalogStylistRole {
  const source = `${matchText(product.name)} ${matchText(product.category)} ${matchText(product.type)}`;

  if (source.includes("acessor") || source.includes("bag") || source.includes("oculos") || source.includes("óculos")) {
    return "accessory";
  }

  if (source.includes("blazer") || source.includes("alfaiat") || source.includes("casaco") || source.includes("sobretudo")) {
    return "anchor";
  }

  if (source.includes("camisa") || source.includes("calca") || source.includes("saia") || source.includes("vestido")) {
    return "base";
  }

  if (source.includes("statement") || source.includes("impacto") || source.includes("bordado") || source.includes("textura")) {
    return "statement";
  }

  return "support";
}

function inferDirection(product: Product): StyleDirectionPreference {
  if (product.style_direction) {
    return normalizeStyleDirectionPreference(product.style_direction);
  }

  const source = [
    matchText(product.name),
    matchText(product.category),
    matchText(product.style || ""),
    matchText(product.catalog_notes || ""),
    ...(product.style_tags || []).map((tag) => matchText(tag)),
  ].join(" ");

  if (source.includes("mascul") || source.includes("tailored") || source.includes("brogue")) return "masculine";
  if (source.includes("femin") || source.includes("romant") || source.includes("cat eye") || source.includes("fitted")) return "feminine";
  if (source.includes("unisex") || source.includes("unissex") || source.includes("genderless") || source.includes("minimal")) return "neutral";
  return "neutral";
}

function inferVisualWeight(role: CatalogStylistRole, product: Product): string {
  if (product.visual_weight) return normalizeText(product.visual_weight);

  const source = `${matchText(product.style || "")} ${matchText(product.category)} ${matchText(product.name)} ${matchText(product.catalog_notes || "")}`;
  if (role === "anchor" || source.includes("estrutur") || source.includes("alfaiat")) return "Alta";
  if (role === "statement" || source.includes("impact") || source.includes("textur")) return "Media alta";
  if (role === "accessory") return "Pontual";
  return "Media";
}

function inferFormality(product: Product): string {
  if (product.formality) return normalizeText(product.formality);

  const source = `${matchText(product.style || "")} ${matchText(product.category)} ${matchText(product.name)} ${matchText(product.catalog_notes || "")}`;
  if (source.includes("luxo") || source.includes("eleg") || source.includes("alfaiat")) return "Alta";
  if (source.includes("casual") || source.includes("jeans")) return "Media";
  return "Media alta";
}

function inferBodyEffect(role: CatalogStylistRole, product: Product): string {
  if (product.body_effect) return normalizeText(product.body_effect);

  const notes = matchText(product.catalog_notes || "");
  if (notes.includes("along")) return "Alonga e limpa a leitura da silhueta";
  if (notes.includes("afina")) return "Afina visualmente e organiza a proporção";
  if (notes.includes("estrutura")) return "Estrutura e organiza a silhueta";
  if (notes.includes("marc")) return "Aumenta presença com controle";
  if (role === "anchor") return "Estrutura e organiza a silhueta";
  if (role === "statement") return "Aumenta presença com controle";
  if (role === "accessory") return "Fecha a leitura e dá acabamento";
  return "Sustenta a leitura com conforto";
}

function inferFaceEffect(role: CatalogStylistRole, product: Product): string {
  if (product.face_effect) return normalizeText(product.face_effect);

  const source = `${matchText(product.style || "")} ${matchText(product.name)} ${matchText(product.catalog_notes || "")}`;
  if (source.includes("cat eye") || source.includes("oculos") || source.includes("óculos")) return "Enquadra e valoriza a região do rosto";
  if (role === "accessory") return "Cria ponto de luz e foco";
  if (role === "statement") return "Amplia a expressividade";
  return "Mantém a leitura limpa";
}

function buildTags(product: Product, role: CatalogStylistRole, direction: StyleDirectionPreference) {
  const catalogNotes = matchText(product.catalog_notes || "");
  const directionSignals = getStyleDirectionCatalogSignals(direction);

  const styleTags = uniq([
    ...(product.style_tags || []),
    role === "anchor" ? "Base forte" : null,
    role === "statement" ? "Ponto de impacto" : null,
    role === "accessory" ? "Complemento" : null,
    role === "support" ? "Uso diário" : null,
    getStyleDirectionDisplayLabel(direction),
    product.style || null,
    catalogNotes.includes("alfaiat") ? "Alfaiataria" : null,
    catalogNotes.includes("minimal") ? "Minimalismo" : null,
    catalogNotes.includes("textur") ? "Textura" : null,
    catalogNotes.includes("estrutura") ? "Estrutura" : null,
    ...directionSignals,
  ].filter((value): value is string => Boolean(value)));

  const categoryTags = uniq([
    ...(product.category_tags || []),
    normalizeText(product.category) || "Produto",
    role === "accessory" ? "Acessório" : role === "anchor" ? "Peça principal" : role === "support" ? "Base" : "Peça de destaque",
  ]);

  const fitTags = uniq([
    ...(product.fit_tags || []),
    role === "anchor" ? "Estrutura" : null,
    role === "support" ? "Conforto" : null,
    role === "statement" ? "Intenção visual" : null,
  ].filter((value): value is string => Boolean(value)));

  const colorTags = uniq([
    ...(product.color_tags || []),
    normalizeText(product.primary_color) || null,
  ].filter((value): value is string => Boolean(value)));

  const targetProfile = uniq([
    ...(product.target_profile || []),
    role === "anchor" ? "Busca presença" : null,
    role === "statement" ? "Quer destaque" : null,
    role === "accessory" ? "Precisa de acabamento" : null,
    role === "support" ? "Quer uso fácil" : null,
    direction === "neutral" || direction === "no_preference" ? "Busca curadoria neutra" : null,
  ].filter((value): value is string => Boolean(value)));

  const useCases = uniq([
    ...(product.use_cases || []),
    ...(product.occasion_tags || []),
    ...(product.season_tags || []),
    catalogNotes.includes("dia a dia") ? "Uso diário" : null,
    catalogNotes.includes("evento") ? "Evento" : null,
    catalogNotes.includes("trabalho") ? "Trabalho" : null,
    catalogNotes.includes("noite") ? "Noite" : null,
    direction === "neutral" || direction === "no_preference" ? "Neutro seguro" : null,
  ].filter((value): value is string => Boolean(value)));

  return { styleTags, categoryTags, fitTags, colorTags, targetProfile, useCases };
}

function buildSummary(product: Product, role: CatalogStylistRole, direction: StyleDirectionPreference): string {
  const name = normalizeText(product.name) || "Peça do catálogo";
  const category = normalizeText(product.category) || "categoria";
  const style = normalizeText(product.style) || "estilo limpo";
  return `${name} entra como ${role}, conversa com ${category}, sustenta ${style} e respeita a linha ${getStyleDirectionDisplayLabel(direction).toLowerCase()}.`;
}

function buildAuthorityRationale(product: Product, role: CatalogStylistRole, direction: StyleDirectionPreference, summary: string): string {
  const notes = normalizeText(product.catalog_notes);
  if (notes) return notes;

  const style = normalizeText(product.style) || "um estilo coerente";
  const category = normalizeText(product.category) || "a categoria";
  return `${summary} O papel dessa peça no look é ${role === "anchor" ? "sustentar a base" : role === "statement" ? "criar ponto de impacto" : role === "accessory" ? "fechar a leitura" : "equilibrar a composição"}, respeitando a linha ${getStyleDirectionDisplayLabel(direction).toLowerCase()} e ${style} em ${category}.`;
}

function buildConversionCopy(title: string, role: CatalogStylistRole, visualWeight: string, formality: string): string {
  const roleText =
    role === "anchor"
      ? "base do look"
      : role === "statement"
        ? "ponto de presença"
        : role === "accessory"
          ? "acabamento"
          : "apoio visual";

  return `${title} funciona como ${roleText}, com peso visual ${normalizeText(visualWeight).toLowerCase()} e formalidade ${normalizeText(formality).toLowerCase()}.`;
}

export function deriveCatalogStylistProfile(product: Product): CatalogStylistProfile {
  const role = inferRole(product);
  const direction = inferDirection(product);
  const tags = buildTags(product, role, direction);
  const bodyEffect = inferBodyEffect(role, product);
  const faceEffect = inferFaceEffect(role, product);
  const visualWeight = inferVisualWeight(role, product);
  const formality = inferFormality(product);
  const title = normalizeText(product.name) || `${normalizeText(product.category) || "Peça"} do catálogo`;
  const summary = buildSummary(product, role, direction);

  return {
    role,
    direction,
    title,
    summary,
    keySignals: uniq([
      role,
      direction,
      normalizeText(product.category),
      normalizeText(product.style),
      normalizeText(product.primary_color),
      visualWeight,
      formality,
    ]),
    styleTags: tags.styleTags,
    categoryTags: tags.categoryTags,
    fitTags: tags.fitTags,
    colorTags: tags.colorTags,
    targetProfile: tags.targetProfile,
    useCases: tags.useCases,
    bodyEffect,
    faceEffect,
    visualWeight,
    formality,
    occasionTags: product.occasion_tags || [],
    seasonTags: product.season_tags || [],
    authorityRationale: buildAuthorityRationale(product, role, direction, summary),
    conversionCopy: buildConversionCopy(title, role, visualWeight, formality),
  };
}
