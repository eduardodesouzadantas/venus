import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CampaignBody = {
  orgId?: string;
  campaignType?: string;
  payload?: { message?: string };
};

const CAMPAIGN_MESSAGES: Record<string, string> = {
  new_collection: "Oi! Acabou de chegar uma nova coleção com peças que combinam com o seu perfil. Posso te mostrar o que separei?",
  reengagement: "Oi! Sinto sua falta por aqui. Temos novidades que combinam com você. Quer dar uma olhada?",
  tryon_followup: "Oi! Vi que você experimentou um look mas não finalizou. A peça ainda está disponível. Posso te ajudar com alguma dúvida?",
  anniversary: "Parabéns pelo seu aniversário! Preparei algo especial para você. Posso te mostrar?",
};

export async function POST(req: NextRequest) {
  let body: CampaignBody;
  try {
    body = (await req.json()) as CampaignBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { orgId, campaignType, payload } = body;
  if (!orgId || !campaignType) {
    return NextResponse.json({ error: "Missing orgId or campaignType" }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  let clients: Array<{ phone: string; last_message_at?: string; message_count?: number; product_id?: string }> = [];

  if (campaignType === "new_collection") {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("phone, last_message_at, metadata")
      .eq("org_id", orgId)
      .gte("last_message_at", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString());
    clients = (data || []) as typeof clients;
  } else if (campaignType === "reengagement") {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("phone, last_message_at")
      .eq("org_id", orgId)
      .lte("last_message_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .gte("last_message_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    clients = (data || []) as typeof clients;
  } else if (campaignType === "tryon_followup") {
    const { data } = await supabase
      .from("tryon_events")
      .select("phone, created_at, product_id")
      .eq("org_id", orgId)
      .is("purchased_at", null)
      .gte("created_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
    clients = (data || []) as typeof clients;
  }

  const { data: org } = await supabase
    .from("orgs")
    .select("whatsapp_token, whatsapp_phone_id, name")
    .eq("id", orgId)
    .maybeSingle();

  const token = (org as Record<string, unknown> | null)?.whatsapp_token as string | undefined ?? process.env.WHATSAPP_TOKEN;
  const phoneId = (org as Record<string, unknown> | null)?.whatsapp_phone_id as string | undefined ?? process.env.WHATSAPP_PHONE_ID;
  const orgName = (org as Record<string, unknown> | null)?.name as string | undefined ?? "loja";

  const baseMessage = CAMPAIGN_MESSAGES[campaignType]?.replace("loja", orgName) ?? payload?.message ?? "Oi! Tenho novidades para você.";

  const results: Array<{ phone: string; sent: boolean }> = [];

  for (const client of clients.slice(0, 50)) {
    const phone = client.phone;
    const message = baseMessage;

    try {
      const sendRes = await fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: message },
        }),
      });

      await supabase.from("campaign_logs").insert({
        org_id: orgId,
        campaign_type: campaignType,
        client_phone: phone,
        message,
        sent_at: new Date().toISOString(),
      });

      results.push({ phone, sent: sendRes.ok });
    } catch {
      results.push({ phone, sent: false });
    }
  }

  return NextResponse.json({ success: true, sent: results.length, results });
}
