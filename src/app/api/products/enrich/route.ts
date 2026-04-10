import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type GeminiPayload = {
  image_base64?: string;
  mime_type?: string;
  file_name?: string;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stripDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,(.*)$/i);
  if (!match) {
    return {
      mimeType: "",
      base64: value,
    };
  }

  return {
    mimeType: match[1] || "",
    base64: match[2] || "",
  };
}

function normalizeAccentless(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeCategory(value: string) {
  const normalized = normalizeAccentless(value);
  return normalized.includes("acessor") ? "acessório" : "roupa";
}

function normalizeStyle(value: string) {
  const normalized = normalizeAccentless(value);
  if (normalized.includes("alfai")) return "alfaiataria";
  if (normalized.includes("street")) return "streetwear";
  if (normalized.includes("lux")) return "luxo";
  if (normalized.includes("festa")) return "festa";
  return "casual";
}

function parseGeminiJson(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const payload = fenced?.[1]?.trim() || trimmed;
  return JSON.parse(payload);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as GeminiPayload | null;
  const imageBase64 = normalize(body?.image_base64);

  if (!imageBase64) {
    return NextResponse.json({ error: "image_base64_missing" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "gemini_api_key_missing" }, { status: 500 });
  }

  const { mimeType, base64 } = stripDataUrl(imageBase64);
  const finalMimeType = normalize(body?.mime_type) || mimeType || "image/jpeg";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  const prompt = [
    "Você é especialista em moda. Analise esta peça e retorne JSON com:",
    "name (string),",
    "category (roupa|acessório),",
    "dominant_color (string),",
    "style (alfaiataria|casual|streetwear|festa|luxo),",
    "emotional_copy (2 frases de venda emocional em português que criam desejo),",
    "tags (array de 5 palavras-chave de estilo).",
    "Responda APENAS com JSON válido, sem markdown.",
  ].join(" ");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: finalMimeType,
                    data: base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 512,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return NextResponse.json(
        {
          error: "gemini_request_failed",
          detail: errorBody || response.statusText,
        },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const rawText = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
    if (!rawText) {
      return NextResponse.json({ error: "gemini_empty_response" }, { status: 502 });
    }

    const parsed = parseGeminiJson(rawText) as Record<string, unknown>;
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.map((item) => normalize(item)).filter(Boolean).slice(0, 5)
      : [];

    return NextResponse.json({
      name: normalize(parsed.name),
      category: normalizeCategory(normalize(parsed.category)),
      dominant_color: normalize(parsed.dominant_color),
      style: normalizeStyle(normalize(parsed.style)),
      emotional_copy: normalize(parsed.emotional_copy).slice(0, 300),
      tags,
      file_name: normalize(body?.file_name),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.toLowerCase().includes("aborted") ? 504 : 500;
    return NextResponse.json({ error: "gemini_analysis_failed", detail: message }, { status });
  } finally {
    clearTimeout(timeout);
  }
}
