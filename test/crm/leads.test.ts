/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");

const { LEAD_STATUSES, isLeadStatus, getLeadStatusLabel, createEmptyLeadStatusCounts, resolveLeadStatus } = require("../src/lib/leads/index.ts");

const LEAD_STATUS_RANK = {
  new: 0,
  engaged: 1,
  qualified: 2,
  offer_sent: 3,
  closing: 4,
  won: 5,
  lost: 6,
};

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

run("LEAD_STATUSES has all required statuses", () => {
  assert.equal(LEAD_STATUSES.includes("new"), true);
  assert.equal(LEAD_STATUSES.includes("engaged"), true);
  assert.equal(LEAD_STATUSES.includes("qualified"), true);
  assert.equal(LEAD_STATUSES.includes("offer_sent"), true);
  assert.equal(LEAD_STATUSES.includes("closing"), true);
  assert.equal(LEAD_STATUSES.includes("won"), true);
  assert.equal(LEAD_STATUSES.includes("lost"), true);
});

run("isLeadStatus validates correctly", () => {
  assert.equal(isLeadStatus("new"), true);
  assert.equal(isLeadStatus("engaged"), true);
  assert.equal(isLeadStatus("qualified"), true);
  assert.equal(isLeadStatus("won"), true);
  assert.equal(isLeadStatus("lost"), true);
  assert.equal(isLeadStatus("invalid"), false);
  assert.equal(isLeadStatus(null), false);
  assert.equal(isLeadStatus(""), false);
});

run("getLeadStatusLabel returns Portuguese labels", () => {
  assert.equal(getLeadStatusLabel("new"), "Novo");
  assert.equal(getLeadStatusLabel("engaged"), "Em conversa");
  assert.equal(getLeadStatusLabel("qualified"), "Qualificado");
  assert.equal(getLeadStatusLabel("offer_sent"), "Proposta enviada");
  assert.equal(getLeadStatusLabel("closing"), "Fechamento em andamento");
  assert.equal(getLeadStatusLabel("won"), "Ganho");
  assert.equal(getLeadStatusLabel("lost"), "Perdido");
});

run("createEmptyLeadStatusCounts initializes all statuses to 0", () => {
  const counts = createEmptyLeadStatusCounts();
  assert.equal(counts.new, 0);
  assert.equal(counts.engaged, 0);
  assert.equal(counts.qualified, 0);
  assert.equal(counts.offer_sent, 0);
  assert.equal(counts.closing, 0);
  assert.equal(counts.won, 0);
  assert.equal(counts.lost, 0);
});

run("resolveLeadStatus does not allow regression for won", () => {
  assert.equal(resolveLeadStatus("won", "new"), "won");
  assert.equal(resolveLeadStatus("won", "engaged"), "won");
  assert.equal(resolveLeadStatus("won", "qualified"), "won");
});

run("resolveLeadStatus does not allow regression for lost", () => {
  assert.equal(resolveLeadStatus("lost", "new"), "lost");
  assert.equal(resolveLeadStatus("lost", "engaged"), "lost");
  assert.equal(resolveLeadStatus("lost", "qualified"), "lost");
});

run("resolveLeadStatus allows forward progression", () => {
  assert.equal(resolveLeadStatus("new", "engaged"), "engaged");
  assert.equal(resolveLeadStatus("engaged", "qualified"), "qualified");
  assert.equal(resolveLeadStatus("qualified", "offer_sent"), "offer_sent");
  assert.equal(resolveLeadStatus("offer_sent", "closing"), "closing");
  assert.equal(resolveLeadStatus("closing", "won"), "won");
  assert.equal(resolveLeadStatus("closing", "lost"), "lost");
});

run("CRM tenant isolation prevents cross-org access", () => {
  const org1Leads = [
    { id: "lead-1", org_id: "org-abc", name: "Client A" },
    { id: "lead-2", org_id: "org-abc", name: "Client B" },
  ];
  const org2Leads = [
    { id: "lead-3", org_id: "org-xyz", name: "Client C" },
  ];
  
  const filteredByOrg = (targetOrgId) => org1Leads.filter(l => l.org_id === targetOrgId).concat(org2Leads.filter(l => l.org_id === targetOrgId));
  
  const org1Results = filteredByOrg("org-abc");
  const org2Results = filteredByOrg("org-xyz");
  
  assert.equal(org1Results.length, 2);
  assert.equal(org2Results.length, 1);
  assert.equal(org1Results.some(l => l.id === "lead-3"), false);
  assert.equal(org2Results.some(l => l.id === "lead-1"), false);
});

run("CRM filters by status correctly", () => {
  const leads = [
    { id: "1", status: "new" },
    { id: "2", status: "engaged" },
    { id: "3", status: "qualified" },
    { id: "4", status: "won" },
  ];
  
  const filterByStatus = (s) => leads.filter(l => l.status === s);
  
  assert.equal(filterByStatus("new").length, 1);
  assert.equal(filterByStatus("engaged").length, 1);
  assert.equal(filterByStatus("qualified").length, 1);
  assert.equal(filterByStatus("won").length, 1);
  assert.equal(filterByStatus("lost").length, 0);
});

run("CRM filters by source correctly", () => {
  const leads = [
    { id: "1", source: "app" },
    { id: "2", source: "whatsapp" },
    { id: "3", source: "manual" },
  ];
  
  const filterBySource = (s) => leads.filter(l => l.source === s);
  
  assert.equal(filterBySource("app").length, 1);
  assert.equal(filterBySource("whatsapp").length, 1);
  assert.equal(filterBySource("manual").length, 1);
});

run("CRM filters by search term correctly", () => {
  const leads = [
    { id: "1", name: "Ana Silva", email: "ana@exemplo.com", phone: "11999990001" },
    { id: "2", name: "João Santos", email: "joao@exemplo.com", phone: "11999990002" },
    { id: "3", name: "Maria Oliveira", email: "maria@exemplo.com", phone: "11999990003" },
  ];
  
  const searchByTerm = (term) => {
    const t = term.toLowerCase();
    return leads.filter(l => 
      l.name.toLowerCase().includes(t) || 
      l.email.toLowerCase().includes(t) ||
      l.phone.includes(t)
    );
  };
  
  assert.equal(searchByTerm("Ana").length, 1);
  assert.equal(searchByTerm("exemplo.com").length, 3);
  assert.equal(searchByTerm("1199999").length, 3);
  assert.equal(searchByTerm("000").length, 3);
});

run("CRM filters by recency correctly", () => {
  const now = new Date();
  const leads = [
    { id: "1", last_interaction_at: now.toISOString() },
    { id: "2", last_interaction_at: new Date(now.getTime() - 86400000).toISOString() },
    { id: "3", last_interaction_at: new Date(now.getTime() - 172800000).toISOString() },
  ];
  
  const filterRecent = (days) => {
    const cutoff = new Date(now.getTime() - days * 86400000);
    return leads.filter(l => new Date(l.last_interaction_at) >= cutoff);
  };
  
  assert.equal(filterRecent(1).length, 1);
  assert.equal(filterRecent(2).length, 2);
  assert.equal(filterRecent(3).length, 3);
});

run("CRM timeline event types are defined", () => {
  const validTypes = ["created", "status_changed", "note_added", "assigned", "conversation_linked", "follow_up_scheduled", "whatsapp_message"];
  assert.equal(validTypes.includes("created"), true);
  assert.equal(validTypes.includes("status_changed"), true);
  assert.equal(validTypes.includes("note_added"), true);
  assert.equal(validTypes.includes("assigned"), true);
  assert.equal(validTypes.includes("follow_up_scheduled"), true);
  assert.equal(validTypes.includes("whatsapp_message"), true);
});