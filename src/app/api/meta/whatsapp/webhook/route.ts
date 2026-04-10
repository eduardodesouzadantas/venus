import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateLead } from "@/lib/leads";
import { bumpTenantUsageDaily } from "@/lib/tenant/core";
import { loadMetaIntegrationByPhoneNumberId } from "@/lib/whatsapp/meta";

export const dynamic = "force-dynamic";

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: {
          phone_number_id?: string;
          display_phone_number?: string;
        };
        contacts?: Array<{
          wa_id?: string;
          profile?: {
            name?: string;
          };
        }>;
        messages?: Array<{
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: {
            body?: string;
          };
        }>;
        statuses?: Array<Record<string, unknown>>;
      };
    }>;
  }>;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getWebhookVerifyToken() {
  return normalize(process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = normalize(url.searchParams.get("hub.mode"));
  const token = normalize(url.searchParams.get("hub.verify_token"));
  const challenge = normalize(url.searchParams.get("hub.challenge"));
  const expectedToken = getWebhookVerifyToken();

  if (mode === "subscribe" && expectedToken && token === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  return NextResponse.json({ error: "Webhook verification failed" }, { status: 403 });
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as WhatsAppWebhookPayload | null;
  if (!payload?.entry?.length) {
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();

  for (const entry of payload.entry) {
    for (const change of entry.changes || []) {
      const value = change.value;
      const phoneNumberId = normalize(value?.metadata?.phone_number_id);
      if (!phoneNumberId) continue;

      const integration = await loadMetaIntegrationByPhoneNumberId(admin, phoneNumberId).catch(() => null);
      if (!integration) continue;

      const { data: org } = await admin
        .from("orgs")
        .select("id, slug, name")
        .eq("id", integration.org_id)
        .maybeSingle();

      if (!org) continue;

      const contact = value?.contacts?.[0];
      const messages = value?.messages || [];

      for (const message of messages) {
        const userPhone = normalize(message.from);
        if (!userPhone) continue;

        const text = normalize(message.text?.body);
        if (!text) continue;

        const userName = normalize(contact?.profile?.name) || "Cliente Venus";
        const timestamp = message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString();
        let nextConversationStatus: "ai_active" | "human_takeover" = "ai_active";
        let nextConversationLastMessage = text;
        let nextConversationLastUpdated = timestamp;

        const { data: existingConversation } = await admin
          .from("whatsapp_conversations")
          .select("id, org_slug, user_phone, user_name, status, priority, unread_count, last_message, last_updated")
          .eq("org_slug", org.slug)
          .eq("user_phone", userPhone)
          .maybeSingle();

        let finalConversationId = existingConversation?.id || null;

        if (!finalConversationId) {
          const { data: createdConversation, error: convError } = await admin
            .from("whatsapp_conversations")
            .insert({
              org_slug: org.slug,
              user_phone: userPhone,
              user_name: userName,
              user_context: {
                name: userName,
                phone: userPhone,
                orgSlug: org.slug,
                source: "meta_webhook",
              },
              status: "ai_active",
              priority: "medium",
              last_message: text,
              unread_count: 1,
              last_updated: timestamp,
            })
            .select("id")
            .single();

          if (convError) {
            console.error("[WEBHOOK] conv insert error:", convError);
          }

          finalConversationId = createdConversation?.id || null;
        }

        if (!finalConversationId) continue;

        const { error: msgError } = await admin.from("whatsapp_messages").insert({
          conversation_id: finalConversationId,
          org_slug: org.slug,
          sender: "user",
          text,
          type: message.type || "text",
          metadata: {
            meta_message_id: message.id || null,
            meta_phone_number_id: phoneNumberId,
            meta_display_phone_number: value?.metadata?.display_phone_number || null,
          },
        });

        if (msgError) {
          console.error("[WEBHOOK] msg insert error:", msgError);
        }

        try {
          const { data: conv } = await admin
            .from("whatsapp_conversations")
            .select("status")
            .eq("id", finalConversationId)
            .maybeSingle();

          if (conv?.status === "ai_active") {
            const { loadContext } = await import("@/lib/venus/ConversationContext");
            const { detectIntent } = await import("@/lib/venus/IntentDetector");
            const { generateReply } = await import("@/lib/venus/VenusStylist");

            const context = await loadContext(userPhone, org.id);
            const intent = detectIntent(text, context.history);

            if (intent === "humano") {
              await admin.from("whatsapp_conversations").update({ status: "human_takeover" }).eq("id", finalConversationId);
              nextConversationStatus = "human_takeover";
            } else {
              const { data: recentVenus } = await admin
                .from("whatsapp_messages")
                .select("id")
                .eq("conversation_id", finalConversationId)
                .eq("sender", "venus")
                .gte("created_at", new Date(Date.now() - 30000).toISOString())
                .maybeSingle();

              if (recentVenus) {
                console.log("[VENUS] resposta recente detectada - skip");
              } else {
                const venusReply = await generateReply({ ...context, state: intent }, text);

                if (venusReply) {
                  await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      messaging_product: "whatsapp",
                      to: userPhone,
                      type: "text",
                      text: { body: venusReply },
                    }),
                  });

                  await admin.from("whatsapp_messages").insert({
                    conversation_id: finalConversationId,
                    org_slug: org.slug,
                    sender: "venus",
                    text: venusReply,
                    type: "text",
                    metadata: { generated_by: "venus_stylist", state: intent },
                  });

                  nextConversationLastMessage = venusReply;
                  nextConversationLastUpdated = new Date().toISOString();

                  await admin
                    .from("whatsapp_conversations")
                    .update({
                      last_message: venusReply,
                      last_updated: nextConversationLastUpdated,
                    })
                    .eq("id", finalConversationId);
                }
              }
            }
          }
        } catch (venusError) {
          console.error("[VENUS_STYLIST] error:", venusError);
        }

        await admin
          .from("whatsapp_conversations")
          .update({
            user_name: userName,
            last_message: nextConversationLastMessage,
            last_updated: nextConversationLastUpdated,
            status: nextConversationStatus,
            priority: "medium",
            unread_count: (existingConversation?.unread_count || 0) + 1,
          })
          .eq("id", finalConversationId)
          .eq("org_slug", org.slug);

        try {
          const { lead, created } = await findOrCreateLead(admin, {
            orgId: org.id,
            name: userName,
            phone: userPhone,
            source: "whatsapp",
            status: "engaged",
            whatsappKey: userPhone,
            intentScore: 60,
            lastInteractionAt: timestamp,
          });

          await admin.from("tenant_events").insert({
            org_id: org.id,
            actor_user_id: null,
            event_type: created ? "lead.created_from_whatsapp_webhook" : "lead.engaged_from_whatsapp_webhook",
            event_source: "whatsapp",
            dedupe_key: `whatsapp_webhook:${org.id}:${lead.id}:${message.id || timestamp}`,
            payload: {
              lead_id: lead.id,
              conversation_id: finalConversationId,
              message_id: message.id || null,
              org_slug: org.slug,
            },
          });

          await bumpTenantUsageDaily(admin, org.id, { leads: created ? 1 : 0, events_count: 1 });
        } catch (e) {
          console.error("[WEBHOOK] lead sync error:", e);
        }
      }
    }
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
