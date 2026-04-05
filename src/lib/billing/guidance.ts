import "server-only";

import { listAgencyBillingRows, type AgencyBillingRow } from "@/lib/billing";
import {
  type OrgAlertStatus,
  type PlanTier,
  type SoftCapCategoryKey,
  type OrgSoftCapSummary,
} from "@/lib/billing/limits";

export type GuidanceLevel = "info" | "warning" | "critical";
export type RecommendedAction =
  | "monitor"
  | "optimize_usage"
  | "review_plan"
  | "recommend_upgrade"
  | "investigate_anomaly";
export type UpgradeSignal = "none" | "weak" | "moderate" | "strong";
export type OperationalSignal = "healthy" | "watch" | "overloaded" | "anomalous";

export interface OrgOperationalRecommendation {
  title: string;
  guidance_level: GuidanceLevel;
  recommended_action: RecommendedAction;
  guidance_reason: string;
  next_step: string;
  upgrade_signal: UpgradeSignal;
  operational_signal: OperationalSignal;
  recommended_plan_if_any: PlanTier | null;
  trigger_categories: SoftCapCategoryKey[];
}

export interface OrgGuidanceSummary {
  org_id: string;
  plan_id: string | null;
  status: string;
  kill_switch: boolean;
  guidance_level: GuidanceLevel;
  recommended_action: RecommendedAction;
  recommended_plan_if_any: PlanTier | null;
  guidance_reason: string;
  next_step: string;
  upgrade_signal: UpgradeSignal;
  operational_signal: OperationalSignal;
  title: string;
  trigger_categories: SoftCapCategoryKey[];
  operational_recommendations: OrgOperationalRecommendation[];
}

export interface AgencyGuidanceRow extends AgencyBillingRow {
  guidance_summary: OrgGuidanceSummary;
}

const PLAN_ORDER: PlanTier[] = ["free", "starter", "growth", "scale", "enterprise"];

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function planTier(planId?: string | null): PlanTier {
  const normalized = normalize(planId).toLowerCase();
  if (normalized === "free") return "free";
  if (normalized === "starter") return "starter";
  if (normalized === "growth") return "growth";
  if (normalized === "scale") return "scale";
  if (normalized === "enterprise") return "enterprise";
  return "starter";
}

function nextPlanTier(currentPlan: PlanTier): PlanTier | null {
  const index = PLAN_ORDER.indexOf(currentPlan);
  if (index < 0 || index >= PLAN_ORDER.length - 1) return null;
  return PLAN_ORDER[index + 1] || null;
}

function formatPct(value: number | null) {
  if (value === null) return "sem base";
  return `${Math.round(value)}%`;
}

function categoriesInStatus(summary: OrgSoftCapSummary, status: OrgAlertStatus) {
  return summary.alerts.filter((alert) => alert.status === status).map((alert) => alert.key);
}

function alertTitle(action: RecommendedAction) {
  switch (action) {
    case "recommend_upgrade":
      return "Sugerir upgrade";
    case "review_plan":
      return "Revisar plano";
    case "optimize_usage":
      return "Otimizar uso";
    case "investigate_anomaly":
      return "Investigar anomalia";
    default:
      return "Monitorar";
  }
}

function normalizeSignal(value: number | null) {
  if (value === null) return "none" as const;
  if (value >= 90) return "strong" as const;
  if (value >= 70) return "moderate" as const;
  if (value > 0) return "weak" as const;
  return "none" as const;
}

function buildRecommendation(
  action: RecommendedAction,
  guidanceLevel: GuidanceLevel,
  upgradeSignal: UpgradeSignal,
  operationalSignal: OperationalSignal,
  reason: string,
  nextStep: string,
  triggerCategories: SoftCapCategoryKey[],
  recommendedPlanIfAny: PlanTier | null = null
): OrgOperationalRecommendation {
  return {
    title: alertTitle(action),
    guidance_level: guidanceLevel,
    recommended_action: action,
    guidance_reason: reason,
    next_step: nextStep,
    upgrade_signal: upgradeSignal,
    operational_signal: operationalSignal,
    recommended_plan_if_any: recommendedPlanIfAny,
    trigger_categories: triggerCategories,
  };
}

function buildGuidanceFromRow(row: AgencyBillingRow): OrgGuidanceSummary {
  const summary = row.soft_cap_summary;
  const currentPlan = planTier(row.plan_id);
  const nextPlan = nextPlanTier(currentPlan);
  const categories = summary.categories;
  const criticalCategories = categoriesInStatus(summary, "critical");
  const warningCategories = categoriesInStatus(summary, "warning");
  const missingData = !summary.has_data || summary.overall_status === "no_data";
  const productsPct = categories.products.usage_pct;
  const leadsPct = categories.leads.usage_pct;
  const savedResultsPct = categories.saved_results.usage_pct;
  const whatsappPct = categories.whatsapp_messages.usage_pct;
  const costTodayPct = categories.estimated_cost_today.usage_pct;
  const costTotalPct = categories.estimated_cost_total.usage_pct;
  const costCritical = categories.estimated_cost_today.status === "critical" || categories.estimated_cost_total.status === "critical";
  const productPressure = productsPct !== null && productsPct >= 70;
  const leadsPressure = leadsPct !== null && leadsPct >= 70;
  const savedPressure = savedResultsPct !== null && savedResultsPct >= 70;
  const whatsappPressure = whatsappPct !== null && whatsappPct < 50;
  const lowLeads = leadsPct !== null && leadsPct < 50;
  const lowWhatsapp = whatsappPct !== null && whatsappPct < 40;
  const highBillingPressure = row.billing_risk === "high" || costCritical;

  const operationalRecommendations: OrgOperationalRecommendation[] = [];

  if (row.status !== "active" || row.kill_switch) {
    operationalRecommendations.push(
      buildRecommendation(
        "monitor",
        "info",
        "none",
        "watch",
        "Org suspensa ou com kill switch ativo. Guidance de uso fica em observação até a reativação.",
        "Monitorar até reativação",
        []
      )
    );
  } else if (missingData) {
    operationalRecommendations.push(
      buildRecommendation(
        "monitor",
        "info",
        "none",
        "watch",
        "Dados insuficientes para recomendar mudança de plano ou ação operacional com segurança.",
        "Monitorar mais 7 dias",
        []
      )
    );
  } else {
    if (criticalCategories.length >= 2) {
      operationalRecommendations.push(
        buildRecommendation(
          "recommend_upgrade",
          "critical",
          "strong",
          "overloaded",
          `Múltiplas categorias críticas (${criticalCategories.join(", ")}). O plano atual já está sob pressão operacional.`,
          `Sugerir upgrade para ${nextPlan || currentPlan}`,
          criticalCategories,
          nextPlan
        )
      );
    } else if (costCritical && (currentPlan === "starter" || currentPlan === "growth")) {
      operationalRecommendations.push(
        buildRecommendation(
          "recommend_upgrade",
          "critical",
          "strong",
          "overloaded",
          `Custo estimado em zona crítica para o plano ${currentPlan}.`,
          `Sugerir upgrade para ${nextPlan || currentPlan}`,
          ["estimated_cost_today", "estimated_cost_total"],
          nextPlan
        )
      );
    } else if (productPressure && lowLeads) {
      operationalRecommendations.push(
        buildRecommendation(
          "optimize_usage",
          "warning",
          "weak",
          "watch",
          `Produtos em ${formatPct(productsPct)} do soft cap, mas leads ainda em ${formatPct(leadsPct)}. Antes de trocar de plano, vale otimizar a conversão comercial.`,
          "Aumentar conversão antes de trocar de plano",
          ["products", "leads"]
        )
      );
    } else if (leadsPressure && whatsappPressure) {
      operationalRecommendations.push(
        buildRecommendation(
          "optimize_usage",
          "warning",
          "weak",
          "watch",
          `Leads em ${formatPct(leadsPct)} do soft cap, mas WhatsApp ainda abaixo do ritmo esperado.`,
          "Aumentar follow-up comercial antes de trocar de plano",
          ["leads", "whatsapp_messages"]
        )
      );
    } else if (savedPressure && lowWhatsapp) {
      operationalRecommendations.push(
        buildRecommendation(
          "investigate_anomaly",
          "warning",
          "weak",
          "anomalous",
          `Saved results em ${formatPct(savedResultsPct)} do soft cap, mas o engajamento no WhatsApp segue baixo.`,
          "Investigar baixa conversão entre saved_results e WhatsApp",
          ["saved_results", "whatsapp_messages"]
        )
      );
    } else if (highBillingPressure && warningCategories.length > 0) {
      operationalRecommendations.push(
        buildRecommendation(
          "review_plan",
          "warning",
          "moderate",
          "watch",
          `Billing risk alto com categorias já em atenção (${warningCategories.join(", ")}).`,
          "Revisar plano em caso de manutenção do ritmo atual",
          warningCategories,
          nextPlan
        )
      );
    } else if (warningCategories.length > 0) {
      operationalRecommendations.push(
        buildRecommendation(
          "review_plan",
          "warning",
          "moderate",
          "watch",
          `Algumas categorias já estão próximas do soft cap (${warningCategories.join(", ")}).`,
          "Revisar plano em caso de manutenção do ritmo atual",
          warningCategories,
          nextPlan
        )
      );
    } else {
      operationalRecommendations.push(
        buildRecommendation(
          "monitor",
          "info",
          normalizeSignal(costTodayPct || costTotalPct),
          "healthy",
          "Uso saudável e abaixo dos soft caps relevantes.",
          "Monitorar mais 7 dias",
          []
        )
      );
    }
  }

  const primary = operationalRecommendations[0] || buildRecommendation(
    "monitor",
    "info",
    "none",
    "watch",
    "Sem guidance suficiente para orientar mudança de plano ou operação.",
    "Monitorar mais 7 dias",
    []
  );

  const suggestedPlan =
    primary.recommended_action === "recommend_upgrade" || primary.recommended_action === "review_plan"
      ? primary.recommended_plan_if_any
      : null;

  const guidanceLevel =
    primary.guidance_level === "critical" || primary.operational_signal === "overloaded"
      ? "critical"
      : primary.guidance_level === "warning" || primary.operational_signal === "watch" || primary.operational_signal === "anomalous"
        ? "warning"
        : "info";

  return {
    org_id: row.id,
    plan_id: row.plan_id || null,
    status: row.status,
    kill_switch: row.kill_switch,
    guidance_level: guidanceLevel,
    recommended_action: primary.recommended_action,
    recommended_plan_if_any: suggestedPlan,
    guidance_reason: primary.guidance_reason,
    next_step: primary.next_step,
    upgrade_signal: primary.upgrade_signal,
    operational_signal: primary.operational_signal,
    title: primary.title,
    trigger_categories: primary.trigger_categories,
    operational_recommendations: operationalRecommendations,
  };
}

export function getOrgGuidanceSummary(row: AgencyBillingRow): OrgGuidanceSummary {
  return buildGuidanceFromRow(row);
}

export async function getOrgGuidanceSummaryByOrgId(orgId: string): Promise<OrgGuidanceSummary | null> {
  const rows = await listAgencyBillingRows();
  const row = rows.find((item) => item.id === normalize(orgId));
  if (!row) return null;
  return buildGuidanceFromRow(row);
}

export async function listAgencyGuidanceRows(): Promise<AgencyGuidanceRow[]> {
  const rows = await listAgencyBillingRows();
  return rows.map((row) => ({
    ...row,
    guidance_summary: buildGuidanceFromRow(row),
  }));
}
