import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { queryWithTimeout } from "@/lib/supabase/query-timeout";
import { canConsumeResource, consumeResource, type ResourceType } from "@/lib/resource-control";
import { logAudit } from "@/lib/security/audit";
import { recordOperationalTenantEvent } from "@/lib/reliability/observability";
import type { TenantRecord } from "@/lib/tenant/core";

export const GAMIFICATION_RULE_TYPES = [
  "share_bonus",
  "return_after_days",
  "onboarding_complete",
  "recurring_interaction",
  "purchase_confirmed",
] as const;

export const GAMIFICATION_TRIGGER_MODES = ["manual", "automatic"] as const;

export const GAMIFICATION_TRIGGER_EVENT_TYPES = [
  "onboarding_completed",
  "lead_reengaged",
  "result_shared",
] as const;

export const GAMIFICATION_BENEFIT_RESOURCE_TYPES = [
  "try_on",
  "whatsapp_message",
  "ai_tokens",
] as const;

export const GAMIFICATION_EVENT_TYPES = [
  "rule_create",
  "rule_update",
  "rule_deactivate",
  "grant",
  "consume",
  "block",
] as const;

export type GamificationRuleType = (typeof GAMIFICATION_RULE_TYPES)[number];
export type GamificationTriggerMode = (typeof GAMIFICATION_TRIGGER_MODES)[number];
export type GamificationTriggerEventType = (typeof GAMIFICATION_TRIGGER_EVENT_TYPES)[number];
export type GamificationBenefitResourceType = (typeof GAMIFICATION_BENEFIT_RESOURCE_TYPES)[number];
export type GamificationEventType = (typeof GAMIFICATION_EVENT_TYPES)[number];
export type GamificationEventStatus = "pending" | "success" | "blocked";

export interface GamificationRuleRecord {
  id: string;
  org_id: string;
  rule_type: GamificationRuleType;
  benefit_resource_type: GamificationBenefitResourceType;
  benefit_amount: number;
  active: boolean;
  trigger_mode: GamificationTriggerMode;
  trigger_event_type: GamificationTriggerEventType | null;
  per_customer_limit: number;
  per_customer_period_days: number;
  valid_from: string;
  valid_until: string | null;
  label: string;
  description: string | null;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GamificationEventRecord {
  id: string;
  org_id: string;
  rule_id: string | null;
  customer_key: string | null;
  customer_label: string | null;
  event_type: GamificationEventType;
  status: GamificationEventStatus;
  resource_type: GamificationBenefitResourceType | null;
  amount: number;
  reason: string | null;
  actor_user_id: string | null;
  source_event_type: GamificationTriggerEventType | null;
  source_event_key: string | null;
  metadata: Record<string, unknown>;
  expires_at: string | null;
  created_at: string;
}

export interface GamificationBudgetBucket {
  granted: number;
  consumed: number;
  available: number;
  blocked: number;
}

export interface GamificationBudgetSummary {
  total_granted: number;
  total_consumed: number;
  total_available: number;
  blocked: number;
  by_resource: Record<GamificationBenefitResourceType, GamificationBudgetBucket>;
}

export interface GamificationCustomerBalanceResource {
  granted: number;
  consumed: number;
  available: number;
}

export interface GamificationCustomerBalance {
  customer_key: string;
  customer_label: string | null;
  last_event_at: string | null;
  last_rule_label: string | null;
  resources: Record<GamificationBenefitResourceType, GamificationCustomerBalanceResource>;
}

export interface GamificationOverview {
  org: TenantRecord | null;
  rules: GamificationRuleRecord[];
  recent_events: GamificationEventRecord[];
  recent_automatic_events: GamificationEventRecord[];
  recent_customers: GamificationCustomerBalance[];
  budget: GamificationBudgetSummary;
  active_rule_count: number;
  inactive_rule_count: number;
  automatic_rule_count: number;
  automatic_blocked_events: number;
  last_automatic_event_at: string | null;
  blocked_events: number;
  has_data: boolean;
  alerts: string[];
}

export interface GamificationRuleInput {
  orgId: string;
  actorUserId: string;
  reason?: string | null;
  ruleId?: string | null;
  ruleType: GamificationRuleType;
  triggerMode?: GamificationTriggerMode;
  triggerEventType?: GamificationTriggerEventType | null;
  benefitResourceType: GamificationBenefitResourceType;
  benefitAmount: number;
  perCustomerLimit: number;
  perCustomerPeriodDays: number;
  active: boolean;
  label: string;
  description?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
}

export interface GamificationGrantInput {
  orgId: string;
  actorUserId?: string | null;
  customerKey: string;
  customerLabel?: string | null;
  ruleId: string;
  amount?: number | null;
  reason?: string | null;
  sourceEventType?: GamificationTriggerEventType | null;
  sourceEventKey?: string | null;
  sourceEventPayload?: Record<string, unknown> | null;
}

export interface GamificationConsumeInput {
  orgId: string;
  actorUserId: string;
  customerKey: string;
  customerLabel?: string | null;
  resourceType: GamificationBenefitResourceType;
  amount: number;
  reason?: string | null;
}

export interface GamificationRepository {
  loadOrg(orgId: string): Promise<TenantRecord | null>;
  listRules(orgId: string): Promise<GamificationRuleRecord[]>;
  getRule(orgId: string, ruleId: string): Promise<GamificationRuleRecord | null>;
  findEventBySourceEventKey(orgId: string, ruleId: string, sourceEventKey: string): Promise<GamificationEventRecord | null>;
  insertRule(input: Partial<GamificationRuleRecord> & { org_id: string; created_by_user_id: string | null; updated_by_user_id: string | null }): Promise<GamificationRuleRecord | null>;
  updateRule(
    orgId: string,
    ruleId: string,
    input: Partial<GamificationRuleRecord> & { updated_by_user_id: string | null }
  ): Promise<GamificationRuleRecord | null>;
  listEvents(orgId: string, limit?: number): Promise<GamificationEventRecord[]>;
  listCustomerRuleEvents(
    orgId: string,
    customerKey: string,
    ruleId: string,
    sinceIso: string
  ): Promise<GamificationEventRecord[]>;
  listCustomerEvents(orgId: string, customerKey: string, limit?: number): Promise<GamificationEventRecord[]>;
  insertEvent(input: Partial<GamificationEventRecord> & { org_id: string }): Promise<GamificationEventRecord | null>;
  updateEvent(
    orgId: string,
    eventId: string,
    input: Partial<GamificationEventRecord>
  ): Promise<GamificationEventRecord | null>;
}

export interface GamificationServiceOptions {
  repository?: GamificationRepository;
  now?: Date;
}

const RESOURCE_LABELS: Record<GamificationBenefitResourceType, string> = {
  try_on: "Try-on extra",
  whatsapp_message: "Mensagem premium",
  ai_tokens: "Tokens IA",
};

const RULE_LABELS: Record<GamificationRuleType, string> = {
  share_bonus: "Bônus por share",
  return_after_days: "Retorno após X dias",
  onboarding_complete: "Onboarding concluído",
  recurring_interaction: "Interação recorrente",
  purchase_confirmed: "Compra confirmada",
};

const TRIGGER_EVENT_LABELS: Record<GamificationTriggerEventType, string> = {
  onboarding_completed: "Onboarding concluído",
  lead_reengaged: "Lead reengajado",
  result_shared: "Resultado compartilhado",
};

const TRIGGER_MODE_LABELS: Record<GamificationTriggerMode, string> = {
  manual: "Manual",
  automatic: "Automática",
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toPositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.trunc(parsed);
}

function toIsoDate(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function utcDateOffset(now: Date, days: number) {
  const result = new Date(now);
  result.setUTCDate(result.getUTCDate() - days);
  return result.toISOString();
}

function defaultBudgetBucket(): GamificationBudgetBucket {
  return { granted: 0, consumed: 0, available: 0, blocked: 0 };
}

function defaultCustomerResource(): GamificationCustomerBalanceResource {
  return { granted: 0, consumed: 0, available: 0 };
}

function eventSortDesc(left: GamificationEventRecord, right: GamificationEventRecord) {
  return right.created_at.localeCompare(left.created_at);
}

function eventChronologicalSort(left: GamificationEventRecord, right: GamificationEventRecord) {
  const timeCompare = left.created_at.localeCompare(right.created_at);
  if (timeCompare !== 0) return timeCompare;

  const priority = (eventType: GamificationEventType) => {
    if (eventType === "grant") return 0;
    if (eventType === "consume") return 1;
    return 2;
  };

  const leftPriority = priority(left.event_type);
  const rightPriority = priority(right.event_type);
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return left.id.localeCompare(right.id);
}

function buildCustomerResourceLedger(): Record<GamificationBenefitResourceType, GamificationCustomerBalanceResource> {
  return {
    try_on: defaultCustomerResource(),
    whatsapp_message: defaultCustomerResource(),
    ai_tokens: defaultCustomerResource(),
  };
}

function buildBudgetLedger(): Record<GamificationBenefitResourceType, GamificationBudgetBucket> {
  return {
    try_on: defaultBudgetBucket(),
    whatsapp_message: defaultBudgetBucket(),
    ai_tokens: defaultBudgetBucket(),
  };
}

function buildBudgetSummary(): GamificationBudgetSummary {
  return {
    total_granted: 0,
    total_consumed: 0,
    total_available: 0,
    blocked: 0,
    by_resource: buildBudgetLedger(),
  };
}

function ruleTypeLabel(ruleType: GamificationRuleType) {
  return RULE_LABELS[ruleType];
}

function resourceLabel(resourceType: GamificationBenefitResourceType) {
  return RESOURCE_LABELS[resourceType];
}

function normalizeGamificationTriggerMode(value: unknown): GamificationTriggerMode {
  const raw = normalize(value);
  return raw === "automatic" ? "automatic" : "manual";
}

export function normalizeGamificationTriggerEventType(value: unknown): GamificationTriggerEventType | null {
  const raw = normalize(value);
  return (GAMIFICATION_TRIGGER_EVENT_TYPES as readonly string[]).includes(raw)
    ? (raw as GamificationTriggerEventType)
    : null;
}

function isAutomaticRule(rule: GamificationRuleRecord) {
  return normalizeGamificationTriggerMode(rule.trigger_mode) === "automatic";
}

function clampNonNegative(value: number) {
  return Math.max(0, Math.trunc(value));
}

function isExpired(event: GamificationEventRecord, referenceDate: Date) {
  if (!event.expires_at) return false;
  return new Date(event.expires_at).getTime() < referenceDate.getTime();
}

function isRuleActive(rule: GamificationRuleRecord, referenceDate: Date) {
  if (!rule.active) return false;

  const referenceIso = referenceDate.toISOString();
  if (rule.valid_from && rule.valid_from > referenceIso) return false;
  if (rule.valid_until && rule.valid_until < referenceIso) return false;

  return true;
}

function sumCustomerGrantedAmount(
  events: GamificationEventRecord[],
  resourceType: GamificationBenefitResourceType,
  sinceIso: string
) {
  return events
    .filter((event) => event.event_type === "grant" && event.status === "success")
    .filter((event) => event.resource_type === resourceType)
    .filter((event) => !event.created_at || event.created_at >= sinceIso)
    .reduce((total, event) => total + clampNonNegative(event.amount || 0), 0);
}

function applyEventToBudget(budget: GamificationBudgetSummary, event: GamificationEventRecord, referenceDate: Date) {
  if (!event.resource_type) return;

  const bucket = budget.by_resource[event.resource_type];
  if (!bucket) return;
  const amount = clampNonNegative(event.amount || 0);

  if (event.event_type === "grant" && event.status === "success" && !isExpired(event, referenceDate)) {
    bucket.granted += amount;
    budget.total_granted += amount;
    bucket.available += amount;
    budget.total_available += amount;
  }

  if (event.event_type === "consume" && event.status === "success") {
    bucket.consumed += amount;
    budget.total_consumed += amount;
    bucket.available = Math.max(0, bucket.available - amount);
    budget.total_available = Math.max(0, budget.total_available - amount);
  }

  if (event.status === "blocked") {
    bucket.blocked += amount;
    budget.blocked += 1;
  }
}

function buildCustomerBalance(
  customerKey: string,
  events: GamificationEventRecord[],
  referenceDate: Date
): GamificationCustomerBalance {
  const resources = buildCustomerResourceLedger();
  let customerLabel: string | null = null;
  let lastEventAt: string | null = null;
  let lastRuleLabel: string | null = null;

  for (const event of [...events].sort(eventChronologicalSort)) {
    if (event.customer_label && !customerLabel) {
      customerLabel = event.customer_label;
    }

    lastEventAt = event.created_at;
    lastRuleLabel = event.metadata?.rule_label ? String(event.metadata.rule_label) : event.reason || null;

    if (!event.resource_type) continue;

    const bucket = resources[event.resource_type];
    const amount = clampNonNegative(event.amount || 0);

    if (event.event_type === "grant" && event.status === "success" && !isExpired(event, referenceDate)) {
      bucket.granted += amount;
      bucket.available += amount;
    }

    if (event.event_type === "consume" && event.status === "success") {
      bucket.consumed += amount;
      bucket.available = Math.max(0, bucket.available - amount);
    }
  }

  return {
    customer_key: customerKey,
    customer_label: customerLabel,
    last_event_at: lastEventAt,
    last_rule_label: lastRuleLabel,
    resources,
  };
}

export function buildGamificationOverview(input: {
  org: TenantRecord | null;
  rules: GamificationRuleRecord[];
  events: GamificationEventRecord[];
  referenceDate?: Date;
}): GamificationOverview {
  const referenceDate = input.referenceDate || new Date();
  const scopedRules = input.org ? input.rules.filter((rule) => rule.org_id === input.org?.id) : input.rules;
  const filteredRules = [...scopedRules].sort((left, right) => right.created_at.localeCompare(left.created_at));
  const scopedEvents = input.org ? input.events.filter((event) => event.org_id === input.org?.id) : input.events;
  const filteredEvents = [...scopedEvents].sort(eventSortDesc);
  const chronologicalEvents = [...scopedEvents].sort(eventChronologicalSort);
  const budget = buildBudgetSummary();
  const customerMap = new Map<string, GamificationEventRecord[]>();

  for (const event of chronologicalEvents) {
    applyEventToBudget(budget, event, referenceDate);
    if (event.event_type === "grant" && event.status === "success" && isExpired(event, referenceDate)) {
      continue;
    }

    const customerKey = normalize(event.customer_key);
    if (!customerKey) continue;

    const current = customerMap.get(customerKey) || [];
    current.push(event);
    customerMap.set(customerKey, current);
  }

  const recentCustomers = [...customerMap.entries()]
    .map(([customerKey, events]) => buildCustomerBalance(customerKey, events, referenceDate))
    .sort((left, right) => {
      if (left.last_event_at && right.last_event_at && left.last_event_at !== right.last_event_at) {
        return right.last_event_at.localeCompare(left.last_event_at);
      }

      const leftAvailable = Object.values(left.resources).reduce((total, item) => total + item.available, 0);
      const rightAvailable = Object.values(right.resources).reduce((total, item) => total + item.available, 0);
      return rightAvailable - leftAvailable;
    })
    .slice(0, 8);

  const activeRuleCount = filteredRules.filter((rule) => isRuleActive(rule, referenceDate)).length;
  const inactiveRuleCount = filteredRules.length - activeRuleCount;
  const automaticRuleCount = filteredRules.filter((rule) => isAutomaticRule(rule)).length;
  const blockedEvents = filteredEvents.filter((event) => event.status === "blocked").length;
  const recentAutomaticEvents = filteredEvents.filter((event) => Boolean(event.source_event_key));
  const automaticBlockedEvents = filteredEvents.filter((event) => Boolean(event.source_event_key) && event.status === "blocked").length;
  const lastAutomaticEventAt = recentAutomaticEvents[0]?.created_at || null;
  const hasData = Boolean(input.org) || filteredRules.length > 0 || filteredEvents.length > 0;
  const alerts: string[] = [];

  if (activeRuleCount === 0) {
    alerts.push("Sem regras ativas");
  }

  if (blockedEvents > 0) {
    alerts.push("Existem concessoes bloqueadas por budget");
  }

  if (budget.total_granted > 0 && budget.total_available === 0) {
    alerts.push("Saldo promocional esgotado");
  }

  return {
    org: input.org,
    rules: filteredRules,
    recent_events: filteredEvents.slice(0, 12),
    recent_automatic_events: recentAutomaticEvents,
    recent_customers: recentCustomers,
    budget,
    active_rule_count: activeRuleCount,
    inactive_rule_count: inactiveRuleCount,
    automatic_rule_count: automaticRuleCount,
    automatic_blocked_events: automaticBlockedEvents,
    last_automatic_event_at: lastAutomaticEventAt,
    blocked_events: blockedEvents,
    has_data: hasData,
    alerts,
  };
}

export function normalizeGamificationRuleType(value: unknown): GamificationRuleType | null {
  const raw = normalize(value);
  return (GAMIFICATION_RULE_TYPES as readonly string[]).includes(raw) ? (raw as GamificationRuleType) : null;
}

export function normalizeGamificationBenefitResourceType(value: unknown): GamificationBenefitResourceType | null {
  const raw = normalize(value);
  return (GAMIFICATION_BENEFIT_RESOURCE_TYPES as readonly string[]).includes(raw)
    ? (raw as GamificationBenefitResourceType)
    : null;
}

function normalizeStatus(value: unknown): GamificationEventStatus {
  const raw = normalize(value);
  return raw === "pending" || raw === "blocked" ? raw : "success";
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as unknown as Record<string, unknown>;
}

export function gamificationRuleLabel(ruleType: GamificationRuleType) {
  return ruleTypeLabel(ruleType);
}

export function gamificationResourceLabel(resourceType: GamificationBenefitResourceType) {
  return resourceLabel(resourceType);
}

export function gamificationTriggerEventLabel(eventType: GamificationTriggerEventType | null | undefined) {
  if (!eventType) return "Manual";
  return TRIGGER_EVENT_LABELS[eventType] || "Automática";
}

export function gamificationTriggerModeLabel(triggerMode: GamificationTriggerMode | null | undefined) {
  if (!triggerMode) return TRIGGER_MODE_LABELS.manual;
  return TRIGGER_MODE_LABELS[triggerMode] || TRIGGER_MODE_LABELS.manual;
}

export function canAccessGamificationPanel(role?: string | null) {
  return typeof role === "string" && role.trim().startsWith("merchant_");
}

function buildRepository(admin = createAdminClient()): GamificationRepository {
  return {
    async loadOrg(orgId) {
      const { data, error } = await queryWithTimeout(
        admin
          .from("orgs")
          .select("id, slug, name, status, kill_switch, plan_id, limits, owner_user_id, created_at, updated_at")
          .eq("id", orgId)
          .maybeSingle(),
        { data: null, error: null }
      );

      if (error) {
        return null;
      }

      return (data as TenantRecord | null) || null;
    },
    async listRules(orgId) {
      const { data, error } = await queryWithTimeout(
        admin
          .from("gamification_rules")
          .select(
            "id, org_id, rule_type, trigger_mode, trigger_event_type, benefit_resource_type, benefit_amount, active, per_customer_limit, per_customer_period_days, valid_from, valid_until, label, description, created_by_user_id, updated_by_user_id, created_at, updated_at"
          )
          .eq("org_id", orgId)
          .order("created_at", { ascending: false }),
        { data: [], error: null }
      );

      if (error) return [];
      return ((data || []) as GamificationRuleRecord[]).map((rule) => ({
        ...rule,
        trigger_mode: normalizeGamificationTriggerMode((rule as unknown as Record<string, unknown>).trigger_mode),
        trigger_event_type: normalizeGamificationTriggerEventType((rule as unknown as Record<string, unknown>).trigger_event_type),
      }));
    },
    async getRule(orgId, ruleId) {
      const { data, error } = await queryWithTimeout(
        admin
          .from("gamification_rules")
          .select(
            "id, org_id, rule_type, trigger_mode, trigger_event_type, benefit_resource_type, benefit_amount, active, per_customer_limit, per_customer_period_days, valid_from, valid_until, label, description, created_by_user_id, updated_by_user_id, created_at, updated_at"
          )
          .eq("org_id", orgId)
          .eq("id", ruleId)
          .maybeSingle(),
        { data: null, error: null }
      );

      if (error) return null;
      const rule = (data as GamificationRuleRecord | null) || null;
      if (!rule) return null;
      return {
        ...rule,
        trigger_mode: normalizeGamificationTriggerMode((rule as unknown as Record<string, unknown>).trigger_mode),
        trigger_event_type: normalizeGamificationTriggerEventType((rule as unknown as Record<string, unknown>).trigger_event_type),
      };
    },
    async findEventBySourceEventKey(orgId, ruleId, sourceEventKey) {
      const { data, error } = await queryWithTimeout(
        admin
          .from("gamification_events")
          .select(
            "id, org_id, rule_id, customer_key, customer_label, event_type, status, resource_type, amount, reason, actor_user_id, source_event_type, source_event_key, metadata, expires_at, created_at"
          )
          .eq("org_id", orgId)
          .eq("rule_id", ruleId)
          .eq("source_event_key", sourceEventKey)
          .maybeSingle(),
        { data: null, error: null }
      );

      if (error) return null;
      return (data as GamificationEventRecord | null) || null;
    },
    async insertRule(input) {
      const { data, error } = await admin
        .from("gamification_rules")
        .insert(input)
        .select(
          "id, org_id, rule_type, trigger_mode, trigger_event_type, benefit_resource_type, benefit_amount, active, per_customer_limit, per_customer_period_days, valid_from, valid_until, label, description, created_by_user_id, updated_by_user_id, created_at, updated_at"
        )
        .single();

      if (error || !data) return null;
      return {
        ...(data as GamificationRuleRecord),
        trigger_mode: normalizeGamificationTriggerMode((data as unknown as Record<string, unknown>).trigger_mode),
        trigger_event_type: normalizeGamificationTriggerEventType((data as unknown as Record<string, unknown>).trigger_event_type),
      };
    },
    async updateRule(orgId, ruleId, input) {
      const { data, error } = await admin
        .from("gamification_rules")
        .update(input)
        .eq("org_id", orgId)
        .eq("id", ruleId)
        .select(
          "id, org_id, rule_type, trigger_mode, trigger_event_type, benefit_resource_type, benefit_amount, active, per_customer_limit, per_customer_period_days, valid_from, valid_until, label, description, created_by_user_id, updated_by_user_id, created_at, updated_at"
        )
        .single();

      if (error || !data) return null;
      return {
        ...(data as GamificationRuleRecord),
        trigger_mode: normalizeGamificationTriggerMode((data as unknown as Record<string, unknown>).trigger_mode),
        trigger_event_type: normalizeGamificationTriggerEventType((data as unknown as Record<string, unknown>).trigger_event_type),
      };
    },
    async listEvents(orgId, limit = 40) {
      const { data, error } = await queryWithTimeout(
        admin
          .from("gamification_events")
          .select(
            "id, org_id, rule_id, customer_key, customer_label, event_type, status, resource_type, amount, reason, actor_user_id, source_event_type, source_event_key, metadata, expires_at, created_at"
          )
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(limit),
        { data: [], error: null }
      );

      if (error) return [];
      return ((data || []) as GamificationEventRecord[]).map((event) => ({
        ...event,
        status: normalizeStatus(event.status),
        source_event_type: normalizeGamificationTriggerEventType((event as unknown as Record<string, unknown>).source_event_type),
        source_event_key: normalize((event as unknown as Record<string, unknown>).source_event_key),
        metadata: normalizeMetadata(event.metadata),
      }));
    },
    async listCustomerRuleEvents(orgId, customerKey, ruleId, sinceIso) {
      const { data, error } = await queryWithTimeout(
        admin
          .from("gamification_events")
          .select(
            "id, org_id, rule_id, customer_key, customer_label, event_type, status, resource_type, amount, reason, actor_user_id, source_event_type, source_event_key, metadata, expires_at, created_at"
          )
          .eq("org_id", orgId)
          .eq("customer_key", customerKey)
          .eq("rule_id", ruleId)
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false }),
        { data: [], error: null }
      );

      if (error) return [];
      return ((data || []) as GamificationEventRecord[]).map((event) => ({
        ...event,
        status: normalizeStatus(event.status),
        source_event_type: normalizeGamificationTriggerEventType((event as unknown as Record<string, unknown>).source_event_type),
        source_event_key: normalize((event as unknown as Record<string, unknown>).source_event_key),
        metadata: normalizeMetadata(event.metadata),
      }));
    },
    async listCustomerEvents(orgId, customerKey, limit = 50) {
      const { data, error } = await queryWithTimeout(
        admin
          .from("gamification_events")
          .select(
            "id, org_id, rule_id, customer_key, customer_label, event_type, status, resource_type, amount, reason, actor_user_id, source_event_type, source_event_key, metadata, expires_at, created_at"
          )
          .eq("org_id", orgId)
          .eq("customer_key", customerKey)
          .order("created_at", { ascending: false })
          .limit(limit),
        { data: [], error: null }
      );

      if (error) return [];
      return ((data || []) as GamificationEventRecord[]).map((event) => ({
        ...event,
        status: normalizeStatus(event.status),
        source_event_type: normalizeGamificationTriggerEventType((event as unknown as Record<string, unknown>).source_event_type),
        source_event_key: normalize((event as unknown as Record<string, unknown>).source_event_key),
        metadata: normalizeMetadata(event.metadata),
      }));
    },
    async insertEvent(input) {
      const { data, error } = await admin
        .from("gamification_events")
        .insert(input)
        .select(
          "id, org_id, rule_id, customer_key, customer_label, event_type, status, resource_type, amount, reason, actor_user_id, source_event_type, source_event_key, metadata, expires_at, created_at"
        )
        .single();

      if (error || !data) return null;
      return {
        ...data,
        status: normalizeStatus(data.status),
        source_event_type: normalizeGamificationTriggerEventType((data as unknown as Record<string, unknown>).source_event_type),
        source_event_key: normalize((data as unknown as Record<string, unknown>).source_event_key),
        metadata: normalizeMetadata(data.metadata),
      } as GamificationEventRecord;
    },
    async updateEvent(orgId, eventId, input) {
      const { data, error } = await admin
        .from("gamification_events")
        .update(input)
        .eq("org_id", orgId)
        .eq("id", eventId)
        .select(
          "id, org_id, rule_id, customer_key, customer_label, event_type, status, resource_type, amount, reason, actor_user_id, source_event_type, source_event_key, metadata, expires_at, created_at"
        )
        .single();

      if (error || !data) return null;
      return {
        ...data,
        status: normalizeStatus(data.status),
        source_event_type: normalizeGamificationTriggerEventType((data as unknown as Record<string, unknown>).source_event_type),
        source_event_key: normalize((data as unknown as Record<string, unknown>).source_event_key),
        metadata: normalizeMetadata(data.metadata),
      } as GamificationEventRecord;
    },
  };
}

function resolveRepository(options?: GamificationServiceOptions) {
  return options?.repository || buildRepository();
}

export async function loadGamificationOverview(
  orgId: string,
  options?: GamificationServiceOptions
): Promise<GamificationOverview> {
  const repository = resolveRepository(options);
  const [org, rules, events] = await Promise.all([
    repository.loadOrg(orgId),
    repository.listRules(orgId),
    repository.listEvents(orgId, 60),
  ]);

  return buildGamificationOverview({
    org,
    rules,
    events,
    referenceDate: options?.now,
  });
}

export async function findGamificationEventBySourceEventKey(
  orgId: string,
  ruleId: string,
  sourceEventKey: string,
  options?: GamificationServiceOptions
): Promise<GamificationEventRecord | null> {
  const repository = resolveRepository(options);
  const normalizedOrgId = normalize(orgId);
  const normalizedRuleId = normalize(ruleId);
  const normalizedSourceEventKey = normalize(sourceEventKey);

  if (!normalizedOrgId || !normalizedRuleId || !normalizedSourceEventKey) {
    return null;
  }

  return repository.findEventBySourceEventKey(normalizedOrgId, normalizedRuleId, normalizedSourceEventKey);
}

export async function listGamificationRules(
  orgId: string,
  options?: GamificationServiceOptions
) {
  return resolveRepository(options).listRules(orgId);
}

export async function createGamificationRule(
  input: GamificationRuleInput,
  options?: GamificationServiceOptions
) {
  const repository = resolveRepository(options);
  const now = options?.now || new Date();
  const orgId = normalize(input.orgId);
  const actorUserId = normalize(input.actorUserId);
  const label = normalize(input.label);
  const reason = normalize(input.reason);
  const description = normalize(input.description);
  const triggerMode = normalizeGamificationTriggerMode(input.triggerMode);
  const triggerEventType = triggerMode === "automatic" ? normalizeGamificationTriggerEventType(input.triggerEventType) : null;

  if (!orgId || !actorUserId || !label) {
    throw new Error("Missing gamification rule fields");
  }

  if (triggerMode === "automatic" && !triggerEventType) {
    throw new Error("Missing gamification trigger event");
  }

  const rule = await repository.insertRule({
    org_id: orgId,
    rule_type: input.ruleType,
    trigger_mode: triggerMode,
    trigger_event_type: triggerEventType,
    benefit_resource_type: input.benefitResourceType,
    benefit_amount: toPositiveNumber(input.benefitAmount, 1),
    active: input.active,
    per_customer_limit: toPositiveNumber(input.perCustomerLimit, 1),
    per_customer_period_days: toPositiveNumber(input.perCustomerPeriodDays, 30),
    valid_from: input.validFrom ? toIsoDate(input.validFrom) || now.toISOString() : now.toISOString(),
    valid_until: input.validUntil ? toIsoDate(input.validUntil) : null,
    label,
    description: description || null,
    created_by_user_id: actorUserId,
    updated_by_user_id: actorUserId,
  });

  if (!rule) {
    throw new Error("Failed to create gamification rule");
  }

  await Promise.all([
    logAudit({
      orgId,
      userId: actorUserId,
      action: "gamification_rule_create",
      resourceType: "gamification_rules",
      resourceId: rule.id,
      metadata: {
        rule_type: rule.rule_type,
        benefit_resource_type: rule.benefit_resource_type,
        trigger_mode: rule.trigger_mode,
        trigger_event_type: rule.trigger_event_type,
        benefit_amount: rule.benefit_amount,
        per_customer_limit: rule.per_customer_limit,
        per_customer_period_days: rule.per_customer_period_days,
        active: rule.active,
        reason: reason || null,
      },
      status: "success",
    }),
    recordOperationalTenantEvent(createAdminClient(), {
      orgId,
      actorUserId,
      eventType: "gamification.rule_created",
      eventSource: "gamification",
      dedupeKeyParts: [orgId, rule.id, "create", rule.rule_type, rule.benefit_resource_type],
      payload: {
        org_id: orgId,
        rule_id: rule.id,
        label: rule.label,
        reason: reason || null,
      },
    }),
  ]);

  return rule;
}

export async function updateGamificationRule(
  input: GamificationRuleInput,
  options?: GamificationServiceOptions
) {
  const repository = resolveRepository(options);
  const now = options?.now || new Date();
  const orgId = normalize(input.orgId);
  const actorUserId = normalize(input.actorUserId);
  const ruleId = normalize(input.ruleId);
  const label = normalize(input.label);
  const reason = normalize(input.reason);
  const description = normalize(input.description);

  if (!orgId || !actorUserId || !ruleId) {
    throw new Error("Missing gamification rule fields");
  }

  const existing = await repository.getRule(orgId, ruleId);
  if (!existing) {
    throw new Error("Gamification rule not found");
  }

  const triggerMode = normalizeGamificationTriggerMode(input.triggerMode ?? existing.trigger_mode);
  const triggerEventType =
    triggerMode === "automatic"
      ? normalizeGamificationTriggerEventType(input.triggerEventType ?? existing.trigger_event_type)
      : null;

  if (triggerMode === "automatic" && !triggerEventType) {
    throw new Error("Missing gamification trigger event");
  }

  const rule = await repository.updateRule(orgId, ruleId, {
    rule_type: input.ruleType || existing.rule_type,
    trigger_mode: triggerMode,
    trigger_event_type: triggerEventType,
    benefit_resource_type: input.benefitResourceType || existing.benefit_resource_type,
    benefit_amount: input.benefitAmount ? toPositiveNumber(input.benefitAmount, existing.benefit_amount) : existing.benefit_amount,
    active: typeof input.active === "boolean" ? input.active : existing.active,
    per_customer_limit: input.perCustomerLimit ? toPositiveNumber(input.perCustomerLimit, existing.per_customer_limit) : existing.per_customer_limit,
    per_customer_period_days: input.perCustomerPeriodDays
      ? toPositiveNumber(input.perCustomerPeriodDays, existing.per_customer_period_days)
      : existing.per_customer_period_days,
    valid_from: input.validFrom ? toIsoDate(input.validFrom) || existing.valid_from : existing.valid_from,
    valid_until: input.validUntil === undefined ? existing.valid_until : toIsoDate(input.validUntil),
    label: label || existing.label,
    description: description || existing.description,
    updated_by_user_id: actorUserId,
    updated_at: now.toISOString(),
  });

  if (!rule) {
    throw new Error("Failed to update gamification rule");
  }

  await Promise.all([
    logAudit({
      orgId,
      userId: actorUserId,
      action: "gamification_rule_update",
      resourceType: "gamification_rules",
      resourceId: rule.id,
      metadata: {
        reason: reason || null,
        previous: existing,
        next: rule,
      },
      status: "success",
    }),
    recordOperationalTenantEvent(createAdminClient(), {
      orgId,
      actorUserId,
      eventType: rule.active ? "gamification.rule_updated" : "gamification.rule_deactivated",
      eventSource: "gamification",
      dedupeKeyParts: [orgId, rule.id, rule.active ? "update" : "deactivate", rule.updated_at],
      payload: {
        org_id: orgId,
        rule_id: rule.id,
        active: rule.active,
        reason: reason || null,
      },
    }),
  ]);

  return rule;
}

export async function getGamificationCustomerBalance(
  orgId: string,
  customerKey: string,
  options?: GamificationServiceOptions
): Promise<GamificationCustomerBalance | null> {
  const repository = resolveRepository(options);
  const referenceDate = options?.now || new Date();
  const normalizedOrgId = normalize(orgId);
  const normalizedCustomerKey = normalize(customerKey);
  if (!normalizedOrgId || !normalizedCustomerKey) return null;

  const events = await repository.listCustomerEvents(normalizedOrgId, normalizedCustomerKey, 100);
  if (!events.length) {
    return {
      customer_key: normalizedCustomerKey,
      customer_label: null,
      last_event_at: null,
      last_rule_label: null,
      resources: buildCustomerResourceLedger(),
    };
  }

  return buildCustomerBalance(normalizedCustomerKey, events, referenceDate);
}

async function recordGrantAudit(params: {
  orgId: string;
  actorUserId: string;
  event: GamificationEventRecord;
  rule: GamificationRuleRecord;
  reason: string | null;
  status: "success" | "blocked";
}) {
  await Promise.all([
    logAudit({
      orgId: params.orgId,
      userId: params.actorUserId,
      action: params.status === "success" ? "gamification_benefit_grant" : "gamification_benefit_blocked",
      resourceType: "gamification_events",
      resourceId: params.event.id,
      metadata: {
        rule_id: params.rule.id,
        rule_label: params.rule.label,
        customer_key: params.event.customer_key,
        customer_label: params.event.customer_label,
        resource_type: params.event.resource_type,
        amount: params.event.amount,
        reason: params.reason,
      },
      status: params.status,
    }),
    recordOperationalTenantEvent(createAdminClient(), {
      orgId: params.orgId,
      actorUserId: params.actorUserId,
      eventType: params.status === "success" ? "gamification.benefit_granted" : "gamification.benefit_blocked",
      eventSource: "gamification",
      dedupeKeyParts: [
        params.orgId,
        params.rule.id,
        params.event.customer_key || "unknown",
        params.event.resource_type || "unknown",
        params.event.amount,
        params.status,
      ],
      payload: {
        org_id: params.orgId,
        rule_id: params.rule.id,
        customer_key: params.event.customer_key,
        customer_label: params.event.customer_label,
        resource_type: params.event.resource_type,
        amount: params.event.amount,
        reason: params.reason,
        status: params.status,
      },
    }),
  ]);
}

export async function grantGamificationBenefit(
  input: GamificationGrantInput,
  options?: GamificationServiceOptions
): Promise<{
  granted: boolean;
  duplicate?: boolean;
  rule: GamificationRuleRecord | null;
  event: GamificationEventRecord | null;
  balance: GamificationCustomerBalance | null;
  reason: string | null;
}> {
  const repository = resolveRepository(options);
  const now = options?.now || new Date();
  const orgId = normalize(input.orgId);
  const actorUserId = normalize(input.actorUserId);
  const customerKey = normalize(input.customerKey);
  const customerLabel = normalize(input.customerLabel) || customerKey;
  const ruleId = normalize(input.ruleId);
  const sourceEventKey = normalize(input.sourceEventKey);
  const sourceEventType = normalizeGamificationTriggerEventType(input.sourceEventType);
  const sourceEventPayload =
    input.sourceEventPayload && typeof input.sourceEventPayload === "object" ? input.sourceEventPayload : null;

  if (!orgId || !customerKey || !ruleId) {
    throw new Error("Missing gamification grant fields");
  }

  const rule = await repository.getRule(orgId, ruleId);
  if (!rule || !isRuleActive(rule, now)) {
    const blockedEvent = await repository.insertEvent({
      org_id: orgId,
      rule_id: ruleId,
      customer_key: customerKey,
      customer_label: customerLabel,
      event_type: "block",
      status: "blocked",
      resource_type: null,
      amount: input.amount ? clampNonNegative(input.amount) : 0,
      reason: "Regra inativa ou expirada",
      actor_user_id: actorUserId || null,
      source_event_key: sourceEventKey || null,
      source_event_type: sourceEventType || null,
      metadata: { reason: "inactive_rule" },
      expires_at: null,
      created_at: now.toISOString(),
    });

    return {
      granted: false,
      rule: rule || null,
      event: blockedEvent,
      balance: await getGamificationCustomerBalance(orgId, customerKey, options),
      reason: "Regra inativa ou expirada",
    };
  }

  if (sourceEventKey) {
    const existingSourceEvent = await repository.findEventBySourceEventKey(orgId, rule.id, sourceEventKey);
    if (existingSourceEvent) {
      return {
        granted: false,
        duplicate: true,
        rule,
        event: existingSourceEvent,
        balance: await getGamificationCustomerBalance(orgId, customerKey, options),
        reason: "Evento já processado",
      };
    }
  }

  const amount = clampNonNegative(input.amount || rule.benefit_amount);
  const periodStart = utcDateOffset(now, rule.per_customer_period_days);
  const recentEvents = await repository.listCustomerRuleEvents(orgId, customerKey, rule.id, periodStart);
  const grantedWithinPeriod = sumCustomerGrantedAmount(recentEvents, rule.benefit_resource_type, periodStart);

  if (grantedWithinPeriod + amount > rule.per_customer_limit) {
    const blockedEvent = await repository.insertEvent({
      org_id: orgId,
      rule_id: rule.id,
      customer_key: customerKey,
      customer_label: customerLabel,
      event_type: "block",
      status: "blocked",
      resource_type: rule.benefit_resource_type,
      amount,
      reason: "Limite por cliente esgotado",
      actor_user_id: actorUserId || null,
      source_event_key: sourceEventKey || null,
      source_event_type: sourceEventType || null,
      metadata: {
        reason: "customer_limit",
        period_start: periodStart,
        granted_within_period: grantedWithinPeriod,
        customer_limit: rule.per_customer_limit,
        source_event_key: sourceEventKey || null,
        source_event_type: sourceEventType || null,
        source_event_payload: sourceEventPayload,
      },
      expires_at: rule.valid_until,
      created_at: now.toISOString(),
    });

    await recordGrantAudit({
      orgId,
      actorUserId,
      event: blockedEvent || {
        id: `pending-${Date.now()}`,
        org_id: orgId,
        rule_id: rule.id,
        customer_key: customerKey,
        customer_label: customerLabel,
        event_type: "block",
        status: "blocked",
        resource_type: rule.benefit_resource_type,
        amount,
        reason: "Limite por cliente esgotado",
        actor_user_id: actorUserId,
        source_event_key: sourceEventKey || null,
        source_event_type: sourceEventType || null,
        metadata: {},
        expires_at: rule.valid_until,
        created_at: now.toISOString(),
      },
      rule,
      reason: "Limite por cliente esgotado",
      status: "blocked",
    });

    return {
      granted: false,
      rule,
      event: blockedEvent,
      balance: await getGamificationCustomerBalance(orgId, customerKey, options),
      reason: "Limite por cliente esgotado",
    };
  }

  const pendingEvent = await repository.insertEvent({
    org_id: orgId,
    rule_id: rule.id,
    customer_key: customerKey,
    customer_label: customerLabel,
    event_type: "grant",
    status: "pending",
    resource_type: rule.benefit_resource_type,
    amount,
    reason: input.reason || "Beneficio concedido",
    actor_user_id: actorUserId || null,
    source_event_key: sourceEventKey || null,
    source_event_type: sourceEventType || null,
    metadata: {
      rule_label: rule.label,
      rule_type: rule.rule_type,
      trigger_mode: rule.trigger_mode,
      trigger_event_type: rule.trigger_event_type,
      benefit_amount: rule.benefit_amount,
      source_event_key: sourceEventKey || null,
      source_event_type: sourceEventType || null,
      source_event_payload: sourceEventPayload,
    },
    expires_at: rule.valid_until,
    created_at: now.toISOString(),
  });

  if (!pendingEvent) {
    throw new Error("Failed to create gamification grant event");
  }

  const budgetAllowed = await canConsumeResource(orgId, rule.benefit_resource_type as ResourceType, amount);
  if (!budgetAllowed.allowed) {
    const blocked = await repository.updateEvent(orgId, pendingEvent.id, {
      status: "blocked",
      reason: "Budget promocional insuficiente",
      source_event_key: sourceEventKey || null,
      source_event_type: sourceEventType || null,
      metadata: {
        ...pendingEvent.metadata,
        budget: budgetAllowed,
      },
    });

    await recordGrantAudit({
      orgId,
      actorUserId,
      event: blocked || {
        ...pendingEvent,
        status: "blocked",
        reason: "Budget promocional insuficiente",
      },
      rule,
      reason: "Budget promocional insuficiente",
      status: "blocked",
    });

    return {
      granted: false,
      rule,
      event: blocked || pendingEvent,
      balance: await getGamificationCustomerBalance(orgId, customerKey, options),
      reason: "Budget promocional insuficiente",
    };
  }

  const consumeResult = await consumeResource(orgId, rule.benefit_resource_type as ResourceType, amount);
  if (!consumeResult.success) {
    const blocked = await repository.updateEvent(orgId, pendingEvent.id, {
      status: "blocked",
      reason: "Budget promocional insuficiente",
      source_event_key: sourceEventKey || null,
      source_event_type: sourceEventType || null,
      metadata: {
        ...pendingEvent.metadata,
        consume_result: consumeResult,
      },
    });

    await recordGrantAudit({
      orgId,
      actorUserId,
      event: blocked || {
        ...pendingEvent,
        status: "blocked",
        reason: "Budget promocional insuficiente",
      },
      rule,
      reason: "Budget promocional insuficiente",
      status: "blocked",
    });

    return {
      granted: false,
      rule,
      event: blocked || pendingEvent,
      balance: await getGamificationCustomerBalance(orgId, customerKey, options),
      reason: "Budget promocional insuficiente",
    };
  }

  const grantedEvent = await repository.updateEvent(orgId, pendingEvent.id, {
    status: "success",
    source_event_key: sourceEventKey || null,
    source_event_type: sourceEventType || null,
    metadata: {
      ...pendingEvent.metadata,
      budget: budgetAllowed,
      consume_result: consumeResult,
    },
  });

  await recordGrantAudit({
    orgId,
    actorUserId,
    event: grantedEvent || {
      ...pendingEvent,
      status: "success",
      metadata: {
        ...pendingEvent.metadata,
        budget: budgetAllowed,
        consume_result: consumeResult,
      },
    },
    rule,
    reason: input.reason || "Beneficio concedido",
    status: "success",
  });

  return {
    granted: true,
    rule,
    event: grantedEvent || pendingEvent,
    balance: await getGamificationCustomerBalance(orgId, customerKey, options),
    reason: null,
    duplicate: false,
  };
}

// Re-exportar integração para conveniência
export {
  processGamificationIntegrationEvent,
  tryonCompletedWithGamification,
  onboardingCompletedWithGamification,
  resultSharedWithGamification,
  leadReengagedWithGamification,
  shouldTriggerGamificationForEvent,
  buildGamificationEventPayload,
  type GamificationIntegrationEvent,
  type GamificationIntegrationContext,
  type GamificationIntegrationResult,
} from "./integration";

export {
  processGamificationTriggerEvent,
  buildGamificationTriggerEventKey,
  listAutomaticGamificationRules,
  summariseGamificationAutomation,
  isGamificationTriggerMode,
} from "./events";

export async function consumeGamificationBenefit(
  input: GamificationConsumeInput,
  options?: GamificationServiceOptions
): Promise<{
  consumed: boolean;
  balance: GamificationCustomerBalance | null;
  reason: string | null;
  event: GamificationEventRecord | null;
}> {
  const repository = resolveRepository(options);
  const now = options?.now || new Date();
  const orgId = normalize(input.orgId);
  const actorUserId = normalize(input.actorUserId);
  const customerKey = normalize(input.customerKey);
  const customerLabel = normalize(input.customerLabel) || customerKey;

  if (!orgId || !actorUserId || !customerKey) {
    throw new Error("Missing gamification consume fields");
  }

  const balance = await getGamificationCustomerBalance(orgId, customerKey, options);
  const currentAvailable = balance?.resources[input.resourceType]?.available || 0;
  const amount = clampNonNegative(input.amount);

  if (currentAvailable < amount) {
    const blockedEvent = await repository.insertEvent({
      org_id: orgId,
      rule_id: null,
      customer_key: customerKey,
      customer_label: customerLabel,
      event_type: "block",
      status: "blocked",
      resource_type: input.resourceType,
      amount,
      reason: "Saldo promocional insuficiente",
      actor_user_id: actorUserId,
      metadata: { reason: "insufficient_balance", balance: currentAvailable },
      expires_at: null,
      created_at: now.toISOString(),
    });

    await Promise.all([
      logAudit({
        orgId,
        userId: actorUserId,
        action: "gamification_benefit_blocked",
        resourceType: "gamification_events",
        resourceId: blockedEvent?.id || null,
        metadata: {
          customer_key: customerKey,
          customer_label: customerLabel,
          resource_type: input.resourceType,
          amount,
          reason: "Saldo promocional insuficiente",
        },
        status: "blocked",
      }),
      recordOperationalTenantEvent(createAdminClient(), {
        orgId,
        actorUserId,
        eventType: "gamification.benefit_blocked",
        eventSource: "gamification",
        dedupeKeyParts: [orgId, customerKey, input.resourceType, amount, "consume_blocked"],
        payload: {
          org_id: orgId,
          customer_key: customerKey,
          customer_label: customerLabel,
          resource_type: input.resourceType,
          amount,
          reason: "Saldo promocional insuficiente",
        },
      }),
    ]);

    return {
      consumed: false,
      balance,
      reason: "Saldo promocional insuficiente",
      event: blockedEvent,
    };
  }

  const event = await repository.insertEvent({
    org_id: orgId,
    rule_id: null,
    customer_key: customerKey,
    customer_label: customerLabel,
    event_type: "consume",
    status: "success",
    resource_type: input.resourceType,
    amount,
    reason: input.reason || "Beneficio consumido",
    actor_user_id: actorUserId,
    metadata: {
      balance_before: currentAvailable,
    },
    expires_at: null,
    created_at: now.toISOString(),
  });

  await Promise.all([
    logAudit({
      orgId,
      userId: actorUserId,
      action: "gamification_benefit_consume",
      resourceType: "gamification_events",
      resourceId: event?.id || null,
      metadata: {
        customer_key: customerKey,
        customer_label: customerLabel,
        resource_type: input.resourceType,
        amount,
        reason: input.reason || null,
      },
      status: "success",
    }),
    recordOperationalTenantEvent(createAdminClient(), {
      orgId,
      actorUserId,
      eventType: "gamification.benefit_consumed",
      eventSource: "gamification",
      dedupeKeyParts: [orgId, customerKey, input.resourceType, amount, "consume"],
      payload: {
        org_id: orgId,
        customer_key: customerKey,
        customer_label: customerLabel,
        resource_type: input.resourceType,
        amount,
        reason: input.reason || null,
      },
    }),
  ]);

  return {
    consumed: true,
    balance: await getGamificationCustomerBalance(orgId, customerKey, options),
    reason: null,
    event,
  };
}
