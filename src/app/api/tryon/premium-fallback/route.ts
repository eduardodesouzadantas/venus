import { NextRequest, NextResponse } from "next/server";
import { buildWhatsAppFollowUpPresentation, generateWhatsAppFollowUpMessage, type FollowUpContext } from "@/lib/whatsapp/look-followup";
import { TRYON_PREMIUM_FALLBACK_MESSAGE, TRYON_PREMIUM_REFINED_MESSAGE } from "@/lib/tryon/fallback-copy";

export const dynamic = "force-dynamic";

type PremiumFallbackBody = {
  orgId?: string;
  orgSlug?: string | null;
  branchName?: string | null;
  customerName?: string | null;
  styleDirection?: string | null;
  imageGoal?: string | null;
  bodyFit?: string | null;
  paletteFamily?: string | null;
  essenceLabel?: string | null;
  viewedLooks?: string[];
  lastLookId?: string | null;
  messageCount?: number;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: PremiumFallbackBody;

  try {
    body = (await req.json()) as PremiumFallbackBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const orgId = normalizeText(body.orgId);
  if (!orgId) {
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
  }

  const fallbackContext: FollowUpContext = {
    orgId,
    conversationId: `premium-fallback:${orgId}`,
    customerPhone: "premium-fallback",
    customerName: normalizeText(body.customerName) || undefined,
    essenceLabel: normalizeText(body.essenceLabel) || undefined,
    paletteFamily: normalizeText(body.paletteFamily) || undefined,
    bodyFit: normalizeText(body.bodyFit) || undefined,
    styleDirection: normalizeText(body.styleDirection) || undefined,
    imageGoal: normalizeText(body.imageGoal) || undefined,
    viewedLooks: Array.isArray(body.viewedLooks) ? body.viewedLooks.filter((value): value is string => typeof value === "string") : [],
    purchasedLooks: [],
    lastLookId: normalizeText(body.lastLookId) || undefined,
    messageCount: typeof body.messageCount === "number" && Number.isFinite(body.messageCount) ? body.messageCount : 0,
    lastMessageAt: undefined,
  };

  console.info("[tryon/premium-fallback] request start", {
    orgId,
    hasStyleDirection: Boolean(fallbackContext.styleDirection),
    hasImageGoal: Boolean(fallbackContext.imageGoal),
    viewedLooks: fallbackContext.viewedLooks.length,
  });

  try {
    const generated = await generateWhatsAppFollowUpMessage(fallbackContext);
    const presentation = buildWhatsAppFollowUpPresentation(
      fallbackContext,
      generated.suggestions,
      {
        sourceLabel: normalizeText(body.branchName) || normalizeText(body.orgSlug) || "catálogo da loja",
        explicit: false,
      }
    );

    console.info("[tryon/premium-fallback] request completed", {
      orgId,
      suggestions: generated.suggestions.length,
      hasMoreOptions: generated.hasMoreOptions,
    });

    return NextResponse.json({
      transitionMessage: TRYON_PREMIUM_FALLBACK_MESSAGE,
      refinementMessage: TRYON_PREMIUM_REFINED_MESSAGE,
      message: generated.message,
      suggestions: generated.suggestions,
      hasMoreOptions: generated.hasMoreOptions,
      presentation,
    });
  } catch (error) {
    console.warn("[tryon/premium-fallback] request failed", {
      orgId,
      error: error instanceof Error ? error.message : String(error),
    });

    const presentation = buildWhatsAppFollowUpPresentation(fallbackContext, [], {
      sourceLabel: normalizeText(body.branchName) || normalizeText(body.orgSlug) || "catálogo da loja",
      explicit: false,
    });

    return NextResponse.json({
      transitionMessage: TRYON_PREMIUM_FALLBACK_MESSAGE,
      refinementMessage: TRYON_PREMIUM_REFINED_MESSAGE,
      message: presentation.copy.summary,
      suggestions: [],
      hasMoreOptions: false,
      presentation,
    });
  }
}
