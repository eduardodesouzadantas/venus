"server-only";

import OpenAI from "openai";
import type { OnboardingData } from "@/types/onboarding";
import type { VisualAnalysisPayload, VisualAnalysisStyleDirection } from "@/types/visual-analysis";
import { deriveEssenceProfile } from "@/lib/result/essence";
import {
  getStyleDirectionDisplayLabel,
  normalizeStyleDirectionPreference,
} from "@/lib/style-direction";

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function compactText(value: unknown, fallback: string, maxLength: number): string {
  const text = normalizeText(value);
  if (!text) return fallback;
  if (text.length > maxLength) return `${text.slice(0, maxLength - 1).trimEnd()}...`;
  return text;
}

function matchText(value: string): string {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeColorList(
  value: unknown,
  fallback: VisualAnalysisPayload["colors"],
): VisualAnalysisPayload["colors"] {
  if (!Array.isArray(value) || value.length === 0) return fallback;

  const colors = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const hex = normalizeText(record.hex);
      const name = normalizeText(record.name);
      if (!hex || !name) return null;
      return { hex, name };
    })
    .filter((entry): entry is { hex: string; name: string } => Boolean(entry));

  return colors.length > 0 ? colors.slice(0, 3) : fallback;
}

function buildColorHex(name: string, fallbackHex: string): string {
  const text = matchText(name);
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

function buildOnboardingPaletteColors(data: OnboardingData, essenceKey: string): VisualAnalysisPayload["colors"] {
  const favoriteColors = data.colors.favoriteColors.map((value) => normalizeText(value)).filter(Boolean);
  const first = favoriteColors[0] || (essenceKey === "authority" ? "Marinho intenso" : "Azul noturno");
  const second = favoriteColors[1] || (data.colors.metal === "Dourado" ? "Off white" : "Grafite");
  const preference = normalizeStyleDirectionPreference(data.intent.styleDirection);
  const third =
    favoriteColors[2] ||
    (preference === "Feminina" ? "Vinho profundo" : preference === "Masculina" ? "Grafite intenso" : "Contraste controlado");

  return [
    { hex: buildColorHex(first, "#1F2937"), name: first },
    { hex: buildColorHex(second, "#F8FAFC"), name: second },
    { hex: buildColorHex(third, "#7C2D12"), name: third },
  ];
}

function buildContextSummary(data: OnboardingData): string {
  const environments = data.lifestyle.environments.join(", ") || "n/a";
  const favoriteColors = data.colors.favoriteColors.join(", ") || "n/a";
  const avoidColors = data.colors.avoidColors.join(", ") || "n/a";

  return [
    `styleDirection=${getStyleDirectionDisplayLabel(data.intent.styleDirection)}`,
    `imageGoal=${normalizeText(data.intent.imageGoal) || "Elegancia"}`,
    `mainPain=${normalizeText(data.intent.mainPain) || "ruido visual"}`,
    `environments=${environments}`,
    `purchaseDna=${normalizeText(data.lifestyle.purchaseDna) || "n/a"}`,
    `purchaseBehavior=${normalizeText(data.lifestyle.purchaseBehavior) || "n/a"}`,
    `fit=${normalizeText(data.body.fit) || "n/a"}`,
    `faceLines=${normalizeText(data.body.faceLines) || "n/a"}`,
    `hairLength=${normalizeText(data.body.hairLength) || "n/a"}`,
    `metal=${normalizeText(data.colors.metal) || "n/a"}`,
    `favoriteColors=${favoriteColors}`,
    `avoidColors=${avoidColors}`,
    `facePhoto=${data.scanner.facePhoto ? "yes" : "no"}`,
    `bodyPhoto=${data.scanner.bodyPhoto ? "yes" : "no"}`,
  ].join(" | ");
}

function buildFallbackColors(key: string): VisualAnalysisPayload["colors"] {
  if (key.includes("authority")) {
    return [
      { hex: "#0F172A", name: "Navy intenso" },
      { hex: "#F8FAFC", name: "Branco optico" },
      { hex: "#334155", name: "Grafite" },
    ];
  }

  if (key.includes("presence")) {
    return [
      { hex: "#111827", name: "Azul noturno" },
      { hex: "#F5F5F4", name: "Off white" },
      { hex: "#7C2D12", name: "Vinho profundo" },
    ];
  }

  if (key.includes("creative")) {
    return [
      { hex: "#111827", name: "Azul noturno" },
      { hex: "#F8FAFC", name: "Branco optico" },
      { hex: "#7C2D12", name: "Vinho profundo" },
    ];
  }

  if (key.includes("discretion")) {
    return [
      { hex: "#111827", name: "Grafite" },
      { hex: "#F8FAFC", name: "Off white" },
      { hex: "#475569", name: "Chumbo" },
    ];
  }

  return [
    { hex: "#111827", name: "Marinho" },
    { hex: "#F8FAFC", name: "Branco optico" },
    { hex: "#374151", name: "Grafite" },
  ];
}

function buildFallbackAnalysis(data: OnboardingData): VisualAnalysisPayload {
  const essence = deriveEssenceProfile(data);
  const styleDirection = normalizeStyleDirectionPreference(data.intent.styleDirection);
  const goal = normalizeText(data.intent.imageGoal) || "Elegancia";
  const mainPain = normalizeText(data.intent.mainPain) || "ruido visual";
  const fit = normalizeText(data.body.fit) || "Slim";
  const faceLines = normalizeText(data.body.faceLines) || "Marcantes";
  const metal = normalizeText(data.colors.metal) || "Prateado";
  const favoriteColors = data.colors.favoriteColors.map((value) => normalizeText(value)).filter(Boolean);
  const avoidColors = data.colors.avoidColors.map((value) => normalizeText(value)).filter(Boolean);
  const paletteFamily = `${styleDirection} • ${goal}`;
  const paletteDescription = `Favorece ${favoriteColors.join(", ") || "as cores escolhidas"} e evita ${avoidColors.join(", ") || "cores de ruído"}, sustentando ${goal.toLowerCase()} com leitura alinhada à linha ${styleDirection.toLowerCase()}.`;
  const paletteColors = buildOnboardingPaletteColors(data, essence.key);

  return {
    source: "fallback",
    essenceLabel: essence.label,
    essenceSummary: essence.summary,
    confidenceLabel: essence.confidenceLabel,
    keySignals: essence.keySignals,
    styleDirection,
    paletteFamily,
    paletteDescription,
    contrast: essence.key === "authority" || essence.key === "presence" || essence.key === "creative" ? "Alto" : "Medio Alto",
    metal,
    colors: paletteColors,
    diagnostic: {
      currentPerception: `Seu perfil pede menos ruido e mais estrutura. Hoje o ponto sensivel e ${mainPain.toLowerCase()}, mas a leitura aponta para ${essence.label.toLowerCase()} na linha ${styleDirection.toLowerCase()}.`,
      desiredGoal: `Projetar ${goal.toLowerCase()} de um jeito mais limpo, pessoal e consistente.`,
      gapSolution: `Usar o acervo real como eixo e sustentar ${goal.toLowerCase()} com pecas coerentes para um rosto ${faceLines.toLowerCase()}, sem perder a essencia ${essence.label.toLowerCase()}.`,
    },
    bodyVisagism: {
      shoulders:
        fit === "Oversized"
          ? "Se a peca vier ampla, vale equilibrar com base mais limpa para nao perder linha."
          : "Estruture os ombros com pecas que sustentem a presenca sem pesar.",
      face:
        faceLines === "Marcantes"
          ? "Decotes em V e linhas angulares ajudam a equilibrar tracos mais marcados."
          : "Linhas suaves e aberturas leves mantem a leitura facial mais limpa.",
      generalFit: `O caimento ${fit.toLowerCase()} mantem conforto, direcao visual e uso real.`,
    },
    hero: {
      dominantStyle: `${essence.label} • ${goal}`,
      subtitle: `Sua leitura cruza ${goal.toLowerCase()} com fit ${fit.toLowerCase()} e uma linha ${styleDirection.toLowerCase()} mais coerente.`,
    },
    lookNames: essence.lookNames,
    toAvoid: essence.toAvoid,
  };
}

function normalizeAnalysisPayload(
  raw: Partial<VisualAnalysisPayload>,
  fallback: VisualAnalysisPayload,
  data: OnboardingData,
): VisualAnalysisPayload {
  const styleDirection = normalizeStyleDirectionPreference(raw.styleDirection || data.intent.styleDirection || fallback.styleDirection);
  const keySignals = Array.isArray(raw.keySignals) && raw.keySignals.length > 0
    ? raw.keySignals.map((value) => normalizeText(value)).filter(Boolean).slice(0, 4)
    : fallback.keySignals;

  const lookNames: [string, string, string] = [
    compactText(raw.lookNames?.[0], fallback.lookNames[0], 48),
    compactText(raw.lookNames?.[1], fallback.lookNames[1], 48),
    compactText(raw.lookNames?.[2], fallback.lookNames[2], 48),
  ];

  return {
    source: "ai",
    essenceLabel: compactText(raw.essenceLabel, fallback.essenceLabel, 80),
    essenceSummary: compactText(raw.essenceSummary, fallback.essenceSummary, 240),
    confidenceLabel: compactText(raw.confidenceLabel, "Leitura visual por IA", 40),
    keySignals,
    styleDirection,
    paletteFamily: compactText(raw.paletteFamily, fallback.paletteFamily, 80),
    paletteDescription: compactText(raw.paletteDescription, fallback.paletteDescription, 180),
    contrast: compactText(raw.contrast, fallback.contrast, 24),
    metal: compactText(raw.metal, fallback.metal, 24),
    colors: normalizeColorList(raw.colors, fallback.colors),
    diagnostic: {
      currentPerception: compactText(raw.diagnostic?.currentPerception, fallback.diagnostic.currentPerception, 220),
      desiredGoal: compactText(raw.diagnostic?.desiredGoal, fallback.diagnostic.desiredGoal, 180),
      gapSolution: compactText(raw.diagnostic?.gapSolution, fallback.diagnostic.gapSolution, 220),
    },
    bodyVisagism: {
      shoulders: compactText(raw.bodyVisagism?.shoulders, fallback.bodyVisagism.shoulders, 180),
      face: compactText(raw.bodyVisagism?.face, fallback.bodyVisagism.face, 180),
      generalFit: compactText(raw.bodyVisagism?.generalFit, fallback.bodyVisagism.generalFit, 180),
    },
    hero: {
      dominantStyle: compactText(raw.hero?.dominantStyle, fallback.hero.dominantStyle, 90),
      subtitle: compactText(raw.hero?.subtitle, fallback.hero.subtitle, 220),
    },
    lookNames,
    toAvoid:
      Array.isArray(raw.toAvoid) && raw.toAvoid.length > 0
        ? raw.toAvoid.map((value) => normalizeText(value)).filter(Boolean).slice(0, 3)
        : fallback.toAvoid,
  };
}

export async function generateVisualProfileAnalysis(data: OnboardingData): Promise<VisualAnalysisPayload> {
  const fallback = buildFallbackAnalysis(data);
  const apiKey = process.env.OPENAI_API_KEY;

  const photoInputs = [data.scanner.facePhoto, data.scanner.bodyPhoto].filter((value): value is string => Boolean(value));
  if (!apiKey || photoInputs.length === 0) {
    return fallback;
  }

  try {
    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Voce e um consultor de moda senior, visagista e personal stylist de alta renda. Analise a imagem real da pessoa e devolva apenas JSON. Nao cite idade, etnia, saude ou qualquer atributo sensivel. Foque em leitura visual, paleta, caimento, presenca e direcao de styling. Se a leitura for incerta, seja conservador.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "CONTEXTO CANONICO:",
                buildContextSummary(data),
                "",
                `Direcao de styling explicitamente escolhida: ${getStyleDirectionDisplayLabel(data.intent.styleDirection)}`,
                "A imagem da pessoa deve ser o sinal principal. O intake e apoio, nao o centro.",
                "",
                "Retorne JSON com estas chaves:",
                "source, essenceLabel, essenceSummary, confidenceLabel, keySignals, styleDirection, paletteFamily, paletteDescription, contrast, metal, colors, diagnostic, bodyVisagism, hero, lookNames, toAvoid",
                "",
                "Tono: elegante, preciso, humano, consultivo, sem parecer intake ou formulario.",
              ].join("\n"),
            },
            ...photoInputs.map((photo) => ({
              type: "image_url" as const,
              image_url: {
                url: photo,
                detail: "high" as const,
              },
            })),
          ],
        },
      ],
    });

    const content = response.choices[0]?.message.content;
    if (!content) {
      return fallback;
    }

    const parsed = JSON.parse(content) as Partial<VisualAnalysisPayload>;
    return normalizeAnalysisPayload(parsed, fallback, data);
  } catch (error) {
    console.warn("[VISUAL_ANALYSIS] falling back to heuristic profile", error);
    return fallback;
  }
}

export function buildVisualProfileFallback(data: OnboardingData) {
  return buildFallbackAnalysis(data);
}

