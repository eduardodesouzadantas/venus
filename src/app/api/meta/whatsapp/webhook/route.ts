import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateLead } from "@/lib/leads";
import { loadLeadContextByIdentity, updateIntentScore, upsertLeadContextByLeadId } from "@/lib/lead-context";
import { decideNextAction } from "@/lib/decision-engine";
import { recordDecisionOutcome } from "@/lib/decision-engine/learning";
import { bumpTenantUsageDaily } from "@/lib/tenant/core";
import { loadMetaIntegrationByPhoneNumberId } from "@/lib/whatsapp/meta";
import { maskPhone } from "@/lib/privacy/logging";
import { logSecurityEvent } from "@/lib/reliability/security";

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

function normalizeForMatch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasAnyKeyword(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
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
  logSecurityEvent("info", "whatsapp_webhook_received", {
    route: "meta/whatsapp/webhook",
    hasPayload: !!payload,
    entryCount: payload?.entry?.length || 0,
    changeCount: payload?.entry?.reduce((total, entry) => total + (entry.changes?.length || 0), 0) || 0,
  });

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
            logSecurityEvent("error", "whatsapp_conversation_insert_failed", {
              route: "meta/whatsapp/webhook",
              orgSlug: org.slug,
              error: convError.message,
            });
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
          logSecurityEvent("error", "whatsapp_message_insert_failed", {
            route: "meta/whatsapp/webhook",
            orgSlug: org.slug,
            error: msgError.message,
          });
        }

        const seedLead = await findOrCreateLead(admin, {
          orgId: org.id,
          name: userName,
          phone: userPhone,
          source: "whatsapp",
          status: "engaged",
          whatsappKey: userPhone,
          intentScore: 50,
          lastInteractionAt: timestamp,
        });

        const leadSnapshot = await loadLeadContextByIdentity(admin, {
          orgId: org.id,
          leadId: seedLead.lead.id,
          phone: userPhone,
        }).catch(() => ({ lead: null, context: null }));

        const currentIntentScore =
          typeof leadSnapshot.context?.intent_score === "number"
            ? leadSnapshot.context.intent_score
            : typeof seedLead.lead.intent_score === "number"
              ? seedLead.lead.intent_score
              : 0;

        const previousActivityAt =
          normalize(leadSnapshot.context?.updated_at) ||
          normalize(existingConversation?.last_updated) ||
          normalize(seedLead.lead.last_interaction_at) ||
          null;

        const normalizedText = normalizeForMatch(text);
        const variationRequested = hasAnyKeyword(normalizedText, [
          /varia[cç][aã]o/,
          /outra op[cç][aã]o/,
          /mais op[cç][aã]es/,
          /troca/,
          /alternativa/,
          /rever/,
          /ajuste/,
        ]);
        const recommendationIgnored =
          hasAnyKeyword(normalizedText, [
            /n[aã]o gostei/,
            /n[aã]o curti/,
            /n[aã]o faz sentido/,
            /n[aã]o quero/,
            /prefiro outro/,
            /passo/,
          ]);
        const inactive24h =
          previousActivityAt ? Date.parse(timestamp) - Date.parse(previousActivityAt) > 24 * 60 * 60 * 1000 : false;
        const intentEventType = inactive24h
          ? "inactive_24h"
          : variationRequested
            ? "variation_requested"
            : recommendationIgnored
              ? "recommendation_ignored"
              : null;
        const nextIntentScore = intentEventType
          ? updateIntentScore(intentEventType, currentIntentScore, {
            now: timestamp,
            lastActivityAt: previousActivityAt,
          })
          : seedLead.lead.intent_score ?? currentIntentScore;

        if (intentEventType === "variation_requested") {
          await recordDecisionOutcome({
            lead_id: seedLead.lead.id,
            action: "SUGGEST_NEW_LOOK",
            outcome: "REQUESTED_VARIATION",
            timestamp,
          }).catch((error) => {
            logSecurityEvent("warn", "whatsapp_outcome_record_failed", {
              route: "meta/whatsapp/webhook",
              orgSlug: org.slug,
              outcome: "variation_requested",
              error: error instanceof Error ? error.message : String(error),
            });
          });
        } else if (intentEventType === "recommendation_ignored") {
          await recordDecisionOutcome({
            lead_id: seedLead.lead.id,
            action: "SUGGEST_NEW_LOOK",
            outcome: "DROPPED_SESSION",
            timestamp,
          }).catch((error) => {
            logSecurityEvent("warn", "whatsapp_outcome_record_failed", {
              route: "meta/whatsapp/webhook",
              orgSlug: org.slug,
              outcome: "recommendation_ignored",
              error: error instanceof Error ? error.message : String(error),
            });
          });
        } else if (intentEventType === "inactive_24h") {
          await recordDecisionOutcome({
            lead_id: seedLead.lead.id,
            action: "SEND_WHATSAPP_MESSAGE",
            outcome: "NO_RESPONSE",
            timestamp,
          }).catch((error) => {
            logSecurityEvent("warn", "whatsapp_outcome_record_failed", {
              route: "meta/whatsapp/webhook",
              orgSlug: org.slug,
              outcome: "inactive_24h",
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }

        await upsertLeadContextByLeadId(admin, {
          orgId: org.id,
          leadId: seedLead.lead.id,
          profileData: {
            name: userName,
            phone: userPhone,
            orgSlug: org.slug,
            source: "whatsapp_webhook",
          },
          emotionalState: {
            source: "whatsapp_webhook",
            lastMessage: text,
            updatedAt: timestamp,
            intentEventType: intentEventType || undefined,
          },
          intentScore: nextIntentScore,
          whatsappContext: {
            name: userName,
            phone: userPhone,
            orgSlug: org.slug,
            lastMessage: text,
            conversationStatus: "ai_active",
          },
        });

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
            const detectedIntentScore =
              intent === "compra"
                ? 90
                : intent === "preco"
                  ? 70
                  : intent === "objecao"
                    ? 55
                    : intent === "interesse"
                      ? 60
                      : intent === "humano"
                        ? 45
                        : intent === "sumiu"
                          ? 20
                          : intent === "primeira_mensagem"
                            ? 35
                            : 40;

            logSecurityEvent("info", "whatsapp_intent_detected", {
              route: "meta/whatsapp/webhook",
              orgSlug: org.slug,
              phone: maskPhone(userPhone),
              intent,
            });

            const enrichedContext = await upsertLeadContextByLeadId(admin, {
              orgId: org.id,
              leadId: seedLead.lead.id,
              intentScore: intentEventType
                ? updateIntentScore(intentEventType, detectedIntentScore, {
                  now: timestamp,
                  lastActivityAt: previousActivityAt,
                })
                : detectedIntentScore,
              emotionalState: {
                intent,
                lastMessage: text,
                updatedAt: timestamp,
                intentEventType: intentEventType || undefined,
              },
              whatsappContext: {
                intent,
                lastMessage: text,
                conversationId: finalConversationId,
              },
            });

            const decision = decideNextAction(enrichedContext);
            logSecurityEvent("info", "whatsapp_decision_made", {
              route: "meta/whatsapp/webhook",
              orgSlug: org.slug,
              phone: maskPhone(userPhone),
              action: decision.chosenAction,
              confidence: decision.confidence,
            });

            await upsertLeadContextByLeadId(admin, {
              orgId: org.id,
              leadId: seedLead.lead.id,
              whatsappContext: {
                nextAction: decision.chosenAction,
                nextActionReason: decision.reason,
                nextActionConfidence: decision.adaptiveConfidence,
              },
            });

            if (intent === "humano" || decision.chosenAction === "TRIGGER_HUMAN_AGENT") {
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
                logSecurityEvent("info", "whatsapp_recent_reply_skipped", {
                  route: "meta/whatsapp/webhook",
                  orgSlug: org.slug,
                  phone: maskPhone(userPhone),
                });
              } else {
                logSecurityEvent("info", "whatsapp_ai_reply_requested", {
                  route: "meta/whatsapp/webhook",
                  orgSlug: org.slug,
                  phone: maskPhone(userPhone),
                });
                let venusReply = "";

                try {
                  venusReply = await generateReply({ ...context, state: intent }, text);
                } catch (replyErr) {
                  logSecurityEvent("error", "whatsapp_ai_reply_failed", {
                    route: "meta/whatsapp/webhook",
                    orgSlug: org.slug,
                    phone: maskPhone(userPhone),
                    error: replyErr instanceof Error ? replyErr.message : String(replyErr),
                  });
                  venusReply = "Oi! Estou processando sua mensagem com carinho. Só um instante que já te respondo com todos os detalhes.";
                }

                if (venusReply) {
                  logSecurityEvent("info", "whatsapp_graph_send_started", {
                    route: "meta/whatsapp/webhook",
                    orgSlug: org.slug,
                    phone: maskPhone(userPhone),
                  });
                  const graphResponse = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
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

                  const graphResult = await graphResponse.json().catch(() => ({}));
                  logSecurityEvent("info", "whatsapp_graph_response", {
                    route: "meta/whatsapp/webhook",
                    orgSlug: org.slug,
                    phone: maskPhone(userPhone),
                    ok: graphResponse.ok,
                    status: graphResponse.status,
                    messageCount: Array.isArray((graphResult as { messages?: unknown[] }).messages)
                      ? (graphResult as { messages?: unknown[] }).messages?.length || 0
                      : 0,
                  });

                  if (!graphResponse.ok) {
                    logSecurityEvent("warn", "whatsapp_graph_send_failed", {
                      route: "meta/whatsapp/webhook",
                      orgSlug: org.slug,
                      phone: maskPhone(userPhone),
                      status: graphResponse.status,
                    });
                  }

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
          logSecurityEvent("error", "whatsapp_venus_flow_failed", {
            route: "meta/whatsapp/webhook",
            orgSlug: org.slug,
            phone: maskPhone(userPhone),
            error: venusError instanceof Error ? venusError.message : String(venusError),
          });
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
          await admin.from("tenant_events").insert({
            org_id: org.id,
            actor_user_id: null,
            event_type: seedLead.created ? "lead.created_from_whatsapp_webhook" : "lead.engaged_from_whatsapp_webhook",
            event_source: "whatsapp",
            dedupe_key: `whatsapp_webhook:${org.id}:${seedLead.lead.id}:${message.id || timestamp}`,
            payload: {
              lead_id: seedLead.lead.id,
              conversation_id: finalConversationId,
              message_id: message.id || null,
              org_slug: org.slug,
            },
          });

          await bumpTenantUsageDaily(admin, org.id, { leads: seedLead.created ? 1 : 0, events_count: 1 });
        } catch (e) {
          logSecurityEvent("error", "whatsapp_lead_sync_failed", {
            route: "meta/whatsapp/webhook",
            orgSlug: org.slug,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
