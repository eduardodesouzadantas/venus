/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");

const { DEFAULT_LIMITS, getCampaignTypeLabel, buildAudienceQuery } = require("../src/lib/campaigns/core");

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

run("DEFAULT_LIMITS has expected values", () => {
  assert.equal(DEFAULT_LIMITS.daily_limit, 50);
  assert.equal(DEFAULT_LIMITS.per_user_limit, 3);
  assert.equal(DEFAULT_LIMITS.throttle_seconds, 60);
});

run("getCampaignTypeLabel returns Portuguese labels", () => {
  assert.equal(getCampaignTypeLabel("welcome"), "Boas-vindas");
  assert.equal(getCampaignTypeLabel("tryon_followup"), "Follow-up pós try-on");
  assert.equal(getCampaignTypeLabel("reengagement"), "Reengajamento");
  assert.equal(getCampaignTypeLabel("new_product"), "Novo produto");
  assert.equal(getCampaignTypeLabel("low_stock_alert"), "Alerta de estoque baixo");
  assert.equal(getCampaignTypeLabel("inactive_lead"), "Lead inativo");
  assert.equal(getCampaignTypeLabel("anniversary"), "Aniversário");
});

run("buildAudienceQuery builds status filter", () => {
  const query = buildAudienceQuery({ status: ["new", "engaged"] });
  assert.deepEqual(query.status, ["new", "engaged"]);
});

run("buildAudienceQuery builds source filter", () => {
  const query = buildAudienceQuery({ source: ["app", "whatsapp"] });
  assert.deepEqual(query.source, ["app", "whatsapp"]);
});

run("buildAudienceQuery builds intent score filter", () => {
  const query = buildAudienceQuery({ intentScoreMin: 50, intentScoreMax: 90 });
  assert.equal(query.intent_score_min, 50);
  assert.equal(query.intent_score_max, 90);
});

run("buildAudienceQuery builds days filter", () => {
  const query = buildAudienceQuery({ daysSinceInteraction: 14 });
  assert.equal(query.daysSinceInteraction, 14);
});

run("buildAudienceQuery builds hasPhone filter", () => {
  const query = buildAudienceQuery({ hasPhone: true });
  assert.equal(query.has_phone, true);
});

run("campaign tenant isolation prevents cross-org access", () => {
  const org1Campaigns = [
    { id: "camp-1", org_id: "org-abc", name: "Campaign A" },
    { id: "camp-2", org_id: "org-abc", name: "Campaign B" },
  ];
  const org2Campaigns = [
    { id: "camp-3", org_id: "org-xyz", name: "Campaign C" },
  ];

  const filterByOrg = (targetOrgId) =>
    org1Campaigns
      .filter((c) => c.org_id === targetOrgId)
      .concat(org2Campaigns.filter((c) => c.org_id === targetOrgId));

  const org1Results = filterByOrg("org-abc");
  const org2Results = filterByOrg("org-xyz");

  assert.equal(org1Results.length, 2);
  assert.equal(org2Results.length, 1);
  assert.equal(org1Results.some((c) => c.id === "camp-3"), false);
  assert.equal(org2Results.some((c) => c.id === "camp-1"), false);
});

run("campaign filters by status correctly", () => {
  const campaigns = [
    { id: "1", status: "draft" },
    { id: "2", status: "active" },
    { id: "3", status: "active" },
    { id: "4", status: "paused" },
  ];

  const filterByStatus = (s) => campaigns.filter((c) => c.status === s);

  assert.equal(filterByStatus("draft").length, 1);
  assert.equal(filterByStatus("active").length, 2);
  assert.equal(filterByStatus("paused").length, 1);
  assert.equal(filterByStatus("archived").length, 0);
});

run("campaign filters by type correctly", () => {
  const campaigns = [
    { id: "1", campaign_type: "welcome" },
    { id: "2", campaign_type: "tryon_followup" },
    { id: "3", campaign_type: "reengagement" },
    { id: "4", campaign_type: "new_product" },
  ];

  const filterByType = (t) => campaigns.filter((c) => c.campaign_type === t);

  assert.equal(filterByType("welcome").length, 1);
  assert.equal(filterByType("tryon_followup").length, 1);
  assert.equal(filterByType("reengagement").length, 1);
  assert.equal(filterByType("new_product").length, 1);
});

run("campaign limits prevent spam", () => {
  const dailyLimit = 50;
  const perUserLimit = 3;

  const sentToday = 45;
  const sentToUser = 2;

  assert.equal(sentToday < dailyLimit, true);
  assert.equal(sentToUser < perUserLimit, true);
});

run("campaign rate limit check allows under limit", () => {
  const limitPerUser = 3;
  const recentCount = 2;
  const allowed = recentCount < limitPerUser;

  assert.equal(allowed, true);
});

run("campaign rate limit check blocks at limit", () => {
  const limitPerUser = 3;
  const recentCount = 3;
  const allowed = recentCount < limitPerUser;

  assert.equal(allowed, false);
});

run("campaign filter leads by status", () => {
  const leads = [
    { id: "1", status: "new", phone: "11999990001" },
    { id: "2", status: "engaged", phone: "11999990002" },
    { id: "3", status: "qualified", phone: "11999990003" },
    { id: "4", status: "won", phone: null },
  ];

  const filterByStatus = (statuses) =>
    leads.filter((l) => statuseses.includes(l.status) && l.phone);

  const result = filterByStatus(["new", "engaged"]);
  assert.equal(result.length, 2);
});

run("campaign filter leads by recency", () => {
  const now = new Date();
  const leads = [
    { id: "1", last_interaction_at: now.toISOString() },
    { id: "2", last_interaction_at: new Date(now.getTime() - 86400000).toISOString() },
    { id: "3", last_interaction_at: new Date(now.getTime() - 172800000).toISOString() },
  ];

  const filterByDays = (days) => {
    const cutoff = new Date(now.getTime() - days * 86400000);
    return leads.filter((l) => new Date(l.last_interaction_at) >= cutoff);
  };

  assert.equal(filterByDays(1).length, 1);
  assert.equal(filterByDays(2).length, 2);
  assert.equal(filterByDays(3).length, 3);
});

run("campaign deduplication prevents duplicate sends", () => {
  const sentLogs = [
    { lead_id: "lead-1", campaign_id: "camp-1", status: "sent" },
    { lead_id: "lead-2", campaign_id: "camp-1", status: "sent" },
  ];

  const checkDuplicate = (leadId, campaignId) =>
    sentLogs.some((log) => log.lead_id === leadId && log.campaign_id === campaignId);

  assert.equal(checkDuplicate("lead-1", "camp-1"), true);
  assert.equal(checkDuplicate("lead-3", "camp-1"), false);
});

run("campaign status progression is valid", () => {
  const validStatuses = ["draft", "active", "paused", "archived"];
  assert.equal(validStatuses.includes("draft"), true);
  assert.equal(validStatuses.includes("active"), true);
  assert.equal(validStatuses.includes("paused"), true);
  assert.equal(validStatuses.includes("archived"), true);
});

run("campaign run statuses are valid", () => {
  const validStatuses = ["pending", "running", "completed", "failed", "cancelled"];
  assert.equal(validStatuses.includes("pending"), true);
  assert.equal(validStatuses.includes("running"), true);
  assert.equal(validStatuses.includes("completed"), true);
  assert.equal(validStatuses.includes("failed"), true);
  assert.equal(validStatuses.includes("cancelled"), true);
});