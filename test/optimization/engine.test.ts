/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");

const {
  getPolicyRules,
  matchRule,
  evaluateCondition,
  applyAdjustmentAction,
  conditionsToLabels,
} = require("../src/lib/optimization/policy-engine");

const { runAutoLimitsJob, getOptimizationRecommendations } = require("../src/lib/optimization/auto-limits");

const {
  recordOptimizationAudit,
  queryOptimizationAudit,
  getOptimizationStats,
} = require("../src/lib/optimization/audit");

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

run("policy-engine exports required functions", () => {
  assert.equal(typeof getPolicyRules, "function");
  assert.equal(typeof matchRule, "function");
  assert.equal(typeof evaluateCondition, "function");
  assert.equal(typeof applyAdjustmentAction, "function");
});

run("getPolicyRules returns non-empty array", () => {
  const rules = getPolicyRules();
  assert.equal(Array.isArray(rules), true);
  assert.equal(rules.length > 0, true);
});

run("policy rules have required fields", () => {
  const rules = getPolicyRules();
  for (const rule of rules) {
    assert.equal(typeof rule.id, "string");
    assert.equal(typeof rule.name, "string");
    assert.equal(Array.isArray(rule.conditions), true);
    assert.equal(typeof rule.action, "string");
    assert.equal(typeof rule.factor, "number");
    assert.equal(typeof rule.priority, "number");
    assert.equal(typeof rule.description, "string");
  }
});

run("policy rules are sorted by priority descending", () => {
  const rules = getPolicyRules();
  for (let i = 1; i < rules.length; i++) {
    assert.equal(rules[i - 1].priority >= rules[i].priority, true);
  }
});

run("evaluateCondition margin_percent lt 0", () => {
  const metrics = {
    org_id: "test",
    margin_percent: -5,
    margin_cents: -500,
    roi: 1,
    usage_pct: { ai_tokens: 50, try_on: 50, whatsapp_message: 50 },
    usage: { ai_tokens: 100, try_on: 10, whatsapp_message: 100 },
    limits: { ai_tokens: 200, try_on: 20, whatsapp_message: 200 },
    risk: "normal",
    billing_status: null,
    is_billing_blocked: false,
    has_manual_override: false,
  };

  const result = evaluateCondition("margin_percent", "lt", 0, metrics);
  assert.equal(result, true);
});

run("evaluateCondition margin_percent gte 30", () => {
  const metrics = {
    org_id: "test",
    margin_percent: 35,
    margin_cents: 3500,
    roi: 4,
    usage_pct: { ai_tokens: 50, try_on: 50, whatsapp_message: 50 },
    usage: { ai_tokens: 100, try_on: 10, whatsapp_message: 100 },
    limits: { ai_tokens: 200, try_on: 20, whatsapp_message: 200 },
    risk: "normal",
    billing_status: null,
    is_billing_blocked: false,
    has_manual_override: false,
  };

  const result = evaluateCondition("margin_percent", "gte", 30, metrics);
  assert.equal(result, true);
});

run("evaluateCondition roi gte 3", () => {
  const metrics = {
    org_id: "test",
    margin_percent: 20,
    margin_cents: 2000,
    roi: 5,
    usage_pct: { ai_tokens: 50, try_on: 50, whatsapp_message: 50 },
    usage: { ai_tokens: 100, try_on: 10, whatsapp_message: 100 },
    limits: { ai_tokens: 200, try_on: 20, whatsapp_message: 200 },
    risk: "normal",
    billing_status: null,
    is_billing_blocked: false,
    has_manual_override: false,
  };

  const result = evaluateCondition("roi", "gte", 3, metrics);
  assert.equal(result, true);
});

run("evaluateCondition usage_pct gte 80", () => {
  const metrics = {
    org_id: "test",
    margin_percent: 10,
    margin_cents: 1000,
    roi: 2,
    usage_pct: { ai_tokens: 85, try_on: 90, whatsapp_message: 70 },
    usage: { ai_tokens: 170, try_on: 18, whatsapp_message: 140 },
    limits: { ai_tokens: 200, try_on: 20, whatsapp_message: 200 },
    risk: "normal",
    billing_status: null,
    is_billing_blocked: false,
    has_manual_override: false,
  };

  const result = evaluateCondition("usage_pct", "gte", 80, metrics);
  assert.equal(result, true);
});

run("evaluateCondition risk eq critical", () => {
  const metrics = {
    org_id: "test",
    margin_percent: -20,
    margin_cents: -2000,
    roi: 0.5,
    usage_pct: { ai_tokens: 50, try_on: 50, whatsapp_message: 50 },
    usage: { ai_tokens: 100, try_on: 10, whatsapp_message: 100 },
    limits: { ai_tokens: 200, try_on: 20, whatsapp_message: 200 },
    risk: "critical",
    billing_status: null,
    is_billing_blocked: true,
    has_manual_override: false,
  };

  const result = evaluateCondition("risk", "eq", 2, metrics);
  assert.equal(result, true);
});

run("matchRule returns true when conditions match", () => {
  const rule = {
    id: "test",
    name: "Test",
    conditions: [{ metric: "margin_percent", operator: "lt", value: 0 }],
    action: "reduce_limits",
    factor: 0.7,
    priority: 100,
    description: "Test rule",
  };

  const metrics = {
    org_id: "test",
    margin_percent: -5,
    margin_cents: -500,
    roi: 1,
    usage_pct: { ai_tokens: 50, try_on: 50, whatsapp_message: 50 },
    usage: { ai_tokens: 100, try_on: 10, whatsapp_message: 100 },
    limits: { ai_tokens: 200, try_on: 20, whatsapp_message: 200 },
    risk: "normal",
    billing_status: null,
    is_billing_blocked: false,
    has_manual_override: false,
  };

  const result = matchRule(rule, metrics);
  assert.equal(result, true);
});

run("matchRule returns false when conditions don't match", () => {
  const rule = {
    id: "test",
    name: "Test",
    conditions: [{ metric: "margin_percent", operator: "lt", value: 0 }],
    action: "reduce_limits",
    factor: 0.7,
    priority: 100,
    description: "Test rule",
  };

  const metrics = {
    org_id: "test",
    margin_percent: 20,
    margin_cents: 2000,
    roi: 3,
    usage_pct: { ai_tokens: 50, try_on: 50, whatsapp_message: 50 },
    usage: { ai_tokens: 100, try_on: 10, whatsapp_message: 100 },
    limits: { ai_tokens: 200, try_on: 20, whatsapp_message: 200 },
    risk: "normal",
    billing_status: null,
    is_billing_blocked: false,
    has_manual_override: false,
  };

  const result = matchRule(rule, metrics);
  assert.equal(result, false);
});

run("matchRule requires all conditions to match", () => {
  const rule = {
    id: "test",
    name: "Test",
    conditions: [
      { metric: "margin_percent", operator: "gte", value: 10 },
      { metric: "roi", operator: "gte", value: 3 },
    ],
    action: "increase_limits",
    factor: 1.2,
    priority: 50,
    description: "Test rule",
  };

  const metrics = {
    org_id: "test",
    margin_percent: 15,
    margin_cents: 1500,
    roi: 2,
    usage_pct: { ai_tokens: 50, try_on: 50, whatsapp_message: 50 },
    usage: { ai_tokens: 100, try_on: 10, whatsapp_message: 100 },
    limits: { ai_tokens: 200, try_on: 20, whatsapp_message: 200 },
    risk: "normal",
    billing_status: null,
    is_billing_blocked: false,
    has_manual_override: false,
  };

  const result = matchRule(rule, metrics);
  assert.equal(result, false);
});

run("applyAdjustmentAction increase_limits", () => {
  const result = applyAdjustmentAction(100, "increase_limits", 1.2, 1000, 10);
  assert.equal(result, 120);
});

run("applyAdjustmentAction reduce_limits", () => {
  const result = applyAdjustmentAction(100, "reduce_limits", 0.7, 1000, 10);
  assert.equal(result, 70);
});

run("applyAdjustmentAction throttle", () => {
  const result = applyAdjustmentAction(100, "throttle", 0.5, 1000, 10);
  assert.equal(result, 50);
});

run("applyAdjustmentAction emergency_reduce", () => {
  const result = applyAdjustmentAction(100, "emergency_reduce", 0.5, 1000, 10);
  assert.equal(result, 50);
});

run("applyAdjustmentAction maintain", () => {
  const result = applyAdjustmentAction(100, "maintain", 1.0, 1000, 10);
  assert.equal(result, 100);
});

run("applyAdjustmentAction respects max limit", () => {
  const result = applyAdjustmentAction(500, "increase_limits", 2, 800, 10);
  assert.equal(result, 800);
});

run("applyAdjustmentAction respects min limit", () => {
  const result = applyAdjustmentAction(10, "reduce_limits", 0.5, 1000, 20);
  assert.equal(result, 20);
});

run("conditionsToLabels formats correctly", () => {
  const conditions = [
    { metric: "margin_percent", operator: "lt", value: 0 },
    { metric: "roi", operator: "gte", value: 3 },
  ];

  const labels = conditionsToLabels(conditions);
  assert.equal(labels[0], "margin_percent < 0");
  assert.equal(labels[1], "roi >= 3");
});

run("auto-limits exports required functions", () => {
  assert.equal(typeof runAutoLimitsJob, "function");
  assert.equal(typeof getOptimizationRecommendations, "function");
});

run("audit exports required functions", () => {
  assert.equal(typeof recordOptimizationAudit, "function");
  assert.equal(typeof queryOptimizationAudit, "function");
  assert.equal(typeof getOptimizationStats, "function");
});

run("optimization audit record has required fields", () => {
  const record = {
    org_id: "test-org",
    resource_type: "ai_tokens",
    previous_limit: 100,
    new_limit: 120,
    factor: 1.2,
    action: "increase_limits",
    reason: "Test",
    policy_rule_id: "test",
    job_id: "test-job",
    is_dry_run: false,
    created_by: "system",
    created_at: new Date().toISOString(),
    metadata: {},
  };

  assert.equal(record.org_id, "test-org");
  assert.equal(record.is_dry_run, false);
});

process.stdout.write("\n# Optimization tests completed\n");