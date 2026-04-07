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

        const text = normalize(message.text?.body) || normalize(message.type) || "";
        const userName = normalize(contact?.profile?.name) || "Cliente Venus";
        const timestamp = message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString();

        const { data: existingConversation } = await admin
          .from("whatsapp_conversations")
          .select("id, org_slug, user_phone, user_name, status, priority, unread_count, last_message, last_updated")
          .eq("org_slug", org.slug)
          .eq("user_phone", userPhone)
          .maybeSingle();

        let finalConversationId = existingConversation?.id || null;

        if (!finalConversationId) {
          const { data: createdConversation } = await admin
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

          finalConversationId = createdConversation?.id || null;
        }

        if (!finalConversationId) continue;

        await admin.from("whatsapp_messages").insert({
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

        await admin
          .from("whatsapp_conversations")
          .update({
            user_name: userName,
            last_message: text,
            last_updated: timestamp,
            status: "ai_active",
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
        } catch (leadError) {
          console.warn("[WHATSAPP_WEBHOOK] failed to sync lead", leadError);
        }
      }
    }
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
