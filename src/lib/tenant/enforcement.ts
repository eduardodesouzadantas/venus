import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  createOperationalEventDedupeKey,
  formatOperationalReason,
  recordOperationalTenantEvent,
} from "@/lib/reliability/observability";
import type { TenantRecord } from "@/lib/tenant/core";

export type TenantOperationalOperation =
  | "saved_result_generation"
  | "ai_recommendation_generation"
  | "catalog_product_creation"
  | "whatsapp_handoff_sync";

export type TenantOperationalReason = "tenant_not_found" | "suspended" | "blocked" | "kill_switch_on";

export interface TenantOperationalOrgSnapshot {
  id: string;
  slug: string;
  status: TenantRecord["status"];
  kill_switch: boolean;
  plan_id: string | null;
}

export interface TenantOperationalDecision {
  allowed: boolean;
  operation: TenantOperationalOperation;
  reason: TenantOperationalReason | null;
  status: TenantRecord["status"] | null;
  kill_switch: boolean | null;
  org_id: string | null;
  org_slug: string | null;
  plan_id: string | null;
  message: string | null;
}

export interface TenantOperationalEnforcementInput {
  orgId: string;
  operation: TenantOperationalOperation;
  actorUserId?: string | null;
  eventSource?: string | null;
  metadata?: Record<string, unknown>;
  org?: TenantOperationalOrgSnapshot | null;
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function blockedDecision(
  operation: TenantOperationalOperation,
  org: TenantOperationalOrgSnapshot,
  reason: TenantOperationalReason,
  message: string
): TenantOperationalDecision {
  return {
    allowed: false,
    operation,
    reason,
    status: org.status,
    kill_switch: org.kill_switch,
    org_id: org.id,
    org_slug: org.slug,
    plan_id: org.plan_id || null,
    message,
  };
}

function allowedDecision(
  operation: TenantOperationalOperation,
  org: TenantOperationalOrgSnapshot | null
): TenantOperationalDecision {
  return {
    allowed: true,
    operation,
    reason: null,
    status: org?.status || null,
    kill_switch: org?.kill_switch ?? null,
    org_id: org?.id || null,
    org_slug: org?.slug || null,
    plan_id: org?.plan_id || null,
    message: null,
  };
}

async function loadTenant(orgId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orgs")
    .select("id, slug, status, kill_switch, plan_id")
    .eq("id", orgId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load tenant state: ${error.message}`);
  }

  return (data as TenantOperationalOrgSnapshot | null) || null;
}

async function recordOperationalBlock(
  input: TenantOperationalEnforcementInput,
  decision: TenantOperationalDecision
) {
  const admin = createAdminClient();
  await recordOperationalTenantEvent(admin, {
    orgId: input.orgId,
    actorUserId: input.actorUserId || null,
    eventType: "tenant.operational_blocked",
    eventSource: input.eventSource || "tenant_guard",
    dedupeKey: createOperationalEventDedupeKey([
      "tenant.operational_blocked",
      input.orgId,
      decision.operation,
      decision.reason || "unknown",
      decision.status || "unknown",
      decision.kill_switch ? "kill_switch_on" : "kill_switch_off",
      Date.now().toString(),
    ]),
    payload: {
      org_id: input.orgId,
      org_slug: decision.org_slug,
      operation: decision.operation,
      reason: decision.reason,
      reason_code: formatOperationalReason("tenant_blocked", decision.reason || "unknown"),
      status: decision.status,
      kill_switch: decision.kill_switch,
      plan_id: decision.plan_id,
      message: decision.message,
      ...input.metadata,
    },
  });
}

export async function enforceTenantOperationalState(
  input: TenantOperationalEnforcementInput
): Promise<TenantOperationalDecision> {
  const orgId = normalize(input.orgId);
  if (!orgId) {
    return {
      allowed: false,
      operation: input.operation,
      reason: "tenant_not_found",
      status: null,
      kill_switch: null,
      org_id: null,
      org_slug: null,
      plan_id: null,
      message: "Tenant not found",
    };
  }

  const org = input.org || (await loadTenant(orgId));

  if (!org) {
    const decision: TenantOperationalDecision = {
      allowed: false,
      operation: input.operation,
      reason: "tenant_not_found",
      status: null,
      kill_switch: null,
      org_id: orgId,
      org_slug: null,
      plan_id: null,
      message: "Tenant not found",
    };

    await recordOperationalBlock(input, decision);
    return decision;
  }

  if (org.kill_switch) {
    const decision = blockedDecision(
      input.operation,
      org,
      "kill_switch_on",
      `Org ${org.slug} está com kill switch ativo. Operação bloqueada.`
    );

    await recordOperationalBlock(input, decision);
    return decision;
  }

  if (org.status === "suspended") {
    const decision = blockedDecision(
      input.operation,
      org,
      "suspended",
      `Org ${org.slug} está suspensa. Operação bloqueada.`
    );

    await recordOperationalBlock(input, decision);
    return decision;
  }

  if (org.status === "blocked") {
    const decision = blockedDecision(
      input.operation,
      org,
      "blocked",
      `Org ${org.slug} está bloqueada. Operação bloqueada.`
    );

    await recordOperationalBlock(input, decision);
    return decision;
  }

  return allowedDecision(input.operation, org);
}
