import type { LeadStatus } from "@/lib/leads";

export interface AgencyValueLeadSummaryLike {
  total: number;
  by_status: Record<LeadStatus, number>;
}

export interface AgencyValueStageCounts {
  new: number;
  engaged: number;
  qualified: number;
  offer_sent: number;
  closing: number;
  won: number;
  lost: number;
}

export type AgencyValueBottleneckStage = "engaged" | "qualified" | "offer_sent" | "closing" | "none";

export interface AgencyValueSummary {
  total_leads: number;
  stage_counts: AgencyValueStageCounts;
  active_pipeline: number;
  advanced_pipeline: number;
  terminal_pipeline: number;
  pipeline_active_rate: number | null;
  advanced_pipeline_rate: number | null;
  terminal_rate: number | null;
  win_rate: number | null;
  bottleneck_stage: AgencyValueBottleneckStage;
  bottleneck_label: string;
  bottleneck_action: string;
  bottleneck_gap: number;
  state_label: string;
}

function createEmptyStageCounts(): AgencyValueStageCounts {
  return {
    new: 0,
    engaged: 0,
    qualified: 0,
    offer_sent: 0,
    closing: 0,
    won: 0,
    lost: 0,
  };
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCounts(summary: AgencyValueLeadSummaryLike): AgencyValueStageCounts {
  return {
    new: toNumber(summary.by_status.new),
    engaged: toNumber(summary.by_status.engaged),
    qualified: toNumber(summary.by_status.qualified),
    offer_sent: toNumber(summary.by_status.offer_sent),
    closing: toNumber(summary.by_status.closing),
    won: toNumber(summary.by_status.won),
    lost: toNumber(summary.by_status.lost),
  };
}

function formatCount(value: number) {
  return value.toLocaleString("pt-BR");
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "Sem dados";
  }

  return `${Math.round(value * 100)}%`;
}

function computeBottleneck(stageCounts: AgencyValueStageCounts) {
  const transitions = [
    {
      stage: "engaged" as const,
      gap: Math.max(stageCounts.engaged - stageCounts.qualified, 0),
      label: "muito lead engajado, pouca qualificação",
      action: "Qualificar mais leads antes de empurrar o pipeline.",
    },
    {
      stage: "qualified" as const,
      gap: Math.max(stageCounts.qualified - stageCounts.offer_sent, 0),
      label: "muito qualificado, pouca oferta",
      action: "Converter qualificação em oferta enviada.",
    },
    {
      stage: "offer_sent" as const,
      gap: Math.max(stageCounts.offer_sent - stageCounts.closing, 0),
      label: "muita oferta, pouco closing",
      action: "Transformar oferta em fechamento concreto.",
    },
    {
      stage: "closing" as const,
      gap: Math.max(stageCounts.closing - stageCounts.won, 0),
      label: "muito closing, pouco ganho",
      action: "Fechar mais oportunidades que já entraram em fechamento.",
    },
  ];

  const winner = transitions.reduce((current, candidate) => {
    if (candidate.gap > current.gap) {
      return candidate;
    }

    if (candidate.gap === current.gap && candidate.stage === "closing" && current.stage !== "closing") {
      return candidate;
    }

    return current;
  });

  if (winner.gap <= 0) {
    if (stageCounts.won > 0 || stageCounts.lost > 0) {
      return {
        stage: "none" as const,
        gap: 0,
        label: "pipeline fluindo",
        action: "Acompanhar a cadência atual e sustentar o fechamento.",
      };
    }

    if (stageCounts.engaged + stageCounts.qualified + stageCounts.offer_sent + stageCounts.closing > 0) {
      return {
        stage: "none" as const,
        gap: 0,
        label: "pipeline em formação",
        action: "Criar mais avanço até a primeira oferta ou fechamento.",
      };
    }

    return {
      stage: "none" as const,
      gap: 0,
      label: "sem pipeline ativo",
      action: "Gerar volume suficiente para formar pipeline.",
    };
  }

  return {
    stage: winner.stage,
    gap: winner.gap,
    label: winner.label,
    action: winner.action,
  };
}

export function buildOperationalValueSummary(summary: AgencyValueLeadSummaryLike): AgencyValueSummary {
  const stageCounts = normalizeCounts(summary);
  const total_leads = Math.max(0, Math.trunc(toNumber(summary.total)));
  const active_pipeline = stageCounts.engaged + stageCounts.qualified + stageCounts.offer_sent + stageCounts.closing;
  const advanced_pipeline = stageCounts.offer_sent + stageCounts.closing + stageCounts.won;
  const terminal_pipeline = stageCounts.won + stageCounts.lost;
  const closed_total = stageCounts.won + stageCounts.lost;
  const bottleneck = computeBottleneck(stageCounts);

  return {
    total_leads,
    stage_counts: stageCounts,
    active_pipeline,
    advanced_pipeline,
    terminal_pipeline,
    pipeline_active_rate: total_leads > 0 ? active_pipeline / total_leads : null,
    advanced_pipeline_rate: total_leads > 0 ? advanced_pipeline / total_leads : null,
    terminal_rate: total_leads > 0 ? terminal_pipeline / total_leads : null,
    win_rate: closed_total > 0 ? stageCounts.won / closed_total : null,
    bottleneck_stage: bottleneck.stage,
    bottleneck_label: bottleneck.label,
    bottleneck_action: bottleneck.action,
    bottleneck_gap: bottleneck.gap,
    state_label:
      bottleneck.stage === "none"
        ? bottleneck.label
        : `${bottleneck.label} (${formatCount(bottleneck.gap)} de gap)`,
  };
}

export function collectOperationalValueSummary(summaries: AgencyValueLeadSummaryLike[]): AgencyValueSummary {
  const totalLeads = summaries.reduce((acc, summary) => acc + toNumber(summary.total), 0);
  const stageCounts = summaries.reduce(
    (acc, summary) => {
      acc.new += toNumber(summary.by_status.new);
      acc.engaged += toNumber(summary.by_status.engaged);
      acc.qualified += toNumber(summary.by_status.qualified);
      acc.offer_sent += toNumber(summary.by_status.offer_sent);
      acc.closing += toNumber(summary.by_status.closing);
      acc.won += toNumber(summary.by_status.won);
      acc.lost += toNumber(summary.by_status.lost);
      return acc;
    }, createEmptyStageCounts()
  );

  return buildOperationalValueSummary({
    total: totalLeads,
    by_status: stageCounts,
  });
}

export function formatOperationalValueRate(value: number | null) {
  return formatPercent(value);
}
