import { LEAD_STATUSES, isLeadStatus, type LeadStatus } from "@/lib/leads";

export const AGING_WARNING_DAYS = 7;
export const AGING_CRITICAL_DAYS = 14;
const AGING_PIPELINE_STATUSES: LeadStatus[] = ["new", "engaged", "qualified", "offer_sent", "closing"];

export interface AgencyAgingLeadLike {
  status: string | null;
  last_interaction_at: string | null;
  updated_at: string | null;
  created_at: string | null;
}

export interface AgencyAgingStageSummary {
  key: LeadStatus;
  count: number;
  avg_age_days: number | null;
  max_age_days: number | null;
  aged_count: number;
  critical_count: number;
}

export type AgencyAgingBottleneckStage = LeadStatus | "none";

export interface AgencyAgingSummary {
  total_leads: number;
  average_age_days: number | null;
  max_age_days: number | null;
  aged_count: number;
  critical_count: number;
  stage_summaries: AgencyAgingStageSummary[];
  bottleneck_stage: AgencyAgingBottleneckStage;
  bottleneck_label: string;
  bottleneck_action: string;
  bottleneck_age_days: number | null;
  bottleneck_aged_count: number;
  state_label: string;
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveAgingReferenceAt(row: AgencyAgingLeadLike) {
  const candidates = [row.last_interaction_at, row.updated_at, row.created_at];

  for (const candidate of candidates) {
    const normalized = normalize(candidate);
    if (!normalized) {
      continue;
    }

    const timestamp = new Date(normalized).getTime();
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }

  return null;
}

function formatCount(value: number) {
  return value.toLocaleString("pt-BR");
}

function formatAgeDays(value: number | null) {
  if (value === null) {
    return "Sem dados";
  }

  return `${Math.round(value)}d`;
}

function createEmptyStageSummary(key: LeadStatus): AgencyAgingStageSummary {
  return {
    key,
    count: 0,
    avg_age_days: null,
    max_age_days: null,
    aged_count: 0,
    critical_count: 0,
  };
}

function sortStageSummary(left: AgencyAgingStageSummary, right: AgencyAgingStageSummary) {
  const byCritical = right.critical_count - left.critical_count;
  if (byCritical !== 0) return byCritical;

  const byAged = right.aged_count - left.aged_count;
  if (byAged !== 0) return byAged;

  const leftAvg = left.avg_age_days || 0;
  const rightAvg = right.avg_age_days || 0;
  if (rightAvg !== leftAvg) return rightAvg - leftAvg;

  return LEAD_STATUSES.indexOf(right.key) - LEAD_STATUSES.indexOf(left.key);
}

export function buildOperationalAgingSummary(rows: AgencyAgingLeadLike[], now = new Date()): AgencyAgingSummary {
  const nowMs = now.getTime();
  const stageMap = new Map<LeadStatus, {
    count: number;
    totalAgeDays: number;
    maxAgeDays: number | null;
    agedCount: number;
    criticalCount: number;
  }>();

  let totalAgeDays = 0;
  let totalAgedLeads = 0;
  let totalCriticalLeads = 0;
  let totalLeadCount = 0;
  let maxAgeDays: number | null = null;

  for (const row of rows) {
    if (!isLeadStatus(row.status) || !AGING_PIPELINE_STATUSES.includes(row.status)) {
      continue;
    }

    const referenceAt = resolveAgingReferenceAt(row);
    if (referenceAt === null) {
      continue;
    }

    const ageDays = Math.max(0, (nowMs - referenceAt) / 86_400_000);
    const current = stageMap.get(row.status) || {
      count: 0,
      totalAgeDays: 0,
      maxAgeDays: null as number | null,
      agedCount: 0,
      criticalCount: 0,
    };

    current.count += 1;
    current.totalAgeDays += ageDays;
    current.maxAgeDays = current.maxAgeDays === null ? ageDays : Math.max(current.maxAgeDays, ageDays);
    current.agedCount += ageDays >= AGING_WARNING_DAYS ? 1 : 0;
    current.criticalCount += ageDays >= AGING_CRITICAL_DAYS ? 1 : 0;
    stageMap.set(row.status, current);

    totalAgeDays += ageDays;
    totalAgedLeads += ageDays >= AGING_WARNING_DAYS ? 1 : 0;
    totalCriticalLeads += ageDays >= AGING_CRITICAL_DAYS ? 1 : 0;
    totalLeadCount += 1;
    maxAgeDays = maxAgeDays === null ? ageDays : Math.max(maxAgeDays, ageDays);
  }

  const stageSummaries = LEAD_STATUSES
    .map((status) => {
      const current = stageMap.get(status) || null;
      if (!current) {
        return createEmptyStageSummary(status);
      }

      return {
        key: status,
        count: current.count,
        avg_age_days: current.count > 0 ? current.totalAgeDays / current.count : null,
        max_age_days: current.maxAgeDays,
        aged_count: current.agedCount,
        critical_count: current.criticalCount,
      };
    })
    .filter((row) => row.count > 0)
    .sort(sortStageSummary);

  const bottleneck = stageSummaries[0] || null;

  const labelByStage: Record<LeadStatus, string> = {
    new: "new envelhecido",
    engaged: "engaged parado",
    qualified: "qualified envelhecido",
    offer_sent: "offer_sent parado",
    closing: "closing lento",
    won: "won",
    lost: "lost",
  };

  const actionByStage: Record<LeadStatus, string> = {
    new: "Disparar o primeiro avanço deste lead.",
    engaged: "Qualificar o lead e empurrar para oferta.",
    qualified: "Revisar o avanço para oferta enviada.",
    offer_sent: "Acionar follow-up para transformar oferta em closing.",
    closing: "Revisar o fechamento e destravar a decisão.",
    won: "Sem ação de aging.",
    lost: "Sem ação de aging.",
  };

  const bottleneckStage = bottleneck?.key || "none";

  return {
    total_leads: totalLeadCount,
    average_age_days: totalLeadCount > 0 ? totalAgeDays / totalLeadCount : null,
    max_age_days: maxAgeDays,
    aged_count: totalAgedLeads,
    critical_count: totalCriticalLeads,
    stage_summaries: stageSummaries,
    bottleneck_stage: bottleneckStage,
    bottleneck_label: bottleneck ? labelByStage[bottleneck.key] : totalLeadCount > 0 ? "pipeline recente" : "sem pipeline",
    bottleneck_action: bottleneck ? actionByStage[bottleneck.key] : "Sem aging relevante na janela atual.",
    bottleneck_age_days: bottleneck?.max_age_days ?? null,
    bottleneck_aged_count: bottleneck?.aged_count ?? 0,
    state_label: bottleneck
      ? `${labelByStage[bottleneck.key]} (${formatAgeDays(bottleneck.max_age_days)})`
      : totalLeadCount > 0
        ? "pipeline recente"
        : "sem pipeline",
  };
}

export function collectOperationalAgingSummary(summaries: AgencyAgingLeadLike[], now = new Date()) {
  return buildOperationalAgingSummary(summaries, now);
}

export function mergeOperationalAgingSummaries(summaries: AgencyAgingSummary[]): AgencyAgingSummary {
  const stageMap = new Map<LeadStatus, {
    count: number;
    totalAgeDays: number;
    maxAgeDays: number | null;
    agedCount: number;
    criticalCount: number;
  }>();

  let totalLeadCount = 0;
  let totalAgeDays = 0;
  let totalAgedLeads = 0;
  let totalCriticalLeads = 0;
  let maxAgeDays: number | null = null;

  for (const summary of summaries) {
    totalLeadCount += summary.total_leads;
    totalAgedLeads += summary.aged_count;
    totalCriticalLeads += summary.critical_count;
    if (summary.max_age_days !== null) {
      maxAgeDays = maxAgeDays === null ? summary.max_age_days : Math.max(maxAgeDays, summary.max_age_days);
    }
    if (summary.average_age_days !== null) {
      totalAgeDays += summary.average_age_days * summary.total_leads;
    }

    for (const stage of summary.stage_summaries) {
      const current = stageMap.get(stage.key) || {
        count: 0,
        totalAgeDays: 0,
        maxAgeDays: null as number | null,
        agedCount: 0,
        criticalCount: 0,
      };

      current.count += stage.count;
      if (stage.avg_age_days !== null) {
        current.totalAgeDays += stage.avg_age_days * stage.count;
      }
      current.maxAgeDays = current.maxAgeDays === null ? stage.max_age_days : Math.max(current.maxAgeDays, stage.max_age_days || 0);
      current.agedCount += stage.aged_count;
      current.criticalCount += stage.critical_count;
      stageMap.set(stage.key, current);
    }
  }

  const stageSummaries = LEAD_STATUSES
    .map((status) => {
      const current = stageMap.get(status) || null;
      if (!current || current.count <= 0) {
        return null;
      }

      return {
        key: status,
        count: current.count,
        avg_age_days: current.count > 0 ? current.totalAgeDays / current.count : null,
        max_age_days: current.maxAgeDays,
        aged_count: current.agedCount,
        critical_count: current.criticalCount,
      } satisfies AgencyAgingStageSummary;
    })
    .filter((value): value is AgencyAgingStageSummary => Boolean(value))
    .sort(sortStageSummary);

  const bottleneck = stageSummaries[0] || null;

  return {
    total_leads: totalLeadCount,
    average_age_days: totalLeadCount > 0 ? totalAgeDays / totalLeadCount : null,
    max_age_days: maxAgeDays,
    aged_count: totalAgedLeads,
    critical_count: totalCriticalLeads,
    stage_summaries: stageSummaries,
    bottleneck_stage: (bottleneck?.key || "none") as AgencyAgingBottleneckStage,
    bottleneck_label: bottleneck ? `${bottleneck.key} envelhecido` : totalLeadCount > 0 ? "pipeline recente" : "sem pipeline",
    bottleneck_action: bottleneck ? `Revisar o estágio ${bottleneck.key} com maior atraso.` : "Sem aging relevante na janela atual.",
    bottleneck_age_days: bottleneck?.max_age_days ?? null,
    bottleneck_aged_count: bottleneck?.aged_count ?? 0,
    state_label: bottleneck
      ? `${bottleneck.key} envelhecido (${formatAgeDays(bottleneck.max_age_days)})`
      : totalLeadCount > 0
        ? "pipeline recente"
        : "sem pipeline",
  };
}

export function formatOperationalAgeDays(value: number | null) {
  return formatAgeDays(value);
}

export function formatOperationalAgingCount(value: number) {
  return formatCount(value);
}
