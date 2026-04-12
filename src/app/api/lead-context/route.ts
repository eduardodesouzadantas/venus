import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadLeadContextByIdentity,
  updateLeadContextIntent,
  updateLeadContextProducts,
  updateLeadContextTryOn,
  updateIntentScore,
  upsertLeadContext,
} from "@/lib/lead-context";

export const dynamic = "force-dynamic";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
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

    const lastTryon = asRecord(body.lastTryon);

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
      });

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
      });

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
      });

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
      intentScore: resolvedIntentScore,
    });

    return NextResponse.json({ ok: true, context });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update lead context" },
      { status: 500 }
    );
  }
}
