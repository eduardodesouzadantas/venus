import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type AuditAction =
  | "login"
  | "logout"
  | "login_failed"
  | "password_reset"
  | "password_change"
  | "org_create"
  | "org_update"
  | "member_add"
  | "member_remove"
  | "member_role_change"
  | "lead_create"
  | "lead_update"
  | "lead_delete"
  | "product_create"
  | "product_update"
  | "product_delete"
  | "resource_limit_update"
  | "gamification_rule_create"
  | "gamification_rule_update"
  | "gamification_benefit_grant"
  | "gamification_benefit_consume"
  | "gamification_benefit_blocked"
  | "campaign_send"
  | "whatsapp_send"
  | "billing_update"
  | "checkout_create"
  | "api_request"
  | "rate_limit_exceeded"
  | "blocked_ip";

export type AuditStatus = "success" | "failed" | "blocked";

export interface AuditLogInput {
  orgId?: string | null;
  userId?: string | null;
  action: AuditAction;
  resourceType?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
  status?: AuditStatus;
  errorMessage?: string | null;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) {
    return cfIp.trim();
  }

  return "unknown";
}

function getUserAgent(request: Request): string {
  const raw = request.headers.get("user-agent");
  return typeof raw === "string" && raw.trim() ? raw.trim() : "unknown";
}

function shouldAuditAction(action: AuditAction): boolean {
  const sensitiveActions = new Set([
    "login",
    "login_failed",
    "password_reset",
    "password_change",
    "org_create",
    "org_update",
    "member_remove",
    "member_role_change",
    "billing_update",
    "checkout_create",
    "resource_limit_update",
    "gamification_rule_create",
    "gamification_rule_update",
    "gamification_benefit_grant",
    "gamification_benefit_consume",
    "gamification_benefit_blocked",
    "rate_limit_exceeded",
    "blocked_ip",
  ]);

  return sensitiveActions.has(action);
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  if (!shouldAuditAction(input.action)) {
    return;
  }

  const admin = createAdminClient();
  const sanitizedMetadata = sanitizeMetadata(input.metadata);

  const { error } = await admin.from("security_audit_logs").insert({
    org_id: input.orgId || null,
    user_id: input.userId || null,
    action: input.action,
    resource_type: input.resourceType || null,
    resource_id: input.resourceId || null,
    ip_address: typeof input.ipAddress === "string" && input.ipAddress.trim() ? input.ipAddress.trim() : null,
    user_agent: typeof input.userAgent === "string" && input.userAgent.trim() ? input.userAgent.trim() : null,
    metadata: sanitizedMetadata,
    status: input.status || "success",
    error_message: input.errorMessage || null,
  });

  if (error) {
    console.warn("[AUDIT] failed to log audit event", {
      action: input.action,
      error: error.message,
    });
  }
}

export async function logAuditFromRequest(
  request: Request,
  auditInput: AuditLogInput
): Promise<void> {
  const ipAddress = getClientIp(request);
  const userAgent = getUserAgent(request);

  await logAudit({
    ...auditInput,
    ipAddress: ipAddress || auditInput.ipAddress,
    userAgent: userAgent || auditInput.userAgent,
  });
}

function sanitizeMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!metadata) {
    return {};
  }

  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = new Set([
    "password",
    "token",
    "secret",
    "api_key",
    "access_token",
    "refresh_token",
    "card_number",
    "cvv",
  ]);

  for (const [key, value] of Object.entries(metadata)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export async function fetchAuditLogs(
  orgId?: string | null,
  options?: {
    userId?: string;
    action?: AuditAction;
    limit?: number;
    offset?: number;
  }
): Promise<{ logs: Record<string, unknown>[]; error: Error | null }> {
  const admin = createAdminClient();
  let query = admin
    .from("security_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options?.limit || 50);

  if (orgId) {
    query = query.eq("org_id", orgId);
  }

  if (options?.userId) {
    query = query.eq("user_id", options.userId);
  }

  if (options?.action) {
    query = query.eq("action", options.action);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    return { logs: [], error };
  }

  return { logs: data || [], error: null };
}

export async function checkRateLimit(
  scope: string,
  key: string,
  limit: number = 10,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number | null }> {
  const admin = createAdminClient();

  try {
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_scope: scope,
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error || !data) {
      console.warn("[RATE_LIMIT] check failed", { scope, key, error });
      return { allowed: true, remaining: limit, retryAfterSeconds: null };
    }

    return {
      allowed: data.allowed,
      remaining: data.remaining,
      retryAfterSeconds: data.retry_after_seconds,
    };
  } catch (err) {
    console.warn("[RATE_LIMIT] RPC error", { scope, key, error: err });
    return { allowed: true, remaining: limit, retryAfterSeconds: null };
  }
}

export async function recordRateLimitExceeded(
  scope: string,
  key: string,
  ipAddress?: string | null
): Promise<void> {
  const admin = createAdminClient();

  await admin.from("security_rate_limits").insert({
    scope,
    key,
    count: 999,
    last_ip: typeof ipAddress === "string" && ipAddress.trim() ? ipAddress.trim() : "unknown",
    window_start: new Date().toISOString(),
  });

  await logAudit({
    action: "rate_limit_exceeded",
    resourceType: "api",
    resourceId: key,
    ipAddress,
    metadata: { scope, key },
    status: "blocked",
  });
}

export async function blockIp(
  ipAddress: string,
  reason: string,
  blockedByUserId?: string | null,
  blockedUntil?: Date | null
): Promise<void> {
  const admin = createAdminClient();

  await admin.from("security_blocked_ips").upsert({
    ip_address: ipAddress,
    reason,
    blocked_until: blockedUntil?.toISOString() || null,
    blocked_by_user_id: blockedByUserId || null,
  });

  await logAudit({
    action: "blocked_ip",
    ipAddress,
    metadata: { reason, blocked_until: blockedUntil?.toISOString() },
    status: "success",
  });
}

export async function isIpBlocked(ipAddress: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("security_blocked_ips")
    .select("id")
    .eq("ip_address", ipAddress)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return true;
}

export async function createSecurityAlert(
  orgId: string,
  alertType: string,
  severity: "low" | "medium" | "high" | "critical",
  title: string,
  description?: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  const admin = createAdminClient();

  await admin.from("security_alerts").insert({
    org_id: orgId,
    alert_type: alertType,
    severity,
    title,
    description,
    metadata: metadata || {},
  });
}
