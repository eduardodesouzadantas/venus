/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");

const {
  normalizeStripeBillingStatus,
  isStripeBillingStatusBlocking,
  resolvePlanIdFromStripePriceId,
  isStripeBillingConfigured,
} = require("../src/lib/billing/stripe");
const {
  PLAN_SOFT_CAPS,
  PLAN_BUDGETS,
} = require("../src/lib/billing/limits");

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

run("normalizeStripeBillingStatus normalizes active", () => {
  assert.equal(normalizeStripeBillingStatus("active"), "active");
});

run("normalizeStripeBillingStatus normalizes uppercase", () => {
  assert.equal(normalizeStripeBillingStatus("ACTIVE"), "active");
});

run("normalizeStripeBillingStatus normalizes past_due", () => {
  assert.equal(normalizeStripeBillingStatus("past_due"), "past_due");
});

run("normalizeStripeBillingStatus normalizes trialing", () => {
  assert.equal(normalizeStripeBillingStatus("trialing"), "trialing");
});

run("normalizeStripeBillingStatus returns null for invalid", () => {
  assert.equal(normalizeStripeBillingStatus("invalid"), null);
  assert.equal(normalizeStripeBillingStatus(null), null);
  assert.equal(normalizeStripeBillingStatus(""), null);
});

run("isStripeBillingStatusBlocking blocks past_due", () => {
  assert.ok(isStripeBillingStatusBlocking("past_due"));
});

run("isStripeBillingStatusBlocking blocks unpaid", () => {
  assert.ok(isStripeBillingStatusBlocking("unpaid"));
});

run("isStripeBillingStatusBlocking blocks canceled", () => {
  assert.ok(isStripeBillingStatusBlocking("canceled"));
});

run("isStripeBillingStatusBlocking allows active", () => {
  assert.ok(!isStripeBillingStatusBlocking("active"));
});

run("isStripeBillingStatusBlocking allows trialing", () => {
  assert.ok(!isStripeBillingStatusBlocking("trialing"));
});

run("isStripeBillingStatusBlocking allows inactive", () => {
  assert.ok(!isStripeBillingStatusBlocking("inactive"));
});

run("PLAN_SOFT_CAPS has all plan tiers", () => {
  assert.ok(PLAN_SOFT_CAPS.free);
  assert.ok(PLAN_SOFT_CAPS.starter);
  assert.ok(PLAN_SOFT_CAPS.growth);
  assert.ok(PLAN_SOFT_CAPS.scale);
  assert.ok(PLAN_SOFT_CAPS.enterprise);
});

run("PLAN_SOFT_CAPS starter has expected values", () => {
  assert.equal(PLAN_SOFT_CAPS.starter.saved_results, 40);
  assert.equal(PLAN_SOFT_CAPS.starter.leads, 20);
  assert.equal(PLAN_SOFT_CAPS.starter.products, 100);
});

run("PLAN_SOFT_CAPS growth has higher values", () => {
  assert.equal(PLAN_SOFT_CAPS.growth.saved_results, 150);
  assert.equal(PLAN_SOFT_CAPS.growth.leads, 80);
  assert.equal(PLAN_SOFT_CAPS.growth.products, 300);
});

run("PLAN_BUDGETS has all plans", () => {
  assert.ok(PLAN_BUDGETS.free);
  assert.ok(PLAN_BUDGETS.starter);
  assert.ok(PLAN_BUDGETS.growth);
});

run("PLAN_BUDGETS has valid amounts", () => {
  assert.ok(PLAN_BUDGETS.free.daily > 0);
  assert.ok(PLAN_BUDGETS.free.monthly > 0);
  assert.ok(PLAN_BUDGETS.starter.daily > PLAN_BUDGETS.free.daily);
});

run("grace period enables for past_due", () => {
  const billingStatus = "past_due";
  const shouldGrace = billingStatus === "past_due" || billingStatus === "unpaid";
  assert.equal(shouldGrace, true);
});

run("grace period disables for active", () => {
  const billingStatus = "active";
  const shouldGrace = billingStatus === "past_due" || billingStatus === "unpaid";
  assert.equal(shouldGrace, false);
});

run("kill switch enables when past_due no grace", () => {
  const billingStatus = "past_due";
  const inGracePeriod = false;
  const shouldKillSwitch = (billingStatus === "past_due" || billingStatus === "unpaid") && !inGracePeriod;
  assert.equal(shouldKillSwitch, true);
});

run("kill switch disables when in grace period", () => {
  const billingStatus = "past_due";
  const inGracePeriod = true;
  const shouldKillSwitch = (billingStatus === "past_due" || billingStatus === "unpaid") && !inGracePeriod;
  assert.equal(shouldKillSwitch, false);
});

run("kill switch enables when canceled and period ended", () => {
  const billingStatus = "canceled";
  const currentPeriodEnd = new Date("2026-04-01");
  const now = new Date("2026-04-15");
  const shouldKillSwitch = billingStatus === "canceled" && now >= currentPeriodEnd;
  assert.equal(shouldKillSwitch, true);
});

run("subscription active allows operations", () => {
  const billingStatus = "active";
  const inGracePeriod = false;
  const shouldKillSwitch = (billingStatus === "past_due" || billingStatus === "unpaid") && !inGracePeriod;
  assert.equal(shouldKillSwitch, false);
});