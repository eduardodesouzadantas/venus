export type ScopeLevel = "catalog" | "recommendation" | "whatsapp" | "lead" | "campaign";

export interface TenantScopeCheck {
  orgId: string | null;
  level: ScopeLevel;
  required: boolean;
  reason?: string;
}

export interface TenantScopeResult {
  allowed: boolean;
  reason?: string;
  orgId: string | null;
  checkedAt: string;
}

const VALID_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidOrgIdentifier(value: string): boolean {
  const normalized = normalizeString(value);
  if (!normalized) return false;
  return VALID_UUID_REGEX.test(normalized) || normalized.startsWith("org-");
}

export function validateTenantContext(
  orgId: string | null | undefined,
  required: boolean = true
): TenantScopeResult {
  const normalizedOrgId = normalizeString(orgId);
  const timestamp = new Date().toISOString();

  if (!normalizedOrgId) {
    if (required) {
      return {
        allowed: false,
        reason: "org_id ausente - contexto de tenant obligatorio",
        orgId: null,
        checkedAt: timestamp,
      };
    }
    return {
      allowed: true,
      reason: "org_id nao fornecido, mas nao requerido",
      orgId: null,
      checkedAt: timestamp,
    };
  }

  if (!isValidOrgIdentifier(normalizedOrgId)) {
    return {
      allowed: false,
      reason: `org_id invalido: ${normalizedOrgId}`,
      orgId: normalizedOrgId,
      checkedAt: timestamp,
    };
  }

  return {
    allowed: true,
    reason: "contexto valido",
    orgId: normalizedOrgId,
    checkedAt: timestamp,
  };
}

export function requireTenantScope(
  orgId: string | null | undefined,
  level: ScopeLevel,
  operation: string
): TenantScopeResult {
  const validated = validateTenantContext(orgId, true);

  if (!validated.allowed) {
    console.warn("[TENANT_SCOPE_REQUIRED]", {
      level,
      operation,
      orgId: validated.orgId,
      reason: validated.reason,
      timestamp: validated.checkedAt,
    });
  }

  return validated;
}

export function logScopeFailure(
  level: ScopeLevel,
  operation: string,
  result: TenantScopeResult,
  metadata?: Record<string, unknown>
): void {
  if (!result.allowed) {
    console.error("[TENANT_SCOPE_FAILURE]", {
      level,
      operation,
      orgId: result.orgId,
      reason: result.reason,
      checkedAt: result.checkedAt,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }
}