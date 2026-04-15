import "server-only";

import type { PolicyRule, PolicyCondition, TenantMetrics, AdjustmentAction } from "./types";

const DEFAULT_POLICY_RULES: PolicyRule[] = [
  {
    id: "margin_negative",
    name: "Margem Negativa",
    conditions: [{ metric: "margin_percent", operator: "lt", value: 0 }],
    action: "reduce_limits",
    factor: 0.7,
    priority: 100,
    description: "Reduzir limites quando margem está negativa",
  },
  {
    id: "margin_low",
    name: "Margem Baixa",
    conditions: [
      { metric: "margin_percent", operator: "gte", value: 0 },
      { metric: "margin_percent", operator: "lt", value: 10 },
    ],
    action: "reduce_limits",
    factor: 0.85,
    priority: 90,
    description: "Reduzir limites moderadamente com margem baixa",
  },
  {
    id: "margin_healthy",
    name: "Margem Saudável",
    conditions: [
      { metric: "margin_percent", operator: "gte", value: 10 },
      { metric: "margin_percent", operator: "lt", value: 30 },
    ],
    action: "maintain",
    factor: 1.0,
    priority: 50,
    description: "Manter limites com margem estável",
  },
  {
    id: "margin_high",
    name: "Margem Alta",
    conditions: [{ metric: "margin_percent", operator: "gte", value: 30 }],
    action: "increase_limits",
    factor: 1.2,
    priority: 40,
    description: "Aumentar limites com margem alta",
  },
  {
    id: "roi_high",
    name: "ROI Alto",
    conditions: [{ metric: "roi", operator: "gte", value: 3 }],
    action: "increase_limits",
    factor: 1.15,
    priority: 45,
    description: "Aumentar limites para tenants com alto ROI",
  },
  {
    id: "roi_low",
    name: "ROI Baixo",
    conditions: [
      { metric: "roi", operator: "gt", value: 0 },
      { metric: "roi", operator: "lt", value: 1 },
    ],
    action: "reduce_limits",
    factor: 0.8,
    priority: 85,
    description: "Reduzir limites com ROI baixo",
  },
  {
    id: "usage_critical",
    name: "Uso Crítico",
    conditions: [{ metric: "usage_pct", operator: "gte", value: 95 }],
    action: "throttle",
    factor: 0.5,
    priority: 95,
    description: "Throttle agressivo quando uso supera 95%",
  },
  {
    id: "usage_accelerating",
    name: "Uso Acelerado",
    conditions: [{ metric: "usage_pct", operator: "gte", value: 80 }],
    action: "throttle",
    factor: 0.9,
    priority: 80,
    description: "Throttle quando uso está acima de 80%",
  },
  {
    id: "risk_critical",
    name: "Risco Crítico",
    conditions: [{ metric: "risk", operator: "eq", value: 2 }],
    action: "emergency_reduce",
    factor: 0.5,
    priority: 99,
    description: "Redução de emergência para risco crítico",
  },
  {
    id: "risk_attention",
    name: "Atenção",
    conditions: [{ metric: "risk", operator: "eq", value: 1 }],
    action: "throttle",
    factor: 0.8,
    priority: 75,
    description: "Throttle para risco em atenção",
  },
];

export function getPolicyRules(): PolicyRule[] {
  return [...DEFAULT_POLICY_RULES].sort((a, b) => b.priority - a.priority);
}

export function evaluateCondition(
  metric: "margin_percent" | "roi" | "usage_pct" | "risk",
  operator: "lt" | "lte" | "gt" | "gte" | "eq" | "ne",
  value: number,
  metrics: TenantMetrics
): boolean {
  let actualValue: number;

  switch (metric) {
    case "margin_percent":
      actualValue = metrics.margin_percent;
      break;
    case "roi":
      actualValue = metrics.roi;
      break;
    case "usage_pct":
      const avgUsagePct = Object.values(metrics.usage_pct).reduce((sum, v) => sum + v, 0) / Math.max(1, Object.keys(metrics.usage_pct).length);
      actualValue = avgUsagePct;
      break;
    case "risk":
      actualValue = metrics.risk === "critical" ? 2 : metrics.risk === "attention" ? 1 : 0;
      break;
    default:
      return false;
  }

  switch (operator) {
    case "lt":
      return actualValue < value;
    case "lte":
      return actualValue <= value;
    case "gt":
      return actualValue > value;
    case "gte":
      return actualValue >= value;
    case "eq":
      return actualValue === value;
    case "ne":
      return actualValue !== value;
    default:
      return false;
  }
}

export function matchRule(rule: PolicyRule, metrics: TenantMetrics): boolean {
  return rule.conditions.every((condition) => evaluateCondition(condition.metric, condition.operator, condition.value, metrics));
}

export function selectBestRule(metrics: TenantMetrics): PolicyRule | null {
  const rules = getPolicyRules();

  for (const rule of rules) {
    if (matchRule(rule, metrics)) {
      return rule;
    }
  }

  return null;
}

export function applyAdjustmentAction(
  currentLimit: number,
  action: AdjustmentAction,
  factor: number,
  maxGlobalLimit: number,
  minLimit: number = 10
): number {
  let newLimit: number;

  switch (action) {
    case "increase_limits":
      newLimit = Math.floor(currentLimit * factor);
      break;
    case "reduce_limits":
    case "throttle":
    case "emergency_reduce":
      newLimit = Math.floor(currentLimit * factor);
      break;
    case "maintain":
    default:
      newLimit = currentLimit;
      break;
  }

  return Math.max(minLimit, Math.min(newLimit, maxGlobalLimit));
}

export function conditionsToLabels(conditions: PolicyRule["conditions"]): string[] {
  return conditions.map((c) => {
    const opMap: Record<string, string> = {
      lt: "<",
      lte: "<=",
      gt: ">",
      gte: ">=",
      eq: "=",
      ne: "!=",
    };
    return `${c.metric} ${opMap[c.operator]} ${c.value}`;
  });
}