import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { TenantRecord, TenantMemberRecord } from "@/lib/tenant/core";
import {
  fetchOrgIdFromSlug,
  fetchTenantById,
  fetchMembershipByOrgId,
  isTenantActive,
  isAgencyRoleStrict,
  isMerchantRoleStrict,
  canManageOrg,
} from "@/lib/tenant/core";

export type GuardFailureReason =
  | "unauthenticated"
  | "tenant_not_found"
  | "membership_not_found"
  | "membership_inactive"
  | "role_forbidden"
  | "tenant_suspended"
  | "tenant_blocked"
  | "tenant_kill_switch";

export interface GuardValidationResult {
  allowed: boolean;
  reason: GuardFailureReason | null;
  userId: string | null;
  orgId: string | null;
  orgSlug: string | null;
  role: string | null;
  memberStatus: string | null;
  tenantStatus: string | null;
  killSwitch: boolean | null;
}

export interface GuardRequirement {
  requireAuthenticated?: boolean;
  requireOrgId?: string | null;
  requireOrgSlug?: string | null;
  requireMembershipStatus?: "active" | "invited" | "suspended" | "blocked" | null;
  requireRole?: string | null;
  requireRoles?: string[];
  requireAgency?: boolean;
  requireMerchant?: boolean;
  requireManagement?: boolean;
  requireTenantActive?: boolean;
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function validateUserAuthenticated(
  supabaseClient: ReturnType<typeof createAdminClient>
): Promise<{ authenticated: boolean; userId: string | null; error: string | null }> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return { authenticated: false, userId: null, error: authError?.message || "Not authenticated" };
    }

    return { authenticated: true, userId: user.id, error: null };
  } catch (err) {
    return { authenticated: false, userId: null, error: String(err) };
  }
}

export async function validateGuard(
  supabaseClient: ReturnType<typeof createAdminClient>,
  requirements: GuardRequirement
): Promise<GuardValidationResult> {
  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (requirements.requireAuthenticated) {
    if (authError || !user) {
      return {
        allowed: false,
        reason: "unauthenticated",
        userId: null,
        orgId: null,
        orgSlug: null,
        role: null,
        memberStatus: null,
        tenantStatus: null,
        killSwitch: null,
      };
    }
  }

  if (!user) {
    return {
      allowed: false,
      reason: "unauthenticated",
      userId: null,
      orgId: null,
      orgSlug: null,
      role: null,
      memberStatus: null,
      tenantStatus: null,
      killSwitch: null,
    };
  }

  const appMetadata = (user.app_metadata || {}) as Record<string, unknown>;
  const userMetadata = (user.user_metadata || {}) as Record<string, unknown>;

  const orgIdFromMeta = normalize(appMetadata.org_id || userMetadata.org_id) || null;
  const orgSlugFromMeta = normalize(appMetadata.org_slug || userMetadata.org_slug) || null;
  const roleFromMeta = normalize(appMetadata.role || userMetadata.role) || null;

  let resolvedOrgId = requirements.requireOrgId || orgIdFromMeta;
  const resolvedOrgSlug = requirements.requireOrgSlug || orgSlugFromMeta;

  if (!resolvedOrgId && resolvedOrgSlug) {
    resolvedOrgId = await fetchOrgIdFromSlug(supabaseClient, resolvedOrgSlug);
  }

  if (requirements.requireOrgId || requirements.requireOrgSlug) {
    if (!resolvedOrgId) {
      return {
        allowed: false,
        reason: "tenant_not_found",
        userId: user.id,
        orgId: null,
        orgSlug: resolvedOrgSlug,
        role: roleFromMeta,
        memberStatus: null,
        tenantStatus: null,
        killSwitch: null,
      };
    }

    const { org: tenantOrg, error: tenantError } = await fetchTenantById(supabaseClient, resolvedOrgId);
    if (tenantError || !tenantOrg) {
      return {
        allowed: false,
        reason: "tenant_not_found",
        userId: user.id,
        orgId: resolvedOrgId,
        orgSlug: resolvedOrgSlug,
        role: roleFromMeta,
        memberStatus: null,
        tenantStatus: null,
        killSwitch: null,
      };
    }

    if (requirements.requireTenantActive && !isTenantActive(tenantOrg)) {
      let reason: GuardFailureReason = "tenant_suspended";
      if (tenantOrg.status === "blocked") {
        reason = "tenant_blocked";
      } else if (tenantOrg.kill_switch) {
        reason = "tenant_kill_switch";
      }

      return {
        allowed: false,
        reason,
        userId: user.id,
        orgId: resolvedOrgId,
        orgSlug: tenantOrg.slug,
        role: roleFromMeta,
        memberStatus: null,
        tenantStatus: tenantOrg.status,
        killSwitch: tenantOrg.kill_switch,
      };
    }

    const { member, error: memberError } = await fetchMembershipByOrgId(
      supabaseClient,
      user.id,
      resolvedOrgId
    );

    if (memberError || !member) {
      return {
        allowed: false,
        reason: "membership_not_found",
        userId: user.id,
        orgId: resolvedOrgId,
        orgSlug: tenantOrg.slug,
        role: roleFromMeta,
        memberStatus: null,
        tenantStatus: tenantOrg.status,
        killSwitch: tenantOrg.kill_switch,
      };
    }

    if (requirements.requireMembershipStatus && member.status !== requirements.requireMembershipStatus) {
      return {
        allowed: false,
        reason: "membership_inactive",
        userId: user.id,
        orgId: resolvedOrgId,
        orgSlug: tenantOrg.slug,
        role: roleFromMeta,
        memberStatus: member.status,
        tenantStatus: tenantOrg.status,
        killSwitch: tenantOrg.kill_switch,
      };
    }

    const memberRole = member.role;

    if (requirements.requireRoles && requirements.requireRoles.length > 0) {
      if (!requirements.requireRoles.includes(memberRole)) {
        return {
          allowed: false,
          reason: "role_forbidden",
          userId: user.id,
          orgId: resolvedOrgId,
          orgSlug: tenantOrg.slug,
          role: memberRole,
          memberStatus: member.status,
          tenantStatus: tenantOrg.status,
          killSwitch: tenantOrg.kill_switch,
        };
      }
    }

    if (requirements.requireAgency && !isAgencyRoleStrict(memberRole)) {
      return {
        allowed: false,
        reason: "role_forbidden",
        userId: user.id,
        orgId: resolvedOrgId,
        orgSlug: tenantOrg.slug,
        role: memberRole,
        memberStatus: member.status,
        tenantStatus: tenantOrg.status,
        killSwitch: tenantOrg.kill_switch,
      };
    }

    if (requirements.requireMerchant && !isMerchantRoleStrict(memberRole)) {
      return {
        allowed: false,
        reason: "role_forbidden",
        userId: user.id,
        orgId: resolvedOrgId,
        orgSlug: tenantOrg.slug,
        role: memberRole,
        memberStatus: member.status,
        tenantStatus: tenantOrg.status,
        killSwitch: tenantOrg.kill_switch,
      };
    }

    if (requirements.requireManagement && !canManageOrg(memberRole)) {
      return {
        allowed: false,
        reason: "role_forbidden",
        userId: user.id,
        orgId: resolvedOrgId,
        orgSlug: tenantOrg.slug,
        role: memberRole,
        memberStatus: member.status,
        tenantStatus: tenantOrg.status,
        killSwitch: tenantOrg.kill_switch,
      };
    }

    return {
      allowed: true,
      reason: null,
      userId: user.id,
      orgId: resolvedOrgId,
      orgSlug: tenantOrg.slug,
      role: memberRole,
      memberStatus: member.status,
      tenantStatus: tenantOrg.status,
      killSwitch: tenantOrg.kill_switch,
    };
  }

  return {
    allowed: true,
    reason: null,
    userId: user.id,
    orgId: resolvedOrgId,
    orgSlug: resolvedOrgSlug,
    role: roleFromMeta,
    memberStatus: null,
    tenantStatus: null,
    killSwitch: null,
  };
}

export async function requireGuard(
  supabaseClient: ReturnType<typeof createAdminClient>,
  requirements: GuardRequirement
): Promise<GuardValidationResult> {
  const result = await validateGuard(supabaseClient, requirements);

  if (!result.allowed) {
    throw new Error(`Access denied: ${result.reason}`);
  }

  return result;
}

export async function enforceTenantStatus(
  supabaseClient: ReturnType<typeof createAdminClient>,
  orgId: string
): Promise<{ allowed: boolean; reason: string | null; tenant: TenantRecord | null }> {
  const normalizedOrgId = normalize(orgId);
  if (!normalizedOrgId) {
    return { allowed: false, reason: "org_id required", tenant: null };
  }

  const { org, error } = await fetchTenantById(supabaseClient, normalizedOrgId);
  if (error || !org) {
    return { allowed: false, reason: "tenant_not_found", tenant: null };
  }

  if (org.kill_switch) {
    return { allowed: false, reason: "tenant_kill_switch", tenant: org };
  }

  if (org.status === "suspended") {
    return { allowed: false, reason: "tenant_suspended", tenant: org };
  }

  if (org.status === "blocked") {
    return { allowed: false, reason: "tenant_blocked", tenant: org };
  }

  return { allowed: true, reason: null, tenant: org };
}
