import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type WardrobeAnalysisBody = {
  imageBase64?: string;
  clientPhone?: string;
  orgId?: string;
};

type WardrobeAnalysis = {
  name?: string;
  category?: string;
  color?: string;
  season?: string;
  style?: string;
  compatibility?: string;
};

export async function POST(req: NextRequest) {
  let body: WardrobeAnalysisBody;
  try {
    body = (await req.json()) as WardrobeAnalysisBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { imageBase64, clientPhone, orgId } = body;
  if (!imageBase64 || !clientPhone) {
    return NextResponse.json({ error: "Missing imageBase64 or clientPhone" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  let analysis: WardrobeAnalysis = {};

  try {
    const imageUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
              {
                type: "text",
                text: 'Analise esta peça de roupa. Retorne JSON: {"name":"nome da peça","category":"categoria","color":"cor principal","season":"primavera|verão|outono|inverno|todas","style":"casual|formal|esportivo|festa","compatibility":"descreva com que tipo de look combina"}',
              },
            ],
          },
        ],
      }),
    });

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content ?? "";
    analysis = JSON.parse(text.replace(/```json|```/g, "").trim()) as WardrobeAnalysis;
  } catch {
    // Análise falhou — continuamos sem metadados de análise
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // Upload para Supabase Storage
  let imageUrl: string | null = null;
  try {
    const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const buffer = Buffer.from(base64Data, "base64");
    const filename = `wardrobe/${clientPhone}/${Date.now()}.jpg`;

    await supabase.storage
      .from("products")
      .upload(filename, buffer, { contentType: "image/jpeg", upsert: true });

    const { data: urlData } = supabase.storage.from("products").getPublicUrl(filename);
    imageUrl = urlData?.publicUrl ?? null;
  } catch {
    // Upload falhou — continuamos sem URL de imagem
  }

  const { data: item } = await supabase
    .from("wardrobe_items")
    .insert({
      client_phone: clientPhone,
      org_id: orgId ?? null,
      name: analysis.name ?? null,
      category: analysis.category ?? null,
      color: analysis.color ?? null,
      season: analysis.season ?? null,
      image_url: imageUrl,
      analysis,
    })
    .select()
    .maybeSingle();

  return NextResponse.json({ success: true, item });
}
