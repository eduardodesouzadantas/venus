import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildInventoryAlerts, resolveProductStockSnapshot, sumVariantQuantity, type InventoryAlert } from "@/lib/catalog/stock";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string;
  stock_qty: number | null;
  reserved_qty: number | null;
  stock_status: string | null;
  stock: number | null;
  image_url: string | null;
  created_at: string | null;
  primary_color: string | null;
};

type TryOnRow = {
  product_id: string | null;
  created_at: string | null;
  status: string | null;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: NextRequest) {
  const orgId = normalize(req.nextUrl.searchParams.get("orgId") || req.nextUrl.searchParams.get("org_id"));
  if (!orgId) {
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [productsResult, tryonsResult, variantsResult] = await Promise.all([
    admin
      .from("products")
      .select("id, name, stock_qty, reserved_qty, stock_status, stock, image_url, created_at, primary_color")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("tryon_events")
      .select("product_id, created_at, status")
      .eq("org_id", orgId)
      .eq("status", "completed")
      .gte("created_at", thirtyDaysAgo)
      .limit(2000),
    admin.from("product_variants").select("product_id, quantity, active").eq("org_id", orgId).limit(2000),
  ]);

  if (productsResult.error) {
    return NextResponse.json({ error: productsResult.error.message }, { status: 500 });
  }
  if (tryonsResult.error) {
    return NextResponse.json({ error: tryonsResult.error.message }, { status: 500 });
  }
  if (variantsResult.error) {
    return NextResponse.json({ error: variantsResult.error.message }, { status: 500 });
  }

  const products = (productsResult.data || []) as ProductRow[];
  const tryons = (tryonsResult.data || []) as TryOnRow[];
  const variants = (variantsResult.data || []) as Array<{ product_id: string | null; quantity: number | null; active: boolean | null }>;

  const tryonsByProduct = new Map<string, TryOnRow[]>();
  for (const row of tryons) {
    if (!row.product_id) continue;
    const current = tryonsByProduct.get(row.product_id) || [];
    current.push(row);
    tryonsByProduct.set(row.product_id, current);
  }

  const variantsByProduct = new Map<string, Array<{ quantity: number | null; active: boolean | null }>>();
  for (const row of variants) {
    if (!row.product_id) continue;
    const current = variantsByProduct.get(row.product_id) || [];
    current.push({ quantity: row.quantity, active: row.active });
    variantsByProduct.set(row.product_id, current);
  }

  const insights: InventoryAlert[] = [];

  for (const product of products) {
    const productTryons = tryonsByProduct.get(product.id) || [];
    const recentTryons = productTryons.filter((row) => {
      const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
      return createdAt >= new Date(sevenDaysAgo).getTime();
    }).length;
    const stockSnapshot = resolveProductStockSnapshot(product, sumVariantQuantity(variantsByProduct.get(product.id) || []));

    insights.push(
      ...buildInventoryAlerts({
        productId: product.id,
        productName: product.name,
        stockSnapshot,
        tryons7d: recentTryons,
        tryons30d: productTryons.length,
      })
    );
  }

  const summary = {
    critical: insights.filter((item) => item.severity === "critical").length,
    alert: insights.filter((item) => item.severity === "alert").length,
    info: insights.filter((item) => item.severity === "info").length,
  };

  return NextResponse.json({
    ok: true,
    orgId,
    summary,
    insights: insights.slice(0, 20),
    updated_at: new Date().toISOString(),
  });
}
