import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
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

type VariantRow = {
  product_id: string | null;
  size: string | null;
  quantity: number | null;
  active: boolean | null;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function severityFor(count: number, threshold: number) {
  if (count >= threshold * 2) return "critical" as const;
  if (count >= threshold) return "alert" as const;
  return "info" as const;
}

export async function GET(req: NextRequest) {
  const orgId = normalize(req.nextUrl.searchParams.get("orgId") || req.nextUrl.searchParams.get("org_id"));
  if (!orgId) {
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [productsResult, tryonsResult] = await Promise.all([
    admin.from("products").select("id, name, category, stock, image_url, created_at, primary_color").eq("org_id", orgId).order("created_at", { ascending: false }).limit(500),
    admin.from("tryon_events").select("product_id, created_at, status").eq("org_id", orgId).gte("created_at", thirtyDaysAgo).limit(2000),
  ]);

  let variantsResult: { data: VariantRow[] | null; error: { message: string } | null } = { data: [], error: null };
  try {
    variantsResult = await admin.from("product_variants").select("product_id, size, quantity, active").eq("org_id", orgId).limit(2000);
  } catch {
    variantsResult = { data: [], error: null };
  }

  if (productsResult.error) {
    return NextResponse.json({ error: productsResult.error.message }, { status: 500 });
  }
  if (tryonsResult.error) {
    return NextResponse.json({ error: tryonsResult.error.message }, { status: 500 });
  }

  const products = (productsResult.data || []) as ProductRow[];
  const tryons = (tryonsResult.data || []) as TryOnRow[];
  const variants = (variantsResult.data || []) as VariantRow[];

  const tryonsByProduct = new Map<string, TryOnRow[]>();
  for (const row of tryons) {
    if (!row.product_id) continue;
    const current = tryonsByProduct.get(row.product_id) || [];
    current.push(row);
    tryonsByProduct.set(row.product_id, current);
  }

  const variantsByProduct = new Map<string, VariantRow[]>();
  for (const row of variants) {
    if (!row.product_id) continue;
    const current = variantsByProduct.get(row.product_id) || [];
    current.push(row);
    variantsByProduct.set(row.product_id, current);
  }

  const insights: Array<{
    id: string;
    severity: "critical" | "alert" | "info";
    title: string;
    description: string;
    productId?: string;
    productName?: string;
  }> = [];

  for (const product of products) {
    const tryonCount = (tryonsByProduct.get(product.id) || []).filter((row) => row.status === "completed").length;
    const stock = Number(product.stock || 0);
    const productVariants = variantsByProduct.get(product.id) || [];
    const lowSizes = productVariants.filter((variant) => variant.active !== false && Number(variant.quantity || 0) <= 0);
    const recentTryons = (tryonsByProduct.get(product.id) || []).filter((row) => {
      const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
      return createdAt >= new Date(sevenDaysAgo).getTime();
    }).length;

    if (recentTryons > stock) {
      insights.push({
        id: `demand:${product.id}`,
        severity: severityFor(recentTryons - stock, 1),
        title: "Demanda reprimida",
        description: `${product.name} teve ${recentTryons} try-ons na semana com apenas ${stock} em estoque.`,
        productId: product.id,
        productName: product.name,
      });
    }

    if (tryonCount === 0 && product.stock !== null && product.stock > 0) {
      insights.push({
        id: `dead:${product.id}`,
        severity: product.stock > 5 ? "alert" : "info",
        title: "Dead stock",
        description: `${product.name} não recebeu try-on nos últimos 30 dias e segue com ${stock} unidades.`,
        productId: product.id,
        productName: product.name,
      });
    }

    if (lowSizes.length > 0) {
      insights.push({
        id: `rupture:${product.id}`,
        severity: "critical",
        title: "Ruptura por tamanho",
        description: `${product.name} está sem estoque em ${lowSizes.map((variant) => variant.size || "tamanho").join(", ")}.`,
        productId: product.id,
        productName: product.name,
      });
    }

    if (tryonCount >= 3 && stock > 0) {
      insights.push({
        id: `rebuy:${product.id}`,
        severity: "info",
        title: "Sugestão de recompra",
        description: `${product.name} lidera a atenção com ${tryonCount} try-ons. Vale repor e testar novos tamanhos.`,
        productId: product.id,
        productName: product.name,
      });
    }
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
  });
}
