import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const productId = req.nextUrl.searchParams.get("product_id")?.trim();
    const orgId = req.nextUrl.searchParams.get("org_id")?.trim();

    if (!productId || !orgId) {
        return NextResponse.json({ error: "Missing product_id or org_id" }, { status: 400 });
    }

    try {
        const supabase = createAdminClient();

        const { data: product, error } = await supabase
            .from("products")
            .select("id, image_url, name")
            .eq("id", productId)
            .eq("org_id", orgId)
            .maybeSingle();

        if (error) {
            console.error("[tryon/resolve-product] Error:", error);
            return NextResponse.json({ error: "Failed to resolve product" }, { status: 500 });
        }

        if (!product) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        console.log("[tryon/resolve-product] Resolved:", {
            productId: product.id,
            hasImage: !!product.image_url,
            name: product.name,
        });

        return NextResponse.json({
            id: product.id,
            image_url: product.image_url,
            name: product.name,
        });
    } catch (error) {
        console.error("[tryon/resolve-product] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to resolve product" },
            { status: 500 }
        );
    }
}
