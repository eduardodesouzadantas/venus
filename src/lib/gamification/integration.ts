import "server-only";

import type { GamificationTriggerEventType, GamificationServiceOptions } from "@/lib/gamification/index";
import { processGamificationTriggerEvent } from "@/lib/gamification/events";

export type GamificationIntegrationEvent =
  | "onboarding_completed"
  | "lead_reengaged"
  | "result_shared"
  | "tryon_completed";

export interface GamificationIntegrationContext {
  orgId: string;
  eventType: GamificationIntegrationEvent;
  customerKey: string;
  customerLabel?: string;
  actorUserId?: string;
  payload?: Record<string, unknown>;
}

export interface GamificationIntegrationResult {
  processed: boolean;
  granted: number;
  blocked: number;
  duplicates: number;
  skipped: boolean;
  skippedReason: string | null;
  eventKey: string | null;
}

function mapToGamificationEventType(eventType: GamificationIntegrationEvent): GamificationTriggerEventType | null {
  switch (eventType) {
    case "onboarding_completed":
      return "onboarding_completed";
    case "lead_reengaged":
      return "lead_reengaged";
    case "result_shared":
      return "result_shared";
    case "tryon_completed":
      // Try-on completed não tem trigger automático direto, mas pode ser usado no futuro
      return null;
    default:
      return null;
  }
}

export async function processGamificationIntegrationEvent(
  context: GamificationIntegrationContext,
  options?: GamificationServiceOptions
): Promise<GamificationIntegrationResult> {
  const eventType = mapToGamificationEventType(context.eventType);

  if (!eventType) {
    return {
      processed: false,
      granted: 0,
      blocked: 0,
      duplicates: 0,
      skipped: true,
      skippedReason: "unsupported_event_type",
      eventKey: null,
    };
  }

  const result = await processGamificationTriggerEvent(
    {
      orgId: context.orgId,
      eventType,
      customerKey: context.customerKey,
      customerLabel: context.customerLabel,
      actorUserId: context.actorUserId,
      reason: `Evento integrado: ${context.eventType}`,
      payload: context.payload,
    },
    options
  );

  return {
    processed: result.processed,
    granted: result.granted,
    blocked: result.blocked,
    duplicates: result.duplicates,
    skipped: result.skipped,
    skippedReason: result.skippedReason,
    eventKey: result.eventKey,
  };
}

export async function tryonCompletedWithGamification(
  orgId: string,
  customerKey: string,
  customerLabel: string,
  savedResultId: string,
  options?: GamificationServiceOptions
): Promise<GamificationIntegrationResult> {
  return processGamificationIntegrationEvent(
    {
      orgId,
      eventType: "tryon_completed",
      customerKey,
      customerLabel,
      payload: {
        saved_result_id: savedResultId,
      },
    },
    options
  );
}

export async function onboardingCompletedWithGamification(
  orgId: string,
  customerKey: string,
  customerLabel: string,
  leadId: string,
  options?: GamificationServiceOptions
): Promise<GamificationIntegrationResult> {
  return processGamificationIntegrationEvent(
    {
      orgId,
      eventType: "onboarding_completed",
      customerKey,
      customerLabel,
      payload: {
        lead_id: leadId,
      },
    },
    options
  );
}

export async function resultSharedWithGamification(
  orgId: string,
  customerKey: string,
  customerLabel: string,
  shareId: string,
  options?: GamificationServiceOptions
): Promise<GamificationIntegrationResult> {
  return processGamificationIntegrationEvent(
    {
      orgId,
      eventType: "result_shared",
      customerKey,
      customerLabel,
      payload: {
        share_id: shareId,
        source_event_key: shareId,
        sourceEventKey: shareId,
      },
    },
    options
  );
}

export async function leadReengagedWithGamification(
  orgId: string,
  customerKey: string,
  customerLabel: string,
  leadId: string,
  options?: GamificationServiceOptions
): Promise<GamificationIntegrationResult> {
  return processGamificationIntegrationEvent(
    {
      orgId,
      eventType: "lead_reengaged",
      customerKey,
      customerLabel,
      payload: {
        lead_id: leadId,
      },
    },
    options
  );
}

export function shouldTriggerGamificationForEvent(eventType: string): boolean {
  const supportedEvents: GamificationIntegrationEvent[] = [
    "onboarding_completed",
    "lead_reengaged",
    "result_shared",
    "tryon_completed",
  ];

  return supportedEvents.includes(eventType as GamificationIntegrationEvent);
}

export function buildGamificationEventPayload(
  eventType: GamificationIntegrationEvent,
  metadata: Record<string, unknown>
): Record<string, unknown> {
  return {
    event_type: eventType,
    timestamp: new Date().toISOString(),
    ...metadata,
  };
}
