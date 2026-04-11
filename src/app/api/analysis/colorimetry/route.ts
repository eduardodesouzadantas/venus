import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ColorimetryPayload = {
  image_base64?: string;
  imageDataUrl?: string;
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

  const imageBase64 = normalizeText(body.image_base64 || body.imageDataUrl);
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
            "Voce e uma colorista profissional com 20 anos de experiencia. Analise a foto do rosto e devolva apenas JSON valido. Nao mencione idade, etnia, saude ou outros atributos sensiveis. Foque em pele, subtom, contraste natural, paleta e armonia visual.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analise esta foto e determine: skinTone (claro, medio, escuro), undertone (frio, quente, neutro), contrast (baixo, medio, alto), favoriteColors (5 cores), avoidColors (3 cores), colorArchetype (Primavera, Verao, Outono, Inverno ou subvariante) e justification (2 frases). Responda APENAS em JSON com as chaves skinTone, undertone, contrast, favoriteColors, avoidColors, colorArchetype e justification.",
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
      favoriteColors: normalizeStringArray(parsed.favoriteColors, 5),
      avoidColors: normalizeStringArray(parsed.avoidColors, 3),
      colorArchetype: normalizeText(parsed.colorArchetype),
      justification: normalizeText(parsed.justification),
    };

    if (
      !payload.skinTone ||
      !payload.undertone ||
      !payload.contrast ||
      payload.favoriteColors.length === 0 ||
      payload.avoidColors.length === 0 ||
      !payload.colorArchetype ||
      !payload.justification
    ) {
      return NextResponse.json({ error: "Invalid AI payload" }, { status: 500 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[analysis/colorimetry] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze colorimetry" },
      { status: 500 }
    );
  }
}
