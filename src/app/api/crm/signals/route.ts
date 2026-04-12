import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const now = Date.now();

  // HOT: try-on nos últimos 10 min sem compra
  const { data: hotData } = await supabase
    .from("tryon_events")
    .select("phone, created_at, product_id")
    .eq("org_id", orgId)
    .is("purchased_at", null)
    .gte("created_at", new Date(now - 10 * 60 * 1000).toISOString());

  // WARM: 3+ mensagens sem compra nos últimos 7 dias
  const { data: warmData } = await supabase
    .from("whatsapp_conversations")
    .select("phone, last_message_at, message_count")
    .eq("org_id", orgId)
    .gte("message_count", 3)
    .is("converted_at", null)
    .gte("last_message_at", new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString());

  // COLD: sem atividade 7-30 dias
  const { data: coldData } = await supabase
    .from("whatsapp_conversations")
    .select("phone, last_message_at")
    .eq("org_id", orgId)
    .lte("last_message_at", new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString())
    .gte("last_message_at", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString());

  type HotRow = { phone: string; created_at: string; product_id: string };
  type WarmRow = { phone: string; last_message_at: string; message_count: number };
  type ColdRow = { phone: string; last_message_at: string };

  return NextResponse.json({
    hot: ((hotData || []) as HotRow[]).map((d) => ({
      phone: d.phone,
      lastAction: "Try-on gerado",
      minutesAgo: Math.round((now - new Date(d.created_at).getTime()) / 60000),
      recommendedAction: "Contatar agora — 80% de chance de compra",
    })),
    warm: ((warmData || []) as WarmRow[]).map((d) => ({
      phone: d.phone,
      lastAction: `${d.message_count} conversas sem compra`,
      minutesAgo: Math.round((now - new Date(d.last_message_at).getTime()) / 60000),
      recommendedAction: "Enviar oferta personalizada",
    })),
    cold: ((coldData || []) as ColdRow[]).map((d) => ({
      phone: d.phone,
      lastAction: "Sem atividade",
      minutesAgo: Math.round((now - new Date(d.last_message_at).getTime()) / 60000),
      recommendedAction: "Campanha de reengajamento",
    })),
    vip: [],
  });
}
