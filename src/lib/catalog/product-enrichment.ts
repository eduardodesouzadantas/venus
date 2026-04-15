import { buildCatalogEnrichmentSignals } from "@/lib/ai/catalog-enricher";

export type ProductCategory = "roupa" | "acessorio";
export type ProductStyle = "alfaiataria" | "casual" | "streetwear" | "festa" | "luxo";

export type ProductEnrichmentDraft = {
  name: string;
  category: ProductCategory;
  primary_color: string;
  style: ProductStyle;
  description: string;
  persuasive_description: string;
  emotional_copy: string;
  tags: string[];
};

export type ProductEnrichmentResult = ProductEnrichmentDraft & {
  fallback_used: boolean;
  warning?: string | null;
};

export const PRODUCT_ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const PRODUCT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeAccentless(value: string) {
  return stripDiacritics(normalizeText(value)).toLowerCase();
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function capitalizeWord(value: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function deriveSeedName(fileName?: string | null) {
  const cleaned = normalizeText(fileName)
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .map((word) => capitalizeWord(word.toLowerCase()))
    .join(" ");
}

function deriveCategoryHint(value: string): ProductCategory {
  const normalized = normalizeAccentless(value);
  if (normalized.includes("acessor") || normalized.includes("bag") || normalized.includes("cinto") || normalized.includes("oculos")) {
    return "acessorio";
  }
  return "roupa";
}

function deriveStyleHint(value: string): ProductStyle {
  const normalized = normalizeAccentless(value);
  if (normalized.includes("alfai")) return "alfaiataria";
  if (normalized.includes("street")) return "streetwear";
  if (normalized.includes("festa") || normalized.includes("evento")) return "festa";
  if (normalized.includes("lux") || normalized.includes("premium")) return "luxo";
  return "casual";
}

export function normalizeProductCategory(value: unknown): ProductCategory {
  const normalized = normalizeAccentless(String(value ?? ""));
  if (normalized.includes("acessor") || normalized.includes("accessor")) return "acessorio";
  return "roupa";
}

export function normalizeProductStyle(value: unknown): ProductStyle {
  return deriveStyleHint(String(value ?? ""));
}

export function normalizeProductTags(values: unknown, maxItems = 8): string[] {
  if (!Array.isArray(values)) return [];
  return uniq(
    values
      .map((value) => normalizeWhitespace(normalizeText(value)))
      .filter(Boolean)
      .map((value) => value.slice(0, 42))
  ).slice(0, maxItems);
}

export function validateProductImageFile(file: File | null | undefined) {
  if (!file) {
    return { valid: false, reason: "image_missing" as const };
  }

  if (file.size <= 0) {
    return { valid: false, reason: "image_empty" as const };
  }

  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return { valid: false, reason: "image_too_large" as const };
  }

  const mimeType = normalizeText(file.type).toLowerCase();
  if (mimeType && !PRODUCT_ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    return { valid: false, reason: "image_invalid_type" as const };
  }

  return { valid: true, reason: null };
}

function buildTagList(source: {
  tags?: unknown;
  styleTags?: string[];
  categoryTags?: string[];
  colorTags?: string[];
  useCases?: string[];
}) {
  return normalizeProductTags(
    uniq([
      ...(Array.isArray(source.tags) ? source.tags : []),
      ...(source.styleTags || []),
      ...(source.categoryTags || []),
      ...(source.colorTags || []),
      ...(source.useCases || []),
    ]),
    8,
  );
}

export function buildFallbackProductEnrichment(input: {
  name?: unknown;
  category?: unknown;
  fileName?: unknown;
  primaryColor?: unknown;
  style?: unknown;
  description?: unknown;
  persuasiveDescription?: unknown;
  emotionalCopy?: unknown;
  tags?: unknown;
} = {}): ProductEnrichmentResult {
  const seedName = normalizeText(input.name) || deriveSeedName(normalizeText(input.fileName)) || "Nova peça";
  const seedCategory = normalizeProductCategory(input.category || deriveCategoryHint(`${seedName} ${normalizeText(input.fileName)}`));
  const signals = buildCatalogEnrichmentSignals(seedName, seedCategory);
  const description = normalizeText(input.description) || signals.baseDescription;
  const persuasiveDescription = normalizeText(input.persuasiveDescription) || signals.persuasiveDescription;
  const emotionalCopy =
    normalizeText(input.emotionalCopy) ||
    normalizeText(`${signals.impactLine} ${signals.conversionCopy}`) ||
    signals.conversionCopy;

  return {
    name: signals.premiumTitle || seedName,
    category: seedCategory,
    primary_color: normalizeText(input.primaryColor) || signals.colorTags[0] || "Neutro",
    style: normalizeProductStyle(input.style || deriveStyleHint(`${seedName} ${seedCategory} ${signals.styleTags.join(" ")}`)),
    description,
    persuasive_description: persuasiveDescription,
    emotional_copy: emotionalCopy,
    tags: buildTagList({
      tags: input.tags,
      styleTags: signals.styleTags,
      categoryTags: signals.categoryTags,
      colorTags: signals.colorTags,
      useCases: signals.useCases,
    }),
    fallback_used: true,
    warning: "fallback_used",
  };
}

export function buildProductEnrichmentFromAiPayload(input: Record<string, unknown>): ProductEnrichmentResult | null {
  const name = normalizeText(input.name);
  const category = normalizeProductCategory(input.category);
  const primaryColor = normalizeText(input.primary_color || input.primaryColor || input.dominant_color);
  const style = normalizeProductStyle(input.style);
  const description = normalizeText(input.description);
  const persuasiveDescription = normalizeText(input.persuasive_description || input.persuasiveDescription);
  const emotionalCopy = normalizeText(input.emotional_copy || input.emotionalCopy);
  const tags = normalizeProductTags(input.tags, 8);

  if (!name || !description || !persuasiveDescription || !emotionalCopy || tags.length === 0) {
    return null;
  }

  return {
    name,
    category,
    primary_color: primaryColor || "Neutro",
    style,
    description,
    persuasive_description: persuasiveDescription,
    emotional_copy: emotionalCopy,
    tags,
    fallback_used: Boolean(input.fallback_used),
    warning: normalizeText(input.warning) || null,
  };
}
