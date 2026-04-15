import { NextRequest, NextResponse } from "next/server";
import { composeLooksFromCatalog, type CompositionInput } from "@/lib/look-composition/engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body: CompositionInput = await req.json();
    
    if (!body.orgId) {
      return NextResponse.json(
        { error: "Missing orgId" },
        { status: 400 }
      );
    }

    const compositions = await composeLooksFromCatalog(body);
    
    return NextResponse.json({
      success: true,
      compositions,
      count: compositions.length,
    });
  } catch (error) {
    console.error("[look-composition] Error:", error);
    return NextResponse.json(
      { error: "Failed to compose looks" },
      { status: 500 }
    );
  }
}
