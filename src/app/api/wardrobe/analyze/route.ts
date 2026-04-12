import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type WardrobeBody = {
  imageBase64?: string;
  imageUrl?: string;
  clientPhone?: string;
  orgId?: string;
  name?: string;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toImageUrl(imageBase64: string) {
  if (imageBase64.startsWith("data:image/")) return imageBase64;
  return `data:image/jpeg;base64,${imageBase64}`;
}

function fallbackAnalysis() {
  return {
    category: "Peça versátil",
    color: "Neutro",
    style: "Estruturado",
    compatibility: "Boa base para combinações complementares",
    complementaryPieces: ["Camisa lisa", "Calça reta", "Blazer neutro"],
    rationale: "A peça foi registrada com leitura neutra para não travar a curadoria. A Venus poderá refiná-la depois com mais contexto visual.",
  };
}

export async function POST(req: NextRequest) {
  let body: WardrobeBody;

  try {
    body = (await req.json()) as WardrobeBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const imageBase64 = normalize(body.imageBase64);
  const imageUrl = normalize(body.imageUrl);
  const clientPhone = normalize(body.clientPhone);
  const orgId = normalize(body.orgId);

  if (!imageBase64 || !clientPhone || !orgId) {
    return NextResponse.json({ error: "Missing imageBase64, clientPhone or orgId" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  let analysis = fallbackAnalysis();

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 500,
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Voce e uma analista de guarda-roupa com foco em styling. Analise a peça e retorne apenas JSON valido.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analise esta peça e retorne JSON com as chaves: category, color, style, compatibility, complementaryPieces (3 itens), rationale. Responda apenas JSON.",
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
    if (content) {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const complementaryPieces = Array.isArray(parsed.complementaryPieces)
        ? parsed.complementaryPieces.map((item) => normalize(item)).filter(Boolean).slice(0, 3)
        : [];

      analysis = {
        category: normalize(parsed.category) || analysis.category,
        color: normalize(parsed.color) || analysis.color,
        style: normalize(parsed.style) || analysis.style,
        compatibility: normalize(parsed.compatibility) || analysis.compatibility,
        complementaryPieces: complementaryPieces.length ? complementaryPieces : analysis.complementaryPieces,
        rationale: normalize(parsed.rationale) || analysis.rationale,
      };
    }
  } catch (error) {
    console.warn("[wardrobe/analyze] analysis fallback", error);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wardrobe_items")
    .insert({
      client_phone: clientPhone,
      org_id: orgId,
      name: normalize(body.name) || analysis.category,
      category: analysis.category,
      color: analysis.color,
      image_url: imageUrl || null,
      analysis,
    })
    .select("id, client_phone, org_id, name, category, color, image_url, analysis, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to save wardrobe item" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    item: data,
  });
}
