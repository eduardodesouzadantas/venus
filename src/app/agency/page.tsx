import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AlertCircle, CircleDashed, HeartPulse, MessageSquare, RefreshCw, Zap } from "lucide-react";

import { AgencyTelemetryPanel } from "@/components/agency/AgencyTelemetryPanel";
import { MerchantProvisionCard } from "@/components/agency/MerchantProvisionCard";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { getAgencyOperationalFrictionSummary } from "@/lib/agency";
import { buildAgencyOperationalRecommendations, formatOperationalPriorityLabel } from "@/lib/agency/operational-recommendations";
import { collectOperationalValueSummary, formatOperationalValueRate } from "@/lib/agency/value-summary";
import { formatOperationalAgeDays, mergeOperationalAgingSummaries } from "@/lib/agency/aging-summary";
import { LEAD_STATUSES, getLeadStatusLabel, type LeadStatus } from "@/lib/leads";
import { createClient } from "@/lib/supabase/server";
import { isAgencyRole, isMerchantRole, resolveTenantContext } from "@/lib/tenant/core";
import { listAgencyPlaybookRows, type AgencyPlaybookRow } from "@/lib/billing/playbooks";
import { normalizeAgencyTimeRange } from "@/lib/agency/time-range";
import { buildAgencyOrgDetailHref } from "@/lib/agency/navigation";

export const dynamic = "force-dynamic";

type AgencyVisualMode = "dark" | "light";

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

function metricValue(value: number | null) {
  return value === null ? "Sem dados" : value.toLocaleString("pt-BR");
}

function formatPipelineCounts(row: AgencyPlaybookRow) {
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

function summarizeRows(rows: AgencyPlaybookRow[]) {
  const leadStatusTotals = LEAD_STATUSES.reduce<Record<LeadStatus, number>>((acc, status) => {
    acc[status] = rows.reduce((sum, row) => sum + row.lead_summary.by_status[status], 0);
    return acc;
  }, {} as Record<LeadStatus, number>);

  const topValueOrgs = [...rows]
    .sort((left, right) => {
      const leftValue = left.total_leads + left.total_saved_results + left.total_products;
      const rightValue = right.total_leads + right.total_saved_results + right.total_products;
      return rightValue - leftValue;
    })
    .slice(0, 4);

  return {
    totalOrgs: rows.length,
    activeOrgs: rows.filter((org) => org.status === "active" && !org.kill_switch).length,
    suspendedOrBlocked: rows.filter((org) => org.status !== "active" || org.kill_switch).length,
    killSwitchOn: rows.filter((org) => org.kill_switch).length,
    totalProducts: rows.reduce((sum, org) => sum + org.total_products, 0),
    totalLeads: rows.reduce((sum, org) => sum + org.total_leads, 0),
    totalSavedResults: rows.reduce((sum, org) => sum + org.total_saved_results, 0),
    totalLeadOverdue: rows.reduce((sum, org) => sum + org.lead_summary.followup_overdue, 0),
    totalLeadWithoutFollowUp: rows.reduce((sum, org) => sum + org.lead_summary.followup_without, 0),
    orgsWithLeadRisk: rows.filter((org) => org.lead_summary.followup_overdue > 0 || org.lead_summary.followup_without > 0).length,
    leadStatusTotals,
    leadStagePeak: Math.max(...LEAD_STATUSES.map((status) => leadStatusTotals[status]), 1),
    topValueOrgs,
    topValuePeak: Math.max(...topValueOrgs.map((org) => org.total_leads + org.total_saved_results + org.total_products), 1),
    operationalValueSummary: collectOperationalValueSummary(rows.map((row) => row.lead_summary)),
    operationalAgingSummary: mergeOperationalAgingSummaries(rows.map((row) => row.aging_summary)),
  };
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

  try {
    const resolved = await searchParams;
    const range = normalizeAgencyTimeRange(firstValue(resolved.range), "all");
    const themeMode = firstValue(resolved.theme) === "light" ? "light" : "dark";

    return (
      <div className={`min-h-screen ${themeMode === "light" ? "bg-[#F5F0E7] text-[#141414]" : "bg-black text-white"}`}>
        <div className={`px-6 pt-10 pb-8 border-b sticky top-0 z-40 backdrop-blur-2xl ${themeMode === "light" ? "border-black/5 bg-[#F5F0E7]/90" : "border-white/5 bg-black/80"}`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#D4AF37] flex items-center justify-center text-black font-serif font-medium shadow-[0_0_24px_rgba(212,175,55,0.35)]">
                  V
                </div>
                <div>
                  <Text className="text-[10px] font-medium tracking-[0.08em] text-[#D4AF37]">Central de lojas</Text>
                  <Heading as="h1" className="text-2xl md:text-3xl tracking-tight">
                    Painel da operação
                  </Heading>
                </div>
              </div>
              <Text className={`text-sm max-w-2xl ${themeMode === "light" ? "text-black/55" : "text-white/50"}`}>
                Shell progressivo com carregamento independente por seção, timeout nas queries e fallback simples se a base estiver vazia.
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
              <Link href="/agency/billing">
                <VenusButton variant="outline" className="h-12 px-6 rounded-full tracking-[0.08em] text-[10px] font-medium border-white/10">
                  Visão financeira
                </VenusButton>
              </Link>
              <Link href="/agency/playbooks">
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

        <main className="px-6 py-8 space-y-10">
          <Suspense fallback={<AgencySectionSkeleton title="Resumo rápido" />}>
            <AgencyTelemetrySection mode={themeMode} range={range} />
          </Suspense>

          <Suspense fallback={<AgencySectionSkeleton title="Sinais operacionais" />}>
            <AgencySignalsSection range={range} />
          </Suspense>

          <Suspense fallback={<AgencySectionSkeleton title="Detalhe por loja" />}>
            <AgencyOrganizationsSection range={range} />
          </Suspense>
        </main>
      </div>
    );
  } catch {
    return <div>Painel da agência — nenhuma loja cadastrada ainda.</div>;
  }
}

async function AgencyTelemetrySection({
  mode,
  range,
}: {
  mode: AgencyVisualMode;
  range: ReturnType<typeof normalizeAgencyTimeRange>;
}) {
  try {
    const [rows, operationalSummary] = await Promise.all([
      listAgencyPlaybookRows({ range }),
      getAgencyOperationalFrictionSummary(range),
    ]);

    const summary = summarizeRows(rows);
    const orgNameById = new Map(rows.map((row) => [row.id, row.name]));
    const frictionTopOrgs = (operationalSummary.top_orgs || []).map((row) => ({
      ...row,
      name: orgNameById.get(row.key) || row.key,
    }));
    const operationalRecommendationOrgs = frictionTopOrgs
      .map((row) => {
        const org = rows.find((candidate) => candidate.id === row.key);
        if (!org) return null;
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
        lead_summary: AgencyPlaybookRow["lead_summary"];
        operational_summary: (typeof frictionTopOrgs)[number];
      } => Boolean(value));

    void buildAgencyOperationalRecommendations(operationalSummary, operationalRecommendationOrgs, 3);

    return (
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AgencyTelemetryPanel
          mode={mode}
          totalOrgs={summary.totalOrgs}
          activeOrgs={summary.activeOrgs}
          suspendedOrBlocked={summary.suspendedOrBlocked}
          killSwitchOn={summary.killSwitchOn}
          totalProducts={summary.totalProducts}
          totalLeads={summary.totalLeads}
          totalSavedResults={summary.totalSavedResults}
          orgsWithLeadRisk={summary.orgsWithLeadRisk}
          totalLeadOverdue={summary.totalLeadOverdue}
          totalLeadWithoutFollowUp={summary.totalLeadWithoutFollowUp}
          leadStatusTotals={summary.leadStatusTotals}
          leadStagePeak={summary.leadStagePeak}
          topValueOrgs={summary.topValueOrgs}
          topValuePeak={summary.topValuePeak}
        />
        <MerchantProvisionCard mode={mode} />
      </div>
    );
  } catch {
    return <div className="p-6 rounded-[28px] border border-white/10 bg-white/[0.03]">Painel da agência — nenhuma loja cadastrada ainda.</div>;
  }
}

async function AgencySignalsSection({
  range,
}: {
  range: ReturnType<typeof normalizeAgencyTimeRange>;
}) {
  try {
    const [rows, operationalSummary] = await Promise.all([
      listAgencyPlaybookRows({ range }),
      getAgencyOperationalFrictionSummary(range),
    ]);

    const summary = summarizeRows(rows);
    const orgById = new Map(rows.map((row) => [row.id, row]));
    const recommendationOrgs = (operationalSummary.top_orgs || [])
      .map((row) => {
        const org = orgById.get(row.key);
        if (!org) return null;
        return {
          id: org.id,
          name: org.name,
          lead_summary: org.lead_summary,
          operational_summary: row,
        };
      })
      .filter(Boolean) as Array<{
        id: string;
        name: string;
        lead_summary: AgencyPlaybookRow["lead_summary"];
        operational_summary: unknown;
      }>;

    const recommendations = buildAgencyOperationalRecommendations(operationalSummary, recommendationOrgs as any, 3);

    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <Heading as="h2" className="text-xs tracking-[0.08em] text-white/40 font-medium">
            Sinais operacionais
          </Heading>
          <Text className="text-sm text-white/40">
            Cada bloco carrega sozinho, com timeout e fallback. Se algo falhar, a página continua renderizando.
          </Text>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard icon={<AlertCircle className="w-5 h-5 text-red-400" />} label="Leads totais" value={summary.operationalValueSummary.total_leads.toLocaleString("pt-BR")} />
          <StatCard icon={<HeartPulse className="w-5 h-5 text-green-400" />} label="Idade média" value={formatOperationalAgeDays(summary.operationalAgingSummary.average_age_days)} />
          <StatCard icon={<Zap className="w-5 h-5 text-[#D4AF37]" />} label="Pior estágio" value={summary.operationalAgingSummary.bottleneck_stage === "none" ? "Sem gargalo" : summary.operationalAgingSummary.bottleneck_label} />
          <StatCard icon={<MessageSquare className="w-5 h-5 text-blue-400" />} label="Follow-up atrasado" value={summary.totalLeadOverdue.toLocaleString("pt-BR")} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-3">
            <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">Recomendações</Text>
            {recommendations.length > 0 ? (
              <div className="space-y-3">
                {recommendations.map((recommendation) => (
                  <div key={recommendation.key} className="rounded-[20px] border border-white/5 bg-black/30 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Heading as="h3" className="text-base tracking-tight">
                        {recommendation.title}
                      </Heading>
                      <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses(recommendation.priority === "high" ? "critical" : recommendation.priority === "medium" ? "warning" : "neutral")}`}>
                        {formatOperationalPriorityLabel(recommendation.priority)}
                      </span>
                    </div>
                    <Text className="text-sm text-white/55">{recommendation.summary}</Text>
                    <Text className="text-[10px] tracking-[0.08em] text-white/35">{recommendation.action}</Text>
                  </div>
                ))}
              </div>
            ) : (
              <Text className="text-sm text-white/40">Nenhuma recomendação crítica na janela atual.</Text>
            )}
          </div>

          <div className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-3">
            <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">Aging por estágio</Text>
            {summary.operationalAgingSummary.stage_summaries.length > 0 ? (
              <div className="space-y-2">
                {summary.operationalAgingSummary.stage_summaries.slice(0, 3).map((stage) => (
                  <div key={stage.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-white/80">{getLeadStatusLabel(stage.key)}</span>
                    <span className="text-white/45 tracking-[0.08em] text-[8px]">
                      média {formatOperationalAgeDays(stage.avg_age_days)} · pico {formatOperationalAgeDays(stage.max_age_days)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Text className="text-sm text-white/40">Nenhuma etapa com aging relevante na janela atual.</Text>
            )}
            <div className="pt-2 flex flex-wrap gap-2">
              <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses("plan")}`}>
                valor ativo {formatOperationalValueRate(summary.operationalValueSummary.pipeline_active_rate)}
              </span>
              <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses("plan")}`}>
                avançado {formatOperationalValueRate(summary.operationalValueSummary.advanced_pipeline_rate)}
              </span>
              <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses("plan")}`}>
                terminal {formatOperationalValueRate(summary.operationalValueSummary.terminal_rate)}
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  } catch {
    return <div className="p-6 rounded-[28px] border border-white/10 bg-white/[0.03]">Painel da agência — nenhuma loja cadastrada ainda.</div>;
  }
}

async function AgencyOrganizationsSection({
  range,
}: {
  range: ReturnType<typeof normalizeAgencyTimeRange>;
}) {
  try {
    const rows = await listAgencyPlaybookRows({ range });
    if (rows.length === 0) {
      return (
        <section className="p-8 rounded-[32px] bg-white/[0.03] border border-white/5 text-center">
          <CircleDashed className="w-6 h-6 text-white/30 mx-auto mb-3" />
          <Heading as="h3" className="text-lg tracking-tight">
            Nenhuma loja cadastrada ainda
          </Heading>
          <Text className="text-sm text-white/40 mt-2">
            A base está vazia agora. Quando houver orgs, elas aparecem aqui sem travar o painel.
          </Text>
        </section>
      );
    }

    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <Heading as="h2" className="text-xs tracking-[0.08em] text-white/40 font-medium">
              Detalhe por loja
            </Heading>
            <Text className="text-sm text-white/40">
              Lista progressiva com timeout e fallback simples em caso de base vazia.
            </Text>
          </div>
          <Link href="/agency">
            <VenusButton variant="outline" className="rounded-full h-11 px-5 text-[9px] tracking-[0.08em] font-medium border-white/10">
              <RefreshCw className="w-3 h-3 mr-2" />
              Atualizar
            </VenusButton>
          </Link>
        </div>

        <div className="space-y-4">
          {rows.map((org) => {
            const statusKind = org.kill_switch ? "blocked" : org.status === "suspended" ? "suspended" : "active";
            const softCaps = org.soft_cap_summary;
            const guidance = org.guidance_summary;
            const playbook = org.playbook_summary;

            return (
              <div key={org.id} className="p-6 rounded-[32px] bg-white/[0.03] border border-white/5 space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Heading as="h3" className="text-2xl tracking-tight">
                        {org.name}
                      </Heading>
                      <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses(statusKind)}`}>
                        {org.kill_switch ? "blocked" : org.status}
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

                    <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">Playbook</Text>
                          <Heading as="h4" className="text-xl tracking-tight">
                            {playbook.title}
                          </Heading>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border ${badgeClasses(softCapKind(playbook.guidance_level === "critical" ? "critical" : playbook.guidance_level === "warning" ? "warning" : "ok"))}`}>
                          {playbook.guidance_level}
                        </span>
                      </div>
                      <Text className="text-sm text-white/55">{playbook.summary}</Text>
                      <Text className="text-[10px] tracking-[0.08em] text-white/35">
                        Próxima revisão: {playbook.next_review_window}
                      </Text>
                      <Text className="text-[10px] tracking-[0.08em] text-white/35">
                        {org.plan_soft_cap_message}
                      </Text>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-[280px]">
                    <Metric label="Membros totais" value={org.total_members} />
                    <Metric label="Produtos totais" value={org.total_products} />
                    <Metric label="Leads totais" value={org.total_leads} />
                    <Metric label="Resultados salvos" value={org.total_saved_results} />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <InfoCard label="Conversas no WhatsApp" value={metricValue(org.total_whatsapp_conversations)} />
                  <InfoCard label="Mensagens no WhatsApp" value={metricValue(org.total_whatsapp_messages)} />
                  <InfoCard label={`Fonte do uso ${org.usage_today ? `(${org.usage_source})` : ""}`} value={org.usage_today ? formatCount(org.usage_today.messages_sent) : "Sem dados"} helper={`msgs · tokens ${org.usage_today ? formatCount(org.usage_today.ai_tokens) : "sem dados"}`} />
                  <InfoCard label="Última atividade" value={formatDate(org.last_activity_at)} helper="Snapshot consolidado" />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href={buildAgencyOrgDetailHref(org.id, { from: "agency", range })}>
                    <VenusButton variant="glass" className="h-11 px-5 rounded-full tracking-[0.08em] text-[9px] font-medium border-white/10">
                      Ver detalhe
                    </VenusButton>
                  </Link>
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
                </div>

                <Text className="text-[10px] tracking-[0.08em] text-white/35">
                  {formatPipelineCounts(org)}
                </Text>
              </div>
            );
          })}
        </div>
      </section>
    );
  } catch {
    return <div className="p-6 rounded-[28px] border border-white/10 bg-white/[0.03]">Painel da agência — nenhuma loja cadastrada ainda.</div>;
  }
}

function AgencySectionSkeleton({ title }: { title: string }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <div className="h-3 w-40 rounded-full bg-white/10 animate-pulse" />
        <div className="h-4 w-72 rounded-full bg-white/5 animate-pulse" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 space-y-3">
          <div className="h-6 w-32 rounded-full bg-white/10 animate-pulse" />
          <div className="h-36 rounded-[22px] bg-white/5 animate-pulse" />
        </div>
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 space-y-3">
          <div className="h-6 w-28 rounded-full bg-white/10 animate-pulse" />
          <div className="h-36 rounded-[22px] bg-white/5 animate-pulse" />
        </div>
      </div>
      <Text className="text-[10px] tracking-[0.08em] text-white/30 uppercase">{title}</Text>
    </section>
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
        <Heading as="h3" className="text-2xl tracking-tight">
          {value}
        </Heading>
        <Text className="text-[9px] tracking-[0.08em] text-white/35 font-medium">{label}</Text>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-1">
      <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">{label}</Text>
      <Heading as="h4" className="text-lg tracking-tight">
        {value}
      </Heading>
      {helper ? <Text className="text-[10px] text-white/35 tracking-[0.08em]">{helper}</Text> : null}
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
      <Heading as="h4" className="text-lg tracking-tight">
        {value.toLocaleString("pt-BR")}
      </Heading>
    </div>
  );
}
