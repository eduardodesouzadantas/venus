import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import type { ColorimetryAnalysisData } from "@/types/onboarding";

export const dynamic = "force-dynamic";

type ColorimetryPayload = {
  imageBase64?: string;
  orgId?: string;
};

const FALLBACK_COLORIMETRY: ColorimetryAnalysisData = {
  skinTone: "médio",
  undertone: "neutro",
  contrast: "médio",
  colorSeason: "Neutro Equilibrado",
  favoriteColors: ["Marinho suave", "Grafite", "Off white", "Verde oliva"],
  avoidColors: ["Neon", "Amarelo vibrante", "Rosa choque"],
  faceShape: "oval",
  idealNeckline: "Decote em V suave",
  idealFit: "Caimento reto com estrutura leve",
  idealFabrics: ["Algodão estruturado", "Lã fria", "Viscose encorpada"],
  avoidFabrics: ["Poliéster brilhante", "Tecidos muito plastificados"],
  justification:
    "A leitura neutra prioriza equilíbrio, contraste controlado e cores que mantêm a imagem limpa sem exagero. Quando a análise não consegue ser concluída com segurança, a Venus retorna uma base segura e versátil para não travar o fluxo.",
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, maxItems);
}

function toImageUrl(imageBase64: string) {
  if (imageBase64.startsWith("data:image/")) return imageBase64;
  return `data:image/jpeg;base64,${imageBase64}`;
}

function isColorShape(value: unknown): value is ColorimetryAnalysisData["faceShape"] {
  return (
    value === "oval" ||
    value === "redondo" ||
    value === "quadrado" ||
    value === "coração" ||
    value === "losango" ||
    value === "retangular" ||
    value === ""
  );
}

function parseColorimetryPayload(input: Record<string, unknown>): ColorimetryAnalysisData | null {
  const candidate: ColorimetryAnalysisData = {
    skinTone: normalizeText(input.skinTone) as ColorimetryAnalysisData["skinTone"],
    undertone: normalizeText(input.undertone) as ColorimetryAnalysisData["undertone"],
    contrast: normalizeText(input.contrast) as ColorimetryAnalysisData["contrast"],
    colorSeason: normalizeText(input.colorSeason),
    favoriteColors: normalizeStringArray(input.favoriteColors, 4),
    avoidColors: normalizeStringArray(input.avoidColors, 3),
    faceShape: isColorShape(input.faceShape) ? input.faceShape : "",
    idealNeckline: normalizeText(input.idealNeckline),
    idealFit: normalizeText(input.idealFit),
    idealFabrics: normalizeStringArray(input.idealFabrics, 3),
    avoidFabrics: normalizeStringArray(input.avoidFabrics, 2),
    justification: normalizeText(input.justification),
  };

  if (
    !candidate.skinTone ||
    !candidate.undertone ||
    !candidate.contrast ||
    !candidate.colorSeason ||
    candidate.favoriteColors.length === 0 ||
    candidate.avoidColors.length === 0 ||
    !candidate.faceShape ||
    !candidate.idealNeckline ||
    !candidate.idealFit ||
    candidate.idealFabrics.length === 0 ||
    candidate.avoidFabrics.length === 0 ||
    !candidate.justification
  ) {
    return null;
  }

  return candidate;
}

function fallbackResponse() {
  return NextResponse.json(FALLBACK_COLORIMETRY);
}

export async function POST(req: NextRequest) {
  let body: ColorimetryPayload;

  try {
    body = (await req.json()) as ColorimetryPayload;
  } catch (error) {
    console.warn("[analysis/colorimetry] invalid body", error);
    return fallbackResponse();
  }

  const imageBase64 = normalizeText(body.imageBase64);
  const orgId = normalizeText(body.orgId);

  if (!imageBase64) {
    console.warn("[analysis/colorimetry] missing imageBase64", { orgId });
    return fallbackResponse();
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[analysis/colorimetry] missing OPENAI_API_KEY", { orgId });
    return fallbackResponse();
  }

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 800,
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Voce e uma colorista profissional com 20 anos de experiencia em colorimetria pessoal e visagismo. Analise a foto e retorne APENAS JSON valido sem markdown.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analise esta foto e retorne JSON com exatamente estas chaves: { skinTone: 'claro' | 'médio' | 'escuro', undertone: 'frio' | 'quente' | 'neutro', contrast: 'baixo' | 'médio' | 'alto', colorSeason: string, favoriteColors: string[] (4 cores que favorecem, nomes em português), avoidColors: string[] (3 cores que enfraquecem), faceShape: 'oval' | 'redondo' | 'quadrado' | 'coração' | 'losango' | 'retangular', idealNeckline: string, idealFit: string, idealFabrics: string[] (3 tecidos que valorizam), avoidFabrics: string[] (2 tecidos que não favorecem), justification: string (2 frases explicando a leitura) }",
            },
            {
              type: "image_url" as const,
              image_url: {
                url: toImageUrl(imageBase64),
                detail: "high" as const,
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message.content;
    if (!content) {
      return fallbackResponse();
    }

    const parsed = JSON.parse(content) as Record<string, unknown>;
    const payload = parseColorimetryPayload(parsed);
    if (!payload) {
      return fallbackResponse();
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[analysis/colorimetry] error:", error);
    return fallbackResponse();
  }
}
