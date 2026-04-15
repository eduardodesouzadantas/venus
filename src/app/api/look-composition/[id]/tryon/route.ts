import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLookCompositionById, updateLookCompositionTryOn, trackLookCompositionInteraction } from "@/lib/look-composition/db";
import { fal } from "@fal-ai/client";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lookId } = await params;
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Buscar dados do look
  let look;
  try {
    look = await getLookCompositionById(lookId);
  } catch (err) {
    return NextResponse.json({ error: "Look not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { personImageUrl, orgId, leadId, resultId } = body;

    if (!personImageUrl) {
      return NextResponse.json({ error: "Missing personImageUrl" }, { status: 400 });
    }

    // Verificar permissão
    if (user) {
      const { data: membership } = await supabase
        .from('org_members')
        .select('role')
        .eq('org_id', look.org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Atualizar status para processing
    await updateLookCompositionTryOn(lookId, { status: "processing" });

    // Track interaction
    await trackLookCompositionInteraction(lookId, {
      type: "tryon_generate",
      leadId,
      sourcePage: `/result?id=${resultId}`,
    });

    // Configurar FAL
    if (!process.env.FAL_KEY) {
      throw new Error("Missing FAL_KEY");
    }

    fal.config({
      credentials: process.env.FAL_KEY,
    });

    // Buscar imagem da peça âncora
    const anchorImageUrl = look.anchorPiece.image_url;
    if (!anchorImageUrl) {
      throw new Error("Anchor piece has no image");
    }

    // Detectar categoria
    const category = detectCategory(look.anchorPiece.category || "");

    // Gerar try-on
    const result = await fal.subscribe("fal-ai/fashn/tryon/v1.6", {
      input: {
        model_image: personImageUrl,
        garment_image: anchorImageUrl,
        category,
      },
      pollInterval: 2000,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const generatedImageUrl = Array.isArray((result as any).images) 
      ? (result as any).images[0]?.url 
      : "";

    if (!generatedImageUrl) {
      throw new Error("No image generated");
    }

    // Atualizar com sucesso
    await updateLookCompositionTryOn(lookId, {
      status: "completed",
      imageUrl: generatedImageUrl,
    });

    return NextResponse.json({
      success: true,
      imageUrl: generatedImageUrl,
      lookComposition: look,
    });

  } catch (error) {
    console.error("[look-composition/tryon] Error:", error);
    
    // Atualizar com falha
    await updateLookCompositionTryOn(lookId, { status: "failed" });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate try-on" },
      { status: 500 }
    );
  }
}

function detectCategory(category: string): "tops" | "bottoms" | "one-pieces" {
  const text = category.toLowerCase();
  if (text.includes("dress") || text.includes("vestido")) return "one-pieces";
  if (text.includes("calca") || text.includes("calça") || text.includes("saia") || text.includes("pants") || text.includes("skirt")) return "bottoms";
  return "tops";
}
