import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ShieldCheck, Users, DollarSign, Zap, HeartPulse, MessageSquare, AlertCircle, RefreshCw, CircleDashed } from "lucide-react";

import { GlassContainer } from "@/components/ui/GlassContainer";
import { Heading } from "@/components/ui/Heading";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { AgencyTelemetryPanel } from "@/components/agency/AgencyTelemetryPanel";
import { MerchantProvisionCard } from "@/components/agency/MerchantProvisionCard";
import { getAgencyOperationalFrictionSummary, listAgencyOrgRows, type AgencyOrgRow } from "@/lib/agency";
import {
  buildAgencyOperationalRecommendations,
  formatOperationalPriorityLabel,
} from "@/lib/agency/operational-recommendations";
import {
  collectOperationalValueSummary,
  formatOperationalValueRate,
} from "@/lib/agency/value-summary";
import {
  formatOperationalAgeDays,
  mergeOperationalAgingSummaries,
} from "@/lib/agency/aging-summary";
import { LEAD_STATUSES, getLeadStatusLabel, type LeadStatus } from "@/lib/leads";
import { createClient } from "@/lib/supabase/server";
import { isAgencyRole, isMerchantRole, resolveTenantContext } from "@/lib/tenant/core";
import { listAgencyPlaybookRows, type AgencyPlaybookRow } from "@/lib/billing/playbooks";
import { normalizeAgencyTimeRange } from "@/lib/agency/time-range";
import { buildAgencyOrgDetailHref } from "@/lib/agency/navigation";

export const dynamic = "force-dynamic";

function formatCount(value: number | null) {
  if (value === null) return "Sem dados";
  return value.toLocaleString("pt-BR");
}

function formatDate(value: string | null) {
  if (!value) return "Sem dados";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function badgeClasses(kind: "active" | "suspended" | "blocked" | "plan" | "kill" | "neutral" | "warning" | "critical" | "ok") {
  switch (kind) {
    case "active":
      return "bg-green-500/10 text-green-400 border-green-500/20";
    case "suspended":
      return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20";
    case "blocked":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "kill":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "warning":
      return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20";
    case "critical":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "ok":
      return "bg-green-500/10 text-green-400 border-green-500/20";
    case "plan":
      return "bg-white/5 text-white/70 border-white/10";
    default:
      return "bg-white/5 text-white/50 border-white/10";
  }
}

function getStatusKind(row: AgencyPlaybookRow) {
  if (row.status === "blocked") return "blocked";
  if (row.status === "suspended") return "suspended";
  if (row.kill_switch) return "blocked";
  return "active";
}

function metricValue(value: number | null) {
  return value === null ? "Sem dados" : value.toLocaleString("pt-BR");
}

function formatDurationMs(value: number | null) {
  if (value === null) return "Sem dados";
  return `${Math.round(value).toLocaleString("pt-BR")}ms`;
}

function softCapKind(status: "ok" | "warning" | "critical" | "no_data") {
  if (status === "critical") return "critical";
  if (status === "warning") return "warning";
  if (status === "ok") return "ok";
  return "neutral";
}

function softCapLabel(status: "ok" | "warning" | "critical" | "no_data") {
  if (status === "critical") return "Crítico";
  if (status === "warning") return "Atenção";
  if (status === "ok") return "Saudável";
  return "Sem dados";
}

function softCapChipText(label: string, usage: number | null, cap: number | null, pct: number | null) {
  const usageText = usage === null ? "Sem dados" : usage.toLocaleString("pt-BR");
  const capText = cap === null ? "Sem dados" : cap.toLocaleString("pt-BR");
  const pctText = pct === null ? "sem base" : `${Math.round(pct)}%`;
  return `${label}: ${usageText}/${capText} (${pctText})`;
}

function leadRiskKind(overdue: number, withoutFollowUp: number) {
  if (overdue > 0) return "critical";
  if (withoutFollowUp > 0) return "warning";
  return "ok";
}

function formatPipelineCounts(row: AgencyOrgLeadRowLike) {
  const counts = row.lead_summary.by_status;
  const pipelineLabels: Record<LeadStatus, string> = {
    new: "Novo",
    engaged: "Em conversa",
    qualified: "Qualificado",
    offer_sent: "Proposta enviada",
    closing: "Fechamento",
    won: "Ganho",
    lost: "Perdido",
  };

  return LEAD_STATUSES.map((status) => `${pipelineLabels[status]} ${counts[status]}`).join(" · ");
}

type AgencyOrgLeadRowLike = {
  lead_summary: {
    total: number;
    by_status: Record<LeadStatus, number>;
    followup_overdue: number;
    followup_today: number;
    followup_upcoming: number;
    followup_without: number;
  };
};

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function buildHref(pathname: string, params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export default async function AgencyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const context = resolveTenantContext(user);

  if (!user) {
    redirect("/login");
  }

  if (context.role && isMerchantRole(context.role)) {
    redirect("/merchant");
  }

  if (!context.role || !isAgencyRole(context.role)) {
    redirect("/login");
  }

  const resolved = await searchParams;
  const range = normalizeAgencyTimeRange(firstValue(resolved.range), "all");
  const themeMode = firstValue(resolved.theme) === "light" ? "light" : "dark";
  const isLight = themeMode === "light";

  let playbookRows: AgencyPlaybookRow[] = [];
  let orgRows: AgencyOrgRow[] = [];
  let operationalSummary = null as Awaited<ReturnType<typeof getAgencyOperationalFrictionSummary>> | null;
  try {
    [playbookRows, orgRows, operationalSummary] = await Promise.all([
      listAgencyPlaybookRows(),
      listAgencyOrgRows(),
      getAgencyOperationalFrictionSummary(range),
    ]);
  } catch (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full space-y-6">
          <div className="p-8 rounded-[40px] bg-red-500/10 border border-red-500/20 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <Heading as="h1" className="text-xl tracking-tight">Painel da agência indisponível</Heading>
            </div>
            <Text className="text-sm text-white/70">
              Não foi possível carregar as lojas reais no momento.
            </Text>
            <Text className="text-[10px] text-white/40 break-all">
              {error instanceof Error ? error.message : "Erro desconhecido"}
            </Text>
            <Link href="/login">
              <VenusButton variant="outline" className="w-full mt-4">
                Voltar ao login
              </VenusButton>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const orgRowsById = new Map(orgRows.map((row) => [row.id, row]));
  const orgs = playbookRows.map((row) => ({ ...row, ...(orgRowsById.get(row.id) || {}) }));
  const orgNameById = new Map(orgs.map((row) => [row.id, row.name]));
  const totalOrgs = orgs.length;
  const activeOrgs = orgs.filter((org) => org.status === "active" && !org.kill_switch).length;
  const suspendedOrBlocked = orgs.filter((org) => org.status !== "active" || org.kill_switch).length;
  const killSwitchOn = orgs.filter((org) => org.kill_switch).length;
  const totalProducts = orgs.reduce((sum, org) => sum + org.total_products, 0);
  const totalLeads = orgs.reduce((sum, org) => sum + org.total_leads, 0);
  const totalSavedResults = orgs.reduce((sum, org) => sum + org.total_saved_results, 0);
  const totalLeadOverdue = orgs.reduce((sum, org) => sum + org.lead_summary.followup_overdue, 0);
  const totalLeadWithoutFollowUp = orgs.reduce((sum, org) => sum + org.lead_summary.followup_without, 0);
  const orgsWithLeadRisk = orgs.filter((org) => org.lead_summary.followup_overdue > 0 || org.lead_summary.followup_without > 0).length;
  const criticalLeadOrgs = [...orgs]
    .filter((org) => org.lead_summary.followup_overdue > 0)
    .sort((left, right) => {
      const byOverdue = right.lead_summary.followup_overdue - left.lead_summary.followup_overdue;
      if (byOverdue !== 0) return byOverdue;
      const byWithout = right.lead_summary.followup_without - left.lead_summary.followup_without;
      if (byWithout !== 0) return byWithout;
      return right.lead_summary.total - left.lead_summary.total;
    })
    .slice(0, 4);
  const withoutFollowUpUrgentOrgs = [...orgs]
    .filter((org) => org.lead_summary.followup_overdue === 0 && org.lead_summary.followup_without > 0)
    .sort((left, right) => {
      const byWithout = right.lead_summary.followup_without - left.lead_summary.followup_without;
      if (byWithout !== 0) return byWithout;
      const byTotal = right.lead_summary.total - left.lead_summary.total;
      if (byTotal !== 0) return byTotal;
      return (
        right.lead_summary.by_status.engaged +
        right.lead_summary.by_status.qualified +
        right.lead_summary.by_status.offer_sent +
        right.lead_summary.by_status.closing -
        (left.lead_summary.by_status.engaged + left.lead_summary.by_status.qualified + left.lead_summary.by_status.offer_sent + left.lead_summary.by_status.closing)
      );
    })
    .slice(0, 4);
  const leadRiskOrgs = [...orgs]
    .sort((left, right) => {
      const byOverdue = right.lead_summary.followup_overdue - left.lead_summary.followup_overdue;
      if (byOverdue !== 0) return byOverdue;
      const byWithout = right.lead_summary.followup_without - left.lead_summary.followup_without;
      if (byWithout !== 0) return byWithout;
      const byTotal = right.lead_summary.total - left.lead_summary.total;
      if (byTotal !== 0) return byTotal;
      return (right.lead_summary.followup_today + right.lead_summary.followup_upcoming) - (left.lead_summary.followup_today + left.lead_summary.followup_upcoming);
    })
    .filter((org) => org.lead_summary.total > 0)
    .slice(0, 6);
  const frictionTopOrgs = (operationalSummary?.top_orgs || []).map((row) => ({
    ...row,
    name: orgNameById.get(row.key) || row.key,
  }));
  const operationalRecommendationOrgs = frictionTopOrgs
    .map((row) => {
      const org = orgRowsById.get(row.key);
      if (!org) {
        return null;
      }

      return {
        id: org.id,
        name: org.name,
        lead_summary: org.lead_summary,
        operational_summary: row,
      };
    })
    .filter((value): value is {
      id: string;
      name: string;
      lead_summary: AgencyOrgRow["lead_summary"];
      operational_summary: (typeof frictionTopOrgs)[number];
    } => Boolean(value));
  const operationalRecommendations = operationalSummary
    ? buildAgencyOperationalRecommendations(operationalSummary, operationalRecommendationOrgs, 3)
    : [];
  const operationalValueSummary = collectOperationalValueSummary(orgs.map((row) => row.lead_summary));
  const operationalAgingSummary = mergeOperationalAgingSummaries(orgs.map((row) => row.aging_summary));
  const agingTopOrgs = [...orgs]
    .filter((org) => org.aging_summary.critical_count > 0 || org.aging_summary.aged_count > 0)
    .sort((left, right) => {
      const byCritical = right.aging_summary.critical_count - left.aging_summary.critical_count;
      if (byCritical !== 0) return byCritical;
      const byAged = right.aging_summary.aged_count - left.aging_summary.aged_count;
      if (byAged !== 0) return byAged;
      const byAge = (right.aging_summary.max_age_days || 0) - (left.aging_summary.max_age_days || 0);
      if (byAge !== 0) return byAge;
      return right.lead_summary.total - left.lead_summary.total;
    })
    .slice(0, 4);
  const leadStatusTotals = LEAD_STATUSES.reduce<Record<LeadStatus, number>>((acc, status) => {
    acc[status] = orgs.reduce((sum, org) => sum + org.lead_summary.by_status[status], 0);
    return acc;
  }, {} as Record<LeadStatus, number>);
  const leadStagePeak = Math.max(...LEAD_STATUSES.map((status) => leadStatusTotals[status]), 1);
  const topValueOrgs = [...orgs]
    .sort((left, right) => {
      const leftValue = left.total_leads + left.total_saved_results + left.total_products;
      const rightValue = right.total_leads + right.total_saved_results + right.total_products;
      return rightValue - leftValue;
    })
    .slice(0, 4);
  const topValuePeak = Math.max(
    ...topValueOrgs.map((org) => org.total_leads + org.total_saved_results + org.total_products),
    1
  );

  return (
    <div className={`min-h-screen ${isLight ? "bg-[#F5F0E7] text-[#141414]" : "bg-black text-white"}`}>
      <div className={`px-6 pt-10 pb-8 border-b sticky top-0 z-40 backdrop-blur-2xl ${isLight ? "border-black/5 bg-[#F5F0E7]/90" : "border-white/5 bg-black/80"}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#D4AF37] flex items-center justify-center text-black font-serif font-medium shadow-[0_0_24px_rgba(212,175,55,0.35)]">
                V
              </div>
              <div>
                <Text className="text-[10px] font-medium tracking-[0.08em] text-[#D4AF37]">Central de lojas</Text>
                <Heading as="h1" className="text-2xl md:text-3xl tracking-tight">Painel da operação</Heading>
              </div>
            </div>
            <Text className={`text-sm max-w-2xl ${isLight ? "text-black/55" : "text-white/50"}`}>
              Visão consolidada da operação por loja, com dados reais, status canônico, bloqueio e atalhos para o detalhe operacional.
            </Text>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={buildHref("/agency", { range: range === "all" ? undefined : range, theme: themeMode === "light" ? "dark" : "light" })}>
              <VenusButton variant="outline" className="h-12 px-6 rounded-full tracking-[0.08em] text-[10px] font-medium border-white/10">
                {themeMode === "light" ? "Tema escuro" : "Tema claro"}
              </VenusButton>
            </Link>
            <Link href="#cadastro-lojista">
              <VenusButton variant="solid" className="h-12 px-6 rounded-full tracking-[0.08em] text-[10px] font-medium bg-[#D4AF37] text-black">
                Cadastrar lojista
              </VenusButton>
            </Link>
            <Link href={buildHref("/agency/billing", { range: range === "all" ? undefined : range })}>
              <VenusButton variant="outline" className="h-12 px-6 rounded-full tracking-[0.08em] text-[10px] font-medium border-white/10">
                Visão financeira
              </VenusButton>
            </Link>
            <Link href={buildHref("/agency/playbooks", { range: range === "all" ? undefined : range })}>
              <VenusButton variant="outline" className="h-12 px-6 rounded-full tracking-[0.08em] text-[10px] font-medium border-white/10">
                Fila operacional
              </VenusButton>
            </Link>
            <Link href="/admin">
              <VenusButton variant="outline" className="h-12 px-6 rounded-full tracking-[0.08em] text-[10px] font-medium border-white/10">
                Portal interno
              </VenusButton>
            </Link>
            <Link href="/login">
              <VenusButton variant="solid" className="h-12 px-6 rounded-full tracking-[0.08em] text-[10px] font-medium bg-white text-black">
                Trocar conta
              </VenusButton>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 space-y-10">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <AgencyTelemetryPanel
            mode={themeMode}
            totalOrgs={totalOrgs}
            activeOrgs={activeOrgs}
            suspendedOrBlocked={suspendedOrBlocked}
            killSwitchOn={killSwitchOn}
            totalProducts={totalProducts}
            totalLeads={totalLeads}
            totalSavedResults={totalSavedResults}
            orgsWithLeadRisk={orgsWithLeadRisk}
            totalLeadOverdue={totalLeadOverdue}
            totalLeadWithoutFollowUp={totalLeadWithoutFollowUp}
            leadStatusTotals={leadStatusTotals}
            leadStagePeak={leadStagePeak}
            topValueOrgs={topValueOrgs}
            topValuePeak={topValuePeak}
          />
          <MerchantProvisionCard mode={themeMode} />
        </div>

        <div className="hidden gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <GlassContainer className="space-y-6 border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.10),_rgba(255,255,255,0.03)_32%,_rgba(0,0,0,0.9)_100%)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-3 py-1 text-[9px] tracking-[0.08em] font-medium text-[#D4AF37]">
                Agency Command Center
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] tracking-[0.08em] font-medium text-white/50">
                {totalOrgs} lojas na base
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] tracking-[0.08em] font-medium text-white/50">
                {orgsWithLeadRisk} com risco comercial
              </span>
            </div>

            <div className="space-y-3">
              <Heading as="h2" className="text-3xl md:text-4xl tracking-tight">
                Comando operacional da carteira
              </Heading>
              <Text className="max-w-2xl text-sm text-white/60">
                Uma visão mais limpa da operação: onde o dinheiro está parado, quais lojas estão com follow-up vencido e quais lojistas precisam de entrada agora.
              </Text>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="#cadastro-lojista">
                <VenusButton variant="solid" className="bg-[#D4AF37] text-black">
                  Cadastrar lojista
                </VenusButton>
              </Link>
              <Link href={buildHref("/agency/playbooks", { range: range === "all" ? undefined : range })}>
                <VenusButton variant="outline" className="border-white/10 text-white/75">
                  Abrir fila operacional
                </VenusButton>
              </Link>
              <Link href={buildHref("/agency/billing", { range: range === "all" ? undefined : range })}>
                <VenusButton variant="outline" className="border-white/10 text-white/75">
                  Ver billing
                </VenusButton>
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <CompactStat icon={<Users className="w-4 h-4 text-[#D4AF37]" />} label="Lojas totais" value={totalOrgs} tone="gold" />
              <CompactStat icon={<HeartPulse className="w-4 h-4 text-green-400" />} label="Ativas" value={activeOrgs} tone="green" />
              <CompactStat icon={<ShieldCheck className="w-4 h-4 text-red-400" />} label="Bloqueadas" value={suspendedOrBlocked} tone="red" />
              <CompactStat icon={<DollarSign className="w-4 h-4 text-[#D4AF37]" />} label="Produtos" value={totalProducts} tone="gold" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <CompactStat icon={<MessageSquare className="w-4 h-4 text-[#D4AF37]" />} label="Leads" value={totalLeads} tone="neutral" />
              <CompactStat icon={<RefreshCw className="w-4 h-4 text-[#D4AF37]" />} label="Resultados salvos" value={totalSavedResults} tone="neutral" />
              <CompactStat icon={<Zap className="w-4 h-4 text-[#D4AF37]" />} label="Bloqueio" value={killSwitchOn} tone="amber" />
            </div>
          </GlassContainer>

          <MerchantProvisionCard />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <GlassContainer className="space-y-5 border-white/10 bg-white/[0.04]">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <Text className="text-[10px] tracking-[0.08em] text-[#D4AF37] font-medium">Leads por etapa</Text>
                <Heading as="h2" className="text-2xl md:text-[2.15rem] tracking-tight">
                  Distribuição dos leads
                </Heading>
              </div>
              <Text className="text-[10px] tracking-[0.08em] text-white/35">
                {totalLeadOverdue} vencidos · {totalLeadWithoutFollowUp} sem follow-up
              </Text>
            </div>

            <div className="space-y-4">
              {LEAD_STATUSES.map((status) => {
                const value = leadStatusTotals[status];
                const width = Math.max((value / leadStagePeak) * 100, value > 0 ? 10 : 2);
                return (
                  <div key={status} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <Text className="text-white/60 tracking-[0.08em] text-[10px] font-medium">{getLeadStatusLabel(status)}</Text>
                      <Text className="text-white/80">{formatCount(value)}</Text>
                    </div>
                    <ProgressBar progress={width} />
                  </div>
                );
              })}
            </div>
          </GlassContainer>

          <GlassContainer className="space-y-5 border-white/10 bg-white/[0.04]">
            <div className="space-y-1">
              <Text className="text-[10px] tracking-[0.08em] text-[#D4AF37] font-medium">Lojas prioritárias</Text>
              <Heading as="h2" className="text-2xl md:text-[2.15rem] tracking-tight">
                Base com mais peso
              </Heading>
              <Text className="text-sm text-white/55">
                Priorize quem já tem volume, produto e sinais de oportunidade. Menos leitura, mais ação.
              </Text>
            </div>

            <div className="space-y-3">
              {topValueOrgs.length > 0 ? (
                topValueOrgs.map((org, index) => {
                  const orgPontuação = org.total_leads + org.total_saved_results + org.total_products;
                  const orgWidth = Math.max((orgPontuação / topValuePeak) * 100, 12);
                  return (
                    <div key={org.id} className="rounded-[28px] border border-white/10 bg-black/40 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <Text className="text-[9px] tracking-[0.08em] text-white/35 font-medium">#{index + 1} loja</Text>
                          <Heading as="h3" className="text-xl tracking-tight">
                            {org.name}
                          </Heading>
                          <Text className="text-sm text-white/45">{org.slug}</Text>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses(leadRiskKind(org.lead_summary.followup_overdue, org.lead_summary.followup_without))}`}>
                          {formatCount(org.lead_summary.total)} leads
                        </span>
                      </div>
                      <ProgressBar progress={orgWidth} />
                      <div className="flex flex-wrap gap-3 pt-1">
                        <Link href={buildAgencyOrgDetailHref(org.id, { from: "agency", range })}>
                          <VenusButton variant="outline" className="h-10 px-4 rounded-full tracking-[0.08em] text-[9px] font-medium border-white/10">
                            Abrir loja
                          </VenusButton>
                        </Link>
                        <Link href={buildAgencyOrgDetailHref(org.id, { from: "agency", range, followUp: "overdue" })}>
                          <VenusButton variant="ghost" className="h-10 px-0 rounded-full tracking-[0.08em] text-[9px] font-medium text-[#D4AF37]">
                            Vencidos
                          </VenusButton>
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[28px] border border-white/10 bg-black/40 p-5">
                  <Text className="text-sm text-white/45">Nenhuma org em destaque agora.</Text>
                </div>
              )}
            </div>
          </GlassContainer>
        </div>

        <section className="space-y-4">
          <div className="space-y-1">
            <Heading as="h2" className="text-xs tracking-[0.08em] text-white/40 font-medium">
              Atenção imediata
            </Heading>
            <Text className="text-sm text-white/40">
              Lojas com follow-up vencido. É a fila imediata de atenção comercial.
            </Text>
          </div>

          {criticalLeadOrgs.length > 0 ? (
            <div className="space-y-3">
              {criticalLeadOrgs.map((org) => (
                <div key={`critical-lead-${org.id}`} className="p-5 rounded-[28px] bg-red-500/5 border border-red-500/15 space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Heading as="h3" className="text-xl tracking-tight">
                          {org.name}
                        </Heading>
                        <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses("critical")}`}>
                          Ação imediata
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses("plan")}`}>
                          Leads {formatCount(org.lead_summary.total)}
                        </span>
                      </div>
                      <Text className="text-sm text-white/45">
                        {org.slug} · vencidos {formatCount(org.lead_summary.followup_overdue)} · sem follow-up {formatCount(org.lead_summary.followup_without)}
                      </Text>
                    </div>
                    <Link href={buildAgencyOrgDetailHref(org.id, { from: "agency", range, followUp: "overdue" })}>
                      <VenusButton variant="solid" className="h-11 px-5 rounded-full tracking-[0.08em] text-[10px] font-medium bg-red-500 text-white">
                        Ver atrasadas
                      </VenusButton>
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Metric label="Vencidos" value={org.lead_summary.followup_overdue} />
                    <Metric label="Sem follow-up" value={org.lead_summary.followup_without} />
                    <Metric label="Hoje" value={org.lead_summary.followup_today} />
                    <Metric label="Total leads" value={org.lead_summary.total} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-[28px] bg-white/[0.03] border border-white/5">
              <Text className="text-sm text-white/40">Nenhuma loja com follow-up vencido agora. A fila imediata está limpa.</Text>
            </div>
          )}

          <div className="space-y-1">
            <Heading as="h2" className="text-xs tracking-[0.08em] text-white/40 font-medium">
              Lojas sem retorno
            </Heading>
            <Text className="text-sm text-white/40">
              Lojas sem vencidos, mas já frouxas por acumular leads sem follow-up. Isso tende a virar problema.
            </Text>
          </div>

          {withoutFollowUpUrgentOrgs.length > 0 ? (
            <div className="space-y-3">
              {withoutFollowUpUrgentOrgs.map((org) => {
                const activePipelineCount = org.lead_summary.by_status.engaged + org.lead_summary.by_status.qualified + org.lead_summary.by_status.offer_sent + org.lead_summary.by_status.closing;
                return (
                  <div key={`without-follow-up-${org.id}`} className="p-5 rounded-[28px] bg-yellow-500/5 border border-yellow-500/15 space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Heading as="h3" className="text-xl tracking-tight">
                            {org.name}
                          </Heading>
                          <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses("warning")}`}>
                            Atenção operacional
                          </span>
                          <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses("plan")}`}>
                            Leads {formatCount(org.lead_summary.total)}
                          </span>
                        </div>
                        <Text className="text-sm text-white/45">
                          {org.slug} · sem follow-up {formatCount(org.lead_summary.followup_without)} · pipeline ativo {formatCount(activePipelineCount)}
                        </Text>
                      </div>
                      <Link href={buildAgencyOrgDetailHref(org.id, { from: "agency", range, followUp: "without_follow_up" })}>
                        <VenusButton variant="outline" className="h-11 px-5 rounded-full tracking-[0.08em] text-[9px] font-medium border-yellow-500/20 text-yellow-200">
                          Ver sem retorno
                        </VenusButton>
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <Metric label="Sem follow-up" value={org.lead_summary.followup_without} />
                      <Metric label="Em conversa" value={org.lead_summary.by_status.engaged} />
                      <Metric label="Qualificados" value={org.lead_summary.by_status.qualified} />
                      <Metric label="Proposta enviada" value={org.lead_summary.by_status.offer_sent} />
                      <Metric label="Fechamento" value={org.lead_summary.by_status.closing} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 rounded-[28px] bg-white/[0.03] border border-white/5">
              <Text className="text-sm text-white/40">Nenhuma loja frouxa sem vencidos agora. Essa camada está limpa.</Text>
            </div>
          )}

          <div className="space-y-1">
            <Heading as="h2" className="text-xs tracking-[0.08em] text-white/40 font-medium">
              Lojas que pedem atenção
            </Heading>
            <Text className="text-sm text-white/40">
              Visão macro das lojas com mais follow-ups vencidos ou leads sem disciplina de acompanhamento. Vencidos primeiro.
            </Text>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard icon={<AlertCircle className="w-5 h-5 text-red-400" />} label="Leads vencidos" value={totalLeadOverdue.toString()} />
            <StatCard icon={<CircleDashed className="w-5 h-5 text-yellow-300" />} label="Sem follow-up" value={totalLeadWithoutFollowUp.toString()} />
            <StatCard icon={<MessageSquare className="w-5 h-5 text-[#D4AF37]" />} label="Loja em risco" value={orgsWithLeadRisk.toString()} />
            <StatCard icon={<Users className="w-5 h-5 text-[#D4AF37]" />} label="Lojas com leads" value={leadRiskOrgs.length.toString()} />
          </div>

          <div className="space-y-3">
            {leadRiskOrgs.length > 0 ? (
              leadRiskOrgs.map((org) => {
              const riskKind = leadRiskKind(org.lead_summary.followup_overdue, org.lead_summary.followup_without);
                const engagedCount = org.lead_summary.by_status.engaged;
                const closingCount = org.lead_summary.by_status.closing;
                return (
                  <div key={`lead-risk-${org.id}`} className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Heading as="h3" className="text-2xl tracking-tight">
                            {org.name}
                          </Heading>
                          <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses(riskKind)}`}>
                            {riskKind === "critical" ? "Crítico" : riskKind === "warning" ? "Atenção" : "Saudável"}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses("plan")}`}>
                            Leads {formatCount(org.lead_summary.total)}
                          </span>
                        </div>
                        <Text className="text-sm text-white/45">
                          {org.slug} · vencidos {formatCount(org.lead_summary.followup_overdue)} · sem follow-up {formatCount(org.lead_summary.followup_without)} · hoje {formatCount(org.lead_summary.followup_today)}
                        </Text>
                        <Text className="text-[10px] tracking-[0.08em] text-white/35">
                          Pipeline: {formatPipelineCounts(org as AgencyOrgLeadRowLike)}
                        </Text>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {org.lead_summary.followup_overdue > 0 ? (
                            <Link href={buildAgencyOrgDetailHref(org.id, { from: "agency", range, followUp: "overdue" })}>
                              <VenusButton
                                variant="outline"
                                className="h-9 px-4 rounded-full tracking-[0.08em] text-[8px] font-medium border-red-500/20 text-red-300"
                              >
                                Ver vencidos ({org.lead_summary.followup_overdue})
                              </VenusButton>
                            </Link>
                          ) : null}
                          {org.lead_summary.followup_without > 0 ? (
                            <Link href={buildAgencyOrgDetailHref(org.id, { from: "agency", range, followUp: "without_follow_up" })}>
                              <VenusButton
                                variant="outline"
                                className="h-9 px-4 rounded-full tracking-[0.08em] text-[8px] font-medium border-yellow-500/20 text-yellow-200"
                              >
                                Sem follow-up ({org.lead_summary.followup_without})
                              </VenusButton>
                            </Link>
                          ) : null}
                          {engagedCount > 0 ? (
                            <Link href={buildAgencyOrgDetailHref(org.id, { from: "agency", range, leadStatus: "engaged" })}>
                              <VenusButton
                                variant="outline"
                                className="h-9 px-4 rounded-full tracking-[0.08em] text-[8px] font-medium border-green-500/20 text-green-300"
                              >
                                Em conversa ({engagedCount})
                              </VenusButton>
                            </Link>
                          ) : null}
                          {closingCount > 0 ? (
                            <Link href={buildAgencyOrgDetailHref(org.id, { from: "agency", range, leadStatus: "closing" })}>
                              <VenusButton
                                variant="outline"
                                className="h-9 px-4 rounded-full tracking-[0.08em] text-[8px] font-medium border-yellow-500/20 text-yellow-200"
                              >
                                Fechamento ({closingCount})
                              </VenusButton>
                            </Link>
                          ) : null}
                        </div>
                      </div>
                      <Link href={buildAgencyOrgDetailHref(org.id, { from: "agency", range })}>
                        <VenusButton variant="glass" className="h-11 px-5 rounded-full tracking-[0.08em] text-[9px] font-medium border-white/10">
                          Abrir loja
                        </VenusButton>
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Metric label="Vencidos" value={org.lead_summary.followup_overdue} />
                      <Metric label="Hoje" value={org.lead_summary.followup_today} />
                      <Metric label="Próximos" value={org.lead_summary.followup_upcoming} />
                      <Metric label="Sem follow-up" value={org.lead_summary.followup_without} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-6 rounded-[28px] bg-white/[0.03] border border-white/5">
                <Text className="text-sm text-white/40">Nenhuma org com leads suficientes para destacar risco comercial agora.</Text>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <Heading as="h2" className="text-xs tracking-[0.08em] text-white/40 font-medium">Problemas operacionais</Heading>
            <Text className="text-sm text-white/40">
              Leitura agregada dos eventos já emitidos na janela {range === "all" ? "total" : range === "7d" ? "de 7 dias" : range === "30d" ? "de 30 dias" : "de 90 dias"}, focada em bloqueios, conflitos e espera.
            </Text>
          </div>

          {operationalSummary ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard icon={<AlertCircle className="w-5 h-5 text-red-400" />} label="Bloqueios" value={operationalSummary.blocked_count.toString()} />
                <StatCard icon={<ShieldCheck className="w-5 h-5 text-yellow-300" />} label="Conflitos" value={operationalSummary.conflict_count.toString()} />
                <StatCard icon={<CircleDashed className="w-5 h-5 text-[#D4AF37]" />} label="Espera single-flight" value={operationalSummary.wait_count.toString()} />
                <StatCard icon={<HeartPulse className="w-5 h-5 text-green-400" />} label="Latência média" value={formatDurationMs(operationalSummary.avg_duration_ms)} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-3">
                  <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">Principais causas</Text>
                  {operationalSummary.top_reason_codes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {operationalSummary.top_reason_codes.map((row) => (
                        <span key={row.key} className="px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border bg-white/5 text-white/70 border-white/10">
                          {row.key} · {row.count}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <Text className="text-sm text-white/40">Nenhum reason_code recente na janela selecionada.</Text>
                  )}
                </div>

                <div className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-3">
                  <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">Orgs com mais atrito</Text>
                  {frictionTopOrgs.length > 0 ? (
                    <div className="space-y-2">
                      {frictionTopOrgs.slice(0, 4).map((row) => (
                        <div key={row.key} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-white/80">{row.name}</span>
                          <span className="text-white/45 tracking-[0.08em] text-[8px]">
                            {row.friction_score} sinais · {formatDurationMs(row.avg_duration_ms)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Text className="text-sm text-white/40">Nenhuma org acumulou atrito suficiente na janela selecionada.</Text>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {operationalSummary.top_event_types.slice(0, 3).map((row) => (
                  <div key={row.key} className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-2">
                    <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">Fluxo crítico</Text>
                    <Heading as="h3" className="text-lg tracking-tight break-all">
                      {row.key}
                    </Heading>
                    <Text className="text-sm text-white/45">
                      {row.count} eventos · média {formatDurationMs(row.avg_duration_ms)} · pico {formatDurationMs(row.max_duration_ms)}
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-[28px] bg-white/[0.03] border border-white/5">
              <Text className="text-sm text-white/40">Não foi possível carregar a agregação operacional desta janela.</Text>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <Heading as="h2" className="text-xs tracking-[0.08em] text-white/40 font-medium">Ações sugeridas</Heading>
            <Text className="text-sm text-white/40">
              Recomendações executivas derivadas dos sinais operacionais da janela atual. São regras canônicas, não automação.
            </Text>
          </div>

          {operationalRecommendations.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {operationalRecommendations.map((recommendation) => (
                <div key={recommendation.key} className="p-5 rounded-[28px] bg-[#D4AF37]/5 border border-[#D4AF37]/15 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">
                        {recommendation.kind.replace(/_/g, " ")}
                      </Text>
                      <Heading as="h3" className="text-xl tracking-tight">
                        {recommendation.title}
                      </Heading>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses(
                        recommendation.priority === "high" ? "critical" : recommendation.priority === "medium" ? "warning" : "ok"
                      )}`}
                    >
                      {formatOperationalPriorityLabel(recommendation.priority)}
                    </span>
                  </div>
                  <Text className="text-sm text-white/55">{recommendation.summary}</Text>
                  <Text className="text-[10px] tracking-[0.08em] text-white/35">{recommendation.action}</Text>
                  {recommendation.org_name ? (
                    <Text className="text-[10px] tracking-[0.08em] text-white/35">
                      Org: {recommendation.org_name}
                    </Text>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {recommendation.evidence.map((item) => (
                      <span
                        key={`${recommendation.key}-${item}`}
                        className="px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border bg-white/5 text-white/70 border-white/10"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-[28px] bg-white/[0.03] border border-white/5">
              <Text className="text-sm text-white/40">Nenhuma recomendação operacional disponível na janela atual.</Text>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <Heading as="h2" className="text-xs tracking-[0.08em] text-white/40 font-medium">Resultado comercial</Heading>
            <Text className="text-sm text-white/40">
              Leitura canônica do avanço comercial real. Sem receita inventada, apenas estágio, conversão e gargalo.
            </Text>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard icon={<Users className="w-5 h-5 text-[#D4AF37]" />} label="Leads totais" value={operationalValueSummary.total_leads.toLocaleString("pt-BR")} />
            <StatCard icon={<HeartPulse className="w-5 h-5 text-green-400" />} label="Pipeline ativo" value={operationalValueSummary.active_pipeline.toLocaleString("pt-BR")} />
            <StatCard
              icon={<Zap className="w-5 h-5 text-[#D4AF37]" />}
              label="Avanço operacional"
              value={formatOperationalValueRate(operationalValueSummary.advanced_pipeline_rate)}
            />
            <StatCard
              icon={<MessageSquare className="w-5 h-5 text-[#D4AF37]" />}
              label="Ganho / perdido"
              value={`${operationalValueSummary.stage_counts.won.toLocaleString("pt-BR")} / ${operationalValueSummary.stage_counts.lost.toLocaleString("pt-BR")}`}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-3">
              <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">Pipeline em fechamento</Text>
              <Heading as="h3" className="text-xl tracking-tight">
                {operationalValueSummary.stage_counts.offer_sent.toLocaleString("pt-BR")} proposta enviada · {operationalValueSummary.stage_counts.closing.toLocaleString("pt-BR")} em fechamento
              </Heading>
              <Text className="text-sm text-white/45">
                Fechados: {operationalValueSummary.terminal_pipeline.toLocaleString("pt-BR")} · taxa de fechamento {formatOperationalValueRate(operationalValueSummary.win_rate)}
              </Text>
              <Text className="text-[10px] tracking-[0.08em] text-white/35">
                Avanço total: {formatOperationalValueRate(operationalValueSummary.advanced_pipeline_rate)}
              </Text>
            </div>

            <div className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-3">
              <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">Gargalo principal</Text>
              <Heading as="h3" className="text-xl tracking-tight">
                {operationalValueSummary.state_label}
              </Heading>
              <Text className="text-sm text-white/45">{operationalValueSummary.bottleneck_action}</Text>
              <Text className="text-[10px] tracking-[0.08em] text-white/35">
                Pipeline ativo {formatOperationalValueRate(operationalValueSummary.pipeline_active_rate)} · fechado {formatOperationalValueRate(operationalValueSummary.terminal_rate)}
              </Text>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border bg-white/5 text-white/70 border-white/10">
              engajado {operationalValueSummary.stage_counts.engaged.toLocaleString("pt-BR")}
            </span>
            <span className="px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border bg-white/5 text-white/70 border-white/10">
              qualificado {operationalValueSummary.stage_counts.qualified.toLocaleString("pt-BR")}
            </span>
            <span className="px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border bg-white/5 text-white/70 border-white/10">
              oferta {operationalValueSummary.stage_counts.offer_sent.toLocaleString("pt-BR")}
            </span>
            <span className="px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border bg-white/5 text-white/70 border-white/10">
              closing {operationalValueSummary.stage_counts.closing.toLocaleString("pt-BR")}
            </span>
            <span className="px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border bg-white/5 text-white/70 border-white/10">
              won {operationalValueSummary.stage_counts.won.toLocaleString("pt-BR")}
            </span>
            <span className="px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border bg-white/5 text-white/70 border-white/10">
              lost {operationalValueSummary.stage_counts.lost.toLocaleString("pt-BR")}
            </span>
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <Heading as="h2" className="text-xs tracking-[0.08em] text-white/40 font-medium">Tempo parado</Heading>
            <Text className="text-sm text-white/40">
              Leitura canônica do tempo parado por estágio. Fonte temporal: last_interaction_at, depois updated_at, depois created_at.
            </Text>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard icon={<AlertCircle className="w-5 h-5 text-red-400" />} label="Leads envelhecidos" value={operationalAgingSummary.aged_count.toLocaleString("pt-BR")} />
            <StatCard icon={<AlertCircle className="w-5 h-5 text-red-400" />} label="Críticos" value={operationalAgingSummary.critical_count.toLocaleString("pt-BR")} />
            <StatCard icon={<HeartPulse className="w-5 h-5 text-green-400" />} label="Idade média" value={formatOperationalAgeDays(operationalAgingSummary.average_age_days)} />
            <StatCard icon={<Zap className="w-5 h-5 text-[#D4AF37]" />} label="Pior estágio" value={operationalAgingSummary.bottleneck_stage === "none" ? "Sem gargalo" : operationalAgingSummary.bottleneck_label} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-3">
              <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">Estágio mais envelhecido</Text>
              <Heading as="h3" className="text-xl tracking-tight">
                {operationalAgingSummary.state_label}
              </Heading>
              <Text className="text-sm text-white/45">{operationalAgingSummary.bottleneck_action}</Text>
              <Text className="text-[10px] tracking-[0.08em] text-white/35">
                Pico {formatOperationalAgeDays(operationalAgingSummary.max_age_days)} · leads envelhecidos {operationalAgingSummary.bottleneck_aged_count.toLocaleString("pt-BR")}
              </Text>
            </div>

            <div className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-3">
              <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">Lojas com aging crítico</Text>
              {agingTopOrgs.length > 0 ? (
                <div className="space-y-2">
                  {agingTopOrgs.map((org) => (
                    <div key={org.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-white/80">{org.name}</span>
                      <span className="text-white/45 tracking-[0.08em] text-[8px]">
                        {org.aging_summary.critical_count} críticos · pico {formatOperationalAgeDays(org.aging_summary.max_age_days)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <Text className="text-sm text-white/40">Nenhuma loja acumulou aging crítico na janela atual.</Text>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {operationalAgingSummary.stage_summaries.slice(0, 3).map((stage) => (
              <div key={stage.key} className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-2">
                <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">Aging por estágio</Text>
                <Heading as="h3" className="text-lg tracking-tight">
                  {getLeadStatusLabel(stage.key)}
                </Heading>
                <Text className="text-sm text-white/45">
                  média {formatOperationalAgeDays(stage.avg_age_days)} · pico {formatOperationalAgeDays(stage.max_age_days)}
                </Text>
                <Text className="text-[10px] tracking-[0.08em] text-white/35">
                  envelhecidos {stage.aged_count.toLocaleString("pt-BR")} · críticos {stage.critical_count.toLocaleString("pt-BR")}
                </Text>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Heading as="h2" className="text-xs tracking-[0.08em] text-white/40 font-medium">Detalhe por loja</Heading>
              <Text className="text-sm text-white/40">Lista canônica por loja, com métricas consolidadas e pontos de entrada para o detalhe operacional.</Text>
            </div>
            <Link href="/agency">
              <VenusButton variant="outline" className="rounded-full h-11 px-5 text-[9px] tracking-[0.08em] font-medium border-white/10">
                <RefreshCw className="w-3 h-3 mr-2" />
                Atualizar
              </VenusButton>
            </Link>
          </div>

          <div className="space-y-4">
            {orgs.map((org) => {
              const statusKind = getStatusKind(org);
              const usage = org.usage_today;
              const statusLabel = org.kill_switch ? "blocked" : org.status;
              const softCaps = org.soft_cap_summary;
              const guidance = org.guidance_summary;
              const playbook = org.playbook_summary;
              return (
                <div key={org.id} className="p-6 rounded-[32px] bg-white/[0.03] border border-white/5 space-y-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Heading as="h3" className="text-2xl tracking-tight">{org.name}</Heading>
                        <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses(statusKind)}`}>
                          {statusLabel}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses("plan")}`}>
                          Guia {org.plan_id || "sem dados"}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses("kill")}`}>
                          Bloqueio {org.kill_switch ? "ativo" : "inativo"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-[10px] tracking-[0.08em] text-white/35">
                        <span>slug: {org.slug}</span>
                        <span>código interno: {org.id}</span>
                        <span>criado: {formatDate(org.created_at || null)}</span>
                        <span>última atividade: {formatDate(org.last_activity_at)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses(softCapKind(softCaps.overall_status))}`}>
                          Limite {softCapLabel(softCaps.overall_status)}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses(softCapKind(softCaps.usage_health === "high" ? "critical" : softCaps.usage_health === "medium" ? "warning" : "ok"))}`}>
                          Saúde {softCaps.usage_health}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses(softCapKind(softCaps.billing_risk === "high" ? "critical" : softCaps.billing_risk === "medium" ? "warning" : "ok"))}`}>
                          Custo {softCaps.billing_risk}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses(softCapKind(guidance.guidance_level === "critical" ? "critical" : guidance.guidance_level === "warning" ? "warning" : "ok"))}`}>
                          Próximo passo {guidance.title}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {softCaps.top_alerts.slice(0, 2).map((alert) => (
                          <span
                            key={`${org.id}-${alert.key}`}
                            className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses(softCapKind(alert.status))}`}
                          >
                            {softCapChipText(alert.label, alert.usage, alert.cap, alert.usage_pct)}
                          </span>
                        ))}
                      </div>
                      <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">Guia</Text>
                            <Heading as="h4" className="text-xl tracking-tight">{playbook.title}</Heading>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses(softCapKind(playbook.guidance_level === "critical" ? "critical" : playbook.guidance_level === "warning" ? "warning" : "ok"))}`}>
                            {playbook.guidance_level}
                          </span>
                        </div>
                        <Text className="text-sm text-white/55">{playbook.summary}</Text>
                        <Text className="text-[10px] tracking-[0.08em] text-white/35">
                          Próxima revisão: {playbook.next_review_window}
                        </Text>
                        <div className="flex flex-wrap gap-2">
                          {playbook.steps.slice(0, 2).map((step) => (
                            <span
                              key={`${org.id}-step-${step.id}`}
                              className="px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border bg-white/5 text-white/70 border-white/10"
                            >
                              {step.label}
                            </span>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {playbook.light_automations.slice(0, 2).map((automation) => (
                            <form key={`${org.id}-${automation.action_key}`} action={`/api/admin/orgs/${org.id}/playbook`} method="post">
                              <input type="hidden" name="action" value={automation.action_key} />
                              <input type="hidden" name="redirect_to" value="/agency" />
                              <VenusButton
                                type="submit"
                                variant="outline"
                                className="h-9 px-4 rounded-full tracking-[0.08em] text-[8px] font-medium border-white/10"
                              >
                                {automation.label}
                              </VenusButton>
                            </form>
                          ))}
                        </div>
                      </div>
                      <Text className="text-[10px] tracking-[0.08em] text-white/35">
                        {org.plan_soft_cap_message}
                      </Text>
                      <Text className="text-[10px] tracking-[0.08em] text-white/35">
                        Próximo: {guidance.next_step}
                      </Text>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-[280px]">
                      <Metric label="Membros totais" value={org.total_members} />
                      <Metric label="Produtos totais" value={org.total_products} />
                      <Metric label="Leads totais" value={org.total_leads} />
                      <Metric label="Resultados salvos" value={org.total_saved_results} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-1">
                      <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">Conversas no WhatsApp</Text>
                      <Heading as="h4" className="text-xl tracking-tight">{metricValue(org.total_whatsapp_conversations)}</Heading>
                    </div>
                    <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-1">
                      <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">Mensagens no WhatsApp</Text>
                      <Heading as="h4" className="text-xl tracking-tight">{metricValue(org.total_whatsapp_messages)}</Heading>
                    </div>
                    <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-1">
                      <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">
                        Fonte do uso {usage ? `(${org.usage_source})` : ""}
                      </Text>
                      <Heading as="h4" className="text-xl tracking-tight">
                        {usage ? formatCount(usage.messages_sent) : "Sem dados"}
                      </Heading>
                      <Text className="text-[10px] text-white/35 tracking-[0.08em]">
                        msgs · tokens {usage ? formatCount(usage.ai_tokens) : "sem dados"}
                      </Text>
                    </div>
                    <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-1">
                      <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">Última atividade</Text>
                      <Heading as="h4" className="text-xl tracking-tight">{formatDate(org.last_activity_at)}</Heading>
                      <Text className="text-[10px] text-white/35 tracking-[0.08em]">Snapshot consolidado</Text>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                        <Link href={buildAgencyOrgDetailHref(org.id, { from: "agency", range })}>
                          <VenusButton
                            variant="glass"
                            className="h-11 px-5 rounded-full tracking-[0.08em] text-[9px] font-medium border-white/10"
                      >
                        Ver detalhe
                      </VenusButton>
                    </Link>
                    <form action={`/api/admin/orgs/${org.id}`} method="post">
                      <input type="hidden" name="action" value={org.status === "active" ? "suspend" : "activate"} />
                      <VenusButton
                        type="submit"
                        variant="outline"
                        className="h-11 px-5 rounded-full tracking-[0.08em] text-[9px] font-medium border-white/10"
                      >
                        {org.status === "active" ? "Suspender org" : "Ativar org"}
                      </VenusButton>
                    </form>
                    <form action={`/api/admin/orgs/${org.id}`} method="post">
                      <input type="hidden" name="action" value="toggle_kill_switch" />
                      <VenusButton
                        type="submit"
                        variant="solid"
                        className={`h-11 px-5 rounded-full tracking-[0.08em] text-[9px] font-medium ${
                          org.kill_switch ? "bg-red-500 text-white" : "bg-[#D4AF37] text-black"
                        }`}
                      >
                        {org.kill_switch ? "Desativar bloqueio" : "Ativar bloqueio"}
                      </VenusButton>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {orgs.length === 0 && (
          <div className="p-8 rounded-[32px] bg-white/[0.03] border border-white/5 text-center">
            <CircleDashed className="w-6 h-6 text-white/30 mx-auto mb-3" />
            <Heading as="h3" className="text-lg tracking-tight">Nenhuma org encontrada</Heading>
            <Text className="text-sm text-white/40 mt-2">O core de tenant está online, mas não há lojas disponíveis para exibir.</Text>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center">{icon}</div>
      </div>
      <div className="space-y-1">
        <Heading as="h3" className="text-2xl tracking-tight">{value}</Heading>
        <Text className="text-[9px] tracking-[0.08em] text-white/35 font-medium">{label}</Text>
      </div>
    </div>
  );
}

function CompactStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: "gold" | "green" | "red" | "amber" | "neutral";
}) {
  const toneClasses = {
    gold: "border-[#D4AF37]/15 bg-[#D4AF37]/8 text-[#D4AF37]",
    green: "border-green-500/15 bg-green-500/8 text-green-300",
    red: "border-red-500/15 bg-red-500/8 text-red-300",
    amber: "border-yellow-500/15 bg-yellow-500/8 text-yellow-300",
    neutral: "border-white/10 bg-white/5 text-white/70",
  } as const;

  return (
    <div className={`rounded-[24px] border px-4 py-4 space-y-3 ${toneClasses[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-black/30">
          {icon}
        </div>
        <Text className="text-[9px] tracking-[0.08em] text-white/35 font-medium">{label}</Text>
      </div>
      <Heading as="h3" className="text-xl tracking-tight">
        {value.toLocaleString("pt-BR")}
      </Heading>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-1">
      <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">{label}</Text>
      <Heading as="h4" className="text-lg tracking-tight">{value.toLocaleString("pt-BR")}</Heading>
    </div>
  );
}
