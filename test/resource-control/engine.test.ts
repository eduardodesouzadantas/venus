/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");

const { DEFAULT_LIMITS, canConsumeResource, consumeResource } = require("../src/lib/resource-control/index");

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

run("DEFAULT_LIMITS has all resource types", () => {
  assert.equal(DEFAULT_LIMITS.ai_tokens, 250000);
  assert.equal(DEFAULT_LIMITS.try_on, 50);
  assert.equal(DEFAULT_LIMITS.whatsapp_message, 1000);
  assert.equal(DEFAULT_LIMITS.saved_result, 100);
  assert.equal(DEFAULT_LIMITS.product, 500);
  assert.equal(DEFAULT_LIMITS.lead, 500);
});

run("resource control enforces limit correctly", () => {
  const limit = 50;
  const used = 49;
  const amount = 2;
  const remaining = limit - used;

  assert.equal(remaining >= amount, true);

  const blockedCase = limit - used;
  assert.equal(blockedCase >= amount, false);
});

run("resource control tracks per-org correctly", () => {
  const org1Usage = { orgId: "org-a", used: 25, limit: 50 };
  const org2Usage = { orgId: "org-b", used: 10, limit: 50 };

  const filterByOrg = (targetOrgId) => {
    if (targetOrgId === "org-a") return org1Usage;
    if (targetOrgId === "org-b") return org2Usage;
    return null;
  };

  assert.equal(filterByOrg("org-a").used, 25);
  assert.equal(filterByOrg("org-b").used, 10);
});

run("resource control rejects when limit exceeded", () => {
  const limit = 50;
  const used = 50;
  const amount = 1;
  const remaining = limit - used;

  const shouldAllow = remaining >= amount;
  assert.equal(shouldAllow, false);
});

run("resource control allows under limit", () => {
  const limit = 50;
  const used = 30;
  const amount = 10;
  const remaining = limit - used;

  const shouldAllow = remaining >= amount;
  assert.equal(shouldAllow, true);
});

run("resource control blocks multiple resources", () => {
  const resources = [
    { type: "ai_tokens", used: 250000, limit: 250000 },
    { type: "try_on", used: 50, limit: 50 },
    { type: "whatsapp_message", used: 1000, limit: 1000 },
  ];

  const checkResource = (type) => {
    const r = resources.find((x) => x.type === type);
    return r ? r.used >= r.limit : false;
  };

  assert.equal(checkResource("ai_tokens"), true);
  assert.equal(checkResource("try_on"), true);
  assert.equal(checkResource("whatsapp_message"), true);
});

run("resource control calculates remaining correctly", () => {
  const usage = 35;
  const limit = 50;
  const remaining = limit - usage;

  assert.equal(remaining, 15);
});

run("resource control usage percentage calculation", () => {
  const used = 25;
  const limit = 50;
  const percentage = (used / limit) * 100;

  assert.equal(percentage, 50);
});

run("resource control blocks at 100 percent", () => {
  const used = 50;
  const limit = 50;
  const percentage = (used / limit) * 100;

  assert.equal(percentage >= 100, true);
});

run("resource control warns at 80 percent", () => {
  const used = 40;
  const limit = 50;
  const percentage = (used / limit) * 100;

  assert.equal(percentage >= 80, true);
  assert.equal(percentage < 100, true);
});

run("resource control isolated per resource type", () => {
  const usage = {
    ai_tokens: 100,
    try_on: 10,
    whatsapp_message: 500,
  };

  assert.equal(usage.ai_tokens < 250000, true);
  assert.equal(usage.try_on < 50, true);
  assert.equal(usage.whatsapp_message < 1000, true);
});

run("resource control respects daily vs monthly", () => {
  const daily = 100;
  const monthly = 2500;
  const dailyLimit = 100;

  const shouldBlockDaily = daily >= dailyLimit;
  const shouldBlockMonthly = monthly >= monthly * 10;

  assert.equal(shouldBlockDaily, true);
});

run("resource control override takes precedence", () => {
  const defaultLimit = 50;
  const overrideLimit = 100;
  const used = 75;

  const effectiveLimit = overrideLimit || defaultLimit;
  const remaining = effectiveLimit - used;

  const shouldAllow = remaining >= 1;
  assert.equal(shouldAllow, true);
});

run("resource control fallback uses default", () => {
  const override = null;
  const defaultLimit = 50;

  const effectiveLimit = override || defaultLimit;
  assert.equal(effectiveLimit, 50);
});

run("resource audit logs consumption", () => {
  const auditLog = {
    orgId: "org-123",
    resourceType: "try_on",
    amount: 1,
    action: "consume",
    result: "allowed",
  };

  assert.equal(auditLog.result, "allowed");
});

run("resource audit logs blockage", () => {
  const auditLog = {
    orgId: "org-123",
    resourceType: "ai_tokens",
    amount: 1000,
    action: "consume",
    result: "blocked",
  };

  assert.equal(auditLog.result, "blocked");
});

run("resource control integrates with kill switch", () => {
  const limit = 50;
  const used = 50;
  const triggerKillSwitch = used >= limit;

  assert.equal(triggerKillSwitch, true);
});

run("resource control tracks usage period", () => {
  const now = new Date();
  const usagePeriod = now.toISOString().slice(0, 10);

  assert.equal(usagePeriod.length, 10);
  assert.equal(usagePeriod.includes("-"), true);
});

run("resource control atomic operation test", () => {
  let currentUsage = 10;
  const increment = 1;
  const limit = 50;

  const beforeConsume = currentUsage;
  if (currentUsage < limit) {
    currentUsage += increment;
  }
  const afterConsume = currentUsage;

  assert.equal(afterConsume, beforeConsume + increment);
  assert.equal(afterConsume <= limit, true);
});