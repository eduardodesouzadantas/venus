import "server-only";

export type PlanTier = "free" | "starter" | "growth" | "scale" | "enterprise";
export type OrgAlertStatus = "ok" | "warning" | "critical" | "no_data";
export type OrgUsageHealth = "low" | "medium" | "high";
export type OrgBillingRisk = "low" | "medium" | "high";

export type SoftCapCategoryKey =
  | "saved_results"
  | "leads"
  | "products"
  | "whatsapp_messages"
  | "estimated_cost_today"
  | "estimated_cost_total";

export interface PlanSoftCaps {
  saved_results: number;
  leads: number;
  products: number;
  whatsapp_messages: number;
  estimated_cost_today_cents: number;
  estimated_cost_total_cents: number;
}

export interface OrgSoftCapUsageInput {
  plan_id?: string | null;
  saved_results: number;
  leads: number;
  products: number;
  whatsapp_messages: number | null;
  estimated_cost_today_cents: number;
  estimated_cost_total_cents: number;
}

export interface OrgUsageAlert {
  key: SoftCapCategoryKey;
  label: string;
  usage: number | null;
  cap: number | null;
  usage_pct: number | null;
  status: OrgAlertStatus;
  message: string;
}

export interface OrgSoftCapSummary {
  plan_id: string | null;
  plan_tier: PlanTier;
  plan_soft_caps: PlanSoftCaps;
  categories: Record<SoftCapCategoryKey, OrgUsageAlert>;
  alerts: OrgUsageAlert[];
  top_alerts: OrgUsageAlert[];
  overall_status: OrgAlertStatus;
  usage_health: OrgUsageHealth;
  billing_risk: OrgBillingRisk;
  has_data: boolean;
  warning_count: number;
  critical_count: number;
}

export interface OrgSoftCapRow extends OrgSoftCapUsageInput {
  org_id: string;
  org_name?: string | null;
  slug?: string | null;
}

export interface AgencyOperationalAlertRow extends OrgSoftCapRow {
  soft_cap_summary: OrgSoftCapSummary;
}

const PLAN_SOFT_CAPS: Record<PlanTier, PlanSoftCaps> = {
  free: {
    saved_results: 10,
    leads: 5,
    products: 20,
    whatsapp_messages: 50,
    estimated_cost_today_cents: 100,
    estimated_cost_total_cents: 1_000,
  },
  starter: {
    saved_results: 40,
    leads: 20,
    products: 100,
    whatsapp_messages: 250,
    estimated_cost_today_cents: 300,
    estimated_cost_total_cents: 9_000,
  },
  growth: {
    saved_results: 150,
    leads: 80,
    products: 300,
    whatsapp_messages: 800,
    estimated_cost_today_cents: 1_000,
    estimated_cost_total_cents: 30_000,
  },
  scale: {
    saved_results: 300,
    leads: 150,
    products: 600,
    whatsapp_messages: 1_500,
    estimated_cost_today_cents: 2_500,
    estimated_cost_total_cents: 75_000,
  },
  enterprise: {
    saved_results: 1_000,
    leads: 500,
    products: 2_000,
    whatsapp_messages: 5_000,
    estimated_cost_today_cents: 6_000,
    estimated_cost_total_cents: 200_000,
  },
};

const CATEGORY_LABELS: Record<SoftCapCategoryKey, string> = {
  saved_results: "Saved results",
  leads: "Leads",
  products: "Produtos",
  whatsapp_messages: "WhatsApp",
  estimated_cost_today: "Custo hoje",
  estimated_cost_total: "Custo total",
};

const CATEGORY_ORDER: SoftCapCategoryKey[] = [
  "estimated_cost_today",
  "estimated_cost_total",
  "products",
  "saved_results",
  "leads",
  "whatsapp_messages",
];

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePlanTier(planId?: string | null): PlanTier {
  const normalized = normalize(planId).toLowerCase();
  if (normalized === "freemium") return "free";
  if (normalized === "free") return "free";
  if (normalized === "starter") return "starter";
  if (normalized === "pro") return "growth";
  if (normalized === "growth") return "growth";
  if (normalized === "scale") return "scale";
  if (normalized === "enterprise") return "enterprise";
  return "starter";
}

function computeUsagePct(usage: number | null, cap: number | null) {
  if (usage === null || cap === null || cap <= 0) return null;
  return (usage / cap) * 100;
}

function statusFromUsagePct(usagePct: number | null, usage: number | null, cap: number | null): OrgAlertStatus {
  if (usagePct === null || usage === null || cap === null || cap <= 0) {
    return "no_data";
  }

  if (usagePct >= 90 || usage >= cap) return "critical";
  if (usagePct >= 70) return "warning";
  return "ok";
}

function statusRank(status: OrgAlertStatus) {
  switch (status) {
    case "critical":
      return 3;
    case "warning":
      return 2;
    case "ok":
      return 1;
    default:
      return 0;
  }
}

function statusToHealth(status: OrgAlertStatus): OrgUsageHealth {
  if (status === "critical") return "high";
  if (status === "warning") return "medium";
  return "low";
}

function formatPercent(value: number | null) {
  if (value === null) return null;
  return `${Math.round(value)}%`;
}

function buildAlert(
  key: SoftCapCategoryKey,
  usage: number | null,
  cap: number | null,
  statusOverride?: OrgAlertStatus
): OrgUsageAlert {
  const usagePct = computeUsagePct(usage, cap);
  const status = statusOverride || statusFromUsagePct(usagePct, usage, cap);
  const label = CATEGORY_LABELS[key];

  if (status === "no_data") {
    return {
      key,
      label,
      usage,
      cap,
      usage_pct: usagePct,
      status,
      message: "Sem dados para avaliar este indicador.",
    };
  }

  const pctText = formatPercent(usagePct) || "0%";
  const usageText = usage === null ? "Sem dados" : usage.toLocaleString("pt-BR");
  const capText = cap === null ? "Sem dados" : cap.toLocaleString("pt-BR");
  const message =
    status === "critical"
      ? `${usageText} de ${capText} (${pctText}) - acima do soft cap.`
      : `${usageText} de ${capText} (${pctText}) do soft cap.`;

  return {
    key,
    label,
    usage,
    cap,
    usage_pct: usagePct,
    status,
    message,
  };
}

function pickTopAlerts(alerts: OrgUsageAlert[]) {
  return [...alerts]
    .filter((alert) => alert.status !== "no_data")
    .sort((left, right) => {
      const byStatus = statusRank(right.status) - statusRank(left.status);
      if (byStatus !== 0) return byStatus;
      const leftPct = left.usage_pct || 0;
      const rightPct = right.usage_pct || 0;
      return rightPct - leftPct;
    });
}

function overallStatusFromAlerts(alerts: OrgUsageAlert[]) {
  const ranked = alerts.map((alert) => alert.status).filter((status) => status !== "no_data");
  if (ranked.length === 0) return "no_data" as const;
  if (ranked.some((status) => status === "critical")) return "critical" as const;
  if (ranked.some((status) => status === "warning")) return "warning" as const;
  return "ok" as const;
}

export function getPlanSoftCaps(planId?: string | null): PlanSoftCaps {
  const tier = normalizePlanTier(planId);
  return PLAN_SOFT_CAPS[tier];
}

export function buildOrgSoftCapSummary(input: OrgSoftCapUsageInput): OrgSoftCapSummary {
  const planTier = normalizePlanTier(input.plan_id);
  const planSoftCaps = getPlanSoftCaps(planTier);
  const usageHealthKeys: SoftCapCategoryKey[] = [
    "saved_results",
    "leads",
    "products",
    "whatsapp_messages",
    "estimated_cost_today",
  ];
  const billingRiskKeys: SoftCapCategoryKey[] = ["estimated_cost_today", "estimated_cost_total"];

  const categories = {
    saved_results: buildAlert("saved_results", input.saved_results, planSoftCaps.saved_results),
    leads: buildAlert("leads", input.leads, planSoftCaps.leads),
    products: buildAlert("products", input.products, planSoftCaps.products),
    whatsapp_messages: buildAlert(
      "whatsapp_messages",
      input.whatsapp_messages,
      planSoftCaps.whatsapp_messages
    ),
    estimated_cost_today: buildAlert(
      "estimated_cost_today",
      input.estimated_cost_today_cents,
      planSoftCaps.estimated_cost_today_cents
    ),
    estimated_cost_total: buildAlert(
      "estimated_cost_total",
      input.estimated_cost_total_cents,
      planSoftCaps.estimated_cost_total_cents
    ),
  } satisfies Record<SoftCapCategoryKey, OrgUsageAlert>;

  const alerts = CATEGORY_ORDER.map((key) => categories[key]);
  const topAlerts = pickTopAlerts(alerts);
  const overallStatus = overallStatusFromAlerts(alerts);
  const usageHealth = statusToHealth(
    usageHealthKeys.reduce<OrgAlertStatus>(
      (current, key) => {
        const next = categories[key].status;
        if (statusRank(next) > statusRank(current)) return next;
        return current;
      },
      "no_data"
    )
  );
  const billingRisk = statusToHealth(
    billingRiskKeys.reduce<OrgAlertStatus>(
      (current, key) => {
        const next = categories[key].status;
        if (statusRank(next) > statusRank(current)) return next;
        return current;
      },
      "no_data"
    )
  );
  const hasData = alerts.some((alert) => alert.status !== "no_data");
  const warningCount = alerts.filter((alert) => alert.status === "warning").length;
  const criticalCount = alerts.filter((alert) => alert.status === "critical").length;

  return {
    plan_id: input.plan_id || null,
    plan_tier: planTier,
    plan_soft_caps: planSoftCaps,
    categories,
    alerts,
    top_alerts: topAlerts,
    overall_status: overallStatus,
    usage_health: usageHealth,
    billing_risk: billingRisk,
    has_data: hasData,
    warning_count: warningCount,
    critical_count: criticalCount,
  };
}

export function getOrgSoftCapStatus(input: OrgSoftCapUsageInput) {
  return buildOrgSoftCapSummary(input);
}

export function listAgencyOperationalAlerts(rows: OrgSoftCapRow[]): AgencyOperationalAlertRow[] {
  return rows.map((row) => ({
    ...row,
    soft_cap_summary: buildOrgSoftCapSummary(row),
  }));
}
