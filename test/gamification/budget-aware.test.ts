/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");

const {
  buildGamificationOverview,
  canAccessGamificationPanel,
  gamificationResourceLabel,
  gamificationRuleLabel,
  gamificationTriggerEventLabel,
  gamificationTriggerModeLabel,
  normalizeGamificationRuleType,
  normalizeGamificationBenefitResourceType,
  normalizeGamificationTriggerEventType,
} = require("../src/lib/gamification/index.ts");

const {
  buildGamificationTriggerEventKey,
  listAutomaticGamificationRules,
  summariseGamificationAutomation,
} = require("../src/lib/gamification/events.ts");

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

function createGamificationMemoryRepo(initial = {}) {
  const state = {
    orgs: initial.orgs ? [...initial.orgs] : [],
    rules: initial.rules ? [...initial.rules] : [],
    events: initial.events ? [...initial.events] : [],
    ruleSeq: 0,
    eventSeq: 0,
  };

  const nowIso = () => new Date().toISOString();
  const clone = (value) => JSON.parse(JSON.stringify(value));

  return {
    state,
    async loadOrg(orgId) {
      return clone(state.orgs.find((org) => org.id === orgId) || null);
    },
    async listRules(orgId) {
      return clone(
        state.rules
          .filter((rule) => rule.org_id === orgId)
          .sort((left, right) => right.created_at.localeCompare(left.created_at))
          .map((rule) => ({
            trigger_mode: "manual",
            trigger_event_type: null,
            ...rule,
          }))
      );
    },
    async getRule(orgId, ruleId) {
      const rule = state.rules.find((item) => item.org_id === orgId && item.id === ruleId);
      return clone(rule ? { trigger_mode: "manual", trigger_event_type: null, ...rule } : null);
    },
    async insertRule(input) {
      const row = {
        id: `rule-${++state.ruleSeq}`,
        org_id: input.org_id,
        rule_type: input.rule_type,
        trigger_mode: input.trigger_mode || "manual",
        trigger_event_type: input.trigger_event_type || null,
        benefit_resource_type: input.benefit_resource_type,
        benefit_amount: input.benefit_amount,
        active: input.active,
        per_customer_limit: input.per_customer_limit,
        per_customer_period_days: input.per_customer_period_days,
        valid_from: input.valid_from,
        valid_until: input.valid_until || null,
        label: input.label,
        description: input.description || null,
        created_by_user_id: input.created_by_user_id || null,
        updated_by_user_id: input.updated_by_user_id || null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      state.rules.unshift(row);
      return clone(row);
    },
    async updateRule(orgId, ruleId, input) {
      const row = state.rules.find((item) => item.org_id === orgId && item.id === ruleId);
      if (!row) return null;
      Object.assign(row, input, { updated_at: input.updated_at || nowIso() });
      return clone(row);
    },
    async listEvents(orgId, limit = 40) {
      return clone(
        state.events
          .filter((event) => event.org_id === orgId)
          .sort((left, right) => right.created_at.localeCompare(left.created_at))
          .slice(0, limit)
      );
    },
    async listCustomerRuleEvents(orgId, customerKey, ruleId, sinceIso) {
      return clone(
        state.events
          .filter((event) => event.org_id === orgId)
          .filter((event) => event.customer_key === customerKey)
          .filter((event) => event.rule_id === ruleId)
          .filter((event) => event.created_at >= sinceIso)
          .sort((left, right) => right.created_at.localeCompare(left.created_at))
      );
    },
    async listCustomerEvents(orgId, customerKey, limit = 50) {
      return clone(
        state.events
          .filter((event) => event.org_id === orgId)
          .filter((event) => event.customer_key === customerKey)
          .sort((left, right) => right.created_at.localeCompare(left.created_at))
          .slice(0, limit)
      );
    },
    async insertEvent(input) {
      const row = {
        id: `event-${++state.eventSeq}`,
        org_id: input.org_id,
        rule_id: input.rule_id || null,
        customer_key: input.customer_key || null,
        customer_label: input.customer_label || null,
        event_type: input.event_type,
        status: input.status || "success",
        resource_type: input.resource_type || null,
        amount: input.amount || 0,
        reason: input.reason || null,
        actor_user_id: input.actor_user_id || null,
        source_event_type: input.source_event_type || null,
        source_event_key: input.source_event_key || null,
        metadata: input.metadata || {},
        expires_at: input.expires_at || null,
        created_at: input.created_at || nowIso(),
      };
      state.events.unshift(row);
      return clone(row);
    },
    async findEventBySourceEventKey(orgId, ruleId, sourceEventKey) {
      return clone(
        state.events.find(
          (event) => event.org_id === orgId && event.rule_id === ruleId && event.source_event_key === sourceEventKey
        ) || null
      );
    },
    async updateEvent(orgId, eventId, input) {
      const row = state.events.find((event) => event.org_id === orgId && event.id === eventId);
      if (!row) return null;
      Object.assign(row, input);
      return clone(row);
    },
  };
}

// Helper para criar cenário base com org e regras
function createBaseScenario() {
  const org = {
    id: "org-test-001",
    slug: "test-store",
    name: "Test Store",
    status: "active",
    kill_switch: false,
    plan_id: "starter",
    limits: {},
    owner_user_id: "user-owner",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const now = new Date();
  const rules = [
    {
      id: "rule-share-001",
      org_id: "org-test-001",
      rule_type: "share_bonus",
      trigger_mode: "manual",
      trigger_event_type: null,
      benefit_resource_type: "try_on",
      benefit_amount: 2,
      active: true,
      per_customer_limit: 3,
      per_customer_period_days: 30,
      valid_from: new Date(now.getTime() - 86400000).toISOString(),
      valid_until: new Date(now.getTime() + 86400000 * 30).toISOString(),
      label: "Bônus por share",
      description: "Ganha try-ons extras ao compartilhar resultado",
      created_by_user_id: "user-001",
      updated_by_user_id: "user-001",
      created_at: new Date(now.getTime() - 86400000).toISOString(),
      updated_at: new Date(now.getTime() - 86400000).toISOString(),
    },
    {
      id: "rule-onboarding-001",
      org_id: "org-test-001",
      rule_type: "onboarding_complete",
      trigger_mode: "automatic",
      trigger_event_type: "onboarding_completed",
      benefit_resource_type: "whatsapp_message",
      benefit_amount: 5,
      active: true,
      per_customer_limit: 1,
      per_customer_period_days: 90,
      valid_from: new Date(now.getTime() - 86400000).toISOString(),
      valid_until: null,
      label: "Onboarding concluído",
      description: "Mensagens premium ao completar onboarding",
      created_by_user_id: "user-001",
      updated_by_user_id: "user-001",
      created_at: new Date(now.getTime() - 86400000).toISOString(),
      updated_at: new Date(now.getTime() - 86400000).toISOString(),
    },
    {
      id: "rule-inactive-001",
      org_id: "org-test-001",
      rule_type: "return_after_days",
      trigger_mode: "manual",
      trigger_event_type: null,
      benefit_resource_type: "ai_tokens",
      benefit_amount: 1000,
      active: false,
      per_customer_limit: 1,
      per_customer_period_days: 60,
      valid_from: new Date(now.getTime() - 86400000 * 60).toISOString(),
      valid_until: new Date(now.getTime() - 86400000).toISOString(),
      label: "Retorno após 7 dias",
      description: "Tokens IA para clientes que retornam",
      created_by_user_id: "user-001",
      updated_by_user_id: "user-001",
      created_at: new Date(now.getTime() - 86400000 * 60).toISOString(),
      updated_at: new Date(now.getTime() - 86400000).toISOString(),
    },
  ];

  const events = [
    {
      id: "event-001",
      org_id: "org-test-001",
      rule_id: "rule-share-001",
      customer_key: "customer-001",
      customer_label: "Maria Silva",
      event_type: "grant",
      status: "success",
      resource_type: "try_on",
      amount: 2,
      reason: "Share confirmado",
      actor_user_id: "user-001",
      source_event_type: "result_shared",
      source_event_key: "share-001",
      metadata: { rule_label: "Bônus por share" },
      expires_at: rules[0].valid_until,
      created_at: new Date(now.getTime() - 3600000).toISOString(),
    },
    {
      id: "event-002",
      org_id: "org-test-001",
      rule_id: "rule-share-001",
      customer_key: "customer-002",
      customer_label: "João Santos",
      event_type: "grant",
      status: "success",
      resource_type: "try_on",
      amount: 2,
      reason: "Share confirmado",
      actor_user_id: "user-001",
      source_event_type: "result_shared",
      source_event_key: "share-002",
      metadata: { rule_label: "Bônus por share" },
      expires_at: rules[0].valid_until,
      created_at: new Date(now.getTime() - 7200000).toISOString(),
    },
    {
      id: "event-003",
      org_id: "org-test-001",
      rule_id: "rule-onboarding-001",
      customer_key: "customer-001",
      customer_label: "Maria Silva",
      event_type: "grant",
      status: "success",
      resource_type: "whatsapp_message",
      amount: 5,
      reason: "Onboarding completado",
      actor_user_id: "system",
      source_event_type: "onboarding_completed",
      source_event_key: "onboard-001",
      metadata: { rule_label: "Onboarding concluído" },
      expires_at: null,
      created_at: new Date(now.getTime() - 86400000).toISOString(),
    },
    {
      id: "event-004",
      org_id: "org-test-001",
      rule_id: null,
      customer_key: "customer-001",
      customer_label: "Maria Silva",
      event_type: "consume",
      status: "success",
      resource_type: "try_on",
      amount: 1,
      reason: "Try-on usado",
      actor_user_id: "customer-001",
      source_event_type: null,
      source_event_key: null,
      metadata: {},
      expires_at: null,
      created_at: new Date(now.getTime() - 1800000).toISOString(),
    },
  ];

  return { org, rules, events };
}

// ===================== TESTES DE GAMIFICAÇÃO =====================

run("gamification labels are correctly mapped", () => {
  assert.equal(gamificationRuleLabel("share_bonus"), "Bônus por share");
  assert.equal(gamificationRuleLabel("return_after_days"), "Retorno após X dias");
  assert.equal(gamificationRuleLabel("onboarding_complete"), "Onboarding concluído");
  assert.equal(gamificationRuleLabel("recurring_interaction"), "Interação recorrente");
  assert.equal(gamificationRuleLabel("purchase_confirmed"), "Compra confirmada");

  assert.equal(gamificationResourceLabel("try_on"), "Try-on extra");
  assert.equal(gamificationResourceLabel("whatsapp_message"), "Mensagem premium");
  assert.equal(gamificationResourceLabel("ai_tokens"), "Tokens IA");

  assert.equal(gamificationTriggerEventLabel("result_shared"), "Resultado compartilhado");
  assert.equal(gamificationTriggerEventLabel("onboarding_completed"), "Onboarding concluído");
  assert.equal(gamificationTriggerEventLabel("lead_reengaged"), "Lead reengajado");
  assert.equal(gamificationTriggerEventLabel(null), "Manual");
  assert.equal(gamificationTriggerEventLabel(undefined), "Manual");

  assert.equal(gamificationTriggerModeLabel("manual"), "Manual");
  assert.equal(gamificationTriggerModeLabel("automatic"), "Automática");
  assert.equal(gamificationTriggerModeLabel(null), "Manual");
});

run("gamification normalizers handle valid values", () => {
  assert.equal(normalizeGamificationRuleType("share_bonus"), "share_bonus");
  assert.equal(normalizeGamificationRuleType("return_after_days"), "return_after_days");
  assert.equal(normalizeGamificationRuleType("invalid_type"), null);
  assert.equal(normalizeGamificationRuleType(""), null);

  assert.equal(normalizeGamificationBenefitResourceType("try_on"), "try_on");
  assert.equal(normalizeGamificationBenefitResourceType("whatsapp_message"), "whatsapp_message");
  assert.equal(normalizeGamificationBenefitResourceType("invalid_resource"), null);

  assert.equal(normalizeGamificationTriggerEventType("result_shared"), "result_shared");
  assert.equal(normalizeGamificationTriggerEventType("onboarding_completed"), "onboarding_completed");
  assert.equal(normalizeGamificationTriggerEventType("invalid_event"), null);
});

run("canAccessGamificationPanel allows only merchant roles", () => {
  assert.equal(canAccessGamificationPanel("merchant_owner"), true);
  assert.equal(canAccessGamificationPanel("merchant_manager"), true);
  assert.equal(canAccessGamificationPanel("merchant_editor"), true);
  assert.equal(canAccessGamificationPanel("merchant_viewer"), true);

  assert.equal(canAccessGamificationPanel("agency_owner"), false);
  assert.equal(canAccessGamificationPanel("agency_admin"), false);
  assert.equal(canAccessGamificationPanel("agency_ops"), false);
  assert.equal(canAccessGamificationPanel("agency_support"), false);
  assert.equal(canAccessGamificationPanel(null), false);
  assert.equal(canAccessGamificationPanel(undefined), false);
  assert.equal(canAccessGamificationPanel(""), false);
});

run("buildGamificationOverview aggregates rules and events correctly", () => {
  const { org, rules, events } = createBaseScenario();

  const overview = buildGamificationOverview({
    org,
    rules,
    events,
  });

  assert.equal(overview.org?.id, org.id);
  assert.equal(overview.rules.length, 3);
  assert.equal(overview.active_rule_count, 2);
  assert.equal(overview.inactive_rule_count, 1);
  assert.equal(overview.automatic_rule_count, 1);
  assert.equal(overview.recent_events.length, 4);
  assert.equal(overview.recent_customers.length, 2);
  assert.equal(overview.has_data, true);

  // Budget calculation
  assert.equal(overview.budget.total_granted, 9); // 2 + 2 + 5
  assert.equal(overview.budget.total_consumed, 1);
  assert.equal(overview.budget.total_available, 8); // 9 - 1

  // By resource
  assert.equal(overview.budget.by_resource.try_on.granted, 4);
  assert.equal(overview.budget.by_resource.try_on.consumed, 1);
  assert.equal(overview.budget.by_resource.try_on.available, 3);

  assert.equal(overview.budget.by_resource.whatsapp_message.granted, 5);
  assert.equal(overview.budget.by_resource.whatsapp_message.consumed, 0);
  assert.equal(overview.budget.by_resource.whatsapp_message.available, 5);

  assert.equal(overview.budget.by_resource.ai_tokens.granted, 0);
  assert.equal(overview.budget.by_resource.ai_tokens.available, 0);
});

run("buildGamificationOverview handles empty data", () => {
  const overview = buildGamificationOverview({
    org: null,
    rules: [],
    events: [],
  });

  assert.equal(overview.has_data, false);
  assert.equal(overview.org, null);
  assert.equal(overview.rules.length, 0);
  assert.equal(overview.active_rule_count, 0);
  assert.equal(overview.recent_customers.length, 0);
  assert.ok(overview.alerts.includes("Sem regras ativas"));
});

run("buildGamificationOverview filters by org isolation", () => {
  const { org, rules, events } = createBaseScenario();

  // Adiciona dados de outra org
  const otherOrg = { ...org, id: "org-other", slug: "other-store" };
  const otherRules = rules.map((r) => ({ ...r, org_id: "org-other" }));
  const otherEvents = events.map((e) => ({ ...e, org_id: "org-other" }));

  const allRules = [...rules, ...otherRules];
  const allEvents = [...events, ...otherEvents];

  const overview = buildGamificationOverview({
    org,
    rules: allRules,
    events: allEvents,
  });

  // Deve mostrar apenas dados da org atual
  assert.equal(overview.rules.length, 3);
  assert.equal(overview.recent_events.length, 4);
});

run("buildGamificationOverview detects alerts correctly", () => {
  // Cenário com budget esgotado
  const { org, rules } = createBaseScenario();
  const now = new Date();
  const exhaustedEvents = [
    {
      id: "event-grant-1",
      org_id: org.id,
      rule_id: "rule-share-001",
      customer_key: "customer-001",
      customer_label: "Test",
      event_type: "grant",
      status: "success",
      resource_type: "try_on",
      amount: 10,
      reason: "Test",
      actor_user_id: "user-001",
      metadata: {},
      expires_at: null,
      created_at: new Date(now.getTime() - 3600000).toISOString(),
    },
    {
      id: "event-consume-1",
      org_id: org.id,
      rule_id: null,
      customer_key: "customer-001",
      customer_label: "Test",
      event_type: "consume",
      status: "success",
      resource_type: "try_on",
      amount: 10,
      reason: "Test",
      actor_user_id: "user-001",
      metadata: {},
      expires_at: null,
      created_at: new Date(now.getTime() - 1800000).toISOString(),
    },
  ];

  const overview = buildGamificationOverview({
    org,
    rules,
    events: exhaustedEvents,
  });

  assert.equal(overview.budget.total_granted, 10);
  assert.equal(overview.budget.total_available, 0);
  assert.ok(overview.alerts.includes("Saldo promocional esgotado"));
});

run("buildGamificationOverview tracks blocked events", () => {
  const { org, rules } = createBaseScenario();
  const now = new Date();
  const eventsWithBlocked = [
    {
      id: "event-blocked-1",
      org_id: org.id,
      rule_id: "rule-share-001",
      customer_key: "customer-001",
      customer_label: "Test",
      event_type: "block",
      status: "blocked",
      resource_type: "try_on",
      amount: 2,
      reason: "Budget insuficiente",
      actor_user_id: "user-001",
      metadata: {},
      expires_at: null,
      created_at: new Date(now.getTime() - 3600000).toISOString(),
    },
  ];

  const overview = buildGamificationOverview({
    org,
    rules,
    events: eventsWithBlocked,
  });

  assert.equal(overview.blocked_events, 1);
  assert.ok(overview.alerts.includes("Existem concessoes bloqueadas por budget"));
});

run("buildGamificationOverview customer balance calculation", () => {
  const { org, rules, events } = createBaseScenario();

  const overview = buildGamificationOverview({
    org,
    rules,
    events,
  });

  // customer-001 tem: grant 2 try_on + grant 5 whatsapp + consume 1 try_on
  const customer1 = overview.recent_customers.find((c) => c.customer_key === "customer-001");
  assert.ok(customer1);
  assert.equal(customer1.resources.try_on.granted, 2);
  assert.equal(customer1.resources.try_on.consumed, 1);
  assert.equal(customer1.resources.try_on.available, 1);
  assert.equal(customer1.resources.whatsapp_message.granted, 5);
  assert.equal(customer1.resources.whatsapp_message.consumed, 0);
  assert.equal(customer1.resources.whatsapp_message.available, 5);

  // customer-002 tem: grant 2 try_on
  const customer2 = overview.recent_customers.find((c) => c.customer_key === "customer-002");
  assert.ok(customer2);
  assert.equal(customer2.resources.try_on.granted, 2);
  assert.equal(customer2.resources.try_on.consumed, 0);
  assert.equal(customer2.resources.try_on.available, 2);
});

run("buildGamificationOverview handles expired events", () => {
  const { org, rules } = createBaseScenario();
  const now = new Date();
  const eventsWithExpiry = [
    {
      id: "event-expired",
      org_id: org.id,
      rule_id: "rule-share-001",
      customer_key: "customer-001",
      customer_label: "Test",
      event_type: "grant",
      status: "success",
      resource_type: "try_on",
      amount: 5,
      reason: "Test",
      actor_user_id: "user-001",
      metadata: {},
      expires_at: new Date(now.getTime() - 86400000).toISOString(), // expired yesterday
      created_at: new Date(now.getTime() - 172800000).toISOString(),
    },
  ];

  const overview = buildGamificationOverview({
    org,
    rules,
    events: eventsWithExpiry,
    referenceDate: now,
  });

  // Evento expirado não deve contar no available
  assert.equal(overview.budget.by_resource.try_on.available, 0);
});

run("buildGamificationOverview automatic events tracking", () => {
  const { org, rules, events } = createBaseScenario();

  const overview = buildGamificationOverview({
    org,
    rules,
    events,
  });

  // Eventos com source_event_key são automáticos
  assert.equal(overview.recent_automatic_events.length, 3); // event-001, event-002, event-003
  assert.equal(overview.last_automatic_event_at !== null, true);
});

run("buildGamificationTriggerEventKey generates deterministic keys", () => {
  const key1 = buildGamificationTriggerEventKey({
    orgId: "org-001",
    eventType: "result_shared",
    customerKey: "customer-001",
    payload: { saved_result_id: "result-123" },
  });

  const key2 = buildGamificationTriggerEventKey({
    orgId: "org-001",
    eventType: "result_shared",
    customerKey: "customer-001",
    payload: { saved_result_id: "result-123" },
  });

  assert.equal(key1, key2);
  assert.ok(key1.includes("org-001"));
  assert.ok(key1.includes("result_shared"));
  assert.ok(key1.includes("customer-001"));
  assert.ok(key1.includes("result-123"));
});

run("buildGamificationTriggerEventKey handles explicit eventKey", () => {
  const key = buildGamificationTriggerEventKey({
    orgId: "org-001",
    eventType: "onboarding_completed",
    customerKey: "customer-001",
    eventKey: "explicit-key-123",
  });

  assert.equal(key, "explicit-key-123");
});

run("buildGamificationTriggerEventKey returns null for missing payload", () => {
  const key = buildGamificationTriggerEventKey({
    orgId: "org-001",
    eventType: "result_shared",
    customerKey: "customer-001",
    payload: {},
  });

  assert.equal(key, null);
});

run("listAutomaticGamificationRules filters correctly", () => {
  const { rules } = createBaseScenario();

  const automaticRules = listAutomaticGamificationRules(rules);

  assert.equal(automaticRules.length, 1);
  assert.equal(automaticRules[0].id, "rule-onboarding-001");
  assert.equal(automaticRules[0].trigger_mode, "automatic");
  assert.equal(automaticRules[0].trigger_event_type, "onboarding_completed");
});

run("summariseGamificationAutomation provides correct summary", () => {
  const { org, rules, events } = createBaseScenario();
  const overview = buildGamificationOverview({
    org,
    rules,
    events,
  });

  const summary = summariseGamificationAutomation(overview);

  assert.equal(summary.automatic_rules, 1);
  assert.equal(summary.recent_automatic_events.length, 3);
  assert.equal(summary.automatic_blocked_events, 0);
});

run("gamification overview handles tenant with kill switch", () => {
  const { org, rules, events } = createBaseScenario();
  const orgWithKillSwitch = { ...org, kill_switch: true };

  const overview = buildGamificationOverview({
    org: orgWithKillSwitch,
    rules,
    events,
  });

  assert.equal(overview.org?.kill_switch, true);
  assert.equal(overview.has_data, true);
  // Overview ainda mostra dados mesmo com kill switch (UI que deve bloquear ações)
});

run("gamification overview handles suspended tenant", () => {
  const { org, rules, events } = createBaseScenario();
  const orgSuspended = { ...org, status: "suspended" };

  const overview = buildGamificationOverview({
    org: orgSuspended,
    rules,
    events,
  });

  assert.equal(overview.org?.status, "suspended");
  assert.equal(overview.has_data, true);
});

run("gamification budget buckets are consistent", () => {
  const { org } = createBaseScenario();

  const overview = buildGamificationOverview({
    org,
    rules: [],
    events: [],
  });

  // Todas as resources devem estar inicializadas
  assert.ok(overview.budget.by_resource.try_on);
  assert.ok(overview.budget.by_resource.whatsapp_message);
  assert.ok(overview.budget.by_resource.ai_tokens);

  assert.equal(overview.budget.by_resource.try_on.granted, 0);
  assert.equal(overview.budget.by_resource.try_on.consumed, 0);
  assert.equal(overview.budget.by_resource.try_on.available, 0);
  assert.equal(overview.budget.by_resource.try_on.blocked, 0);
});

run("gamification events chronological ordering respects grant-before-consume", () => {
  const { org, rules } = createBaseScenario();
  const now = new Date();
  const unorderedEvents = [
    {
      id: "event-consume",
      org_id: org.id,
      rule_id: null,
      customer_key: "customer-001",
      customer_label: "Test",
      event_type: "consume",
      status: "success",
      resource_type: "try_on",
      amount: 1,
      reason: "Test",
      actor_user_id: "user-001",
      metadata: {},
      expires_at: null,
      created_at: new Date(now.getTime() - 1000).toISOString(),
    },
    {
      id: "event-grant",
      org_id: org.id,
      rule_id: "rule-share-001",
      customer_key: "customer-001",
      customer_label: "Test",
      event_type: "grant",
      status: "success",
      resource_type: "try_on",
      amount: 2,
      reason: "Test",
      actor_user_id: "user-001",
      metadata: {},
      expires_at: null,
      created_at: new Date(now.getTime() - 1000).toISOString(),
    },
  ];

  const overview = buildGamificationOverview({
    org,
    rules,
    events: unorderedEvents,
  });

  // Grant deve vir antes de consume no cálculo do saldo
  const customer = overview.recent_customers[0];
  assert.equal(customer.resources.try_on.granted, 2);
  assert.equal(customer.resources.try_on.consumed, 1);
  assert.equal(customer.resources.try_on.available, 1);
});

// ===================== TESTES DE ISOLAMENTO DE TENANT =====================

run("gamification tenant isolation prevents cross-org access", () => {
  const org1 = {
    id: "org-alpha",
    slug: "alpha-store",
    name: "Alpha Store",
    status: "active",
    kill_switch: false,
    plan_id: "starter",
    limits: {},
    owner_user_id: "user-001",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const org2 = {
    id: "org-beta",
    slug: "beta-store",
    name: "Beta Store",
    status: "active",
    kill_switch: false,
    plan_id: "pro",
    limits: {},
    owner_user_id: "user-002",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const now = new Date();
  const rules1 = [
    {
      id: "rule-org1-001",
      org_id: "org-alpha",
      rule_type: "share_bonus",
      trigger_mode: "manual",
      trigger_event_type: null,
      benefit_resource_type: "try_on",
      benefit_amount: 3,
      active: true,
      per_customer_limit: 5,
      per_customer_period_days: 30,
      valid_from: new Date(now.getTime() - 86400000).toISOString(),
      valid_until: null,
      label: "Alpha Share Bonus",
      description: "Alpha only",
      created_by_user_id: "user-001",
      updated_by_user_id: "user-001",
      created_at: new Date(now.getTime() - 86400000).toISOString(),
      updated_at: new Date(now.getTime() - 86400000).toISOString(),
    },
  ];

  const rules2 = [
    {
      id: "rule-org2-001",
      org_id: "org-beta",
      rule_type: "onboarding_complete",
      trigger_mode: "automatic",
      trigger_event_type: "onboarding_completed",
      benefit_resource_type: "whatsapp_message",
      benefit_amount: 10,
      active: true,
      per_customer_limit: 1,
      per_customer_period_days: 90,
      valid_from: new Date(now.getTime() - 86400000).toISOString(),
      valid_until: null,
      label: "Beta Onboarding",
      description: "Beta only",
      created_by_user_id: "user-002",
      updated_by_user_id: "user-002",
      created_at: new Date(now.getTime() - 86400000).toISOString(),
      updated_at: new Date(now.getTime() - 86400000).toISOString(),
    },
  ];

  // Visão da org-alpha
  const overviewAlpha = buildGamificationOverview({
    org: org1,
    rules: [...rules1, ...rules2],
    events: [],
  });

  // Visão da org-beta
  const overviewBeta = buildGamificationOverview({
    org: org2,
    rules: [...rules1, ...rules2],
    events: [],
  });

  // Cada org deve ver apenas suas próprias regras
  assert.equal(overviewAlpha.rules.length, 1);
  assert.equal(overviewAlpha.rules[0].org_id, "org-alpha");
  assert.equal(overviewAlpha.rules[0].benefit_amount, 3);

  assert.equal(overviewBeta.rules.length, 1);
  assert.equal(overviewBeta.rules[0].org_id, "org-beta");
  assert.equal(overviewBeta.rules[0].benefit_amount, 10);

  // Budgets devem ser separados
  assert.equal(overviewAlpha.budget.total_granted, 0);
  assert.equal(overviewBeta.budget.total_granted, 0);
});

// ===================== TESTES DE REGRAS E VALIDAÇÕES =====================

run("gamification rule types are exhaustive", () => {
  const { GAMIFICATION_RULE_TYPES } = require("../src/lib/gamification/index.ts");
  assert.equal(GAMIFICATION_RULE_TYPES.length, 5);
  assert.ok(GAMIFICATION_RULE_TYPES.includes("share_bonus"));
  assert.ok(GAMIFICATION_RULE_TYPES.includes("return_after_days"));
  assert.ok(GAMIFICATION_RULE_TYPES.includes("onboarding_complete"));
  assert.ok(GAMIFICATION_RULE_TYPES.includes("recurring_interaction"));
  assert.ok(GAMIFICATION_RULE_TYPES.includes("purchase_confirmed"));
});

run("gamification benefit resource types are exhaustive", () => {
  const { GAMIFICATION_BENEFIT_RESOURCE_TYPES } = require("../src/lib/gamification/index.ts");
  assert.equal(GAMIFICATION_BENEFIT_RESOURCE_TYPES.length, 3);
  assert.ok(GAMIFICATION_BENEFIT_RESOURCE_TYPES.includes("try_on"));
  assert.ok(GAMIFICATION_BENEFIT_RESOURCE_TYPES.includes("whatsapp_message"));
  assert.ok(GAMIFICATION_BENEFIT_RESOURCE_TYPES.includes("ai_tokens"));
});

run("gamification trigger event types are exhaustive", () => {
  const { GAMIFICATION_TRIGGER_EVENT_TYPES } = require("../src/lib/gamification/index.ts");
  assert.equal(GAMIFICATION_TRIGGER_EVENT_TYPES.length, 3);
  assert.ok(GAMIFICATION_TRIGGER_EVENT_TYPES.includes("onboarding_completed"));
  assert.ok(GAMIFICATION_TRIGGER_EVENT_TYPES.includes("lead_reengaged"));
  assert.ok(GAMIFICATION_TRIGGER_EVENT_TYPES.includes("result_shared"));
});

process.stdout.write("\n");
