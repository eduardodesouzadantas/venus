import { NextRequest, NextResponse } from "next/server";

import {
  shouldTriggerGamificationForEvent,
  type GamificationIntegrationEvent,
} from "@/lib/gamification/index";
import { processGamificationIntegrationEvent } from "@/lib/gamification/integration";
import { resolveMerchantOrgAccess } from "@/lib/merchant/access";
import { canAccessGamificationPanel } from "@/lib/gamification/index";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * POST /api/org/[slug]/gamification/events
 *
 * Endpoint para processar eventos automáticos de gamificação.
 * Chamado internamente quando eventos do sistema acontecem (onboarding, share, etc).
 * Respeita budget limits e resource control engine.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;

  if (process.env.GAMIFICATION_BUDGET_AWARE_ENABLED === "false") {
    return NextResponse.json(
      { error: "Gamification disabled", processed: false },
      { status: 403 }
    );
  }

  try {
    const access = await resolveMerchantOrgAccess(slug);
    if (!canAccessGamificationPanel(access.role)) {
      return NextResponse.json({ error: "Unauthorized", processed: false }, { status: 403 });
    }

    let payload: Record<string, unknown>;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else {
      return NextResponse.json(
        { error: "Content-Type must be application/json", processed: false },
        { status: 400 }
      );
    }

    const eventType = normalize(payload.event_type) as GamificationIntegrationEvent;
    const customerKey = normalize(payload.customer_key);
    const customerLabel = normalize(payload.customer_label) || customerKey;
    const actorUserId = normalize(payload.actor_user_id) || access.user.id;

    if (!eventType || !customerKey) {
      return NextResponse.json(
        {
          error: "Missing required fields: event_type, customer_key",
          processed: false,
        },
        { status: 400 }
      );
    }

    if (!shouldTriggerGamificationForEvent(eventType)) {
      return NextResponse.json(
        {
          error: `Unsupported event type: ${eventType}`,
          processed: false,
          supportedEvents: ["onboarding_completed", "lead_reengaged", "result_shared", "tryon_completed"],
        },
        { status: 400 }
      );
    }

    const result = await processGamificationIntegrationEvent({
      orgId: access.org.id,
      eventType,
      customerKey,
      customerLabel: customerLabel || undefined,
      actorUserId,
      payload: payload.payload as Record<string, unknown> | undefined,
    });

    // 207 para indicar processamento parcial (alguns podem ter sido bloqueados/duplicados)
    const statusCode = result.processed ? 200 : result.skipped ? 204 : 207;

    return NextResponse.json(
      {
        processed: result.processed,
        granted: result.granted,
        blocked: result.blocked,
        duplicates: result.duplicates,
        skipped: result.skipped,
        skippedReason: result.skippedReason,
        eventKey: result.eventKey,
      },
      {
        status: statusCode,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process gamification event";
    return NextResponse.json(
      { error: message, processed: false },
      { status: 500 }
    );
  }
}
