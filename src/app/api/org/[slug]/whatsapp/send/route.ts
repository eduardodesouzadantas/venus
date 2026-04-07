import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertMerchantWritableOrgAccess } from "@/lib/tenant/core";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  decryptStoredMetaIntegrationToken,
  loadMetaIntegrationByOrgId,
  sendMetaWhatsAppTextMessage,
} from "@/lib/whatsapp/meta";

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
        conversationId?: string;
        text?: string;
        type?: string;
        sender?: string;
        metadata?: Record<string, unknown>;
      }
    | null;

  const conversationId = normalize(body?.conversationId);
  const text = normalize(body?.text);
  const sender = normalize(body?.sender) || "merchant";
  const type = normalize(body?.type) || "text";

  if (!conversationId || !text) {
    return NextResponse.json({ error: "Missing conversation or text" }, { status: 400 });
  }

  const supabase = await createClient();
  const resolved = await assertMerchantWritableOrgAccess(supabase).catch((error: unknown) => {
    return { error: error instanceof Error ? error.message : "Access denied" } as const;
  });

  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 403 });
  }

  if (resolved.org.slug !== slug) {
    return NextResponse.json({ error: "Merchant org mismatch" }, { status: 403 });
  }

  const admin = createAdminClient();
  const integration = await loadMetaIntegrationByOrgId(admin, resolved.org.id);

  if (!integration) {
    return NextResponse.json({ error: "WhatsApp oficial não conectado para esta loja" }, { status: 409 });
  }

  const { data: conversation, error: conversationError } = await admin
    .from("whatsapp_conversations")
    .select("id, org_slug, user_phone, user_name, last_message, last_updated, status, priority, unread_count")
    .eq("id", conversationId)
    .eq("org_slug", slug)
    .maybeSingle();

  if (conversationError || !conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const accessToken = decryptStoredMetaIntegrationToken(integration);
  const sendResult = await sendMetaWhatsAppTextMessage({
    accessToken,
    phoneNumberId: integration.phone_number_id,
    to: normalize(conversation.user_phone),
    text,
    previewUrl: false,
  }).catch((error: unknown) => {
    return { error: error instanceof Error ? error.message : "Meta send failed" } as const;
  });

  if ("error" in sendResult) {
    return NextResponse.json({ error: sendResult.error }, { status: 502 });
  }

  const metaMessageId = sendResult.messages?.[0]?.id || null;

  const { data: messageRow, error: messageError } = await admin
    .from("whatsapp_messages")
    .insert({
      org_slug: slug,
      conversation_id: conversationId,
      sender,
      text,
      type,
      metadata: {
        ...(body?.metadata || {}),
        meta_message_id: metaMessageId,
        meta_phone_number_id: integration.phone_number_id,
        meta_business_account_id: integration.business_account_id,
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
      status: sender === "merchant" ? "human_takeover" : conversation.status,
      priority: sender === "merchant" ? "medium" : conversation.priority,
      unread_count: sender === "merchant" ? 0 : (conversation.unread_count || 0) + 1,
    })
    .eq("id", conversationId)
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
