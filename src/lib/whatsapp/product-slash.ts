import { createWhatsAppClient } from "@/lib/supabase/whatsapp-client";

export interface SlashProduct {
  id: string;
  name: string;
  category: string;
  primary_color: string | null;
  style: string | null;
  type: string;
  price_range: string | null;
  image_url: string | null;
  external_url: string | null;
  created_at: string;
}

export interface MerchantProfileSignals {
  styleIdentity: string;
  intentScore: number;
  tryOnCount: number;
  viewedProducts: string[];
  orgSlug?: string;
  paletteFamily?: string;
  bodyFit?: string;
  objective?: string;
}

export interface SlashLookSuggestion {
  id: string;
  title: string;
  items: SlashProduct[];
  justification: string;
  cta: string;
  confidence: number;
  reasonTags: string[];
}

export interface SlashProductSuggestion {
  product: SlashProduct;
  justification: string;
  confidence: number;
  reasonTags: string[];
}

const supabase = createWhatsAppClient();

export function parseProductCommand(rawValue: string) {
  const trimmed = rawValue.trimStart();
  const match = trimmed.match(/^\/produto(?:\s+(.*))?$/i);

  if (!match) {
    return { active: false, query: "" };
  }

  return {
    active: true,
    query: (match[1] ?? "").trim(),
  };
}

export function parseLookCommand(rawValue: string) {
  const trimmed = rawValue.trimStart();
  const match = trimmed.match(/^\/(?:look|oferta)(?:\s+(.*))?$/i);

  if (!match) {
    return { active: false, query: "" };
  }

  return {
    active: true,
    query: (match[1] ?? "").trim(),
  };
}

export async function fetchMerchantProducts(orgId: string): Promise<SlashProduct[]> {
  if (!orgId) return [];

  const { data, error } = await supabase
    .from("products")
    .select("id,name,category,primary_color,style,type,price_range,image_url,external_url,created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[WHATSAPP_PRODUCT_SLASH] failed to load merchant products", error);
    return [];
  }

  return (data ?? []) as SlashProduct[];
}

export function searchMerchantProducts(products: SlashProduct[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  const scored = products.map((product) => {
    const haystack = [
      product.name,
      product.category,
      product.primary_color ?? "",
      product.style ?? "",
      product.type ?? "",
      product.price_range ?? "",
    ]
      .join(" ")
      .toLowerCase();

    let score = 0;
    if (!normalizedQuery) {
      score = 1;
    } else if (product.name.toLowerCase().includes(normalizedQuery)) {
      score += 4;
    }

    if (normalizedQuery && product.category.toLowerCase().includes(normalizedQuery)) {
      score += 3;
    }

    if (normalizedQuery && (product.style ?? "").toLowerCase().includes(normalizedQuery)) {
      score += 2;
    }

    if (normalizedQuery && haystack.includes(normalizedQuery)) {
      score += 1;
    }

    return { product, score };
  });

  return scored
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return new Date(right.product.created_at).getTime() - new Date(left.product.created_at).getTime();
    })
    .map(({ product }) => product)
    .slice(0, 5);
}

export function buildProductComposerMessage(
  product: SlashProduct,
  context?: { justification?: string; reasonTags?: string[] }
) {
  const opening = buildProductOpening(product, context?.reasonTags ?? []);
  const outcome = inferProductOutcome(context?.reasonTags ?? [], product);

  const parts = [
    `Eu iria por este item para esse perfil: ${product.name}.`,
    opening,
    context?.justification ? `Por que eu indicaria: ${context.justification}` : null,
    outcome ? `Resultado percebido: ${outcome}` : null,
    context?.reasonTags && context.reasonTags.length > 0 ? `Leitura de imagem: ${context.reasonTags.join(" • ")}` : null,
    product.category ? `Base do item: ${product.category}` : null,
    product.style ? `Acabamento: ${product.style}` : null,
    product.primary_color ? `Cor que ajuda na leitura: ${product.primary_color}` : null,
    product.price_range ? `Faixa: ${product.price_range}` : null,
    product.external_url ? `Link: ${product.external_url}` : null,
    "",
    "Se quiser, eu já te mando o link para fechar essa proposta.",
  ].filter(Boolean) as string[];

  return parts.join("\n");
}

const scoreProductForProfile = (
  product: SlashProduct,
  profile: MerchantProfileSignals,
  query: string
) => {
  const haystack = normalizeText([
    product.name,
    product.category,
    product.primary_color ?? "",
    product.style ?? "",
    product.type ?? "",
    product.price_range ?? "",
  ].join(" "));

  const styleText = normalizeText(profile.styleIdentity || "");
  const objectiveText = normalizeText(profile.objective || "");
  const queryText = normalizeText(query);

  let score = 0;
  const reasons: string[] = [];

  if (styleText && haystack.includes(styleText)) {
    score += 7;
    reasons.push("alinha com o estilo do cliente");
  }

  if (objectiveText && haystack.includes(objectiveText)) {
    score += 4;
    reasons.push("bate com o objetivo declarado");
  }

  if (queryText && haystack.includes(queryText)) {
    score += 6;
    reasons.push("responde ao comando digitado");
  }

  if (profile.intentScore >= 75 && containsAny(haystack, ["blazer", "camisa", "alfaiat", "premium", "social", "structured", "tailor"])) {
    score += 4;
    reasons.push("acompanha a intencao alta");
  }

  if (profile.tryOnCount > 2 && containsAny(haystack, ["fit", "slim", "structured", "alfaiat", "tailor"])) {
    score += 4;
    reasons.push("respeita a prova visual ja validada");
  }

  if (profile.paletteFamily && containsAny(haystack, ["preto", "branco", "cinza", "navy", "azul", "bege", "off white", "grafite"])) {
    score += 3;
    reasons.push("conversa com a paleta segura");
  }

  if (profile.bodyFit && containsAny(haystack, [normalizeText(profile.bodyFit)])) {
    score += 3;
    reasons.push("acomoda o caimento preferido");
  }

  return { score, reasons: Array.from(new Set(reasons)) };
};

export function generateProductSuggestions(
  products: SlashProduct[],
  profile: MerchantProfileSignals,
  query: string
): SlashProductSuggestion[] {
  if (!products.length) return [];

  const scored = products
    .map((product) => {
      const result = scoreProductForProfile(product, profile, query);
      return { product, score: result.score, reasons: result.reasons };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return new Date(right.product.created_at).getTime() - new Date(left.product.created_at).getTime();
    });

  if (scored.length === 0) return [];

  return scored
    .map((item) => ({
      product: item.product,
      confidence: Math.min(98, 42 + item.score * 5),
      reasonTags: item.reasons.slice(0, 4),
      justification: `O produto combina com ${profile.styleIdentity || "o perfil atual"} porque a leitura visual, o encaixe e o contexto do item mantem coerencia comercial.`,
    }))
    .filter((item) => item.confidence >= 55 && item.reasonTags.length > 0)
    .slice(0, 5);
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const containsAny = (text: string, tokens: string[]) => tokens.some((token) => text.includes(token));

const inferLookObjective = (profile: MerchantProfileSignals) => {
  const combined = normalizeText(`${profile.styleIdentity || ""} ${profile.objective || ""}`);

  if (containsAny(combined, ["autoridade", "execut", "alfaiat", "quiet luxury", "elite", "authority"])) {
    return { key: "authority", label: "Autoridade", cta: "Fechar este look agora" };
  }

  if (containsAny(combined, ["eleg", "sofistic", "refined", "premium", "luxo", "elegance"])) {
    return { key: "elegance", label: "Elegancia", cta: "Enviar oferta do conjunto" };
  }

  if (containsAny(combined, ["leve", "fresh", "casual", "despojado", "minimal", "clean"])) {
    return { key: "lightness", label: "Leveza", cta: "Mostrar essa combinacao" };
  }

  if (containsAny(combined, ["sensual", "impact", "noite", "festa", "desir"])) {
    return { key: "impact", label: "Impacto", cta: "Levar essa proposta" };
  }

  return { key: "balance", label: "Equilibrio", cta: "Te mando o conjunto completo" };
};

const scoreProductForLook = (
  product: SlashProduct,
  profile: MerchantProfileSignals,
  objectiveKey: string,
  query: string
) => {
  const haystack = normalizeText([
    product.name,
    product.category,
    product.primary_color ?? "",
    product.style ?? "",
    product.type ?? "",
    product.price_range ?? "",
  ].join(" "));

  const styleText = normalizeText(profile.styleIdentity || "");
  const objectiveText = normalizeText(profile.objective || "");
  const queryText = normalizeText(query);

  let score = 0;
  const reasons: string[] = [];

  if (styleText && haystack.includes(styleText)) {
    score += 8;
    reasons.push("alinha com o estilo do cliente");
  }

  if (objectiveText && haystack.includes(objectiveText)) {
    score += 5;
    reasons.push("bate com o objetivo declarado");
  }

  if (queryText && haystack.includes(queryText)) {
    score += 6;
    reasons.push("responde ao comando digitado");
  }

  if (objectiveKey === "authority" && containsAny(haystack, ["blazer", "alfaiat", "tailor", "estrutura", "terno", "camisa", "social"])) {
    score += 8;
    reasons.push("reforca autoridade visual");
  }

  if (objectiveKey === "elegance" && containsAny(haystack, ["minimal", "clean", "premium", "luxo", "refinado", "mono", "preto", "branco", "cinza", "navy", "bege"])) {
    score += 7;
    reasons.push("mantem a leitura elegante");
  }

  if (objectiveKey === "lightness" && containsAny(haystack, ["leve", "casual", "fresh", "cotton", "linho"])) {
    score += 7;
    reasons.push("preserva leveza");
  }

  if (objectiveKey === "impact" && containsAny(haystack, ["impact", "noite", "festa", "luxo", "statement"])) {
    score += 7;
    reasons.push("cria presenca imediata");
  }

  if (profile.intentScore >= 75 && containsAny(haystack, ["blazer", "camisa", "alfaiat", "premium", "social", "structured"])) {
    score += 4;
    reasons.push("acompanha a intencao alta");
  }

  if (profile.tryOnCount > 2 && containsAny(haystack, ["fit", "slim", "structured", "alfaiat", "tailor"])) {
    score += 4;
    reasons.push("respeita a prova visual ja validada");
  }

  if (profile.paletteFamily && containsAny(haystack, ["preto", "branco", "cinza", "navy", "azul", "bege", "off white", "grafite"])) {
    score += 3;
    reasons.push("conversa com a paleta segura");
  }

  if (profile.bodyFit && containsAny(haystack, [normalizeText(profile.bodyFit)])) {
    score += 4;
    reasons.push("acomoda o caimento preferido");
  }

  if (product.type === "roupa") {
    score += 1;
  }

  return { score, reasons: Array.from(new Set(reasons)) };
};

const pickComplementProducts = (
  seed: SlashProduct,
  scored: { product: SlashProduct; score: number; reasons: string[] }[]
) => {
  const complements = scored
    .filter(({ product }) => product.id !== seed.id)
    .sort((left, right) => {
      const leftDiversity = left.product.type !== seed.type ? 2 : 0;
      const rightDiversity = right.product.type !== seed.type ? 2 : 0;
      const leftCategory = left.product.category !== seed.category ? 1 : 0;
      const rightCategory = right.product.category !== seed.category ? 1 : 0;
      const leftScore = left.score + leftDiversity + leftCategory;
      const rightScore = right.score + rightDiversity + rightCategory;
      return rightScore - leftScore;
    });

  const bundle = [seed];
  const seenCategories = new Set<string>([normalizeText(seed.category)]);
  const seenTypes = new Set<string>([normalizeText(seed.type)]);

  for (const candidate of complements) {
    const normalizedCategory = normalizeText(candidate.product.category);
    const normalizedType = normalizeText(candidate.product.type);

    const isUseful = !seenCategories.has(normalizedCategory) || !seenTypes.has(normalizedType);
    if (!isUseful) continue;

    bundle.push(candidate.product);
    seenCategories.add(normalizedCategory);
    seenTypes.add(normalizedType);

    if (bundle.length >= 3) break;
  }

  return bundle;
};

export function generateLookSuggestions(
  products: SlashProduct[],
  profile: MerchantProfileSignals,
  query: string
): SlashLookSuggestion[] {
  if (!products.length) return [];

  const objective = inferLookObjective(profile);
  const scored = products
    .map((product) => {
      const result = scoreProductForLook(product, profile, objective.key, query);
      return { product, score: result.score, reasons: result.reasons };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return new Date(right.product.created_at).getTime() - new Date(left.product.created_at).getTime();
    });

  if (scored.length < 2) return [];

  const suggestions: SlashLookSuggestion[] = [];
  const seenBundleKeys = new Set<string>();

  for (const seed of scored.slice(0, 5)) {
    const bundleProducts = pickComplementProducts(seed.product, scored);
    const bundleKey = bundleProducts.map((product) => product.id).sort().join("|");

    if (seenBundleKeys.has(bundleKey) || bundleProducts.length < 2) continue;

    const reasonTags = new Set<string>(seed.reasons);
    for (const item of bundleProducts.slice(1)) {
      const itemReasons = scored.find((entry) => entry.product.id === item.id)?.reasons || [];
      itemReasons.forEach((reason) => reasonTags.add(reason));
    }

    if (profile.intentScore >= 75) {
      reasonTags.add("intencao alta do cliente");
    }

    if (
      bundleProducts.some((item) => containsAny(normalizeText(item.category), ["accessor", "acessorio"])) &&
      bundleProducts.some((item) => item.type === "roupa")
    ) {
      reasonTags.add("equilibrio entre peca principal e apoio");
    }

    const confidence = Math.min(
      98,
      48 +
        seed.score * 1.6 +
        bundleProducts.reduce((acc, product) => acc + (scored.find((entry) => entry.product.id === product.id)?.score || 0), 0) * 0.35
    );

    if (confidence < 55 || reasonTags.size === 0) continue;

    const anchor = bundleProducts[0];
    const title = `${objective.label} · ${anchor.category}`;
    const cta = `${objective.cta}.`;
    const justification = `O conjunto respeita ${profile.styleIdentity || objective.label} porque a peca âncora sustenta a leitura visual e os complementos mantem proporcao, paleta e contexto de uso coerentes.`;

    suggestions.push({
      id: bundleKey,
      title,
      items: bundleProducts,
      justification,
      cta,
      confidence,
      reasonTags: Array.from(reasonTags).slice(0, 4),
    });

    seenBundleKeys.add(bundleKey);

    if (suggestions.length >= 3) break;
  }

  return suggestions.sort((left, right) => right.confidence - left.confidence);
}

export function buildLookComposerMessage(bundle: SlashLookSuggestion) {
  const heroItem = bundle.items[0];
  const supportingItems = bundle.items.slice(1);
  const outcome = inferLookOutcome(bundle.title, bundle.reasonTags);

  const lines = [
    `Look sugerido: ${bundle.title}`,
    "",
    `Leitura rápida: esse conjunto foi montado para entregar uma imagem mais ${bundle.title.toLowerCase().includes("autoridade") ? "firme" : "coesa"} sem perder naturalidade.`,
    heroItem ? `Peça principal: ${heroItem.name}` : null,
    supportingItems.length > 0 ? `Complementos: ${supportingItems.map((item) => item.name).join(" • ")}` : null,
    "",
    "Conjunto pensado para manter proporção, presença e harmonia visual:",
    ...bundle.items.map((item, index) => {
      const details = [item.category, item.style, item.price_range].filter(Boolean).join(" • ");
      return `${index + 1}. ${item.name}${details ? ` — ${details}` : ""}`;
    }),
    "",
    `Por que eu montaria assim: ${bundle.justification}`,
    outcome ? `Resultado percebido: ${outcome}` : null,
    bundle.reasonTags.length > 0 ? `Leitura de imagem: ${bundle.reasonTags.join(" • ")}` : null,
    "",
    bundle.cta,
  ].filter(Boolean) as string[];

  const links = bundle.items
    .filter((item) => item.external_url)
    .map((item, index) => `${index + 1}. ${item.external_url}`);

  if (links.length > 0) {
    lines.push("", "Links:", ...links);
  }

  return lines.join("\n");
}

const inferProductOutcome = (reasonTags: string[], product: SlashProduct) => {
  const cue = normalizeText([reasonTags.join(" "), product.category, product.style, product.type, product.price_range ?? ""].join(" "));

  if (containsAny(cue, ["autoridade", "blazer", "alfaiat", "social", "structured"])) {
    return "passa uma imagem mais firme, organizada e segura";
  }

  if (containsAny(cue, ["eleg", "premium", "luxo", "refinado", "clean"])) {
    return "eleva a leitura com acabamento mais refinado";
  }

  if (containsAny(cue, ["leve", "casual", "fresh", "linho", "cotton"])) {
    return "mantem a proposta leve, natural e fácil de usar";
  }

  if (containsAny(cue, ["impact", "noite", "festa", "statement"])) {
    return "entrega presença imediata sem parecer forçado";
  }

  return "deixa a proposta mais coerente, comercial e fácil de aceitar";
};

const buildProductOpening = (product: SlashProduct, reasonTags: string[]) => {
  const cue = normalizeText([product.name, product.category, product.style, reasonTags.join(" ")].join(" "));

  if (containsAny(cue, ["autoridade", "alfaiat", "social", "blazer", "execut"])) {
    return "A leitura aqui é de imagem mais firme e estratégica.";
  }

  if (containsAny(cue, ["eleg", "premium", "refin", "luxo", "clean"])) {
    return "A leitura aqui fica mais refinada e premium sem exagero.";
  }

  if (containsAny(cue, ["leve", "casual", "fresh", "minimal"])) {
    return "A leitura aqui fica leve, limpa e fácil de usar no dia a dia.";
  }

  if (containsAny(cue, ["impact", "sensual", "noite", "festa"])) {
    return "A leitura aqui ganha mais presença e destaque visual.";
  }

  return "A leitura aqui fica mais coerente com o perfil e mais fácil de converter.";
};

const inferLookOutcome = (title: string, reasonTags: string[]) => {
  const cue = normalizeText([title, reasonTags.join(" ")].join(" "));

  if (containsAny(cue, ["autoridade", "alfaiat", "blazer", "social"])) {
    return "entrega uma presença mais firme e credível";
  }

  if (containsAny(cue, ["eleg", "premium", "refin", "luxo"])) {
    return "passa uma imagem mais elegante e sofisticada";
  }

  if (containsAny(cue, ["leve", "casual", "fresh", "linho"])) {
    return "mantem leveza sem perder intenção comercial";
  }

  if (containsAny(cue, ["impact", "noite", "festa", "statement"])) {
    return "cria impacto visual e destaca a proposta";
  }

  return "deixa a proposta mais harmônica e comercial";
};
