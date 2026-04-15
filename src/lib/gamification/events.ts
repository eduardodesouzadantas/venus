import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/security/audit";
import { recordOperationalTenantEvent } from "@/lib/reliability/observability";

import {
  findGamificationEventBySourceEventKey,
  grantGamificationBenefit,
  loadGamificationOverview,
  normalizeGamificationTriggerEventType,
  type GamificationServiceOptions,
  type GamificationTriggerEventType,
  type GamificationTriggerMode,
  type GamificationRuleRecord,
  type GamificationOverview,
} from "@/lib/gamification";

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getPayloadField(payload: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!payload) return "";

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

export function buildGamificationTriggerEventKey(input: {
  orgId: string;
  eventType: GamificationTriggerEventType;
  customerKey?: string | null;
  customerLabel?: string | null;
  eventKey?: string | null;
  payload?: Record<string, unknown> | null;
}): string | null {
  const explicitKey = normalize(input.eventKey);
  if (explicitKey) {
    return explicitKey;
  }

  const payloadKey =
    getPayloadField(input.payload, [
      "source_event_key",
      "sourceEventKey",
      "request_id",
      "requestId",
      "saved_result_id",
      "savedResultId",
      "ref_code",
      "refCode",
      "lead_id",
      "leadId",
      "user_id",
      "userId",
      "event_id",
      "eventId",
      "id",
    ]) || "";

  if (!payloadKey) {
    return null;
  }

  return [
    input.orgId,
    input.eventType,
    normalize(input.customerKey),
    normalize(input.customerLabel),
    payloadKey,
  ]
    .filter(Boolean)
    .join(":");
}

export function isGamificationTriggerMode(value: unknown): value is GamificationTriggerMode {
  return value === "manual" || value === "automatic";
}

export function listAutomaticGamificationRules(rules: GamificationRuleRecord[]) {
  return rules.filter((rule) => rule.active && rule.trigger_mode === "automatic" && Boolean(rule.trigger_event_type));
}

export function summariseGamificationAutomation(overview: GamificationOverview) {
  const automaticRules = listAutomaticGamificationRules(overview.rules);
  const recentAutomaticEvents = overview.recent_automatic_events;
  const lastAutomaticEvent = recentAutomaticEvents[0] || null;

  return {
    automatic_rules: automaticRules.length,
    recent_automatic_events: recentAutomaticEvents,
    last_automatic_event_at: lastAutomaticEvent?.created_at || null,
    automatic_blocked_events: recentAutomaticEvents.filter((event) => event.status === "blocked").length,
  };
}

export async function processGamificationTriggerEvent(
  input: {
    orgId: string;
    eventType: GamificationTriggerEventType;
    customerKey?: string | null;
    customerLabel?: string | null;
    eventKey?: string | null;
    actorUserId?: string | null;
    reason?: string | null;
    payload?: Record<string, unknown> | null;
  },
  options?: GamificationServiceOptions
): Promise<{
  processed: boolean;
  matchedRules: number;
  granted: number;
  blocked: number;
  duplicates: number;
  skipped: boolean;
  skippedReason: string | null;
  eventKey: string | null;
}> {
  const normalizedOrgId = normalize(input.orgId);
  const normalizedEventType = normalizeGamificationTriggerEventType(input.eventType);
  const normalizedCustomerKey = normalize(input.customerKey);
  const normalizedCustomerLabel = normalize(input.customerLabel) || normalizedCustomerKey || null;
  const sourceEventKey = buildGamificationTriggerEventKey({
    orgId: normalizedOrgId,
    eventType: normalizedEventType || input.eventType,
    customerKey: normalizedCustomerKey || null,
    customerLabel: normalizedCustomerLabel || null,
    eventKey: input.eventKey,
    payload: input.payload || null,
  });

  if (!normalizedOrgId || !normalizedEventType) {
    return {
      processed: false,
      matchedRules: 0,
      granted: 0,
      blocked: 0,
      duplicates: 0,
      skipped: true,
      skippedReason: "invalid_event",
      eventKey: sourceEventKey,
    };
  }

  const overview = await loadGamificationOverview(normalizedOrgId, options);
  const org = overview.org;

  if (!org || org.kill_switch || org.status !== "active") {
    return {
      processed: false,
      matchedRules: 0,
      granted: 0,
      blocked: 0,
      duplicates: 0,
      skipped: true,
      skippedReason: "org_unavailable",
      eventKey: sourceEventKey,
    };
  }

  const automationEnabled = process.env.GAMIFICATION_EVENT_DRIVEN_ENABLED !== "false";
  const tenantFlag = (org.limits as Record<string, unknown> | null | undefined)?.gamification_event_driven;
  if (!automationEnabled || tenantFlag === false) {
    return {
      processed: false,
      matchedRules: 0,
      granted: 0,
      blocked: 0,
      duplicates: 0,
      skipped: true,
      skippedReason: "automation_disabled",
      eventKey: sourceEventKey,
    };
  }

  if (!sourceEventKey || !normalizedCustomerKey) {
    return {
      processed: false,
      matchedRules: 0,
      granted: 0,
      blocked: 0,
      duplicates: 0,
      skipped: true,
      skippedReason: "missing_event_key",
      eventKey: sourceEventKey,
    };
  }

  const automaticRules = listAutomaticGamificationRules(overview.rules).filter(
    (rule) => rule.trigger_event_type === normalizedEventType
  );

  if (automaticRules.length === 0) {
    return {
      processed: false,
      matchedRules: 0,
      granted: 0,
      blocked: 0,
      duplicates: 0,
      skipped: true,
      skippedReason: "no_matching_rule",
      eventKey: sourceEventKey,
    };
  }

  let granted = 0;
  let blocked = 0;
  let duplicates = 0;

  for (const rule of automaticRules) {
    const duplicate = await findGamificationEventBySourceEventKey(normalizedOrgId, rule.id, sourceEventKey, options);
    if (duplicate) {
      duplicates += 1;
      await Promise.all([
        logAudit({
          orgId: normalizedOrgId,
          userId: input.actorUserId || null,
          action: "gamification_benefit_blocked",
          resourceType: "gamification_events",
          resourceId: duplicate.id,
          metadata: {
            rule_id: rule.id,
            source_event_key: sourceEventKey,
            source_event_type: normalizedEventType,
            reason: "duplicate_event",
          },
          status: "blocked",
        }),
        recordOperationalTenantEvent(createAdminClient(), {
          orgId: normalizedOrgId,
          actorUserId: input.actorUserId || null,
          eventType: "gamification.duplicate_ignored",
          eventSource: "gamification",
          dedupeKeyParts: [normalizedOrgId, rule.id, sourceEventKey, "duplicate"],
          payload: {
            org_id: normalizedOrgId,
            rule_id: rule.id,
            source_event_key: sourceEventKey,
            source_event_type: normalizedEventType,
          },
        }),
      ]);
      continue;
    }

    const result = await grantGamificationBenefit(
      {
        orgId: normalizedOrgId,
        actorUserId: input.actorUserId || null,
        customerKey: normalizedCustomerKey,
        customerLabel: normalizedCustomerLabel || undefined,
        ruleId: rule.id,
        reason: input.reason || `Evento automático: ${normalizedEventType}`,
        sourceEventKey,
        sourceEventType: normalizedEventType,
        sourceEventPayload: input.payload || null,
      },
      options
    );

    if (result.duplicate) {
      duplicates += 1;
      continue;
    }

    if (result.granted) {
      granted += 1;
    } else {
      blocked += 1;
    }
  }

  return {
    processed: granted > 0 || blocked > 0 || duplicates > 0,
    matchedRules: automaticRules.length,
    granted,
    blocked,
    duplicates,
    skipped: false,
    skippedReason: null,
    eventKey: sourceEventKey,
  };
}
