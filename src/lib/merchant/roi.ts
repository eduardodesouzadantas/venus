import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface MerchantRoiMetrics {
  leadsGenerated: number;
  leadsConverted: number;
  campaignsExecuted: number;
  estimatedSalesImpact: number | null;
  estimatedRevenueRange: {
    low: number | null;
    high: number | null;
  };
  dataConfidence: "high" | "medium" | "low";
  notes: string[];
}

type MoneySampleRow = {
  sale_amount: number | string | null;
};

function toNumber(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.max(0, Math.round(value));
}

function calculateAverageSaleAmount(rows: MoneySampleRow[]) {
  const amounts = rows.map((row) => toNumber(row.sale_amount)).filter((value) => value > 0);
  if (amounts.length === 0) return null;

  const sum = amounts.reduce((acc, value) => acc + value, 0);
  return sum / amounts.length;
}

function buildRevenueRange(leadsConverted: number, averageOrderValue: number) {
  if (leadsConverted <= 0 || averageOrderValue <= 0) {
    return { low: null, high: null };
  }

  return {
    low: roundMoney(leadsConverted * averageOrderValue * 0.85),
    high: roundMoney(leadsConverted * averageOrderValue * 1.15),
  };
}

function buildEstimatedSalesImpact(leadsConverted: number, averageOrderValue: number, confidence: "high" | "medium" | "low") {
  if (leadsConverted <= 0 || averageOrderValue <= 0) {
    return null;
  }

  const confidenceMultiplier = confidence === "high" ? 1 : confidence === "medium" ? 0.92 : 0.82;
  return roundMoney(leadsConverted * averageOrderValue * confidenceMultiplier);
}

function buildConfidence(input: {
  leadsGenerated: number;
  leadsConverted: number;
  campaignsExecuted: number;
  averageOrderValue: number | null;
}) {
  if (input.leadsGenerated > 0 && input.leadsConverted > 0 && input.campaignsExecuted > 0 && input.averageOrderValue) {
    return "high" as const;
  }

  if (input.leadsGenerated > 0 || input.campaignsExecuted > 0 || input.averageOrderValue) {
    return "medium" as const;
  }

  return "low" as const;
}

export async function loadMerchantRoiMetrics(
  supabase: SupabaseClient,
  orgId: string
): Promise<MerchantRoiMetrics> {
  const windowDays = 30;
  const startOfWindow = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const [leadsResult, convertedLeadsResult, campaignsResult, salesResult] = await Promise.all([
    supabase
      .from("crm_leads")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("created_at", startOfWindow),
    supabase
      .from("crm_leads")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "won")
      .gte("updated_at", startOfWindow),
    supabase
      .from("campaign_logs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .not("sent_at", "is", null)
      .gte("sent_at", startOfWindow),
    supabase
      .from("commission_events")
      .select("sale_amount")
      .eq("org_id", orgId)
      .not("confirmed_at", "is", null)
      .gte("confirmed_at", startOfWindow)
      .limit(100),
  ]);

  const leadsGenerated = leadsResult.count ?? 0;
  const leadsConverted = convertedLeadsResult.count ?? 0;
  const campaignsExecuted = campaignsResult.count ?? 0;
  const averageOrderValue = calculateAverageSaleAmount((salesResult.data || []) as MoneySampleRow[]);
  const confidence = buildConfidence({
    leadsGenerated,
    leadsConverted,
    campaignsExecuted,
    averageOrderValue,
  });

  const estimatedSalesImpact =
    averageOrderValue === null ? null : buildEstimatedSalesImpact(leadsConverted, averageOrderValue, confidence);
  const estimatedRevenueRange =
    averageOrderValue === null ? { low: null, high: null } : buildRevenueRange(leadsConverted, averageOrderValue);

  const notes: string[] = [];
  notes.push("Leitura de 30 dias por tenant.");
  notes.push(`${leadsGenerated} lead(s) gerado(s) no CRM.`);
  notes.push(`${leadsConverted} lead(s) convertidos em ganho.`);
  notes.push(`${campaignsExecuted} campanha(s) executada(s) pelo motor.`); 

  if (averageOrderValue === null) {
    notes.push("Sem vendas confirmadas suficientes para estimar impacto financeiro com ticket real.");
  } else {
    notes.push(`Ticket médio observado: R$ ${Math.round(averageOrderValue).toLocaleString("pt-BR")}.`);
  }

  return {
    leadsGenerated,
    leadsConverted,
    campaignsExecuted,
    estimatedSalesImpact,
    estimatedRevenueRange,
    dataConfidence: confidence,
    notes,
  };
}
