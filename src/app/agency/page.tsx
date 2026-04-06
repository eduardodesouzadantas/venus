import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ShieldCheck, Users, DollarSign, Zap, HeartPulse, MessageSquare, AlertCircle, RefreshCw, CircleDashed } from "lucide-react";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { listAgencyOrgRows, type AgencyOrgRow } from "@/lib/agency";
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
  return `novo ${counts.new} · engajado ${counts.engaged} · qualificado ${counts.qualified} · oferta ${counts.offer_sent} · ganho ${counts.won} · perdido ${counts.lost}`;
}

type AgencyOrgLeadRowLike = {
  lead_summary: {
    total: number;
    by_status: {
      new: number;
      engaged: number;
      qualified: number;
      offer_sent: number;
      won: number;
      lost: number;
    };
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

  let playbookRows: AgencyPlaybookRow[] = [];
  let orgRows: AgencyOrgRow[] = [];
  try {
    [playbookRows, orgRows] = await Promise.all([
      listAgencyPlaybookRows(),
      listAgencyOrgRows(),
    ]);
  } catch (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full space-y-6">
          <div className="p-8 rounded-[40px] bg-red-500/10 border border-red-500/20 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <Heading as="h1" className="text-xl uppercase tracking-tight">Agency panel indisponível</Heading>
            </div>
            <Text className="text-sm text-white/70">
              Não foi possível carregar as orgs reais no momento.
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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="px-6 pt-10 pb-8 border-b border-white/5 sticky top-0 z-40 bg-black/80 backdrop-blur-2xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#D4AF37] flex items-center justify-center text-black font-serif font-bold shadow-[0_0_24px_rgba(212,175,55,0.35)]">
                V
              </div>
              <div>
                <Text className="text-[10px] uppercase font-bold tracking-[0.5em] text-[#D4AF37]">Snapshot consolidado / Agency Command Center</Text>
                <Heading as="h1" className="text-3xl uppercase tracking-tighter">Painel de comando consolidado</Heading>
              </div>
            </div>
            <Text className="text-sm text-white/50 max-w-2xl">
              Visão consolidada da operação por org_id, com dados reais, status canônico, kill switch e atalhos para o drill-down operacional.
            </Text>
          </div>
          <div className="flex gap-3">
            <Link href={buildHref("/agency/billing", { range: range === "all" ? undefined : range })}>
              <VenusButton variant="outline" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold border-white/10">
                Visão econômica
              </VenusButton>
            </Link>
            <Link href={buildHref("/agency/playbooks", { range: range === "all" ? undefined : range })}>
              <VenusButton variant="outline" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold border-white/10">
                Fila operacional
              </VenusButton>
            </Link>
            <Link href="/admin">
              <VenusButton variant="outline" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold border-white/10">
                Portal
              </VenusButton>
            </Link>
            <Link href="/login">
              <VenusButton variant="solid" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold bg-white text-black">
                Trocar Usuário
              </VenusButton>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 space-y-10">
        <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
          <StatCard icon={<Users className="w-5 h-5 text-[#D4AF37]" />} label="Orgs totais" value={totalOrgs.toString()} />
          <StatCard icon={<HeartPulse className="w-5 h-5 text-green-400" />} label="Orgs ativas" value={activeOrgs.toString()} />
          <StatCard icon={<ShieldCheck className="w-5 h-5 text-red-400" />} label="Bloqueadas ou suspensas" value={suspendedOrBlocked.toString()} />
          <StatCard icon={<Zap className="w-5 h-5 text-[#D4AF37]" />} label="Kill switch ativo" value={killSwitchOn.toString()} />
          <StatCard icon={<DollarSign className="w-5 h-5 text-[#D4AF37]" />} label="Produtos totais" value={totalProducts.toString()} />
          <StatCard icon={<MessageSquare className="w-5 h-5 text-[#D4AF37]" />} label="Leads totais / Saved results totais" value={`${totalLeads} / ${totalSavedResults}`} />
        </div>

        <section className="space-y-4">
          <div className="space-y-1">
            <Heading as="h2" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">
              Risco comercial por org
            </Heading>
            <Text className="text-sm text-white/40">
              Visão macro das orgs com mais follow-ups vencidos ou leads sem disciplina de acompanhamento. Vencidos primeiro.
            </Text>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard icon={<AlertCircle className="w-5 h-5 text-red-400" />} label="Leads vencidos" value={totalLeadOverdue.toString()} />
            <StatCard icon={<CircleDashed className="w-5 h-5 text-yellow-300" />} label="Sem follow-up" value={totalLeadWithoutFollowUp.toString()} />
            <StatCard icon={<MessageSquare className="w-5 h-5 text-[#D4AF37]" />} label="Org com risco" value={orgsWithLeadRisk.toString()} />
            <StatCard icon={<Users className="w-5 h-5 text-[#D4AF37]" />} label="Orgs com leads" value={leadRiskOrgs.length.toString()} />
          </div>

          <div className="space-y-3">
            {leadRiskOrgs.length > 0 ? (
              leadRiskOrgs.map((org) => {
                const riskKind = leadRiskKind(org.lead_summary.followup_overdue, org.lead_summary.followup_without);
                return (
                  <div key={`lead-risk-${org.id}`} className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Heading as="h3" className="text-2xl uppercase tracking-tighter">
                            {org.name}
                          </Heading>
                          <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badgeClasses(riskKind)}`}>
                            {riskKind === "critical" ? "Crítico" : riskKind === "warning" ? "Atenção" : "Saudável"}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badgeClasses("plan")}`}>
                            Leads {formatCount(org.lead_summary.total)}
                          </span>
                        </div>
                        <Text className="text-sm text-white/45">
                          {org.slug} · overdue {formatCount(org.lead_summary.followup_overdue)} · sem follow-up {formatCount(org.lead_summary.followup_without)} · hoje {formatCount(org.lead_summary.followup_today)}
                        </Text>
                        <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                          Pipeline: {formatPipelineCounts(org as AgencyOrgLeadRowLike)}
                        </Text>
                      </div>
                      <Link href={buildAgencyOrgDetailHref(org.id, { from: "agency", range })}>
                        <VenusButton variant="glass" className="h-11 px-5 rounded-full uppercase tracking-[0.3em] text-[9px] font-bold border-white/10">
                          Abrir org
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
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Heading as="h2" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">Snapshot consolidado por org</Heading>
              <Text className="text-sm text-white/40">Lista canônica por org_id, com métricas consolidadas e pontos de entrada para o detalhe operacional.</Text>
            </div>
            <Link href="/agency">
              <VenusButton variant="outline" className="rounded-full h-11 px-5 text-[9px] uppercase tracking-[0.35em] font-bold border-white/10">
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
                        <Heading as="h3" className="text-2xl uppercase tracking-tighter">{org.name}</Heading>
                        <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badgeClasses(statusKind)}`}>
                          {statusLabel}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badgeClasses("plan")}`}>
                          Plano {org.plan_id || "sem dados"}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badgeClasses("kill")}`}>
                          Kill switch {org.kill_switch ? "ON" : "OFF"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-[10px] uppercase tracking-widest text-white/35">
                        <span>slug: {org.slug}</span>
                        <span>org_id: {org.id}</span>
                        <span>criado: {formatDate(org.created_at || null)}</span>
                        <span>última atividade: {formatDate(org.last_activity_at)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badgeClasses(softCapKind(softCaps.overall_status))}`}>
                          Soft cap {softCapLabel(softCaps.overall_status)}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badgeClasses(softCapKind(softCaps.usage_health === "high" ? "critical" : softCaps.usage_health === "medium" ? "warning" : "ok"))}`}>
                          Health {softCaps.usage_health}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badgeClasses(softCapKind(softCaps.billing_risk === "high" ? "critical" : softCaps.billing_risk === "medium" ? "warning" : "ok"))}`}>
                          Billing {softCaps.billing_risk}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badgeClasses(softCapKind(guidance.guidance_level === "critical" ? "critical" : guidance.guidance_level === "warning" ? "warning" : "ok"))}`}>
                          Guidance {guidance.title}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {softCaps.top_alerts.slice(0, 2).map((alert) => (
                          <span
                            key={`${org.id}-${alert.key}`}
                            className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badgeClasses(softCapKind(alert.status))}`}
                          >
                            {softCapChipText(alert.label, alert.usage, alert.cap, alert.usage_pct)}
                          </span>
                        ))}
                      </div>
                      <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">Playbook</Text>
                            <Heading as="h4" className="text-xl tracking-tighter">{playbook.title}</Heading>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badgeClasses(softCapKind(playbook.guidance_level === "critical" ? "critical" : playbook.guidance_level === "warning" ? "warning" : "ok"))}`}>
                            {playbook.guidance_level}
                          </span>
                        </div>
                        <Text className="text-sm text-white/55">{playbook.summary}</Text>
                        <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                          Próxima revisão: {playbook.next_review_window}
                        </Text>
                        <div className="flex flex-wrap gap-2">
                          {playbook.steps.slice(0, 2).map((step) => (
                            <span
                              key={`${org.id}-step-${step.id}`}
                              className="px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border bg-white/5 text-white/70 border-white/10"
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
                                className="h-9 px-4 rounded-full uppercase tracking-[0.25em] text-[8px] font-bold border-white/10"
                              >
                                {automation.label}
                              </VenusButton>
                            </form>
                          ))}
                        </div>
                      </div>
                      <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                        {org.plan_soft_cap_message}
                      </Text>
                      <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                        Próximo: {guidance.next_step}
                      </Text>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-[280px]">
                      <Metric label="Membros totais" value={org.total_members} />
                      <Metric label="Produtos totais" value={org.total_products} />
                      <Metric label="Leads totais" value={org.total_leads} />
                      <Metric label="Saved results totais" value={org.total_saved_results} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-1">
                      <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">WhatsApp consolidado</Text>
                      <Heading as="h4" className="text-xl tracking-tighter">{metricValue(org.total_whatsapp_conversations)}</Heading>
                    </div>
                    <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-1">
                      <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">WhatsApp mensagens</Text>
                      <Heading as="h4" className="text-xl tracking-tighter">{metricValue(org.total_whatsapp_messages)}</Heading>
                    </div>
                    <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-1">
                      <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">
                        Fonte do uso {usage ? `(${org.usage_source})` : ""}
                      </Text>
                      <Heading as="h4" className="text-xl tracking-tighter">
                        {usage ? formatCount(usage.messages_sent) : "Sem dados"}
                      </Heading>
                      <Text className="text-[10px] text-white/35 uppercase tracking-widest">
                        msgs · tokens {usage ? formatCount(usage.ai_tokens) : "sem dados"}
                      </Text>
                    </div>
                    <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-1">
                      <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">Última atividade</Text>
                      <Heading as="h4" className="text-xl tracking-tighter">{formatDate(org.last_activity_at)}</Heading>
                      <Text className="text-[10px] text-white/35 uppercase tracking-widest">Snapshot consolidado</Text>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                        <Link href={buildAgencyOrgDetailHref(org.id, { from: "agency", range })}>
                          <VenusButton
                            variant="glass"
                            className="h-11 px-5 rounded-full uppercase tracking-[0.3em] text-[9px] font-bold border-white/10"
                      >
                        Ver detalhe
                      </VenusButton>
                    </Link>
                    <form action={`/api/admin/orgs/${org.id}`} method="post">
                      <input type="hidden" name="action" value={org.status === "active" ? "suspend" : "activate"} />
                      <VenusButton
                        type="submit"
                        variant="outline"
                        className="h-11 px-5 rounded-full uppercase tracking-[0.3em] text-[9px] font-bold border-white/10"
                      >
                        {org.status === "active" ? "Suspender org" : "Ativar org"}
                      </VenusButton>
                    </form>
                    <form action={`/api/admin/orgs/${org.id}`} method="post">
                      <input type="hidden" name="action" value="toggle_kill_switch" />
                      <VenusButton
                        type="submit"
                        variant="solid"
                        className={`h-11 px-5 rounded-full uppercase tracking-[0.3em] text-[9px] font-bold ${
                          org.kill_switch ? "bg-red-500 text-white" : "bg-[#D4AF37] text-black"
                        }`}
                      >
                        {org.kill_switch ? "Desligar kill switch" : "Ligar kill switch"}
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
            <Heading as="h3" className="text-lg uppercase tracking-tight">Nenhuma org encontrada</Heading>
            <Text className="text-sm text-white/40 mt-2">O core de tenant está online, mas não há orgs disponíveis para exibir.</Text>
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
        <Heading as="h3" className="text-2xl tracking-tighter">{value}</Heading>
        <Text className="text-[9px] uppercase tracking-[0.35em] text-white/35 font-bold">{label}</Text>
      </div>
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
      <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">{label}</Text>
      <Heading as="h4" className="text-lg tracking-tighter">{value.toLocaleString("pt-BR")}</Heading>
    </div>
  );
}
