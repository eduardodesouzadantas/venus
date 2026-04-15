/**
 * Venus Audit Log System.
 * Persistent auditing of critical actions across all tenants.
 */

import { AuditLogEntry, ActionType, ResourceType, Role } from "@/types/hardened";
import { sanitizePrivacyLogEntry } from "@/lib/privacy/logging";

export const logAudit = async (
  userId: string,
  role: Role,
  orgId: string,
  resource: ResourceType,
  action: ActionType,
  success: boolean,
  payloadSummary: string,
  metadata?: Record<string, unknown> | null
) => {
  const entry: AuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    timestamp: new Date().toISOString(),
    userId,
    userRole: role,
    orgId,
    resource,
    action,
    success,
    payload: { summary: payloadSummary },
    metadata: {
      ip: typeof metadata?.ip === "string" && metadata.ip ? metadata.ip : "SYSTEM",
      userAgent: typeof metadata?.userAgent === "string" && metadata.userAgent ? metadata.userAgent : "VENUS_INTERNAL"
    }
  };

  // 1. Persist log (Production: write to Prisma/PostgreSQL)
  // Simulation: using localStorage for dashboard visibility.
  try {
    const existingLogs = JSON.parse(localStorage.getItem('venus_audit_logs') || '[]');
    localStorage.setItem('venus_audit_logs', JSON.stringify([entry, ...existingLogs.slice(0, 499)]));
  } catch {
    console.error(`[AUDIT_FAIL] Could not log action: ${action} on ${resource}`, sanitizePrivacyLogEntry(entry as unknown as Record<string, unknown>));
  }

  // 2. Alert for critical failures
  if (!success && (action === 'enrich' || action === 'toggle')) {
    console.warn(`[AUDIT_ALERT] Action ${action} on ${resource} failed for orgId: ${orgId}. Investigation recommended.`);
  }

  return entry;
};

/**
 * Step 5: Usage & Cost Tracking.
 */
export const trackUsage = async (orgId: string, costType: 'analyses' | 'tryOns' | 'aiEnrichedProducts') => {
  try {
    const usageStr = localStorage.getItem(`venus_usage_${orgId}`) || '{}';
    const usage = JSON.parse(usageStr);
    
    usage[costType] = (usage[costType] || 0) + 1;
    
    // Estimate cost (Step 5)
    const costMap = {
      analyses: 0.05, // e.g., R$ 0.05 per analysis
      tryOns: 0.25,   // e.g., R$ 0.25 per image generation
      aiEnrichedProducts: 0.10 // e.g., R$ 0.10 per completion
    };

    usage.totalEstimatedCost = (usage.totalEstimatedCost || 0) + costMap[costType];

    localStorage.setItem(`venus_usage_${orgId}`, JSON.stringify(usage));
  } catch (err) {
    console.error("[USAGE_TRACK_ERR]", err);
  }
};
