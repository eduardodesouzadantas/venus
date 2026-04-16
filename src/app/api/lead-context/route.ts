import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processGamificationTriggerEvent } from "@/lib/gamification/events";
import {
  loadLeadContextByIdentity,
  updateLeadContextIntent,
  updateLeadContextProducts,
  updateLeadContextTryOn,
  updateIntentScore,
  upsertLeadContext,
} from "@/lib/lead-context";
import { recordDecisionOutcome } from "@/lib/decision-engine/learning";

export const dynamic = "force-dynamic";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function mapEventAction(eventType: string) {
  switch (eventType) {
    case "first_message_shown":
      return { action: "SHOW_ONBOARDING_WELCOME", outcome: "FIRST_MESSAGE_SHOWN" };
    case "photo_sent":
      return { action: "UPLOAD_PHOTO", outcome: "PHOTO_SENT" };
    case "photo_not_sent":
      return { action: "SKIP_PHOTO", outcome: "PHOTO_NOT_SENT" };
    case "wow_shown":
      return { action: "SHOW_WOW", outcome: "WOW_SHOWN" };
    case "post_wow_cta_clicked":
      return { action: "CLICK_POST_WOW_CTA", outcome: "POST_WOW_CTA_CLICKED" };
    case "whatsapp_clicked":
      return { action: "SEND_WHATSAPP_MESSAGE", outcome: "WHATSAPP_CLICKED" };
    case "tryon_generated":
    case "product_revisited":
      return { action: "SUGGEST_NEW_LOOK", outcome: "REQUESTED_VARIATION" };
    default:
      return { action: "", outcome: "" };
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const orgId = normalizeText(body.orgId ?? body.org_id);
  const leadId = normalizeText(body.leadId ?? body.lead_id);
  const savedResultId = normalizeText(body.savedResultId ?? body.saved_result_id);
  const phone = normalizeText(body.phone ?? body.clientPhone ?? body.contactPhone);
  const email = normalizeText(body.email);
  const eventType = normalizeText(body.eventType ?? body.event_type);
  const action = normalizeText(body.action ?? body.lastAction ?? body.last_action);
  const outcome = normalizeText(body.outcome ?? body.lastActionOutcome ?? body.last_action_outcome);
  const eventMeta = asRecord(body.eventMeta ?? body.event_meta);

  if (!orgId) {
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    const leadSnapshot = eventType
      ? await loadLeadContextByIdentity(supabase, {
          orgId,
          leadId: leadId || null,
          savedResultId: savedResultId || null,
          phone: phone || null,
          email: email || null,
        }).catch(() => ({ lead: null, context: null }))
      : { lead: null, context: null };

    const currentIntentScore = typeof leadSnapshot.context?.intent_score === "number"
      ? leadSnapshot.context.intent_score
      : typeof leadSnapshot.lead?.intent_score === "number"
        ? leadSnapshot.lead.intent_score
        : 0;

    const lastActivityAt =
      normalizeText(body.lastActivityAt ?? body.last_activity_at) ||
      normalizeText(leadSnapshot.context?.updated_at) ||
      normalizeText(leadSnapshot.lead?.last_interaction_at) ||
      null;

    const resolvedIntentScore = eventType
      ? updateIntentScore(eventType, currentIntentScore, {
          now: new Date().toISOString(),
          lastActivityAt,
        })
      : typeof body.intentScore === "number"
        ? body.intentScore
        : null;

    const shouldTriggerGamification = eventType === "whatsapp_clicked" || eventType === "product_revisited";
    const gamificationCustomerKey = leadId || savedResultId || phone || email || null;
    const gamificationEventKey = shouldTriggerGamification && gamificationCustomerKey
      ? [
          "lead_reengaged",
          orgId,
          gamificationCustomerKey,
          normalizeText(body.timestamp ?? body.eventTimestamp ?? body.event_timestamp) || lastActivityAt || eventType,
        ]
          .filter(Boolean)
          .join(":")
      : null;
    const gamificationEventPromise =
      shouldTriggerGamification && gamificationCustomerKey && gamificationEventKey
        ? processGamificationTriggerEvent(
            {
              orgId,
              eventType: "lead_reengaged",
              customerKey: gamificationCustomerKey,
              customerLabel: normalizeText(body.customerLabel ?? body.customer_label) || gamificationCustomerKey,
              eventKey: gamificationEventKey,
              actorUserId: null,
              reason: "Lead reengajado",
              payload: {
                event_type: eventType,
                lead_id: leadId || null,
                saved_result_id: savedResultId || null,
                phone: phone || null,
                email: email || null,
                last_activity_at: lastActivityAt,
              },
            },
            { now: new Date() }
          ).catch((error) => {
            console.warn("[GAMIFICATION] failed to process lead_reengaged", error);
          })
        : Promise.resolve(null);

    const lastTryon = asRecord(body.lastTryon);

    const eventMapping = mapEventAction(eventType);
    const mappedAction = action || eventMapping.action;
    const mappedOutcome = outcome || eventMapping.outcome;

    const tenantEventPromise = eventType
      ? (async () => {
          const { error } = await supabase.from("tenant_events").insert({
            org_id: orgId,
            actor_user_id: null,
            event_type: eventType,
            event_source: normalizeText(body.eventSource ?? body.event_source) || "app",
            dedupe_key: [
              "lead-context",
              orgId,
              leadId || savedResultId || phone || email || "anonymous",
              eventType,
              normalizeText(body.timestamp ?? body.eventTimestamp ?? body.event_timestamp) || new Date().toISOString(),
            ]
              .filter(Boolean)
              .join(":"),
            payload: {
              event_type: eventType,
              org_id: orgId,
              lead_id: leadId || null,
              saved_result_id: savedResultId || null,
              phone: phone || null,
              email: email || null,
              action: mappedAction || null,
              outcome: mappedOutcome || null,
              event_meta: eventMeta,
              timestamp: normalizeText(body.timestamp ?? body.eventTimestamp ?? body.event_timestamp) || new Date().toISOString(),
            },
          });

          if (error) {
            console.warn("[LEAD_CONTEXT] failed to record tenant event", error);
          }
        })()
      : Promise.resolve(null);

    if (leadId && mappedAction && mappedOutcome) {
      await recordDecisionOutcome({
        lead_id: leadId,
        action: mappedAction,
        outcome: mappedOutcome,
        timestamp: normalizeText(body.timestamp ?? body.eventTimestamp ?? body.event_timestamp) || new Date().toISOString(),
      }).catch((error) => {
        console.warn("[LEAD_CONTEXT] failed to record decision outcome", error);
      });
    }

    if (lastTryon || body.generatedImageUrl) {
      const context = await updateLeadContextTryOn(supabase, {
        orgId,
        leadId: leadId || null,
        savedResultId: savedResultId || null,
        personImageUrl: normalizeText(lastTryon?.personImageUrl ?? lastTryon?.person_image_url ?? body.personImageUrl ?? body.person_image_url),
        garmentImageUrl: normalizeText(lastTryon?.garmentImageUrl ?? lastTryon?.garment_image_url ?? body.garmentImageUrl ?? body.garment_image_url),
        generatedImageUrl: normalizeText(lastTryon?.generatedImageUrl ?? body.generatedImageUrl),
        lookName: normalizeText(lastTryon?.lookName ?? body.lookName),
        lookId: normalizeText(lastTryon?.lookId ?? body.lookId),
        category: normalizeText(lastTryon?.category ?? body.category),
        requestId: normalizeText(lastTryon?.requestId ?? lastTryon?.request_id ?? body.requestId ?? body.request_id),
        intentScore: resolvedIntentScore,
        lastAction: mappedAction || null,
        lastActionOutcome: mappedOutcome || null,
        actionHistory: (body.actionHistory as unknown[] | undefined) || null,
      });

      await gamificationEventPromise;
      await tenantEventPromise;

      return NextResponse.json({ ok: true, context });
    }

    if (Array.isArray(body.lastProductsViewed) || Array.isArray(body.products)) {
      const context = await updateLeadContextProducts(supabase, {
        orgId,
        leadId: leadId || null,
        savedResultId: savedResultId || null,
        products: (body.lastProductsViewed as unknown[]) || (body.products as unknown[]) || [],
        source: normalizeText(body.source) || "product_interaction",
        lookId: normalizeText(body.lookId),
        lookName: normalizeText(body.lookName),
        intentScore: resolvedIntentScore,
        lastAction: mappedAction || null,
        lastActionOutcome: mappedOutcome || null,
        actionHistory: (body.actionHistory as unknown[] | undefined) || null,
      });

      await gamificationEventPromise;
      await tenantEventPromise;

      return NextResponse.json({ ok: true, context });
    }

    if (typeof body.intentScore === "number") {
      const context = await updateLeadContextIntent(supabase, {
        orgId,
        leadId: leadId || null,
        savedResultId: savedResultId || null,
        intentScore: resolvedIntentScore ?? body.intentScore,
        emotionalState: (body.emotionalState as Record<string, unknown> | undefined) || null,
        whatsappContext: (body.whatsappContext as Record<string, unknown> | undefined) || null,
        actionHistory: (body.actionHistory as unknown[] | undefined) || null,
        lastAction: mappedAction || null,
        lastActionOutcome: mappedOutcome || null,
      });

      await gamificationEventPromise;
      await tenantEventPromise;

      return NextResponse.json({ ok: true, context });
    }

    const context = await upsertLeadContext(supabase, {
      orgId,
      leadId: leadId || null,
      savedResultId: savedResultId || null,
      phone: phone || null,
      email: email || null,
      profileData: (body.profileData as Record<string, unknown> | undefined) || null,
      styleProfile: (body.styleProfile as Record<string, unknown> | undefined) || null,
      colorimetry: (body.colorimetry as Record<string, unknown> | undefined) || null,
      bodyAnalysis: (body.bodyAnalysis as Record<string, unknown> | undefined) || null,
      emotionalState: (body.emotionalState as Record<string, unknown> | undefined) || null,
      lastTryon: (body.lastTryon as Record<string, unknown> | undefined) || null,
      lastProductsViewed: (body.lastProductsViewed as unknown[] | undefined) || null,
      lastRecommendations: (body.lastRecommendations as unknown[] | undefined) || null,
      whatsappContext: (body.whatsappContext as Record<string, unknown> | undefined) || null,
      actionHistory: (body.actionHistory as unknown[] | undefined) || null,
      lastAction: mappedAction || null,
      lastActionOutcome: mappedOutcome || null,
      intentScore: resolvedIntentScore,
    });

    await gamificationEventPromise;
    await tenantEventPromise;

    return NextResponse.json({ ok: true, context });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update lead context" },
      { status: 500 }
    );
  }
}
