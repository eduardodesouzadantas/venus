import type { LookData } from "@/types/result";

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

const TECHNICAL_REASON_CODES = new Set([
  "INVALID_OUTFIT_COMPOSITION",
  "SAME_SLOT_CONFLICT",
  "INVALID_HERO_SLOT",
  "PROFILE_DIRECTION_CONFLICT",
  "CONTEXT_FORMALITY_CONFLICT",
]);
const CURATION_FALLBACK_MESSAGE =
  "Ainda não tenho uma composição completa forte o suficiente. Posso refinar com uma nova foto ou levar essa leitura para o WhatsApp.";

function publicText(value: unknown, fallback = ""): string {
  const text = normalizeText(value);
  return TECHNICAL_REASON_CODES.has(text) ? fallback : text;
}

function inferItemSlot(item: Record<string, unknown>): string {
  const source = normalizeText([
    item.name,
    item.title,
    item.category,
    item.role,
    item.baseDescription,
    item.premiumTitle,
    ...(Array.isArray(item.styleTags) ? item.styleTags : []),
    ...(Array.isArray(item.categoryTags) ? item.categoryTags : []),
  ].join(" "))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (source.includes("one_piece") || source.includes("vestido") || source.includes("dress") || source.includes("macacao")) return "one_piece";
  if (source.includes("bottom") || source.includes("calca") || source.includes("trouser") || source.includes("jeans") || source.includes("short")) return "bottom";
  if (source.includes("top") || source.includes("camisa") || source.includes("blusa") || source.includes("camiseta")) return "top";
  if (source.includes("shoes") || source.includes("sapato") || source.includes("tenis") || source.includes("sandal") || source.includes("flip flop") || source.includes("chinelo") || source.includes("slipper")) return "shoes";
  if (source.includes("accessory") || source.includes("acessorio") || source.includes("bolsa") || source.includes("handbag")) return "accessory";
  return "unknown";
}

function getLookSlots(look: LookData): string[] {
  return (look.items || []).map((item) => inferItemSlot(item as unknown as Record<string, unknown>));
}

function hasSlotConflict(slots: string[]): boolean {
  const counts = slots.reduce<Record<string, number>>((current, slot) => {
    current[slot] = (current[slot] || 0) + 1;
    return current;
  }, {});

  return (counts.shoes || 0) > 1 || (counts.accessory || 0) > 1 || (counts.top || 0) > 1 || (counts.bottom || 0) > 1;
}

function isRenderableRecommendation(look: LookData): boolean {
  const slots = getLookSlots(look);
  const knownSlots = slots.filter((slot) => slot !== "unknown");

  if (slots.length === 0 || hasSlotConflict(slots)) {
    return false;
  }

  if (knownSlots.length === 0) {
    return true;
  }

  if (knownSlots.length === 1) {
    return knownSlots[0] === "top" || knownSlots[0] === "bottom" || knownSlots[0] === "one_piece";
  }

  return true;
}

function isCompleteRenderableLook(look: LookData): boolean {
  const slots = (look.items || []).map((item) => inferItemSlot(item as unknown as Record<string, unknown>));
  const knownSlots = slots.filter((slot) => slot !== "unknown");

  if (slots.length === 0 || hasSlotConflict(slots)) {
    return false;
  }

  if (knownSlots.length === 0) {
    return true;
  }

  return slots.includes("one_piece") || (slots.includes("top") && slots.includes("bottom"));
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => normalizeText(entry)).filter(Boolean);
}

function normalizeStringOrList(value: unknown): string[] {
  if (typeof value === "string") {
    return normalizeText(value)
      .split(/[,/|•]+/g)
      .map((entry) => normalizeText(entry))
      .filter(Boolean);
  }

  return normalizeList(value);
}

function formatCurrency(value: number, currency = "BRL"): string {
  if (!Number.isFinite(value) || value <= 0) return "";

  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      maximumFractionDigits: value >= 100 ? 0 : 2,
    }).format(value);
  } catch {
    return `R$ ${value.toFixed(value >= 100 ? 0 : 2)}`;
  }
}

function looksLikeSizeToken(value: string): boolean {
  const normalized = value.toUpperCase();
  return /^(PP|P|M|G|GG|XG|XXG|XS|S|M|L|XL|XXL|\d{2})$/.test(normalized);
}

type CatalogRecommendationSource = Record<string, unknown>;

function resolveImageUrl(item: CatalogRecommendationSource): string {
  const arrayImage = Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : "";
  return normalizeText(item.image_url || item.photoUrl || item.imageUrl || item.tryOnUrl || arrayImage);
}

function resolveTitle(item: CatalogRecommendationSource): string {
  return normalizeText(item.premiumTitle || item.title || item.name || item.description) || "Peça recomendada";
}

function resolveBrand(item: CatalogRecommendationSource, fallback = "Catálogo da loja"): string {
  return normalizeText(item.brand || item.sourceLabel) || fallback;
}

function resolvePriceLabel(item: CatalogRecommendationSource): string {
  const directLabel = normalizeText(item.priceLabel || item.price_range || item.itemPrice || item.bundlePrice);
  if (directLabel) return directLabel;

  if (typeof item.price === "string") {
    const text = normalizeText(item.price);
    if (text) return text;
  }

  const numericPrice = typeof item.price === "number" ? item.price : typeof item.price === "string" ? Number(item.price) : NaN;
  if (Number.isFinite(numericPrice) && numericPrice > 0) {
    return formatCurrency(numericPrice, normalizeText(item.currency) || "BRL");
  }

  return "";
}

function resolveColors(item: CatalogRecommendationSource): string[] {
  const candidates = [
    item.colors,
    item.color_tags,
    item.colorTags,
  ];

  for (const candidate of candidates) {
    const values = normalizeList(candidate);
    if (values.length > 0) {
      return values.slice(0, 4);
    }
  }

  return [];
}

function resolveSizes(item: CatalogRecommendationSource): string[] {
  const candidates = [
    item.sizes,
    item.size_type,
    item.fit_tags,
    item.fitTags,
  ];

  for (const candidate of candidates) {
    const values = normalizeStringOrList(candidate);
    const sizeLike = values.filter(looksLikeSizeToken);
    if (sizeLike.length > 0) {
      return sizeLike.slice(0, 4);
    }
  }

  return [];
}

function resolveJustification(item: CatalogRecommendationSource, fallback: string): string {
  const text = normalizeText(
    item.justification ||
      item.reason ||
      item.conversionCopy ||
      item.authorityRationale ||
      item.persuasive_description ||
      item.emotional_copy ||
      item.functionalBenefit ||
      item.description ||
    fallback,
  );
  return publicText(text, CURATION_FALLBACK_MESSAGE);
}

function truncateSentence(value: string, limit = 88): string {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (normalized.length <= limit) return normalized;

  const trimmed = normalized.slice(0, limit).replace(/\s+\S*$/, "").trim();
  return `${trimmed || normalized.slice(0, limit).trim()}…`;
}

export type AssistedCatalogProductCard = {
  id: string;
  title: string;
  brand: string;
  imageUrl: string;
  priceLabel: string;
  colors: string[];
  sizes: string[];
  justification: string;
  sourceLabel: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
};

export type AssistedLookStripItem = {
  id: string;
  title: string;
  imageUrl: string;
  description: string;
  typeLabel: string;
  detailLine: string;
  supportingPieces: string[];
  ctaLabel: string;
};

export type CatalogAccessCopy = {
  eyebrow: string;
  title: string;
  summary: string;
  nextStep: string;
  openLabel: string;
  continueLabel: string;
  saveLabel: string;
};

export type AssistedRecommendationSurface = {
  copy: CatalogAccessCopy;
  reinforcement: string[];
  products: AssistedCatalogProductCard[];
  looks: AssistedLookStripItem[];
  emptyState: {
    title: string;
    summary: string;
  };
  actions: {
    moreOptionsLabel: string;
    talkToVenusLabel: string;
    catalogLabel: string;
    continueLabel: string;
    saveLabel: string;
    opinionLabel: string;
  };
};

export function buildAssistedCatalogProductCards(
  looks: LookData[] | null | undefined,
  options?: {
    limit?: number;
    sourceLabel?: string | null;
  }
): AssistedCatalogProductCard[] {
  if (!Array.isArray(looks) || looks.length === 0) return [];

  const limit = Math.max(1, Math.min(options?.limit || 3, 3));
  const sourceLabel = normalizeText(options?.sourceLabel) || "Catálogo da loja";

  return looks
    .filter(isRenderableRecommendation)
    .slice(0, limit)
    .map((look, index) => {
      const primaryItem = look.items?.[0] ? (look.items[0] as unknown as CatalogRecommendationSource) : null;
      const imageItem = (look.items?.find((item) => Boolean(resolveImageUrl(item as unknown as CatalogRecommendationSource))) || primaryItem) as CatalogRecommendationSource | null;
      const fallbackItem = primaryItem || imageItem || null;

      if (!fallbackItem) return null;

      return {
        id: normalizeText(look.product_id) || normalizeText(fallbackItem.product_id) || normalizeText(look.id) || `${sourceLabel}-${index + 1}`,
        title: resolveTitle({
          premiumTitle: primaryItem?.premiumTitle || fallbackItem.premiumTitle,
          title: primaryItem?.name || fallbackItem.name,
          name: primaryItem?.name || fallbackItem.name,
          description: look.name,
        }),
        brand: resolveBrand(primaryItem || fallbackItem, sourceLabel),
        imageUrl: normalizeText(imageItem?.photoUrl || imageItem?.tryOnUrl),
        priceLabel: resolvePriceLabel({
          price: primaryItem?.price || fallbackItem.price,
          currency: primaryItem?.currency || fallbackItem.currency,
          priceLabel: primaryItem?.price || fallbackItem.price,
          itemPrice: primaryItem?.price || fallbackItem.price,
          bundlePrice: look.bundlePrice,
          price_range: primaryItem?.price || fallbackItem.price,
        }),
        colors: resolveColors(primaryItem || fallbackItem),
        sizes: resolveSizes(primaryItem || fallbackItem),
        justification: resolveJustification(
          {
            conversionCopy: primaryItem?.conversionCopy || fallbackItem.conversionCopy,
            authorityRationale: primaryItem?.authorityRationale || fallbackItem.authorityRationale,
            functionalBenefit: primaryItem?.functionalBenefit || fallbackItem.functionalBenefit,
            description: primaryItem?.baseDescription || fallbackItem.baseDescription,
            reason: look.explanation,
          },
          look.explanation || look.intention || "Recomendação curada para o seu perfil",
        ),
        sourceLabel,
        primaryCtaLabel: index === 0 ? "Ver detalhe" : "Ver opção",
        secondaryCtaLabel: "Perguntar opinião",
      } satisfies AssistedCatalogProductCard;
    })
    .filter((entry): entry is AssistedCatalogProductCard => Boolean(entry));
}

export function buildAssistedLookStripItems(
  looks: LookData[] | null | undefined,
  options?: {
    limit?: number;
  }
): AssistedLookStripItem[] {
  if (!Array.isArray(looks) || looks.length === 0) return [];

  const limit = Math.max(1, Math.min(options?.limit || 3, 3));

  return looks.filter(isCompleteRenderableLook).slice(0, limit).map((look, index) => {
    const anchorItem = look.items?.[0] || null;
    const supportingPieces = look.items?.slice(1, 4).map((item) => normalizeText(item.premiumTitle || item.name)).filter(Boolean) || [];
    const imageUrl = normalizeText(anchorItem?.photoUrl || look.tryOnUrl);
    const productCount = look.items?.length || 0;

    return {
      id: normalizeText(look.id) || `look-${index + 1}`,
      title: normalizeText(look.name) || "Look recomendado",
      imageUrl,
      description: normalizeText(look.explanation || look.intention) || "Composição assistida pelo catálogo real da loja.",
      typeLabel: normalizeText(look.type) || "Look curado",
      detailLine:
        productCount > 1
          ? `Peça principal + ${productCount - 1} complementares`
          : "Peça principal",
      supportingPieces,
      ctaLabel: index === 0 ? "Continuar por aqui" : "Ver variação",
    } satisfies AssistedLookStripItem;
  });
}

export function buildCatalogAccessCopy(input: {
  sourceLabel?: string | null;
  productCount: number;
  lookCount?: number;
  explicit?: boolean;
}): CatalogAccessCopy {
  const sourceLabel = normalizeText(input.sourceLabel) || "catálogo da loja";
  const productCount = Math.max(0, input.productCount);
  const lookCount = Math.max(0, input.lookCount || 0);
  const explicit = Boolean(input.explicit);
  const totalItems = productCount > 0 ? productCount : lookCount;

  if (explicit) {
    return {
      eyebrow: "Catálogo solicitado",
      title: `Abrir ${sourceLabel}`,
      summary: "Você pediu o catálogo direto da fonte certa, sem perder o contexto da conversa.",
      nextStep: "Se quiser, eu continuo com uma seleção guiada depois disso.",
      openLabel: `Abrir ${sourceLabel}`,
      continueLabel: "Manter conversa",
      saveLabel: "Salvar look",
    };
  }

  return {
    eyebrow: "Catálogo assistido",
    title:
      totalItems > 0
        ? `${Math.min(totalItems, 3)} ${Math.min(totalItems, 3) === 1 ? "opção" : "opções"} que fazem sentido para você`
        : "Peças que fazem sentido para você",
    summary: "Selecionamos até 3 recomendações com leitura coerente, sem virar vitrine infinita.",
    nextStep: "Se quiser, eu refino por ocasião, cor ou orçamento.",
    openLabel: `Abrir ${sourceLabel}`,
    continueLabel: "Continuar conversa",
    saveLabel: "Salvar look",
  };
}

export function buildAssistedRecommendationSurface(
  looks: LookData[] | null | undefined,
  options?: {
    limit?: number;
    sourceLabel?: string | null;
    explicit?: boolean;
  }
): AssistedRecommendationSurface {
  const products = buildAssistedCatalogProductCards(looks, {
    limit: options?.limit ?? 3,
    sourceLabel: options?.sourceLabel ?? null,
  });
  const lookStrip = buildAssistedLookStripItems(looks, {
    limit: options?.limit ?? 3,
  });
  const copy = buildCatalogAccessCopy({
    sourceLabel: options?.sourceLabel ?? null,
    productCount: products.length,
    lookCount: lookStrip.length,
    explicit: Boolean(options?.explicit),
  });

  const reinforcement = [
    products[0]?.brand || copy.eyebrow,
    truncateSentence(products[0]?.justification || lookStrip[0]?.description || copy.summary, 72),
    lookStrip[0]?.typeLabel || lookStrip[0]?.detailLine || "Leitura assistida",
  ]
    .map((entry) => normalizeText(entry))
    .filter(Boolean)
    .slice(0, 3);

  return {
    copy,
    reinforcement,
    products,
    looks: lookStrip,
    emptyState: {
      title: "Ainda nao ha recomendacoes suficientes",
      summary: "Assim que o catalogo responder, eu mostro ate 3 opcoes sem virar vitrine crua.",
    },
    actions: {
      moreOptionsLabel: "Ver mais 1 opcao",
      talkToVenusLabel: "Falar com a Venus sobre esse look",
      catalogLabel: copy.openLabel,
      continueLabel: copy.continueLabel,
      saveLabel: copy.saveLabel,
      opinionLabel: "Pedir opiniao",
    },
  };
}
