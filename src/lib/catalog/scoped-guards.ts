import type { Product } from "@/lib/catalog";

export interface CatalogScopeAssertion {
  orgId: string;
  context: "catalog_read" | "catalog_write" | "recommendation";
  operation: string;
}

export interface CatalogScopeValidationResult {
  valid: boolean;
  reason?: string;
  scopedProducts: Product[];
  rejectedCount: number;
}

const VALID_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidUuid(value: string): boolean {
  return VALID_UUID_REGEX.test(value);
}

export function hasValidTenantScope(
  orgId: string | null | undefined,
  context: CatalogScopeAssertion["context"]
): boolean {
  const normalized = normalizeString(orgId);
  if (!normalized) {
    return false;
  }
  if (!isValidUuid(normalized) && !normalized.startsWith("org-")) {
    return false;
  }
  return true;
}

export function filterProductsByScope(
  products: Product[],
  orgId: string
): CatalogScopeValidationResult {
  const targetOrgId = normalizeString(orgId);
  if (!targetOrgId) {
    return {
      valid: false,
      reason: "org_id ausente ou vazio",
      scopedProducts: [],
      rejectedCount: products.length,
    };
  }

  const scopedProducts: Product[] = [];
  let rejectedCount = 0;

  for (const product of products) {
    const productOrgId = normalizeString(product.org_id);
    if (productOrgId === targetOrgId) {
      scopedProducts.push(product);
    } else {
      rejectedCount++;
    }
  }

  const valid = scopedProducts.length > 0;

  return {
    valid,
    reason: valid
      ? undefined
      : rejectedCount > 0
        ? `produtos encontrados de outra org: ${rejectedCount}`
        : "nenhum produto encontrado",
    scopedProducts,
    rejectedCount,
  };
}

export function assertCatalogScope(
  products: Product[],
  orgId: string,
  operation: string
): CatalogScopeValidationResult {
  const result = filterProductsByScope(products, orgId);

  if (!result.valid) {
    console.warn("[CATALOG_SCOPE_VIOLATION]", {
      operation,
      orgId,
      rejectedCount: result.rejectedCount,
      reason: result.reason,
      timestamp: new Date().toISOString(),
    });
  }

  return result;
}

export function logScopeViolation(
  context: CatalogScopeAssertion,
  attempt: Record<string, unknown>
): void {
  console.error("[TENANT_SCOPE_VIOLATION_DETECTED]", {
    ...context,
    attempt,
    trace: "scoped_guards",
    timestamp: new Date().toISOString(),
  });
}