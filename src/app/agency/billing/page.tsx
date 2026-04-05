import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertCircle,
  BarChart3,
  Coins,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { createClient } from "@/lib/supabase/server";
import { isAgencyRole, isMerchantRole, resolveTenantContext } from "@/lib/tenant/core";
import { listAgencyPlaybookRows, type AgencyPlaybookRow } from "@/lib/billing/playbooks";
import { normalizeAgencyTimeRange, type AgencyTimeRange } from "@/lib/agency/time-range";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDate(value: string | null) {
  if (!value) return "Sem dados";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCount(value: number | null) {
  if (value === null) return "Sem dados";
  return value.toLocaleString("pt-BR");
}

function badge(kind: "active" | "suspended" | "blocked" | "plan" | "risk-low" | "risk-medium" | "risk-high" | "neutral") {
  switch (kind) {
    case "active":
      return "bg-green-500/10 text-green-400 border-green-500/20";
    case "suspended":
      return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20";
    case "blocked":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "risk-high":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "risk-medium":
      return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20";
    case "risk-low":
      return "bg-green-500/10 text-green-400 border-green-500/20";
    case "plan":
      return "bg-white/5 text-white/70 border-white/10";
    default:
      return "bg-white/5 text-white/50 border-white/10";
  }
}

function softCapBadge(kind: "ok" | "warning" | "critical" | "no_data") {
  if (kind === "critical") return "risk-high";
  if (kind === "warning") return "risk-medium";
  if (kind === "ok") return "risk-low";
  return "neutral";
}

function softCapLabel(kind: "ok" | "warning" | "critical" | "no_data") {
  if (kind === "critical") return "Crítico";
  if (kind === "warning") return "Atenção";
  if (kind === "ok") return "Saudável";
  return "Sem dados";
}

function softCapChipText(label: string, usage: number | null, cap: number | null, pct: number | null) {
  const usageText = usage === null ? "Sem dados" : usage.toLocaleString("pt-BR");
  const capText = cap === null ? "Sem dados" : cap.toLocaleString("pt-BR");
  const pctText = pct === null ? "sem base" : `${Math.round(pct)}%`;
  return `${label} ${usageText}/${capText} (${pctText})`;
}

function statusKind(row: AgencyPlaybookRow) {
  if (row.kill_switch || row.status === "blocked") return "blocked";
  if (row.status === "suspended") return "suspended";
  return "active";
}

function riskKind(value: "low" | "medium" | "high") {
  if (value === "high") return "risk-high";
  if (value === "medium") return "risk-medium";
  return "risk-low";
}

function guidanceKind(value: "info" | "warning" | "critical") {
  if (value === "critical") return "risk-high";
  if (value === "warning") return "risk-medium";
  return "risk-low";
}

function rangeLabel(range: AgencyTimeRange) {
  switch (range) {
    case "7d":
      return "7 dias";
    case "30d":
      return "30 dias";
    case "90d":
      return "90 dias";
    default:
      return "Tudo";
  }
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-1">
      <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">{label}</Text>
      <Heading as="h4" className="text-xl tracking-tighter">
        {value}
      </Heading>
    </div>
  );
}

export default async function AgencyBillingPage({
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
  const range = normalizeAgencyTimeRange(Array.isArray(resolved.range) ? resolved.range[0] : resolved.range, "all");

  let rows: AgencyPlaybookRow[] = [];
  try {
    rows = await listAgencyPlaybookRows({ range });
  } catch (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full space-y-6">
          <div className="p-8 rounded-[40px] bg-red-500/10 border border-red-500/20 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <Heading as="h1" className="text-xl uppercase tracking-tight">
                Billing panel indisponível
              </Heading>
            </div>
            <Text className="text-sm text-white/70">
              Não foi possível carregar a visão real de uso e custo agora.
            </Text>
            <Text className="text-[10px] text-white/40 break-all">
              {error instanceof Error ? error.message : "Erro desconhecido"}
            </Text>
            <Link href="/agency">
              <VenusButton variant="outline" className="w-full mt-4">
                Voltar ao agency
              </VenusButton>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totalOrgs = rows.length;
  const activeOrgs = rows.filter((row) => row.status === "active" && !row.kill_switch).length;
  const highRiskOrgs = rows.filter((row) => row.billing_risk === "high").length;
  const estimatedToday = rows.reduce((sum, row) => sum + row.estimated_cost_today_cents, 0);
  const estimatedTotal = rows.reduce((sum, row) => sum + row.estimated_cost_total_cents, 0);
  const latestUsageDate = rows.reduce<string | null>((current, row) => {
    if (!row.usage_date) return current;
    if (!current || row.usage_date > current) return row.usage_date;
    return current;
  }, null);
  const attentionOrgs = rows.filter((row) => row.soft_cap_summary.overall_status === "warning").length;
  const criticalOrgs = rows.filter((row) => row.soft_cap_summary.overall_status === "critical").length;
  const exportParams = { range };

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
                <Text className="text-[10px] uppercase font-bold tracking-[0.5em] text-[#D4AF37]">
                  Agency Billing / Usage
                </Text>
                <Heading as="h1" className="text-3xl uppercase tracking-tighter">
                  Visão Econômica Real
                </Heading>
              </div>
            </div>
            <Text className="text-sm text-white/50 max-w-2xl">
              Uso e custo estimado por org, com base em dados reais do tenant core, catálogo, CRM e WhatsApp.
            </Text>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badge("plan")}`}>
              Janela {rangeLabel(range)}
            </span>
            <Link href="/agency">
              <VenusButton variant="outline" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold border-white/10">
                Governança
              </VenusButton>
            </Link>
            <Link href={buildHref("/agency/playbooks", { range })}>
              <VenusButton variant="outline" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold border-white/10">
                Playbooks
              </VenusButton>
            </Link>
            <Link href={buildHref("/api/agency/billing/export", { ...exportParams, format: "csv" })}>
              <VenusButton variant="outline" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold border-white/10">
                CSV
              </VenusButton>
            </Link>
            <Link href={buildHref("/api/agency/billing/export", { ...exportParams, format: "json" })}>
              <VenusButton variant="outline" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold border-white/10">
                JSON
              </VenusButton>
            </Link>
            <Link href={buildHref("/agency/billing", exportParams)}>
              <VenusButton variant="solid" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold bg-white text-black">
                <RefreshCw className="w-3 h-3 mr-2" />
                Atualizar
              </VenusButton>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 pt-6">
        <section className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-4">
          <Heading as="h2" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">
            Filtro temporal
          </Heading>
          <form className="grid grid-cols-1 md:grid-cols-3 gap-3" method="get">
            <label className="space-y-2">
              <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">Período</Text>
              <select name="range" defaultValue={range} className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white">
                <option value="all">Tudo</option>
                <option value="7d">7 dias</option>
                <option value="30d">30 dias</option>
                <option value="90d">90 dias</option>
              </select>
            </label>
            <div className="flex items-end">
              <VenusButton type="submit" variant="solid" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold bg-white text-black w-full">
                Aplicar
              </VenusButton>
            </div>
          </form>
        </section>
      </div>

      <div className="px-6 py-8 space-y-10">
        <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
          <Metric label="Orgs" value={totalOrgs.toString()} />
          <Metric label="Ativas" value={activeOrgs.toString()} />
          <Metric label="Alto risco" value={highRiskOrgs.toString()} />
          <Metric label="Uso estimado hoje" value={formatCurrency(estimatedToday)} />
          <Metric label="Uso estimado total" value={formatCurrency(estimatedTotal)} />
          <Metric label="Último uso" value={latestUsageDate || "Sem dados"} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-2">
            <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">Em atenção</Text>
            <Heading as="h3" className="text-2xl tracking-tighter">{attentionOrgs.toString()}</Heading>
            <Text className="text-[10px] uppercase tracking-widest text-white/35">orgs em warning nos soft caps</Text>
          </div>
          <div className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-2">
            <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">Críticas</Text>
            <Heading as="h3" className="text-2xl tracking-tighter">{criticalOrgs.toString()}</Heading>
            <Text className="text-[10px] uppercase tracking-widest text-white/35">orgs em critical nos soft caps</Text>
          </div>
        </div>

        <section className="space-y-4">
          <div className="space-y-1">
            <Heading as="h2" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">
              Orgs com leitura real de uso e custo
            </Heading>
            <Text className="text-sm text-white/40">
              Custo estimado é heurístico e explícito, para base de controle e limites futuros.
            </Text>
          </div>

          <div className="space-y-4">
            {rows.map((row) => {
              const usage = row.usage_date;
              const totalCost = formatCurrency(row.estimated_cost_total_cents);
              const todayCost = formatCurrency(row.estimated_cost_today_cents);
              const statusLabel = row.kill_switch ? "blocked" : row.status;
              const softCaps = row.soft_cap_summary;
              const topAlerts = softCaps.top_alerts.slice(0, 3);
              const guidance = row.guidance_summary;

              return (
                <div key={row.id} className="p-6 rounded-[32px] bg-white/[0.03] border border-white/5 space-y-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Heading as="h3" className="text-2xl uppercase tracking-tighter">
                          {row.name}
                        </Heading>
                        <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badge(statusKind(row))}`}>
                          {statusLabel}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badge("plan")}`}>
                          Plano {row.plan_id || "sem dados"}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badge(riskKind(row.billing_risk))}`}>
                          Risco {row.billing_risk}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-[10px] uppercase tracking-widest text-white/35">
                        <span>slug: {row.slug}</span>
                        <span>org_id: {row.id}</span>
                        <span>criado: {formatDate(row.created_at || null)}</span>
                        <span>última atividade: {formatDate(row.last_activity_at)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-[280px]">
                      <Metric label="Membros" value={row.total_members.toString()} />
                      <Metric label="Produtos" value={row.total_products.toString()} />
                      <Metric label="Leads" value={row.total_leads.toString()} />
                      <Metric label="Saved" value={row.total_saved_results.toString()} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-1">
                      <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">Uso diário</Text>
                      <Heading as="h4" className="text-xl tracking-tighter">
                        {usage || "Sem dados"}
                      </Heading>
                      <Text className="text-[10px] text-white/35 uppercase tracking-widest">
                        msgs {formatCount(row.messages_sent)} · tokens {formatCount(row.ai_tokens)}
                      </Text>
                    </div>
                    <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-1">
                      <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">WhatsApp</Text>
                      <Heading as="h4" className="text-xl tracking-tighter">
                        {row.total_whatsapp_messages === null || row.total_whatsapp_conversations === null
                          ? "Sem dados"
                          : `${row.total_whatsapp_conversations} conv · ${row.total_whatsapp_messages} msgs`}
                      </Heading>
                      <Text className="text-[10px] text-white/35 uppercase tracking-widest">
                        eventos {row.tenant_events_count.toLocaleString("pt-BR")}
                      </Text>
                    </div>
                    <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-1">
                      <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">Custo hoje</Text>
                      <Heading as="h4" className="text-xl tracking-tighter">
                        {todayCost}
                      </Heading>
                      <Text className="text-[10px] text-white/35 uppercase tracking-widest">
                        AI {formatCurrency(row.estimated_ai_cost_today_cents)} · CRM {formatCurrency(row.estimated_crm_cost_today_cents)}
                      </Text>
                    </div>
                    <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-1">
                      <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">Custo total</Text>
                      <Heading as="h4" className="text-xl tracking-tighter">
                        {totalCost}
                      </Heading>
                      <Text className="text-[10px] text-white/35 uppercase tracking-widest">
                        catálogo {formatCurrency(row.estimated_catalog_cost_total_cents)} · WhatsApp {formatCurrency(row.estimated_whatsapp_cost_total_cents)}
                      </Text>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.3em] text-white/45">
                    <span className={`px-3 py-1 rounded-full border ${badge(softCapBadge(softCaps.overall_status))}`}>
                      Soft cap {softCapLabel(softCaps.overall_status)}
                    </span>
                    <span className={`px-3 py-1 rounded-full border ${badge(softCapBadge(softCaps.usage_health === "high" ? "critical" : softCaps.usage_health === "medium" ? "warning" : "ok"))}`}>
                      Health {softCaps.usage_health}
                    </span>
                    <span className={`px-3 py-1 rounded-full border ${badge(softCapBadge(softCaps.billing_risk === "high" ? "critical" : softCaps.billing_risk === "medium" ? "warning" : "ok"))}`}>
                      Billing {softCaps.billing_risk}
                    </span>
                    <span className={`px-3 py-1 rounded-full border ${badge(guidanceKind(guidance.guidance_level))}`}>
                      Guidance {guidance.title}
                    </span>
                  </div>

                  <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">Playbook</Text>
                        <Heading as="h4" className="text-xl tracking-tighter">{row.playbook_summary.title}</Heading>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badge(guidanceKind(row.playbook_summary.guidance_level))}`}>
                        {row.playbook_summary.guidance_level}
                      </span>
                    </div>
                    <Text className="text-sm text-white/55">{row.playbook_summary.summary}</Text>
                    <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                      Próxima revisão: {row.playbook_summary.next_review_window}
                    </Text>
                    <div className="flex flex-wrap gap-2">
                      {row.playbook_summary.steps.slice(0, 2).map((step) => (
                        <span
                          key={`${row.id}-step-${step.id}`}
                          className="px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border bg-white/5 text-white/70 border-white/10"
                        >
                          {step.label}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {row.playbook_summary.light_automations.slice(0, 1).map((automation) => (
                        <form key={`${row.id}-${automation.action_key}`} action={`/api/admin/orgs/${row.id}/playbook`} method="post">
                          <input type="hidden" name="action" value={automation.action_key} />
                          <input type="hidden" name="redirect_to" value="/agency/billing" />
                          <VenusButton
                            type="submit"
                            variant="outline"
                            className="h-9 px-4 rounded-full uppercase tracking-[0.25em] text-[8px] font-bold border-white/10"
                          >
                            {automation.label}
                          </VenusButton>
                        </form>
                      ))}
                      <Link href={`/agency/orgs/${row.id}`}>
                        <VenusButton variant="glass" className="h-9 px-4 rounded-full uppercase tracking-[0.25em] text-[8px] font-bold border-white/10">
                          Ver playbook
                        </VenusButton>
                      </Link>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.3em] text-white/45">
                    {topAlerts.map((alert) => (
                      <span
                        key={`${row.id}-${alert.key}`}
                        className={`px-3 py-1 rounded-full border ${badge(softCapBadge(alert.status))}`}
                      >
                        {softCapChipText(alert.label, alert.usage, alert.cap, alert.usage_pct)}
                      </span>
                    ))}
                  </div>

                  <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                    {row.plan_soft_cap_message}
                  </Text>
                  <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                    Próximo: {guidance.next_step}
                  </Text>

                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badge("neutral")}`}>
                      Uso {row.usage_health}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badge("neutral")}`}>
                      Uso diário limite {formatCurrency(row.plan_budget_daily_cents)}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badge("neutral")}`}>
                      Base mensal {formatCurrency(row.plan_budget_monthly_cents)}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badge("neutral")}`}>
                      Usage source {row.usage_source}
                    </span>
                    <Link href={`/agency/orgs/${row.id}`}>
                      <VenusButton variant="glass" className="h-9 px-4 rounded-full uppercase tracking-[0.25em] text-[8px] font-bold border-white/10">
                        Ver detalhe
                      </VenusButton>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="p-6 rounded-[32px] bg-[#D4AF37]/5 border border-[#D4AF37]/20 flex items-start gap-4">
          <ShieldCheck className="w-5 h-5 text-[#D4AF37] flex-shrink-0 mt-1" />
          <div className="space-y-2">
            <Heading as="h4" className="text-sm uppercase tracking-[0.35em]">
              Heurística explícita
            </Heading>
            <Text className="text-sm text-white/60">
              AI = R$ 1,50 por saved result; catálogo = R$ 0,20 por produto; CRM = R$ 0,08 por lead;
              WhatsApp = R$ 0,02 por mensagem e R$ 0,05 por conversa; eventos de plataforma = R$ 0,01 por tenant_event.
            </Text>
            <Text className="text-xs text-white/40">
              Os valores são estimados por unidade real persistida, apenas para visibilidade operacional e futura definição de limites.
            </Text>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoTile label="Uso real" value="org_usage_daily + tenant_events + entidades operacionais" icon={<BarChart3 className="w-5 h-5 text-[#D4AF37]" />} />
          <InfoTile label="Custo estimado" value="somatório por unidade real persistida" icon={<Coins className="w-5 h-5 text-[#D4AF37]" />} />
          <InfoTile label="Base para limites" value="plan_id + daily budget + monthly budget" icon={<TrendingUp className="w-5 h-5 text-[#D4AF37]" />} />
        </section>
      </div>
    </div>
  );
}

function InfoTile({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 flex items-start gap-3">
      <div className="mt-1">{icon}</div>
      <div className="space-y-1">
        <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">{label}</Text>
        <Text className="text-sm text-white/60">{value}</Text>
      </div>
    </div>
  );
}
