/**
 * Venus RBAC & Multi-Tenant Isolation Utility.
 * Enforces strict organizationId scoping and role-based permissions at the logic level.
 */

import { Role, ResourceType, ActionType } from "@/types/hardened";

export interface RequestContext {
  userId: string;
  role: Role;
  orgId: string;
}

type PermissionRule = "*" | ActionType[];
type PermissionMatrix = Partial<Record<ResourceType | "*", PermissionRule>>;

const PERMISSIONS: Record<Role, PermissionMatrix> = {
  agency_owner: { "*": "*" },
  agency_admin: { "*": "*" },
  agency_ops: { ai_config: ['update', 'toggle'], tenant: ['view', 'update'] },
  agency_support: { tenant: ['view'], catalog: ['view'] },
  
  merchant_owner: { "*": "*" },
  merchant_manager: { product: ['create', 'update', 'view'], catalog: ['view', 'update'], look: ['view', 'update'] },
  merchant_editor: { product: ['update', 'view'], catalog: ['view', 'update'] },
  merchant_viewer: { product: ['view'], catalog: ['view'], look: ['view'] },
};

/**
 * Step 2 & 3: Multi-tenant Isolation and RBAC Helper
 */
export function authorize(ctx: RequestContext, resource: ResourceType, action: ActionType): boolean {
  // 1. Strict Tenant Scoping: Non-agency roles can only access their own orgId.
  if (!ctx.role.startsWith('agency_') && !ctx.orgId) {
    console.error(`[AUTH_ERR] Missing orgId for merchant role: ${ctx.userId}`);
    return false;
  }

  // 2. Permission Check
  const permissions = PERMISSIONS[ctx.role] ?? {};
  const allowedActions = permissions[resource] ?? [];

  if (allowedActions === '*' || (allowedActions as string[]).includes(action)) {
    return true;
  }

  // Double check if root agency role
  if (ctx.role === 'agency_owner' || ctx.role === 'agency_admin' || ctx.role === 'merchant_owner') {
    return true;
  }

  return false;
}

/**
 * Ensures strict scoping of data queries.
 */
export function applyTenantScope<T extends Record<string, unknown>>(query: T, ctx: RequestContext): T & { organizationId?: string } {
  // If merchant role, ALWAYS include orgId in filter.
  if (!ctx.role.startsWith('agency_')) {
    return { ...query, organizationId: ctx.orgId } as T & { organizationId: string };
  }
  
  // If agency, allow scoped or global (as specified in query).
  return query as T & { organizationId?: string };
}

/**
 * Step 10: Failsafe default for data results.
 */
export function wrapSafeData<T>(data: T | null | undefined, fallback: T): T {
  if (data === null || data === undefined) return fallback;
  return data;
}
