import { getB2BProducts, type Product } from "@/lib/catalog";
import { resolveProductStockSnapshot } from "@/lib/catalog/stock";
import { deriveCatalogStylistProfile } from "@/lib/catalog/stylist-profile";
import type { VenusStylistAudit } from "@/lib/venus/audit/engine";
import type { WhatsAppLookSummary } from "@/types/whatsapp";

type CommerceItem = {
  productId: string;
  name: string;
  brand?: string | null;
  price?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  role: string;
  reason: string;
  score: number;
};

export type WhatsAppStylistCommercePlan = {
  available: boolean;
  orgId: string | null;
  openingLine: string;
  summaryLine: string;
  completeLooks: Array<{
    title: string;
    reason: string;
    items: CommerceItem[];
    stylePositioning: string;
  }>;
  upsellLine: string;
  crossSellLine: string;
  alternativeLine: string;
  targetSignals: string[];
  fallbackReason?: string;
};

type BuildWhatsAppStylistCommercePlanInput = {
  orgId?: string | null;
  catalog?: Product[] | null;
  audit?: VenusStylistAudit | null;
  contactName?: string | null;
  styleIdentity?: string | null;
  imageGoal?: string | null;
  paletteFamily?: string | null;
  fit?: string | null;
  metal?: string | null;
  intentScore?: number | null;
  resultState?: "hero" | "preview" | "retry_required" | null;
  lookSummary?: WhatsAppLookSummary[] | null;
};

const normalizeText = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function tokenize(value: unknown) {
  const text = normalizeText(value).toLowerCase();
  if (!text) return [];
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function countOverlap(values: Array<string | null | undefined>, tokens: string[]) {
  const flattened = values.flatMap((value) => tokenize(value));
  return flattened.filter((token) => tokens.some((candidate) => candidate.includes(token) || token.includes(candidate))).length;
}

function getProductTokens(product: Product, profile: ReturnType<typeof deriveCatalogStylistProfile>) {
  return unique([
    product.name,
    product.category,
    product.style,
    product.primary_color,
    profile.title,
    profile.summary,
    ...profile.keySignals,
    ...profile.styleTags,
    ...profile.categoryTags,
    ...profile.fitTags,
    ...profile.colorTags,
    ...profile.useCases,
  ]);
}

function scoreProduct(
  product: Product,
  profile: ReturnType<typeof deriveCatalogStylistProfile>,
  contextTokens: string[],
) {
  const productTokens = getProductTokens(product, profile);
  const overlap = countOverlap(contextTokens, productTokens);
  const catalogNotes = tokenize(product.catalog_notes);
  const roleWeight = profile.role === "anchor" ? 12 : profile.role === "statement" ? 10 : profile.role === "support" ? 8 : 6;
  const availabilityWeight = resolveProductStockSnapshot(product as Product & Record<string, unknown>).availableQty > 0 ? 6 : -8;
  const styleWeight =
    countOverlap(profile.styleTags, contextTokens) +
    countOverlap(profile.categoryTags, contextTokens) +
    countOverlap(profile.fitTags, contextTokens) +
    countOverlap(profile.useCases, contextTokens) +
    countOverlap(catalogNotes, contextTokens);

  return overlap * 4 + styleWeight * 2 + roleWeight + availabilityWeight;
}

function makeItem(product: Product, profile: ReturnType<typeof deriveCatalogStylistProfile>, score: number): CommerceItem {
  return {
    productId: product.id,
    name: profile.title,
    brand: null,
    price: product.price_range,
    category: product.category,
    imageUrl: product.image_url,
    role: profile.role,
    reason: profile.conversionCopy,
    score,
  };
}

function buildLookTitle(name: string, index: number) {
  return name ? `${name} • conjunto ${index + 1}` : `Conjunto ${index + 1}`;
}

export async function buildWhatsAppStylistCommercePlan({
  orgId,
  catalog,
  audit,
  contactName,
  styleIdentity,
  imageGoal,
  paletteFamily,
  fit,
  metal,
  intentScore,
  resultState,
  lookSummary,
}: BuildWhatsAppStylistCommercePlanInput): Promise<WhatsAppStylistCommercePlan> {
  const resolvedOrgId = normalizeText(orgId);
  if (!resolvedOrgId) {
    return {
      available: false,
      orgId: null,
      openingLine: "A leitura continua, mas o catálogo desta loja não está disponível agora.",
      summaryLine: "Sem org_id não há catálogo permitido para a conversa.",
      completeLooks: [],
      upsellLine: "",
      crossSellLine: "",
      alternativeLine: "",
      targetSignals: [],
      fallbackReason: "missing_org_id",
    };
  }

  const resolvedCatalog = Array.isArray(catalog) ? catalog : await getB2BProducts(resolvedOrgId);
  const profiles = resolvedCatalog
    .map((product) => ({ product, profile: deriveCatalogStylistProfile(product) }))
    .filter(({ product }) => Boolean(normalizeText(product.id)) && normalizeText(product.org_id) === resolvedOrgId);

  if (!profiles.length) {
    return {
      available: false,
      orgId: resolvedOrgId,
      openingLine: "Ainda não há catálogo validado suficiente para compor um look completo.",
      summaryLine: "Sem peças elegíveis para montar o conjunto da loja.",
      completeLooks: [],
      upsellLine: "",
      crossSellLine: "",
      alternativeLine: "",
      targetSignals: [],
      fallbackReason: "empty_catalog",
    };
  }

  const contextTokens = unique(
    [
      styleIdentity,
      imageGoal,
      paletteFamily,
      fit,
      metal,
      audit?.diagnosis.positioning,
      audit?.direction.title,
      audit?.direction.subtitle,
      audit?.buyNow.looks?.[0]?.name,
      audit?.buyNow.looks?.[0]?.type,
      lookSummary?.[0]?.name,
      lookSummary?.[0]?.explanation,
      lookSummary?.[0]?.whenToWear,
      resultState,
      intentScore ? String(intentScore) : "",
    ].filter((value): value is string => Boolean(value)),
  );

  const scored = profiles
    .map(({ product, profile }) => ({
      product,
      profile,
      score: scoreProduct(product, profile, contextTokens),
    }))
    .sort((left, right) => right.score - left.score);

  const anchor = scored.filter((entry) => entry.profile.role === "anchor" || entry.profile.role === "statement" || entry.profile.role === "base");
  const support = scored.filter((entry) => entry.profile.role === "support" || entry.profile.role === "base");
  const accessory = scored.filter((entry) => entry.profile.role === "accessory");

  const topAnchors = anchor.slice(0, 2);
  const topSupports = support.slice(0, 2);
  const topAccessories = accessory.slice(0, 2);

  const completeLooks = [
    {
      title: buildLookTitle(topAnchors[0]?.profile.title || scored[0]?.profile.title || "Leitura principal", 0),
      reason: topAnchors[0]
        ? `${topAnchors[0].profile.summary} ${topSupports[0] ? `Combine com ${topSupports[0].profile.title} para sustentar o ticket com coerência.` : ""}`.trim()
        : "Conjunto principal sustentado pelo catálogo da própria loja.",
      items: [
        ...(topAnchors[0] ? [makeItem(topAnchors[0].product, topAnchors[0].profile, topAnchors[0].score)] : []),
        ...(topSupports[0] ? [makeItem(topSupports[0].product, topSupports[0].profile, topSupports[0].score)] : []),
        ...(topAccessories[0] ? [makeItem(topAccessories[0].product, topAccessories[0].profile, topAccessories[0].score)] : []),
      ],
      stylePositioning: audit?.diagnosis.positioning || styleIdentity || "Assinatura em evolução",
    },
  ];

  const upsellCandidate = scored.find((entry) => entry.product.price_range);
  const crossSellCandidate = scored.find((entry) => entry.profile.role === "accessory" || entry.profile.role === "statement");
  const alternativeCandidate = scored.find((entry) => entry.product.id !== completeLooks[0]?.items[0]?.productId);

  const openingLine = contactName
    ? `Para ${contactName}, eu manteria a mesma leitura e subiria a composição com peças da própria loja.`
    : "Eu manteria a mesma leitura e subiria a composição com peças da própria loja.";

  const summaryLine = completeLooks[0]?.items.length
    ? `Look montado com ${completeLooks[0].items.length} peça(s) do catálogo ligado a esta sessão.`
    : "A composição completa ainda não fechou, mas o catálogo desta loja foi respeitado.";

  const upsellLine = upsellCandidate
    ? `Se a ideia for elevar o ticket sem perder direção, a próxima peça certa é ${upsellCandidate.profile.title}.`
    : "Se quiser subir o ticket sem perder direção, eu sigo com uma expansão do conjunto."
  ;

  const crossSellLine = crossSellCandidate
    ? `Para complementar sem brigar com a imagem, eu adicionaria ${crossSellCandidate.profile.title}.`
    : "Para complementar sem brigar com a imagem, eu sigo com um complemento mais leve.";

  const alternativeLine = alternativeCandidate
    ? `Se precisar reduzir o valor, eu troco por ${alternativeCandidate.profile.title} e preservo a leitura.`
    : "Se precisar reduzir o valor, eu ajusto a proposta sem perder a coerência.";

  return {
    available: true,
    orgId: resolvedOrgId,
    openingLine,
    summaryLine,
    completeLooks,
    upsellLine,
    crossSellLine,
    alternativeLine,
    targetSignals: unique([
      styleIdentity || "",
      imageGoal || "",
      paletteFamily || "",
      fit || "",
      metal || "",
      audit?.diagnosis.positioning || "",
      audit?.direction.title || "",
    ]),
  };
}
