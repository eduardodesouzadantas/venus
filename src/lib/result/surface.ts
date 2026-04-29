import type { OnboardingData } from "@/types/onboarding";
import type { LookData, ResultPayload } from "@/types/result";
import type { VisualAnalysisPayload } from "@/types/visual-analysis";
import { deriveEssenceProfile, type EssenceProfile } from "@/lib/result/essence";
import { getStyleDirectionDisplayLabel, isExplicitNeutralStyleDirection } from "@/lib/style-direction";
import { buildColorStyleEvidence, buildColorStyleEvidenceInputFromOnboarding, flattenColorStyleEvidence } from "@/lib/color-style-evidence";

type GoalKey = "Autoridade" | "Elegância" | "Atração" | "Criatividade" | "Discrição sofisticada";

export type ResultSurface = {
  essence: {
    key: EssenceProfile["key"];
    label: string;
    summary: string;
    confidenceLabel: string;
    keySignals: string[];
    styleDirection: EssenceProfile["styleDirection"];
  };
  desirePulse: {
    title: string;
    body: string;
    bullets: string[];
  };
  hero: ResultPayload["hero"];
  palette: ResultPayload["palette"];
  diagnostic: ResultPayload["diagnostic"];
  bodyVisagism: ResultPayload["bodyVisagism"];
  accessories: ResultPayload["accessories"];
  looks: LookData[];
  curationFallback?: {
    reason: string;
    message: string;
  };
  toAvoid: string[];
  headline: string;
  subheadline: string;
  lookHierarchy: Array<{
    label: string;
    title: string;
    description: string;
  }>;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  footerLabel: string;
};

const LOOK_IMAGES = [
  [
    "https://images.unsplash.com/photo-1594932224491-bb24dcafe277?q=80&w=600&auto=format",
    "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?q=80&w=600&auto=format",
  ],
  [
    "https://images.unsplash.com/photo-1614676466623-f1f9e0d1213d?q=80&w=600&auto=format",
    "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&w=600&auto=format",
  ],
  [
    "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=600&auto=format",
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=600&auto=format",
  ],
];

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.trim().replace(/\s+/g, " ");
  if (!/[ÃÂ�]/.test(text)) return text;

  try {
    const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);
    const repaired = new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim().replace(/\s+/g, " ");
    return repaired || text;
  } catch {
    return text;
  }
}

const CURATION_FALLBACK_MESSAGE =
  "Ainda não tenho uma composição completa forte o suficiente. Posso refinar com uma nova foto ou levar essa leitura para o WhatsApp.";
const TECHNICAL_REASON_CODES = new Set([
  "INVALID_OUTFIT_COMPOSITION",
  "SAME_SLOT_CONFLICT",
  "INVALID_HERO_SLOT",
  "PROFILE_DIRECTION_CONFLICT",
  "CONTEXT_FORMALITY_CONFLICT",
]);

function stripTechnicalReasonCodes(value: string): string {
  return TECHNICAL_REASON_CODES.has(value) ? "" : value;
}

function inferLookItemSlot(item: LookData["items"][number]): string {
  const source = normalizeText([
    item.name,
    item.category,
    item.role,
    item.baseDescription,
    item.premiumTitle,
    ...(item.styleTags || []),
    ...(item.categoryTags || []),
    ...(item.useCases || []),
  ].join(" "))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (source.includes("one_piece") || source.includes("vestido") || source.includes("dress") || source.includes("macacao")) return "one_piece";
  if (source.includes("bottom") || source.includes("calca") || source.includes("trouser") || source.includes("jeans") || source.includes("bermuda") || source.includes("short")) return "bottom";
  if (source.includes("layer") || source.includes("blazer") || source.includes("casaco") || source.includes("jaqueta")) return "layer";
  if (source.includes("shoes") || source.includes("sapato") || source.includes("tenis") || source.includes("sandal") || source.includes("flip flop") || source.includes("chinelo") || source.includes("slipper")) return "shoes";
  if (source.includes("accessory") || source.includes("acessorio") || source.includes("bolsa") || source.includes("handbag")) return "accessory";
  if (source.includes("top") || source.includes("camisa") || source.includes("blusa") || source.includes("camiseta")) return "top";
  return "unknown";
}

function isCompleteRenderableLook(look: LookData, styleDirection: string): boolean {
  const slots = (look.items || []).map(inferLookItemSlot);
  const hasOnePiece = slots.includes("one_piece");
  const hasTopAndBottom = slots.includes("top") && slots.includes("bottom");
  const feminine = normalizeText(styleDirection).toLowerCase().includes("femin");
  const slotCounts = slots.reduce<Record<string, number>>((counts, slot) => {
    counts[slot] = (counts[slot] || 0) + 1;
    return counts;
  }, {});

  if ((slotCounts.shoes || 0) > 1 || (slotCounts.accessory || 0) > 1 || (slotCounts.top || 0) > 1 || (slotCounts.bottom || 0) > 1) {
    return false;
  }

  return feminine ? hasOnePiece || hasTopAndBottom : hasTopAndBottom;
}

export function hasLegacyTryOnProducts(looks: LookData[] | null | undefined): boolean {
  return Array.isArray(looks)
    ? looks.some((look) => !normalizeText(look.product_id) || look.items.some((item) => !normalizeText(item.product_id)))
    : false;
}

function normalizeGoalKey(goal: string): GoalKey {
  const normalized = normalizeText(goal).toLowerCase();
  if (normalized.includes("autor")) return "Autoridade";
  if (normalized.includes("criativ")) return "Criatividade";
  if (normalized.includes("atra")) return "Atração";
  if (normalized.includes("discri")) return "Discrição sofisticada";
  return "Elegância";
}

function buildPalette(goalKey: GoalKey, metal: string): ResultPayload["palette"] {
  const metalLabel = normalizeText(metal) === "Dourado" ? "metais quentes" : "metais frios";

  switch (goalKey) {
    case "Autoridade":
      return {
        family: "Presença de Autoridade",
        description: `Contraste alto, tons profundos e ${metalLabel} para sustentar uma leitura firme sem ruído.`,
        contrast: "Alto",
        metal: normalizeText(metal) || "Prateado",
        colors: [
          { hex: "#0F172A", name: "Marinho intenso" },
          { hex: "#F8FAFC", name: "Branco óptico" },
          { hex: "#334155", name: "Grafite" },
        ],
        evidence: {
          basePalette: [
            { hex: "#0F172A", name: "Marinho intenso", reason: "Base profunda para sustentar a leitura.", tier: "base" },
            { hex: "#F8FAFC", name: "Branco óptico", reason: "Base clara para dar respiro visual.", tier: "base" },
            { hex: "#334155", name: "Grafite", reason: "Base segura para manter a imagem firme.", tier: "base" },
          ],
          accentPalette: [],
          avoidOrUseCarefully: [],
          confidence: "medium",
          evidence: "Leitura de cor baseada no objetivo e no metal informado.",
        },
      };
    case "Atração":
      return {
        family: "Contraste Editorial",
        description: `Mais impacto visual, mas ainda com leitura limpa e ${metalLabel} funcionando como ponto de acabamento.`,
        contrast: "Alto",
        metal: normalizeText(metal) || "Prateado",
        colors: [
          { hex: "#111827", name: "Azul noturno" },
          { hex: "#F5F5F4", name: "Off white" },
          { hex: "#7C2D12", name: "Vinho profundo" },
        ],
        evidence: {
          basePalette: [
            { hex: "#111827", name: "Azul noturno", reason: "Base profunda para manter contraste.", tier: "base" },
            { hex: "#F5F5F4", name: "Off white", reason: "Base clara para equilibrar a leitura.", tier: "base" },
            { hex: "#7C2D12", name: "Vinho profundo", reason: "Base de impacto controlado.", tier: "base" },
          ],
          accentPalette: [],
          avoidOrUseCarefully: [],
          confidence: "medium",
          evidence: "Leitura de cor baseada no objetivo e no metal informado.",
        },
      };
    case "Criatividade":
      return {
        family: "Editorial de Contraste",
        description: `Cores mais expressivas, mas ainda legíveis, com ${metalLabel} ajudando a manter a composição controlada.`,
        contrast: "Alto",
        metal: normalizeText(metal) || "Prateado",
        colors: [
          { hex: "#111827", name: "Azul noturno" },
          { hex: "#F8FAFC", name: "Branco óptico" },
          { hex: "#7C2D12", name: "Vinho profundo" },
        ],
        evidence: {
          basePalette: [
            { hex: "#111827", name: "Azul noturno", reason: "Base profunda para sustentar a leitura.", tier: "base" },
            { hex: "#F8FAFC", name: "Branco óptico", reason: "Base clara para dar respiro visual.", tier: "base" },
            { hex: "#7C2D12", name: "Vinho profundo", reason: "Base de impacto controlado.", tier: "base" },
          ],
          accentPalette: [],
          avoidOrUseCarefully: [],
          confidence: "medium",
          evidence: "Leitura de cor baseada no objetivo e no metal informado.",
        },
      };
    case "Discrição sofisticada":
      return {
        family: "Neutros Silenciosos",
        description: `Baixo ruído, leitura limpa e ${metalLabel} discretos para uma presença mais refinada.`,
        contrast: "Médio",
        metal: normalizeText(metal) || "Prateado",
        colors: [
          { hex: "#111827", name: "Grafite" },
          { hex: "#F8FAFC", name: "Off white" },
          { hex: "#475569", name: "Chumbo" },
        ],
        evidence: {
          basePalette: [
            { hex: "#111827", name: "Grafite", reason: "Base neutra para leitura limpa.", tier: "base" },
            { hex: "#F8FAFC", name: "Off white", reason: "Base clara para equilibrar a leitura.", tier: "base" },
            { hex: "#475569", name: "Chumbo", reason: "Base silenciosa para manter sofisticação.", tier: "base" },
          ],
          accentPalette: [],
          avoidOrUseCarefully: [],
          confidence: "medium",
          evidence: "Leitura de cor baseada no objetivo e no metal informado.",
        },
      };
    default:
      return {
        family: "Neutros Refinados",
        description: `Leitura limpa, coerência visual e ${metalLabel} mantendo a imagem pessoal e fácil de usar.`,
        contrast: "Médio Alto",
        metal: normalizeText(metal) || "Prateado",
        colors: [
          { hex: "#111827", name: "Marinho" },
          { hex: "#F8FAFC", name: "Branco óptico" },
          { hex: "#374151", name: "Grafite" },
        ],
        evidence: {
          basePalette: [
            { hex: "#111827", name: "Marinho", reason: "Base segura para a leitura principal.", tier: "base" },
            { hex: "#F8FAFC", name: "Branco óptico", reason: "Base clara para dar respiro visual.", tier: "base" },
            { hex: "#374151", name: "Grafite", reason: "Base neutra para sustentar a imagem.", tier: "base" },
          ],
          accentPalette: [],
          avoidOrUseCarefully: [],
          confidence: "medium",
          evidence: "Leitura de cor baseada no objetivo e no metal informado.",
        },
      };
  }
}

function buildPaletteHex(name: string, fallbackHex: string): string {
  const text = normalizeText(name).toLowerCase();
  if (!text) return fallbackHex;
  if (text.includes("preto") || text.includes("black")) return "#111827";
  if (text.includes("branco") || text.includes("off white") || text.includes("creme")) return "#F8FAFC";
  if (text.includes("grafite") || text.includes("cinza") || text.includes("chumbo")) return "#374151";
  if (text.includes("marinho") || text.includes("azul")) return "#1E3A8A";
  if (text.includes("vinho") || text.includes("bordo") || text.includes("bordô")) return "#7C2D12";
  if (text.includes("verde")) return "#14532D";
  if (text.includes("bege") || text.includes("areia") || text.includes("taupe")) return "#D6C6B8";
  if (text.includes("dour")) return "#C9A84C";
  if (text.includes("prat")) return "#94A3B8";
  if (text.includes("rosa")) return "#DB2777";
  if (text.includes("roxo")) return "#7C3AED";
  if (text.includes("laranja") || text.includes("coral")) return "#EA580C";
  return fallbackHex;
}

function buildPaletteFromOnboarding(data: OnboardingData, essence: EssenceProfile): ResultPayload["palette"] {
  const evidence = buildColorStyleEvidence(buildColorStyleEvidenceInputFromOnboarding(data));
  const directionLabel = isExplicitNeutralStyleDirection(data?.intent?.styleDirection || essence.styleDirection)
    ? "Base neutra"
    : getStyleDirectionDisplayLabel(data?.intent?.styleDirection || essence.styleDirection);
  const contrast = evidence.confidence === "high" ? "Alto" : evidence.confidence === "medium" ? "Médio Alto" : "Médio";

  return {
    family: `${evidence.confidence === "high" ? "Leitura de cor" : "Direção de cor"} • ${directionLabel}`,
    description: evidence.evidence,
    colors: flattenColorStyleEvidence(evidence),
    metal: normalizeText(data?.colors?.metal) || "Prateado",
    contrast,
    evidence,
  };
}

function buildPaletteFromAnalysis(
  analysis: VisualAnalysisPayload,
  fallbackPalette: ResultPayload["palette"],
): ResultPayload["palette"] {
  return {
    family: normalizeText(analysis.paletteFamily) || fallbackPalette.family,
    description: normalizeText(analysis.paletteDescription) || fallbackPalette.description,
    colors: fallbackPalette.colors,
    metal: normalizeText(analysis.metal) || fallbackPalette.metal,
    contrast: normalizeText(analysis.contrast) || fallbackPalette.contrast,
    evidence: fallbackPalette.evidence,
  };
}

function buildBodyVisagism(fit: string, faceLines: string): ResultPayload["bodyVisagism"] {
  const fitLabel = normalizeText(fit) || "Slim";
  const faceLabel = normalizeText(faceLines) || "Marcantes";

  return {
    shoulders:
      fitLabel === "Oversized"
        ? "Se a peça vier ampla, vale equilibrar com base mais limpa para não perder linha."
        : "Estruture os ombros com peças que sustentem a presença sem pesar.",
    face:
      faceLabel === "Marcantes"
        ? "Decotes em V e linhas angulares ajudam a equilibrar traços mais marcados."
        : "Linhas suaves e aberturas leves mantêm a leitura facial mais limpa.",
    generalFit: `O caimento ${fitLabel.toLowerCase()} mantém conforto, direção visual e uso real.`,
  };
}

function buildDiagnostic(goal: string, mainPain: string, fit: string, faceLines: string, essence: EssenceProfile): ResultPayload["diagnostic"] {
  const goalLabel = normalizeText(goal) || "elegância";
  const painLabel = normalizeText(mainPain) || "excesso visual";
  const fitLabel = normalizeText(fit) || "Slim";
  const faceLabel = normalizeText(faceLines) || "Marcantes";
  const directionLabel = getStyleDirectionDisplayLabel(essence.styleDirection);

  return {
    currentPerception: `Seu perfil pede menos excesso visual e mais estrutura. Hoje o ponto sensível é ${painLabel.toLowerCase()} e o caimento ${fitLabel.toLowerCase()}, mas a leitura já aponta para ${essence.label.toLowerCase()} na direção ${directionLabel.toLowerCase()}.`,
    desiredGoal: `Projetar ${goalLabel.toLowerCase()} de um jeito mais limpo, pessoal e consistente com colorimetria e visagismo alinhados.`,
    gapSolution: `Usar o catálogo real como eixo e sustentar ${goalLabel.toLowerCase()} com peças coerentes para sua presença ${faceLabel.toLowerCase()}, sem perder a essência ${essence.label.toLowerCase()} nem a direção ${directionLabel.toLowerCase()}.`,
  };
}

function buildAccessories(goalKey: GoalKey, metal: string, essence: EssenceProfile): ResultPayload["accessories"] {
  const metalLabel = normalizeText(metal) === "Dourado" ? "metais quentes" : "metais frios";

  return {
    scale: goalKey === "Atração" ? "Marcante" : goalKey === "Criatividade" ? "Moderada" : "Minimalista",
    focalPoint: "Punhos e parte superior do tronco",
    advice: `Mantenha poucos pontos de atenção e deixe ${metalLabel} sustentarem a leitura sem competir com a peça principal e com a essência ${essence.label.toLowerCase()}.`,
  };
}

function buildHero(goalKey: GoalKey, goal: string, fit: string, essence: EssenceProfile): ResultPayload["hero"] {
  const dominantStyle =
    goalKey === "Autoridade"
      ? "Autoridade limpa"
      : goalKey === "Atração"
        ? "Presença magnética"
        : goalKey === "Criatividade"
          ? "Contraste editorial"
          : goalKey === "Discrição sofisticada"
            ? "Minimalismo preciso"
            : "Elegância precisa";

  return {
    dominantStyle: `${essence.label} • ${dominantStyle}`,
    subtitle: `A Venus identificou ${normalizeText(goal).toLowerCase() || "elegância"} com fit de caimento ${normalizeText(fit).toLowerCase() || "limpo"}, rotina real e um eixo de ${essence.label.toLowerCase()} na direção ${getStyleDirectionDisplayLabel(essence.styleDirection).toLowerCase()}.`,
    coverImageUrl: "",
  };
}

function buildLookItems(
  prefix: string,
  goalLabel: string,
  essenceLabel: string,
  type: LookData["type"],
  images: string[],
): LookData["items"] {
  if (type === "Híbrido Seguro") {
    return [
      {
        id: `${prefix}-1`,
        product_id: "",
        brand: "Acervo real",
        name: "Blazer estruturado",
        photoUrl: images[0],
        premiumTitle: "Blazer estruturado",
        impactLine: "Organiza a leitura sem pesar.",
        functionalBenefit: "Entrega estrutura e simplifica a combinação.",
        socialEffect: `Passa ${essenceLabel.toLowerCase()} com controle.`,
        contextOfUse: `Rotina, reunião leve e transição entre contextos ${goalLabel}.`,
      },
      {
        id: `${prefix}-2`,
        product_id: "",
        brand: "Acervo real",
        name: "Camisa limpa",
        photoUrl: images[1],
        premiumTitle: "Camisa limpa",
        impactLine: "Traz uma base clara para o look respirar.",
        functionalBenefit: "Mantém a composição fácil de usar.",
        socialEffect: `Deixa a leitura mais segura e coerente para ${essenceLabel.toLowerCase()}.`,
        contextOfUse: "Camada fundamental sob a peça principal.",
      },
    ];
  }

  if (type === "Híbrido Premium") {
    return [
      {
        id: `${prefix}-1`,
        product_id: "",
        brand: "Acervo real",
        name: "Camada refinada",
        photoUrl: images[0],
        premiumTitle: "Camada refinada",
        impactLine: "Sobe a presença sem exagero.",
        functionalBenefit: "Eleva a leitura com controle.",
        socialEffect: `Passa sofisticação mais evidente para ${essenceLabel.toLowerCase()}.`,
        contextOfUse: `Reuniões decisivas e situações em que ${goalLabel} precisa aparecer.`,
      },
      {
        id: `${prefix}-2`,
        product_id: "",
        brand: "Acervo real",
        name: "Calça de base",
        photoUrl: images[1],
        premiumTitle: "Calça de base",
        impactLine: "Mantém o look firme e equilibrado.",
        functionalBenefit: "Sustenta a composição sem roubar atenção.",
        socialEffect: `Ajuda a deixar a presença mais estável e alinhada com ${essenceLabel.toLowerCase()}.`,
        contextOfUse: "Par natural da camada superior.",
      },
    ];
  }

  return [
    {
      id: `${prefix}-1`,
      product_id: "",
      brand: "Acervo real",
      name: "Peça de destaque",
      photoUrl: images[0],
      premiumTitle: "Peça de destaque",
      impactLine: "Coloca um ponto de intenção no look.",
      functionalBenefit: "Amplia repertório sem perder coerência.",
      socialEffect: `Cria presença com controle e reforça ${essenceLabel.toLowerCase()}.`,
      contextOfUse: `Momentos em que ${goalLabel} precisa sair do óbvio.`,
    },
    {
      id: `${prefix}-2`,
      product_id: "",
      brand: "Acervo real",
      name: "Acessório de foco",
      photoUrl: images[1],
      premiumTitle: "Acessório de foco",
      impactLine: "Fecha a composição com um ponto visual claro.",
      functionalBenefit: "Completa o conjunto sem competir com a peça principal.",
      socialEffect: `Deixa o resultado mais intencional para ${essenceLabel.toLowerCase()}.`,
      contextOfUse: "Acabamento visual e finalização do look.",
    },
  ];
}

function buildLooks(goal: string, fit: string, lookNames: [string, string, string], essence: EssenceProfile): LookData[] {
  const goalLabel = normalizeText(goal).toLowerCase() || "elegância";
  const fitLabel = normalizeText(fit).toLowerCase() || "slim";
  const look1Items = buildLookItems("surface-look-1", `${goalLabel} com fit ${fitLabel}`, essence.label, "Híbrido Seguro", LOOK_IMAGES[0]);
  const look2Items = buildLookItems("surface-look-2", `${goalLabel} com fit ${fitLabel}`, essence.label, "Híbrido Premium", LOOK_IMAGES[1]);
  const look3Items = buildLookItems("surface-look-3", `${goalLabel} com fit ${fitLabel}`, essence.label, "Expansão Direcionada", LOOK_IMAGES[2]);

  return [
    {
      id: "surface-look-1",
      product_id: look1Items[0]?.product_id || "",
      name: lookNames[0] || essence.lookNames[0],
      intention: `Entrada limpa com ${goalLabel} e leitura de ${essence.label.toLowerCase()}.`,
      type: "Híbrido Seguro",
      items: look1Items,
      accessories: ["Relógio minimalista"],
      explanation: `A base segura a leitura do perfil e deixa a essência ${essence.label.toLowerCase()} fácil de reconhecer no mundo real.`,
      whenToWear: "Rotina, reunião leve e transição entre contextos.",
      popularityRank: 1,
      isDailyPick: true,
    },
    {
      id: "surface-look-2",
      product_id: look2Items[0]?.product_id || "",
      name: lookNames[1] || essence.lookNames[1],
      intention: `Mais presença sem perder coerência com ${goalLabel} e ${essence.label.toLowerCase()}.`,
      type: "Híbrido Premium",
      items: look2Items,
      accessories: ["Ponto metálico discreto"],
      explanation: `A combinação sobe a presença sem sair do uso real nem parecer forçada, mantendo ${essence.label.toLowerCase()} visível.`,
      whenToWear: "Reuniões decisivas e apresentações importantes.",
      popularityRank: 2,
    },
    {
      id: "surface-look-3",
      product_id: look3Items[0]?.product_id || "",
      name: lookNames[2] || essence.lookNames[2],
      intention: `Um ponto de destaque com controle para ampliar ${essence.label.toLowerCase()} sem exagero.`,
      type: "Expansão Direcionada",
      items: look3Items,
      accessories: ["Óculos estruturado"],
      explanation: `Um toque de contraste amplia a leitura sem transformar a proposta em algo artificial e preserva a essência ${essence.label.toLowerCase()}.`,
      whenToWear: "Eventos sociais e momentos de maior intenção.",
      popularityRank: 3,
    },
  ];
}

/**
 * Normalize API looks to ensure they have valid product UUIDs.
 * API looks come from finalResult.looks and contain real items with real product IDs.
 */
function normalizeApiLooks(apiLooks: any[] | null | undefined, styleDirection: string): LookData[] {
  if (!Array.isArray(apiLooks) || apiLooks.length === 0) return [];

  return apiLooks
    .filter((look: any) => look && typeof look === "object")
    .map((look: any) => {
      const items = Array.isArray(look.items)
        ? look.items.map((item: any) => ({
          ...item,
          // The real product UUID is preserved in product_id; id stays UI-safe.
          id: item.id || "",
          product_id: normalizeText(item.product_id) || normalizeText(item.productId) || "",
          photoUrl: item.photoUrl || item.image_url || "",
          brand: normalizeText(item.brand),
          name: normalizeText(item.name),
          premiumTitle: stripTechnicalReasonCodes(normalizeText(item.premiumTitle)),
          impactLine: stripTechnicalReasonCodes(normalizeText(item.impactLine)),
          functionalBenefit: stripTechnicalReasonCodes(normalizeText(item.functionalBenefit)),
          socialEffect: stripTechnicalReasonCodes(normalizeText(item.socialEffect)),
          contextOfUse: stripTechnicalReasonCodes(normalizeText(item.contextOfUse)),
        }))
        : [];
      const productId = normalizeText(look.product_id) || normalizeText(look.productId) || normalizeText(items[0]?.product_id);

      return {
        id: look.id || "",
        product_id: productId || "",
        name: stripTechnicalReasonCodes(normalizeText(look.name)) || "Look",
        intention: stripTechnicalReasonCodes(normalizeText(look.intention)),
        type: normalizeText(look.type) === "Híbrido Premium" || normalizeText(look.type) === "Expansão Direcionada" ? normalizeText(look.type) : "Híbrido Seguro",
        items,
        accessories: Array.isArray(look.accessories) ? look.accessories.map((item: unknown) => stripTechnicalReasonCodes(normalizeText(item))).filter(Boolean) : [],
        explanation: stripTechnicalReasonCodes(normalizeText(look.explanation)),
        whenToWear: stripTechnicalReasonCodes(normalizeText(look.whenToWear)),
        popularityRank: look.popularityRank,
        isDailyPick: look.isDailyPick,
      } as LookData;
    })
    .filter((look) => look.items.length > 0 && isCompleteRenderableLook(look, styleDirection));
}

export function buildResultSurface(
  data: OnboardingData,
  visualAnalysis?: VisualAnalysisPayload | null,
  apiResult?: { looks?: any[]; curationFallback?: { reason?: string; message?: string } } | null,
): ResultSurface {
  const essence = deriveEssenceProfile(data);
  const goal = normalizeText(data?.intent?.imageGoal) || "Elegância";
  const goalKey = normalizeGoalKey(goal);
  const fit = normalizeText(data?.body?.fit) || "Slim";
  const faceLines = normalizeText(data?.body?.faceLines) || "Marcantes";
  const metal = normalizeText(data?.colors?.metal) || "Prateado";
  const mainPain = normalizeText(data?.intent?.mainPain) || "excesso visual";
  const onboardingPalette = buildPaletteFromOnboarding(data, essence);

  const resolvedEssence = visualAnalysis
    ? {
      key: essence.key,
      label: normalizeText(visualAnalysis.essenceLabel) || essence.label,
      summary: normalizeText(visualAnalysis.essenceSummary) || essence.summary,
      confidenceLabel: normalizeText(visualAnalysis.confidenceLabel) || "Leitura visual por IA",
      keySignals:
        Array.isArray(visualAnalysis.keySignals) && visualAnalysis.keySignals.length > 0
          ? visualAnalysis.keySignals.slice(0, 4).map((value) => normalizeText(value)).filter(Boolean)
          : essence.keySignals,
      styleDirection: essence.styleDirection,
      lookNames:
        Array.isArray(visualAnalysis.lookNames) && visualAnalysis.lookNames.length === 3
          ? [
            normalizeText(visualAnalysis.lookNames[0]) || essence.lookNames[0],
            normalizeText(visualAnalysis.lookNames[1]) || essence.lookNames[1],
            normalizeText(visualAnalysis.lookNames[2]) || essence.lookNames[2],
          ]
          : essence.lookNames,
      toAvoid:
        Array.isArray(visualAnalysis.toAvoid) && visualAnalysis.toAvoid.length > 0
          ? visualAnalysis.toAvoid.slice(0, 3).map((value) => normalizeText(value)).filter(Boolean)
          : essence.toAvoid,
    }
    : {
      key: essence.key,
      label: essence.label,
      summary: essence.summary,
      confidenceLabel: essence.confidenceLabel,
      keySignals: essence.keySignals,
      styleDirection: essence.styleDirection,
      lookNames: essence.lookNames,
      toAvoid: essence.toAvoid,
    };

  const hero = visualAnalysis
    ? {
      dominantStyle: normalizeText(visualAnalysis.hero.dominantStyle) || `${resolvedEssence.label} • ${goal}`,
      subtitle: normalizeText(visualAnalysis.hero.subtitle) || buildHero(goalKey, goal, fit, essence).subtitle,
      coverImageUrl: "",
    }
    : buildHero(goalKey, goal, fit, essence);

  const palette = visualAnalysis
    ? buildPaletteFromAnalysis(visualAnalysis, onboardingPalette)
    : onboardingPalette;

  const diagnostic = visualAnalysis
    ? {
      currentPerception:
        normalizeText(visualAnalysis.diagnostic.currentPerception) ||
        buildDiagnostic(goal, mainPain, fit, faceLines, essence).currentPerception,
      desiredGoal:
        normalizeText(visualAnalysis.diagnostic.desiredGoal) ||
        buildDiagnostic(goal, mainPain, fit, faceLines, essence).desiredGoal,
      gapSolution:
        normalizeText(visualAnalysis.diagnostic.gapSolution) ||
        buildDiagnostic(goal, mainPain, fit, faceLines, essence).gapSolution,
    }
    : buildDiagnostic(goal, mainPain, fit, faceLines, essence);

  const bodyVisagism = visualAnalysis
    ? {
      shoulders:
        normalizeText(visualAnalysis.bodyVisagism.shoulders) ||
        buildBodyVisagism(fit, faceLines).shoulders,
      face: normalizeText(visualAnalysis.bodyVisagism.face) || buildBodyVisagism(fit, faceLines).face,
      generalFit:
        normalizeText(visualAnalysis.bodyVisagism.generalFit) ||
        buildBodyVisagism(fit, faceLines).generalFit,
    }
    : buildBodyVisagism(fit, faceLines);

  const accessories = buildAccessories(goalKey, metal, essence);

  // Prefer real API looks (with real product UUIDs) over synthetic looks
  const apiLooksProvided = Array.isArray(apiResult?.looks);
  const realLooks = normalizeApiLooks(apiResult?.looks, essence.styleDirection);
  const looks = realLooks.length > 0
    ? realLooks
    : apiLooksProvided
      ? []
    : buildLooks(goal, fit, resolvedEssence.lookNames as [string, string, string], essence);
  const curationFallback = looks.length === 0
    ? {
        reason: normalizeText(apiResult?.curationFallback?.reason) || "INVALID_OUTFIT_COMPOSITION",
        message: normalizeText(apiResult?.curationFallback?.message) || CURATION_FALLBACK_MESSAGE,
      }
    : undefined;

  return {
    essence: {
      key: resolvedEssence.key,
      label: resolvedEssence.label,
      summary: resolvedEssence.summary,
      confidenceLabel: resolvedEssence.confidenceLabel,
      keySignals: resolvedEssence.keySignals,
      styleDirection: resolvedEssence.styleDirection,
    },
    desirePulse: {
      title: "Esse é o tipo de leitura que faz a loja inteira fazer sentido",
      body: `Quando a essência acerta, o desejo deixa de ser por um look solto e vira vontade de explorar o acervo inteiro com a mesma lógica.`,
      bullets: [
        "A primeira leitura já parece feita para você.",
        "O post vira prova social com marcação e CTA.",
        "A loja ganha novos testes por atração natural.",
      ],
    },
    hero,
    palette,
    diagnostic,
    bodyVisagism,
    accessories,
    looks,
    ...(curationFallback ? { curationFallback } : {}),
    toAvoid: resolvedEssence.toAvoid,
    headline: visualAnalysis?.source === "ai" ? `Essência captada pela foto: ${resolvedEssence.label}` : `Essência captada: ${resolvedEssence.label}`,
    subheadline: resolvedEssence.summary,
    lookHierarchy: [
      {
        label: "Base",
        title: resolvedEssence.lookNames[0],
        description: "Segura a leitura e mostra o eixo central da sua presença.",
      },
      {
        label: "Apoio",
        title: resolvedEssence.lookNames[1],
        description: "Sobe a presença sem perder coerência com sua essência.",
      },
      {
        label: "Destaque",
        title: resolvedEssence.lookNames[2],
        description: "Abre contraste com controle para ampliar repertório sem exagero.",
      },
    ],
    primaryCtaLabel: "Continuar no WhatsApp",
    secondaryCtaLabel: "Ver meus looks",
    footerLabel: "Curadoria sincronizada com a sua essência e o catálogo real",
  };
}
