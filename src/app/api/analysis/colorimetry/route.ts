import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ColorimetryPayload = {
  image_base64?: string;
  imageDataUrl?: string;
  imageBase64?: string;
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

export async function POST(req: NextRequest) {
  let body: ColorimetryPayload;

  try {
    body = (await req.json()) as ColorimetryPayload;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const imageBase64 = normalizeText(
    body.image_base64 || body.imageDataUrl || body.imageBase64
  );
  if (!imageBase64) {
    return NextResponse.json({ error: "Missing image_base64" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Você é colorista e visagista profissional com 20 anos de experiência. Analise fotos e retorne APENAS JSON válido. Não mencione idade, etnia, saúde ou outros atributos sensíveis. Foque em pele, subtom, contraste natural, paleta, harmonia visual, formato de rosto e orientações de moda.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analise esta foto e retorne JSON com exatamente estas chaves:
{
  "skinTone": "claro|médio|escuro",
  "undertone": "frio|quente|neutro",
  "contrast": "baixo|médio|alto",
  "colorSeason": "nome da estação (ex: Inverno Puro, Verão Suave, Outono Quente, Primavera Clara)",
  "colorArchetype": "Primavera|Verão|Outono|Inverno ou subvariante",
  "favoriteColors": ["5 cores que favorecem em português"],
  "avoidColors": ["3 cores que enfraquecem"],
  "faceShape": "oval|redondo|quadrado|coração|losango|retangular",
  "idealNeckline": "decote ideal (ex: Decote em V profundo, Gola estruturada)",
  "idealFit": "caimento ideal (ex: Slim com ombro estruturado, Fluido e solto)",
  "idealFabrics": ["3 tecidos que valorizam"],
  "avoidFabrics": ["2 tecidos que não favorecem"],
  "justification": "2 frases explicando a leitura visual"
}`,
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
      return NextResponse.json({ error: "Empty OpenAI response" }, { status: 500 });
    }

    const parsed = JSON.parse(content) as Record<string, unknown>;
    const payload = {
      skinTone: normalizeText(parsed.skinTone),
      undertone: normalizeText(parsed.undertone),
      contrast: normalizeText(parsed.contrast),
      colorSeason: normalizeText(parsed.colorSeason),
      colorArchetype: normalizeText(parsed.colorArchetype),
      favoriteColors: normalizeStringArray(parsed.favoriteColors, 5),
      avoidColors: normalizeStringArray(parsed.avoidColors, 3),
      faceShape: normalizeText(parsed.faceShape),
      idealNeckline: normalizeText(parsed.idealNeckline),
      idealFit: normalizeText(parsed.idealFit),
      idealFabrics: normalizeStringArray(parsed.idealFabrics, 3),
      avoidFabrics: normalizeStringArray(parsed.avoidFabrics, 2),
      justification: normalizeText(parsed.justification),
    };

    if (
      !payload.skinTone ||
      !payload.undertone ||
      !payload.contrast ||
      payload.favoriteColors.length === 0 ||
      payload.avoidColors.length === 0 ||
      !payload.justification
    ) {
      return NextResponse.json({ error: "Invalid AI payload" }, { status: 500 });
    }

    // Also expose under success/colorimetry shape for callers that use that format
    return NextResponse.json({ ...payload, success: true, colorimetry: payload });
  } catch (error) {
    console.error("[analysis/colorimetry] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze colorimetry" },
      { status: 500 }
    );
  }
}
