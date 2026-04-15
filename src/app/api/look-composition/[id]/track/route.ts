import { NextRequest, NextResponse } from "next/server";
import { trackLookCompositionInteraction, recordLookCompositionConversion } from "@/lib/look-composition/db";

export const dynamic = "force-dynamic";

// POST /api/look-composition/[id]/track
// Track interactions (view, click, etc)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lookId } = await params;
  
  try {
    const body = await req.json();
    const { 
      type, 
      leadId, 
      sessionId, 
      sourcePage, 
      metadata 
    } = body;

    if (!type) {
      return NextResponse.json({ error: "Missing type" }, { status: 400 });
    }

    await trackLookCompositionInteraction(lookId, {
      type,
      leadId,
      sessionId,
      sourcePage,
      metadata,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[look-composition/track] Error:", error);
    return NextResponse.json(
      { error: "Failed to track interaction" },
      { status: 500 }
    );
  }
}

// PUT /api/look-composition/[id]/track
// Record conversion (purchase)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lookId } = await params;
  
  try {
    const body = await req.json();
    const {
      leadId,
      purchasedProductIds,
      totalValue,
      source,
      whatsappConversationId,
    } = body;

    if (!purchasedProductIds || !Array.isArray(purchasedProductIds)) {
      return NextResponse.json({ error: "Missing purchasedProductIds" }, { status: 400 });
    }

    await recordLookCompositionConversion(lookId, {
      leadId,
      purchasedProductIds,
      totalValue,
      source,
      whatsappConversationId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[look-composition/track] Error:", error);
    return NextResponse.json(
      { error: "Failed to record conversion" },
      { status: 500 }
    );
  }
}
