import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        to?: string;
        text?: string;
      }
    | null;

  const to = normalize(body?.to);
  const text = normalize(body?.text);

  if (!to || !text) {
    return NextResponse.json({ error: "Missing recipient or text" }, { status: 400 });
  }

  const accessToken = normalize(process.env.WHATSAPP_TOKEN);
  const phoneNumberId = normalize(process.env.WHATSAPP_PHONE_ID);

  if (!accessToken || !phoneNumberId) {
    return NextResponse.json({ error: "WhatsApp token or phone id missing" }, { status: 500 });
  }

  const admin = createAdminClient();

  const { data: conversation, error: conversationError } = await admin
    .from("whatsapp_conversations")
    .select("id, org_slug, user_phone, user_name, last_message, last_updated, status, priority, unread_count")
    .eq("org_slug", slug)
    .eq("user_phone", to)
    .maybeSingle();

  if (conversationError || !conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: false,
        body: text,
      },
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return NextResponse.json(
      { error: payload?.error?.message || `Meta API error (${response.status})` },
      { status: 502 }
    );
  }

  const metaMessageId = payload?.messages?.[0]?.id || null;

  const { data: messageRow, error: messageError } = await admin
    .from("whatsapp_messages")
    .insert({
      org_slug: slug,
      conversation_id: conversation.id,
      sender: "merchant",
      text,
      type: "text",
      metadata: {
        meta_message_id: metaMessageId,
        meta_phone_number_id: phoneNumberId,
      },
    })
    .select("id, created_at")
    .single();

  if (messageError || !messageRow) {
    return NextResponse.json({ error: messageError?.message || "Failed to persist message" }, { status: 500 });
  }

  await admin
    .from("whatsapp_conversations")
    .update({
      last_message: text,
      last_updated: new Date().toISOString(),
      status: "human_takeover",
      priority: "medium",
      unread_count: 0,
    })
    .eq("id", conversation.id)
    .eq("org_slug", slug);

  return NextResponse.json(
    {
      ok: true,
      message_id: messageRow.id,
      meta_message_id: metaMessageId,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
