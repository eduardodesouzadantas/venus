import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type InsightSeverity = "critical" | "warning";

interface InventoryInsight {
  severity: InsightSeverity;
  type: string;
  title: string;
  description: string;
  products: unknown[];
  action: string;
}

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // Produtos com try-ons mas sem estoque (via RPC se disponível)
  const { data: shortage } = await supabase.rpc("get_shortage_products", {
    org_id_param: orgId,
  });

  // Produtos sem movimento em 30 dias (dead stock)
  const { data: deadStock } = await supabase
    .from("products")
    .select("id, name, image_url, created_at")
    .eq("org_id", orgId)
    .eq("active", true);

  const insights: InventoryInsight[] = [];

  const shortageList = (shortage || []) as unknown[];
  if (shortageList.length > 0) {
    insights.push({
      severity: "critical",
      type: "shortage",
      title: `${shortageList.length} produto(s) com demanda sem estoque`,
      description: "Clientes estão tentando experimentar peças indisponíveis",
      products: shortageList,
      action: "Repor estoque urgente",
    });
  }

  type ProductRow = { id: string; name: string; image_url: string | null; created_at: string };
  if (deadStock && deadStock.length > 0) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const stale = (deadStock as ProductRow[]).filter(
      (p) => new Date(p.created_at) < thirtyDaysAgo
    );
    if (stale.length > 0) {
      insights.push({
        severity: "warning",
        type: "dead_stock",
        title: `${stale.length} produto(s) sem movimento em 30 dias`,
        description: "Considere campanha de liquidação segmentada",
        products: stale.slice(0, 5),
        action: "Criar campanha de liquidação",
      });
    }
  }

  return NextResponse.json({ insights, updatedAt: new Date().toISOString() });
}
