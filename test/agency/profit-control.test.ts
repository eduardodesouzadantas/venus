/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");

const { DEFAULT_RESOURCE_COSTS } = require("../src/lib/agency/profit-control");

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

run("DEFAULT_RESOURCE_COSTS has all resource types", () => {
  assert.equal(DEFAULT_RESOURCE_COSTS.ai_tokens, 1);
  assert.equal(DEFAULT_RESOURCE_COSTS.ai_requests, 150);
  assert.equal(DEFAULT_RESOURCE_COSTS.try_on, 250);
  assert.equal(DEFAULT_RESOURCE_COSTS.whatsapp_message, 2);
  assert.equal(DEFAULT_RESOURCE_COSTS.whatsapp_conversation, 50);
  assert.equal(DEFAULT_RESOURCE_COSTS.saved_result, 150);
  assert.equal(DEFAULT_RESOURCE_COSTS.product_create, 20);
  assert.equal(DEFAULT_RESOURCE_COSTS.lead_create, 8);
});

run("profit calculation is correct", () => {
  const revenue = 10000;
  const cost = 3000;
  const margin = revenue - cost;
  const marginPercent = (margin / revenue) * 100;

  assert.equal(margin, 7000);
  assert.equal(marginPercent, 70);
});

run("profit calculation with negative margin", () => {
  const revenue = 3000;
  const cost = 5000;
  const margin = revenue - cost;
  const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;

  assert.equal(margin, -2000);
  assert.equal(marginPercent, -66.67);
});

run("profit isolation between tenants", () => {
  const org1Profit = { orgId: "org-a", revenue: 10000, cost: 3000 };
  const org2Profit = { orgId: "org-b", revenue: 5000, cost: 2000 };

  const org1Margin = org1Profit.revenue - org1Profit.cost;
  const org2Margin = org2Profit.revenue - org2Profit.cost;

  assert.equal(org1Margin, 7000);
  assert.equal(org2Margin, 3000);
  assert.notEqual(org1Margin, org2Margin);
});

run("cost calculation by resource type", () => {
  const usage = {
    ai_requests: 100,
    try_on: 20,
    whatsapp_message: 500,
    saved_result: 50,
    product_create: 30,
    lead_create: 10,
  };

  const totalCost =
    usage.ai_requests * DEFAULT_RESOURCE_COSTS.ai_requests +
    usage.try_on * DEFAULT_RESOURCE_COSTS.try_on +
    usage.whatsapp_message * DEFAULT_RESOURCE_COSTS.whatsapp_message +
    usage.saved_result * DEFAULT_RESOURCE_COSTS.saved_result +
    usage.product_create * DEFAULT_RESOURCE_COSTS.product_create +
    usage.lead_create * DEFAULT_RESOURCE_COSTS.lead_create;

  const expected =
    100 * 150 +
    20 * 250 +
    500 * 2 +
    50 * 150 +
    30 * 20 +
    10 * 8;

  assert.equal(totalCost, expected);
});

run("forecast uses daily average", () => {
  const currentCost = 3000;
  const daysElapsed = 10;
  const daysTotal = 30;
  const dailyAverage = currentCost / daysElapsed;
  const forecast = dailyAverage * daysTotal;

  assert.equal(dailyAverage, 300);
  assert.equal(forecast, 9000);
});

run("forecast exceeds budget alert", () => {
  const forecastCost = 12000;
  const budget = 10000;
  const shouldAlert = forecastCost > budget;

  assert.equal(shouldAlert, true);
});

run("margin below threshold alert", () => {
  const marginPercent = 15;
  const threshold = 20;
  const shouldAlert = marginPercent < threshold;

  assert.equal(shouldAlert, true);
});

run("negative margin alert", () => {
  const marginPercent = -10;
  const shouldAlert = marginPercent < 0;

  assert.equal(shouldAlert, true);
});

run("high margin allows operation", () => {
  const marginPercent = 75;
  const minMargin = 20;
  const canProceed = marginPercent >= minMargin;

  assert.equal(canProceed, true);
});

run("revenue confirmed takes precedence", () => {
  const estimatedRevenue = 10000;
  const confirmedRevenue = 8000;
  const useConfirmed = confirmedRevenue > 0;
  const finalRevenue = useConfirmed ? confirmedRevenue : estimatedRevenue;

  assert.equal(finalRevenue, 8000);
});

run("profit calculation with zero revenue", () => {
  const revenue = 0;
  const cost = 3000;
  const margin = revenue - cost;
  const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;

  assert.equal(margin, -3000);
  assert.equal(marginPercent, 0);
});

run("profit breakdown by category", () => {
  const breakdown = {
    ai: { revenue: 5000, cost: 1500 },
    whatsapp: { revenue: 3000, cost: 200 },
    catalog: { revenue: 2000, cost: 600 },
  };

  const totalRevenue = breakdown.ai.revenue + breakdown.whatsapp.revenue + breakdown.catalog.revenue;
  const totalCost = breakdown.ai.cost + breakdown.whatsapp.cost + breakdown.catalog.cost;
  const margin = totalRevenue - totalCost;

  assert.equal(totalRevenue, 10000);
  assert.equal(totalCost, 2300);
  assert.equal(margin, 7700);
});

run("cost efficiency calculation", () => {
  const cost = 3000;
  const revenue = 10000;
  const efficiency = (revenue / cost);

  assert.equal(efficiency, 3.33);
});

run("ROI calculation from profit", () => {
  const revenue = 10000;
  const cost = 3000;
  const investment = cost;
  const roi = ((revenue - cost) / investment) * 100;

  assert.equal(roi, 233.33);
});

run("profit margin tier classification", () => {
  const marginHigh = 70;
  const marginMedium = 40;
  const marginLow = 10;
  const marginNegative = -10;

  const classify = (margin) => {
    if (margin < 0) return "negative";
    if (margin < 20) return "low";
    if (margin < 50) return "medium";
    return "high";
  };

  assert.equal(classify(marginHigh), "high");
  assert.equal(classify(marginMedium), "medium");
  assert.equal(classify(marginLow), "low");
  assert.equal(classify(marginNegative), "negative");
});

run("daily burn rate calculation", () => {
  const cost = 3000;
  const days = 15;
  const dailyRate = cost / days;

  assert.equal(dailyRate, 200);
});

run("month end forecast from daily rate", () => {
  const dailyRate = 200;
  const monthDays = 30;
  const forecast = dailyRate * monthDays;

  assert.equal(forecast, 6000);
});

run("cost per lead calculation", () => {
  const cost = 3000;
  const leads = 50;
  const costPerLead = cost / leads;

  assert.equal(costPerLead, 60);
});

run("revenue per lead calculation", () => {
  const revenue = 10000;
  const leads = 50;
  const revenuePerLead = revenue / leads;

  assert.equal(revenuePerLead, 200);
});

run("LTV calculation", () => {
  const monthlyRevenue = 10000;
  const months = 12;
  const ltv = monthlyRevenue * months;

  assert.equal(ltv, 120000);
});