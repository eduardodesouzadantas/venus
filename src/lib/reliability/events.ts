export interface VenusEventMetadata {
  org_id: string;
  lead_id?: string | null;
  session_id?: string | null;
  result_id?: string | null;
  event_type: string;
  event_timestamp: string;
}

export interface VenusFlowEvent {
  event: string;
  orgId: string;
  leadId?: string | null;
  sessionId?: string | null;
  timestamp: string;
  payload?: Record<string, unknown>;
}

export interface VenusFlowCorrelation {
  orgId: string;
  leadId?: string | null;
  sessionId?: string | null;
  resultId?: string | null;
  campaignId?: string | null;
}

const CORRELATION_FIELDS: (keyof VenusFlowCorrelation)[] = [
  "orgId",
  "leadId",
  "sessionId",
  "resultId",
  "campaignId",
];

export type VenusFlowEventType =
  | "result.viewed"
  | "whatsapp.handoff.started"
  | "recommendation.requested"
  | "recommendation.blocked_by_missing_scope"
  | "collection.targeting_generated";

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value);
}

function buildCorrelation(
  orgId: string | null | undefined,
  leadId?: string | null | undefined,
  sessionId?: string | null | undefined,
  resultId?: string | null | undefined,
  campaignId?: string | null | undefined
): VenusFlowCorrelation {
  return {
    orgId: normalizeString(orgId) || "",
    leadId: leadId === null || leadId === undefined ? null : normalizeString(leadId) || null,
    sessionId: sessionId === null || sessionId === undefined ? null : normalizeString(sessionId) || null,
    resultId: resultId === null || resultId === undefined ? null : normalizeString(resultId) || null,
    campaignId: campaignId === null || campaignId === undefined ? null : normalizeString(campaignId) || null,
  };
}

export function createFlowCorrelation(correlation: Partial<VenusFlowCorrelation>): VenusFlowCorrelation {
  return buildCorrelation(
    correlation.orgId,
    correlation.leadId,
    correlation.sessionId,
    correlation.resultId,
    correlation.campaignId
  );
}

export function logVenusFlowEvent(
  eventType: VenusFlowEventType,
  correlation: VenusFlowCorrelation,
  payload?: Record<string, unknown>
): void {
  const safeCorrelation = CORRELATION_FIELDS.reduce(
    (acc, key) => {
      const value = correlation[key];
      if (value) {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, unknown>
  );

  console.log(`[VENUS_FLOW] ${eventType}`, {
    ...safeCorrelation,
    timestamp: new Date().toISOString(),
    payload: sanitizePayload(payload),
  });
}

function sanitizePayload(payload?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!payload) return undefined;

  const sensitiveKeys = [
    "password",
    "token",
    "secret",
    "api_key",
    "apikey",
    "access_token",
    "refresh_token",
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = "[OBJECT]";
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function logResultViewed(
  orgId: string | null,
  leadId?: string | null,
  sessionId?: string | null
): void {
  const correlation = createFlowCorrelation({ orgId: orgId ?? undefined, leadId: leadId ?? undefined, sessionId: sessionId ?? undefined });
  logVenusFlowEvent("result.viewed", correlation);
}

export function logWhatsAppHandoffStarted(
  orgId: string | null,
  leadId?: string | null,
  sessionId?: string | null,
  resultId?: string | null
): void {
  const correlation = createFlowCorrelation({
    orgId: orgId ?? undefined,
    leadId: leadId ?? undefined,
    sessionId: sessionId ?? undefined,
    resultId: resultId ?? undefined,
  });
  logVenusFlowEvent("whatsapp.handoff.started", correlation);
}

export function logRecommendationRequested(
  orgId: string | null,
  leadId?: string | null,
  sessionId?: string | null
): void {
  const correlation = createFlowCorrelation({ orgId: orgId ?? undefined, leadId: leadId ?? undefined, sessionId: sessionId ?? undefined });
  logVenusFlowEvent("recommendation.requested", correlation);
}

export function logRecommendationBlockedByMissingScope(
  orgId: string | null,
  context: string
): void {
  const correlation = createFlowCorrelation({ orgId: orgId ?? undefined });
  logVenusFlowEvent("recommendation.blocked_by_missing_scope", correlation, { context });
}

export function logCollectionTargetingGenerated(
  orgId: string | null,
  campaignId: string | null,
  segmentCount: number
): void {
  const correlation = createFlowCorrelation({ orgId: orgId ?? undefined, campaignId: campaignId ?? undefined });
  logVenusFlowEvent("collection.targeting_generated", correlation, {
    segment_count: segmentCount,
  });
}

export function isCorrelationComplete(correlation: VenusFlowCorrelation): boolean {
  return !!correlation.orgId;
}
