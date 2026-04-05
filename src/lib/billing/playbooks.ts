import "server-only";

import type { AgencyGuidanceRow, OrgGuidanceSummary, RecommendedAction, GuidanceLevel } from "@/lib/billing/guidance";
import { listAgencyGuidanceRows } from "@/lib/billing/guidance";
import type { PlanTier } from "@/lib/billing/limits";
import type { AgencyBillingFilters } from "@/lib/billing";

export type OrgPlaybookActionKey =
  | "mark_monitoring"
  | "mark_operational_review"
  | "mark_upgrade_candidate"
  | "mark_anomaly_review";

export type PlaybookStepPriority = "low" | "medium" | "high";
export type PlaybookStepCategory = "billing" | "growth" | "whatsapp" | "catalog" | "leads" | "governance";
export type PlaybookStepActionType = "manual" | "assisted" | "automation";

export interface OrgPlaybookStep {
  id: string;
  label: string;
  description: string;
  priority: PlaybookStepPriority;
  category: PlaybookStepCategory;
  action_type: PlaybookStepActionType;
}

export interface OrgLightAutomation {
  id: string;
  label: string;
  description: string;
  enabled_by_default: false;
  safe: true;
  action_key: OrgPlaybookActionKey;
}

export interface OrgActionPlaybook {
  id: string;
  title: string;
  summary: string;
  trigger_reason: string;
  guidance_level: GuidanceLevel;
  recommended_action: RecommendedAction;
  suggested_plan_if_any: PlanTier | null;
  steps: OrgPlaybookStep[];
  light_automations: OrgLightAutomation[];
  next_review_window: string;
}

export interface OrgPlaybookSummary extends OrgActionPlaybook {
  trigger_categories: string[];
}

export interface AgencyPlaybookRow extends AgencyGuidanceRow {
  playbook_summary: OrgPlaybookSummary;
}

export interface OrgPlaybookActionMeta {
  action_key: OrgPlaybookActionKey;
  event_type: string;
  label: string;
  description: string;
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildStep(
  id: string,
  label: string,
  description: string,
  priority: PlaybookStepPriority,
  category: PlaybookStepCategory,
  action_type: PlaybookStepActionType
): OrgPlaybookStep {
  return {
    id,
    label,
    description,
    priority,
    category,
    action_type,
  };
}

function buildAutomation(
  id: string,
  label: string,
  description: string,
  action_key: OrgPlaybookActionKey
): OrgLightAutomation {
  return {
    id,
    label,
    description,
    action_key,
    enabled_by_default: false,
    safe: true,
  };
}

function titleForAction(action: RecommendedAction) {
  switch (action) {
    case "recommend_upgrade":
      return "Playbook de upgrade";
    case "review_plan":
      return "Revisão de plano";
    case "optimize_usage":
      return "Otimização operacional";
    case "investigate_anomaly":
      return "Investigação de anomalia";
    default:
      return "Monitoramento assistido";
  }
}

function nextReviewWindowForAction(action: RecommendedAction) {
  switch (action) {
    case "recommend_upgrade":
      return "Imediato";
    case "review_plan":
      return "3 a 7 dias";
    case "optimize_usage":
      return "7 dias";
    case "investigate_anomaly":
      return "24 a 72 horas";
    default:
      return "7 dias";
  }
}

function actionMeta(actionKey: OrgPlaybookActionKey): OrgPlaybookActionMeta {
  switch (actionKey) {
    case "mark_monitoring":
      return {
        action_key: actionKey,
        event_type: "agency.playbook_review_scheduled",
        label: "Marcar monitoramento",
        description: "Registra acompanhamento leve sem alterar status ou plano.",
      };
    case "mark_operational_review":
      return {
        action_key: actionKey,
        event_type: "agency.operational_review_marked",
        label: "Marcar revisão",
        description: "Registra revisão operacional assistida para a org.",
      };
    case "mark_upgrade_candidate":
      return {
        action_key: actionKey,
        event_type: "agency.upgrade_candidate_marked",
        label: "Marcar upgrade",
        description: "Registra a org como candidata a revisão de upgrade.",
      };
    case "mark_anomaly_review":
      return {
        action_key: actionKey,
        event_type: "agency.anomaly_investigation_marked",
        label: "Investigar",
        description: "Registra investigação operacional para sinais inconsistentes.",
      };
  }
}

export function getPlaybookActionMeta(actionKey: OrgPlaybookActionKey) {
  return actionMeta(actionKey);
}

export function isOrgPlaybookActionKey(value: string): value is OrgPlaybookActionKey {
  return value === "mark_monitoring" || value === "mark_operational_review" || value === "mark_upgrade_candidate" || value === "mark_anomaly_review";
}

export function getOrgPlaybookSummary(guidance: OrgGuidanceSummary): OrgPlaybookSummary {
  const triggerCategories = guidance.trigger_categories.map((category) => normalize(category)).filter(Boolean);
  const action = guidance.recommended_action;
  const title = titleForAction(action);
  const nextReviewWindow = nextReviewWindowForAction(action);
  const primaryCategory = triggerCategories[0] || "governance";

  const stepsByAction: Record<RecommendedAction, OrgPlaybookStep[]> = {
    monitor: [
      buildStep("monitor-usage", "Monitorar 7 dias", "Acompanhar a evolução sem intervir no plano.", "high", "governance", "manual"),
      buildStep("review-trend", "Revisar tendência", "Comparar uso atual com o período anterior para validar ritmo.", "medium", "billing", "assisted"),
      buildStep("check-health", "Checar saúde", "Verificar se a org continua saudável antes de qualquer ação.", "low", "governance", "manual"),
    ],
    optimize_usage: [
      buildStep("check-funnel", "Revisar conversão", "Avaliar saved_results -> WhatsApp e o follow-up de leads.", "high", "leads", "assisted"),
      buildStep("catalog-mix", "Revisar catálogo", "Comparar produtos com tração vs. catálogo inchado.", "medium", "catalog", "assisted"),
      buildStep("operational-flag", "Marcar revisão operacional", "Abrir revisão leve para a equipe atuar no processo.", "medium", "governance", "automation"),
      buildStep("follow-up", "Aumentar follow-up", "Fortalecer contato comercial antes de trocar de plano.", "low", "whatsapp", "manual"),
    ],
    review_plan: [
      buildStep("compare-caps", "Comparar cap do plano", "Ver quais categorias pressionam mais o plano atual.", "high", "billing", "assisted"),
      buildStep("watch-window", "Acompanhar 7 dias", "Validar se a pressão se mantém antes de qualquer mudança.", "high", "governance", "manual"),
      buildStep("plan-review", "Marcar revisão de plano", "Registrar a org como candidata a revisão comercial.", "medium", "governance", "automation"),
    ],
    recommend_upgrade: [
      buildStep("show-plan", "Mostrar plano sugerido", "Destacar o próximo plano como resposta à pressão real.", "high", "billing", "assisted"),
      buildStep("pressure-categories", "Listar categorias pressionadas", "Explicitar os pontos que mais consomem o soft cap.", "high", "growth", "manual"),
      buildStep("upgrade-candidate", "Marcar upgrade candidate", "Registrar a org para abordagem comercial de upgrade.", "medium", "governance", "automation"),
      buildStep("commercial-approach", "Orientar abordagem comercial", "Apoiar contato consultivo sem bloquear a operação.", "medium", "growth", "manual"),
    ],
    investigate_anomaly: [
      buildStep("check-mismatch", "Checar descompasso", "Comparar saved_results, leads e WhatsApp para achar a ruptura.", "high", "leads", "assisted"),
      buildStep("inspect-handoff", "Inspecionar handoff", "Validar se o contexto do app chega corretamente ao WhatsApp.", "high", "whatsapp", "assisted"),
      buildStep("anomaly-flag", "Marcar investigação", "Registrar a org para análise operacional posterior.", "medium", "governance", "automation"),
      buildStep("review-feedback", "Revisar feedback", "Checar se o cliente está engajando com as sugestões.", "low", "growth", "manual"),
    ],
  };

  const automationsByAction: Record<RecommendedAction, OrgLightAutomation[]> = {
    monitor: [
      buildAutomation("monitoring", "Marcar monitoramento", "Registrar acompanhamento leve para revisão futura.", "mark_monitoring"),
    ],
    optimize_usage: [
      buildAutomation("operational-review", "Marcar revisão", "Registrar revisão operacional assistida.", "mark_operational_review"),
    ],
    review_plan: [
      buildAutomation("plan-review", "Marcar revisão", "Registrar a org como candidata a revisão de plano.", "mark_operational_review"),
      buildAutomation("monitoring", "Manter monitoramento", "Registrar acompanhamento leve antes de sugerir mudança.", "mark_monitoring"),
    ],
    recommend_upgrade: [
      buildAutomation("upgrade-candidate", "Marcar upgrade", "Registrar a org como candidata a upgrade.", "mark_upgrade_candidate"),
    ],
    investigate_anomaly: [
      buildAutomation("anomaly-review", "Investigar", "Registrar investigação operacional para sinais incoerentes.", "mark_anomaly_review"),
      buildAutomation("monitoring", "Manter monitoramento", "Registrar acompanhamento leve enquanto investiga.", "mark_monitoring"),
    ],
  };

  const summaryText =
    action === "recommend_upgrade"
      ? `A org está sob pressão real em ${triggerCategories.join(", ") || primaryCategory}, então o playbook orienta upgrade consultivo para aliviar o plano atual.`
      : action === "review_plan"
        ? `A org mostra pressão operacional em ${triggerCategories.join(", ") || primaryCategory}, então o playbook orienta revisão de plano antes de qualquer mudança.`
        : action === "optimize_usage"
          ? `O problema parece mais operacional do que estrutural, então o playbook prioriza otimização de conversão e follow-up.`
          : action === "investigate_anomaly"
            ? `Os sinais estão desalinhados, então o playbook pede investigação assistida do funil e do handoff.`
            : `A org está saudável o suficiente para monitoramento assistido, sem necessidade de ação agressiva no momento.`;

  return {
    id: `playbook:${action}:${guidance.org_id}`,
    title,
    summary: summaryText,
    trigger_reason: guidance.guidance_reason,
    guidance_level: guidance.guidance_level,
    recommended_action: action,
    suggested_plan_if_any: guidance.recommended_plan_if_any,
    steps: stepsByAction[action],
    light_automations: automationsByAction[action],
    next_review_window: nextReviewWindow,
    trigger_categories: triggerCategories,
  };
}

export async function listAgencyPlaybookRows(filters: AgencyBillingFilters = {}): Promise<AgencyPlaybookRow[]> {
  const rows = await listAgencyGuidanceRows(filters);
  return rows.map((row) => ({
    ...row,
    playbook_summary: getOrgPlaybookSummary(row.guidance_summary),
  }));
}
