import type { OperationalSignalOrgRow, OperationalSignalSummary } from "./operational-signals";

export type OperationalRecommendationPriority = "high" | "medium" | "low";

export type OperationalRecommendationKind =
  | "hard_cap"
  | "tenant_blocked"
  | "conflict"
  | "single_flight"
  | "latency"
  | "commercial_risk";

export interface OperationalRecommendationLeadSummary {
  total: number;
  by_status?: Record<string, number>;
  followup_overdue: number;
  followup_today: number;
  followup_upcoming: number;
  followup_without: number;
}

export interface OperationalRecommendationOrgContext {
  id: string;
  name: string;
  lead_summary: OperationalRecommendationLeadSummary;
  operational_summary?: OperationalSignalOrgRow | null;
}

export interface OperationalRecommendation {
  key: string;
  kind: OperationalRecommendationKind;
  priority: OperationalRecommendationPriority;
  title: string;
  summary: string;
  action: string;
  evidence: string[];
  org_id?: string;
  org_name?: string;
  score?: number;
  order?: number;
}

interface OperationalRecommendationCandidate extends OperationalRecommendation {
  score: number;
  order: number;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function priorityRank(priority: OperationalRecommendationPriority) {
  switch (priority) {
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function formatDurationMs(value: number | null) {
  if (value === null) {
    return "sem dados";
  }

  return `${Math.round(value).toLocaleString("pt-BR")}ms`;
}

function formatCount(value: number) {
  return value.toLocaleString("pt-BR");
}

export function formatOperationalReasonLabel(reasonCode: string | null | undefined) {
  const normalized = normalizeText(reasonCode);
  if (!normalized) {
    return "sem motivo";
  }

  const [scope, detail = ""] = normalized.split(":", 2);
  const detailLabel = detail.replace(/_/g, " ").trim();

  switch (scope) {
    case "hard_cap":
      return detailLabel ? `hard cap em ${detailLabel}` : "hard cap";
    case "tenant_blocked":
      return detailLabel ? `bloqueio operacional em ${detailLabel}` : "bloqueio operacional";
    case "conflict":
      return detailLabel ? `conflito de ${detailLabel}` : "conflito operacional";
    case "single_flight":
      return detailLabel ? `single-flight ${detailLabel}` : "single-flight";
    case "persist_result":
      return detailLabel ? `persistência ${detailLabel}` : "persistência";
    default:
      return normalized.replace(/[:_]/g, " ");
  }
}

function countReasonPrefix(summary: OperationalSignalSummary, prefix: string) {
  return summary.top_reason_codes.reduce((total, row) => (row.key.startsWith(prefix) ? total + row.count : total), 0);
}

function findReason(summary: OperationalSignalSummary, prefix: string) {
  return summary.top_reason_codes.find((row) => row.key.startsWith(prefix)) || null;
}

function sortCandidates(candidates: OperationalRecommendationCandidate[], limit: number) {
  return [...candidates]
    .sort((left, right) => {
      const priorityDelta = priorityRank(right.priority) - priorityRank(left.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.order - right.order;
    })
    .slice(0, limit);
}

function buildHardCapRecommendation(summary: OperationalSignalSummary, order: number) {
  const reasonCount = countReasonPrefix(summary, "hard_cap:");
  if (reasonCount <= 0 && summary.blocked_count <= 0) {
    return null;
  }

  const reason = findReason(summary, "hard_cap:");
  const priority: OperationalRecommendationPriority = reasonCount >= 2 || summary.blocked_count >= 3 ? "high" : "medium";
  const score = reasonCount * 120 + summary.blocked_count * 15;

  return {
    key: "hard_cap",
    kind: "hard_cap",
    priority,
    title: "Limites sob pressão",
    summary: `${formatCount(summary.blocked_count)} bloqueios por hard cap na janela.`,
    action: "Revisar plano ou ampliar os limites pressionados.",
    evidence: [
      reason ? formatOperationalReasonLabel(reason.key) : "hard cap",
      `bloqueios ${formatCount(summary.blocked_count)}`,
    ],
    score,
    order,
  } satisfies OperationalRecommendationCandidate;
}

function buildTenantBlockedRecommendation(summary: OperationalSignalSummary, order: number) {
  const reasonCount = countReasonPrefix(summary, "tenant_blocked:");
  if (reasonCount <= 0 && summary.blocked_count <= 0) {
    return null;
  }

  const reason = findReason(summary, "tenant_blocked:");
  const priority: OperationalRecommendationPriority = reasonCount >= 2 || summary.blocked_count >= 2 ? "high" : "medium";
  const score = reasonCount * 110 + summary.blocked_count * 12;

  return {
    key: "tenant_blocked",
    kind: "tenant_blocked",
    priority,
    title: "Bloqueio operacional ativo",
    summary: `${formatCount(summary.blocked_count)} bloqueios operacionais na janela.`,
    action: "Revisar o bloqueio da org e destravar com critério.",
    evidence: [
      reason ? formatOperationalReasonLabel(reason.key) : "bloqueio operacional",
      `bloqueios ${formatCount(summary.blocked_count)}`,
    ],
    score,
    order,
  } satisfies OperationalRecommendationCandidate;
}

function buildConflictRecommendation(summary: OperationalSignalSummary, order: number) {
  if (summary.conflict_count <= 0) {
    return null;
  }

  const reason = findReason(summary, "conflict:");
  const priority: OperationalRecommendationPriority = summary.conflict_count >= 3 ? "high" : "medium";
  const score = summary.conflict_count * 100;

  return {
    key: "conflict",
    kind: "conflict",
    priority,
    title: "Concorrência em conflito",
    summary: `${formatCount(summary.conflict_count)} conflitos de snapshot na janela.`,
    action: "Evitar edição simultânea e revisar snapshots desatualizados.",
    evidence: [
      reason ? formatOperationalReasonLabel(reason.key) : "conflito operacional",
      `conflitos ${formatCount(summary.conflict_count)}`,
    ],
    score,
    order,
  } satisfies OperationalRecommendationCandidate;
}

function buildSingleFlightRecommendation(summary: OperationalSignalSummary, order: number) {
  const reason = findReason(summary, "single_flight:");
  if (summary.wait_count <= 0 && !reason) {
    return null;
  }

  const busyCount = countReasonPrefix(summary, "single_flight:busy");
  const priority: OperationalRecommendationPriority = summary.wait_count >= 3 || busyCount >= 2 ? "high" : "medium";
  const score = summary.wait_count * 100 + busyCount * 20;

  return {
    key: "single_flight",
    kind: "single_flight",
    priority,
    title: "Gargalo de processamento",
    summary: `${formatCount(summary.wait_count)} esperas de single-flight na janela.`,
    action: "Investigar o gargalo de processamento e reduzir a espera concorrente.",
    evidence: [
      reason ? formatOperationalReasonLabel(reason.key) : "single-flight",
      `esperas ${formatCount(summary.wait_count)}`,
    ],
    score,
    order,
  } satisfies OperationalRecommendationCandidate;
}

function buildLatencyRecommendation(summary: OperationalSignalSummary, order: number) {
  const slowestEvent = summary.top_event_types[0] || null;
  const avgDuration = slowestEvent?.avg_duration_ms ?? summary.avg_duration_ms;
  const maxDuration = slowestEvent?.max_duration_ms ?? summary.max_duration_ms;

  if (avgDuration === null || avgDuration < 900) {
    return null;
  }

  const score = Math.round(avgDuration / 10) + Math.round((maxDuration || 0) / 100);
  const flowLabel = slowestEvent
    ? slowestEvent.key.replace(/\./g, " / ").replace(/_/g, " ")
    : "fluxo critico";

  return {
    key: "latency",
    kind: "latency",
    priority: avgDuration >= 2000 || (maxDuration || 0) >= 5000 ? "high" : "medium",
    title: "Fluxo crítico lento",
    summary: `Latência média de ${formatDurationMs(avgDuration)} no fluxo mais pressionado.`,
    action: "Revisar custo, tempo e caminho crítico do fluxo operacional mais lento.",
    evidence: [
      flowLabel,
      `média ${formatDurationMs(avgDuration)}`,
      `pico ${formatDurationMs(maxDuration)}`,
    ],
    score,
    order,
  } satisfies OperationalRecommendationCandidate;
}

function buildLeadPressureRecommendation(
  summary: OperationalSignalSummary,
  org: OperationalRecommendationOrgContext,
  order: number
) {
  const operationalPressure = (org.operational_summary?.blocked_count || 0) + (org.operational_summary?.conflict_count || 0) + (org.operational_summary?.wait_count || 0);
  const overdue = org.lead_summary.followup_overdue;
  const withoutFollowUp = org.lead_summary.followup_without;

  if (overdue <= 0 && withoutFollowUp <= 0) {
    return null;
  }

  if (overdue <= 0 && operationalPressure <= 0) {
    return null;
  }

  const priority: OperationalRecommendationPriority = overdue > 0 && operationalPressure > 0 ? "high" : "medium";
  const score = overdue * 150 + operationalPressure * 40 + withoutFollowUp * 8;
  const leadText =
    overdue > 0
      ? `${formatCount(overdue)} leads vencidos`
      : `${formatCount(withoutFollowUp)} leads sem follow-up`;

  const pressureText =
    operationalPressure > 0
      ? ` e ${formatCount(operationalPressure)} sinais de atrito`
      : "";

  const evidence: string[] = [leadText];
  const topReason = org.operational_summary?.top_reason_code || summary.top_reason_codes[0]?.key || null;
  if (topReason) {
    evidence.push(formatOperationalReasonLabel(topReason));
  }

  return {
    key: `org:${org.id}:lead_pressure`,
    kind: "commercial_risk",
    priority,
    title: `Priorizar ${org.name}`,
    summary: `${leadText}${pressureText} na janela.`,
    action: overdue > 0
      ? "Atacar o follow-up vencido desta org agora e destravar a operação."
      : "Organizar o follow-up desta org antes que o atrito vire atraso.",
    evidence,
    org_id: org.id,
    org_name: org.name,
    score,
    order,
  } satisfies OperationalRecommendationCandidate;
}

function collectSummaryRecommendations(summary: OperationalSignalSummary) {
  const candidates: OperationalRecommendationCandidate[] = [];
  let order = 0;

  const hardCap = buildHardCapRecommendation(summary, order++);
  if (hardCap) candidates.push(hardCap);

  const tenantBlocked = buildTenantBlockedRecommendation(summary, order++);
  if (tenantBlocked) candidates.push(tenantBlocked);

  const conflict = buildConflictRecommendation(summary, order++);
  if (conflict) candidates.push(conflict);

  const singleFlight = buildSingleFlightRecommendation(summary, order++);
  if (singleFlight) candidates.push(singleFlight);

  const latency = buildLatencyRecommendation(summary, order++);
  if (latency) candidates.push(latency);

  return candidates;
}

export function buildAgencyOperationalRecommendations(
  summary: OperationalSignalSummary,
  orgs: OperationalRecommendationOrgContext[] = [],
  limit = 3
): OperationalRecommendation[] {
  const candidates = collectSummaryRecommendations(summary);
  let order = candidates.length;

  for (const org of orgs) {
    const recommendation = buildLeadPressureRecommendation(summary, org, order);
    if (recommendation) {
      candidates.push(recommendation);
      order += 1;
    }
  }

  return sortCandidates(candidates, limit);
}

export function buildOrgOperationalRecommendations(
  summary: OperationalSignalSummary,
  leadSummary: OperationalRecommendationLeadSummary,
  orgName: string,
  limit = 3
): OperationalRecommendation[] {
  const candidates = collectSummaryRecommendations(summary);
  const orgRecommendation = buildLeadPressureRecommendation(
    summary,
    {
      id: orgName,
      name: orgName,
      lead_summary: leadSummary,
      operational_summary: {
        key: orgName,
        count: summary.total_events,
        friction_score: summary.blocked_count + summary.conflict_count + summary.wait_count + summary.failed_count,
        blocked_count: summary.blocked_count,
        conflict_count: summary.conflict_count,
        wait_count: summary.wait_count,
        failed_count: summary.failed_count,
        avg_duration_ms: summary.avg_duration_ms,
        max_duration_ms: summary.max_duration_ms,
        top_reason_code: summary.top_reason_codes[0]?.key || null,
        top_event_type: summary.top_event_types[0]?.key || null,
      },
    },
    candidates.length
  );

  if (orgRecommendation) {
    candidates.push(orgRecommendation);
  }

  return sortCandidates(candidates, limit);
}

export function formatOperationalPriorityLabel(priority: OperationalRecommendationPriority) {
  switch (priority) {
    case "high":
      return "Alta";
    case "medium":
      return "Média";
    default:
      return "Baixa";
  }
}
