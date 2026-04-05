import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { createClient } from "@/lib/supabase/server";
import { isAgencyRole, isMerchantRole, resolveTenantContext } from "@/lib/tenant/core";
import { getAgencyOrgDetail } from "@/lib/agency/org-details";
import { getOrgGuidanceSummary } from "@/lib/billing/guidance";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "Sem dados";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCurrency(cents: number | null) {
  if (cents === null) return "Sem dados";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatNumber(value: number | null) {
  if (value === null) return "Sem dados";
  return value.toLocaleString("pt-BR");
}

function badge(kind: "active" | "suspended" | "blocked" | "plan" | "neutral" | "risk-low" | "risk-medium" | "risk-high") {
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
  return `${label}: ${usageText}/${capText} (${pctText})`;
}

function guidanceBadge(kind: "info" | "warning" | "critical") {
  if (kind === "critical") return "risk-high";
  if (kind === "warning") return "risk-medium";
  return "risk-low";
}

function SectionShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <Heading as="h2" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">
          {title}
        </Heading>
        <Text className="text-sm text-white/40">{description}</Text>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 rounded-[28px] bg-white/[0.03] border border-white/5 text-center space-y-2">
      <CircleIcon />
      <Heading as="h3" className="text-lg uppercase tracking-tight">
        {title}
      </Heading>
      <Text className="text-sm text-white/40">{description}</Text>
    </div>
  );
}

function CircleIcon() {
  return <div className="w-10 h-10 rounded-full border border-white/10 mx-auto bg-white/[0.03]" />;
}

function SimpleCard({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) {
  return (
    <div className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-2">
      <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">{label}</Text>
      <Heading as="h4" className="text-xl tracking-tighter">
        {value}
      </Heading>
      {subvalue ? <Text className="text-[10px] uppercase tracking-widest text-white/35">{subvalue}</Text> : null}
    </div>
  );
}

export default async function AgencyOrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
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

  const detail = await getAgencyOrgDetail(orgId);

  if (!detail) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full space-y-6">
          <div className="p-8 rounded-[40px] bg-red-500/10 border border-red-500/20 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <Heading as="h1" className="text-xl uppercase tracking-tight">
                Org não encontrada
              </Heading>
            </div>
            <Text className="text-sm text-white/70">
              Não foi possível localizar a org solicitada no tenant core.
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

  const org = detail.org;
  const billing = detail.billing.summary;
  const usageRows = detail.billing.recent_usage_rows;
  const statusLabel = org.kill_switch ? "blocked" : org.status;
  const softCaps = billing?.soft_cap_summary || null;
  const guidance = getOrgGuidanceSummary(org);
  const playbook = detail.playbook;

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
                  Agency Org Drill-Down
                </Text>
                <Heading as="h1" className="text-3xl uppercase tracking-tighter">
                  {org.name}
                </Heading>
              </div>
            </div>
            <Text className="text-sm text-white/50 max-w-2xl">
              Diagnóstico operacional completo da org, com catálogo, leads, saved_results, WhatsApp e billing.
            </Text>
          </div>
          <div className="flex gap-3">
            <Link href="/agency">
              <VenusButton variant="outline" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold border-white/10">
                <ArrowLeft className="w-3 h-3 mr-2" />
                Agency
              </VenusButton>
            </Link>
            <Link href="/agency/billing">
              <VenusButton variant="outline" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold border-white/10">
                Billing
              </VenusButton>
            </Link>
            <Link href={`/agency/orgs/${org.id}`}>
              <VenusButton variant="solid" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold bg-white text-black">
                <RefreshCw className="w-3 h-3 mr-2" />
                Atualizar
              </VenusButton>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 space-y-10">
        <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
          <SimpleCard label="Status" value={statusLabel} subvalue={`Plano ${org.plan_id || "sem dados"}`} />
          <SimpleCard label="Kill switch" value={org.kill_switch ? "ON" : "OFF"} subvalue={`Criado ${formatDate(org.created_at || null)}`} />
          <SimpleCard label="Membros" value={formatNumber(org.total_members)} subvalue="org_members" />
          <SimpleCard label="Produtos" value={formatNumber(org.total_products)} subvalue="products" />
          <SimpleCard label="Leads" value={formatNumber(org.total_leads)} subvalue="leads" />
          <SimpleCard label="Saved results" value={formatNumber(org.total_saved_results)} subvalue="saved_results" />
        </div>

        <SectionShell
          title="Resumo operacional"
          description="Visão consolidada real com uso, custo estimado e sinais básicos de saúde."
        >
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <SimpleCard label="Última atividade" value={formatDate(org.last_activity_at)} subvalue="tenant core" />
            <SimpleCard label="Uso hoje" value={formatCurrency(billing?.estimated_cost_today_cents ?? null)} subvalue={`usage source ${org.usage_source}`} />
            <SimpleCard label="Uso total" value={formatCurrency(billing?.estimated_cost_total_cents ?? null)} subvalue="estimativa explícita" />
            <SimpleCard label="Saúde" value={billing?.usage_health || "Sem dados"} subvalue={`billing risk ${billing?.billing_risk || "sem dados"}`} />
            <SimpleCard label="Plano" value={org.plan_id || "sem dados"} subvalue={`limite diário ${formatCurrency(billing?.plan_budget_daily_cents ?? null)}`} />
          </div>

          {billing ? (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <SimpleCard
                label="AI"
                value={formatCurrency(billing.estimated_ai_cost_today_cents)}
                subvalue={`total ${formatCurrency(billing.estimated_ai_cost_total_cents)}`}
              />
              <SimpleCard
                label="Catálogo"
                value={formatCurrency(billing.estimated_catalog_cost_today_cents)}
                subvalue={`total ${formatCurrency(billing.estimated_catalog_cost_total_cents)}`}
              />
              <SimpleCard
                label="CRM"
                value={formatCurrency(billing.estimated_crm_cost_today_cents)}
                subvalue={`total ${formatCurrency(billing.estimated_crm_cost_total_cents)}`}
              />
              <SimpleCard
                label="WhatsApp"
                value={formatCurrency(billing.estimated_whatsapp_cost_today_cents)}
                subvalue={`total ${formatCurrency(billing.estimated_whatsapp_cost_total_cents)}`}
              />
              <SimpleCard
                label="Eventos"
                value={formatCurrency(billing.estimated_event_overhead_today_cents)}
                subvalue={`total ${formatCurrency(billing.estimated_event_overhead_total_cents)}`}
              />
            </div>
          ) : (
            <div className="p-6 rounded-[28px] bg-white/[0.03] border border-white/5">
              <Text className="text-sm text-white/40">Sem dados de billing para esta org.</Text>
            </div>
          )}
        </SectionShell>

        <SectionShell
          title="Operational Alerts"
          description="Alertas heurísticos e explicáveis com base no plano e no uso real da org."
        >
          {softCaps ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <SimpleCard label="Status geral" value={softCapLabel(softCaps.overall_status)} subvalue={`plan ${softCaps.plan_tier}`} />
                <SimpleCard label="Health" value={softCaps.usage_health} subvalue={`warnings ${softCaps.warning_count}`} />
                <SimpleCard label="Billing risk" value={softCaps.billing_risk} subvalue={`critical ${softCaps.critical_count}`} />
                <SimpleCard label="Alertas" value={softCaps.alerts.length.toString()} subvalue={softCaps.has_data ? "dados reais" : "sem dados"} />
              </div>

              {softCaps.top_alerts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {softCaps.top_alerts.slice(0, 3).map((alert) => (
                    <span
                      key={`${org.id}-${alert.key}`}
                      className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badge(softCapBadge(alert.status))}`}
                    >
                      {softCapChipText(alert.label, alert.usage, alert.cap, alert.usage_pct)}
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Sem alertas"
                  description="A org não possui sinais suficientes para gerar alertas operacionais."
                />
              )}
            </div>
          ) : (
            <EmptyState
              title="Sem soft caps"
              description="Não foi possível carregar os limites operacionais do plano desta org."
            />
          )}
        </SectionShell>

        <SectionShell
          title="Plan Soft Caps"
          description="Consumo atual vs soft cap do plano, sem enforcement duro."
        >
          {softCaps ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {softCaps.alerts.map((alert) => (
                <div key={alert.key} className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">{alert.label}</Text>
                    <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badge(softCapBadge(alert.status))}`}>
                      {softCapLabel(alert.status)}
                    </span>
                  </div>
                  <Heading as="h3" className="text-2xl tracking-tighter">
                    {softCapChipText(alert.label, alert.usage, alert.cap, alert.usage_pct)}
                  </Heading>
                  <Text className="text-[10px] uppercase tracking-widest text-white/35">
                    {alert.message}
                  </Text>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Sem dados de soft caps"
              description="Os limites do plano não puderam ser carregados para esta org."
            />
          )}
        </SectionShell>

        <SectionShell
          title="Upgrade Guidance"
          description="Sinal de upgrade ou revisão de plano, derivado de uso real e soft caps."
        >
          {guidance ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <SimpleCard label="Guidance level" value={guidance.guidance_level} subvalue={guidance.title} />
                <SimpleCard label="Recommended action" value={guidance.recommended_action} subvalue={guidance.guidance_reason} />
                <SimpleCard label="Suggested plan" value={guidance.recommended_plan_if_any || "Sem dados"} subvalue="se fizer sentido" />
                <SimpleCard label="Upgrade signal" value={guidance.upgrade_signal} subvalue={`operational ${guidance.operational_signal}`} />
              </div>
              <div className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-2">
                <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">Reason</Text>
                <Heading as="h3" className="text-xl tracking-tighter">
                  {guidance.guidance_reason}
                </Heading>
                <Text className="text-[10px] uppercase tracking-widest text-white/35">
                  Next step: {guidance.next_step}
                </Text>
              </div>
              <div className="flex flex-wrap gap-2">
                {guidance.trigger_categories.map((category) => (
                  <span key={`${org.id}-upgrade-${category}`} className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badge(guidanceBadge(guidance.guidance_level))}`}>
                    {category}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState title="Sem guidance" description="Não foi possível calcular guidance para esta org." />
          )}
        </SectionShell>

        <SectionShell
          title="Action Playbook"
          description="Plano prático derivado do guidance real, com passos priorizados e janela de revisão."
        >
          {playbook ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <SimpleCard label="Playbook" value={playbook.title} subvalue={`action ${playbook.recommended_action}`} />
                <SimpleCard label="Guidance" value={playbook.guidance_level} subvalue={playbook.trigger_reason} />
                <SimpleCard label="Plano sugerido" value={playbook.suggested_plan_if_any || "Sem dados"} subvalue="quando fizer sentido" />
                <SimpleCard label="Janela" value={playbook.next_review_window} subvalue="revisão operacional" />
              </div>

              <div className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-2">
                <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">Summary</Text>
                <Heading as="h3" className="text-xl tracking-tighter">
                  {playbook.summary}
                </Heading>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {playbook.steps.map((step) => (
                  <div key={step.id} className="p-4 rounded-[24px] bg-white/[0.03] border border-white/5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">{step.category}</Text>
                      <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badge(step.priority === "high" ? "risk-high" : step.priority === "medium" ? "risk-medium" : "risk-low")}`}>
                        {step.priority}
                      </span>
                    </div>
                    <Heading as="h4" className="text-lg tracking-tighter">
                      {step.label}
                    </Heading>
                    <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                      {step.description}
                    </Text>
                    <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                      {step.action_type}
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState title="Sem playbook" description="Não foi possível montar um playbook para esta org." />
          )}
        </SectionShell>

        <SectionShell
          title="Light Automations / Operational Actions"
          description="Ações leves, seguras e reversíveis. Nenhum status ou plano é alterado automaticamente."
        >
          {playbook && playbook.light_automations.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {playbook.light_automations.map((automation) => (
                <form key={`${org.id}-${automation.action_key}`} action={`/api/admin/orgs/${org.id}/playbook`} method="post">
                  <input type="hidden" name="action" value={automation.action_key} />
                  <input type="hidden" name="redirect_to" value={`/agency/orgs/${org.id}`} />
                  <VenusButton
                    type="submit"
                    variant="outline"
                    className="h-11 px-5 rounded-full uppercase tracking-[0.3em] text-[9px] font-bold border-white/10"
                  >
                    {automation.label}
                  </VenusButton>
                </form>
              ))}
            </div>
          ) : (
            <EmptyState title="Sem ações leves" description="Este playbook não expõe automações leves neste momento." />
          )}
        </SectionShell>

        <SectionShell
          title="Operational Recommendations"
          description="Recomendações auxiliares para otimizar uso e conversão antes de mudar o plano."
        >
          {guidance && guidance.operational_recommendations.length > 0 ? (
            <div className="space-y-3">
              {guidance.operational_recommendations.map((item) => (
                <div key={`${org.id}-${item.title}-${item.recommended_action}`} className="p-4 rounded-[24px] bg-white/[0.03] border border-white/5">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <Heading as="h3" className="text-lg tracking-tighter">
                        {item.title}
                      </Heading>
                      <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                        {item.guidance_reason}
                      </Text>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.3em]">
                      <span className={`px-3 py-1 rounded-full border ${badge(guidanceBadge(item.guidance_level))}`}>{item.guidance_level}</span>
                      <span className={`px-3 py-1 rounded-full border ${badge(guidanceBadge(item.guidance_level))}`}>{item.recommended_action}</span>
                      <span className={`px-3 py-1 rounded-full border ${badge("plan")}`}>{item.recommended_plan_if_any || "sem plano"}</span>
                    </div>
                  </div>
                  <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35 mt-2">
                    Next step: {item.next_step}
                  </Text>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sem recomendações" description="A org não possui recomendações operacionais adicionais no momento." />
          )}
        </SectionShell>

        <SectionShell
          title="Billing recente"
          description="Últimos registros diários do ledger operacional da org."
        >
          {usageRows.length > 0 ? (
            <div className="space-y-3">
              {usageRows.map((row) => (
                <div key={row.usage_date} className="p-4 rounded-[24px] bg-white/[0.03] border border-white/5">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="space-y-1">
                      <Heading as="h3" className="text-lg tracking-tighter">
                        {row.usage_date}
                      </Heading>
                      <Text className="text-[10px] uppercase tracking-[0.35em] text-white/35">
                        msgs {formatNumber(row.messages_sent)} · tokens {formatNumber(row.ai_tokens)} · leads {formatNumber(row.leads)}
                      </Text>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.3em] text-white/45">
                      <span className={`px-3 py-1 rounded-full border ${badge("neutral")}`}>events {formatNumber(row.events_count)}</span>
                      <span className={`px-3 py-1 rounded-full border ${badge("neutral")}`}>cost {formatCurrency(row.cost_cents)}</span>
                      <span className={`px-3 py-1 rounded-full border ${badge("neutral")}`}>revenue {formatCurrency(row.revenue_cents)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sem dados de usage" description="org_usage_daily não retornou linhas para esta org." />
          )}
        </SectionShell>

        <SectionShell title="Leads recentes" description="Leads reais vinculados à org_id, com status e intent score.">
          {detail.leads.length > 0 ? (
            <div className="space-y-3">
              {detail.leads.map((lead) => (
                <div key={lead.id} className="p-4 rounded-[24px] bg-white/[0.03] border border-white/5">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <Heading as="h3" className="text-lg tracking-tighter">
                        {lead.name || "Sem nome"}
                      </Heading>
                      <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                        {lead.email || "Sem email"} · {lead.phone || "Sem telefone"} · source {lead.source || "sem dados"}
                      </Text>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.3em]">
                      <span className={`px-3 py-1 rounded-full border ${badge("plan")}`}>{lead.status}</span>
                      <span className={`px-3 py-1 rounded-full border ${badge("neutral")}`}>
                        intent {lead.intent_score === null ? "Sem dados" : lead.intent_score.toFixed(0)}
                      </span>
                      <span className={`px-3 py-1 rounded-full border ${badge("neutral")}`}>
                        {formatDate(lead.last_interaction_at || lead.updated_at || lead.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sem leads" description="Nenhum lead recente encontrado para esta org." />
          )}
        </SectionShell>

        <SectionShell title="Produtos recentes" description="Catálogo canônico vinculado à org.">
          {detail.products.length > 0 ? (
            <div className="space-y-3">
              {detail.products.map((product) => (
                <div key={product.id} className="p-4 rounded-[24px] bg-white/[0.03] border border-white/5">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <Heading as="h3" className="text-lg tracking-tighter">
                        {product.name}
                      </Heading>
                      <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                        {product.category} · {product.style || "sem estilo"} · {product.primary_color || "sem cor"}
                      </Text>
                    </div>
                    <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                      {formatDate(product.created_at)}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sem produtos" description="Nenhum produto recente encontrado para esta org." />
          )}
        </SectionShell>

        <SectionShell title="Saved results recentes" description="Resultados persistidos da jornada com contexto canônico.">
          {detail.saved_results.length > 0 ? (
            <div className="space-y-3">
              {detail.saved_results.map((result) => (
                <div key={result.id} className="p-4 rounded-[24px] bg-white/[0.03] border border-white/5">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <Heading as="h3" className="text-lg tracking-tighter">
                        {result.user_name || "Sem nome"}
                      </Heading>
                      <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                        {result.user_email || "Sem email"} · org {result.tenant_org_slug || result.tenant_org_id || "sem contexto"}
                      </Text>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.3em]">
                      <span className={`px-3 py-1 rounded-full border ${badge("neutral")}`}>
                        intent {result.intent_score === null ? "Sem dados" : result.intent_score.toFixed(0)}
                      </span>
                      <span className={`px-3 py-1 rounded-full border ${result.has_tenant_context ? badge("active") : badge("suspended")}`}>
                        {result.has_tenant_context ? "tenant ok" : "sem contexto"}
                      </span>
                      <span className={`px-3 py-1 rounded-full border ${badge("neutral")}`}>
                        {formatDate(result.updated_at || result.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sem saved results" description="Nenhum resultado recente encontrado para esta org." />
          )}
        </SectionShell>

        <SectionShell title="WhatsApp" description="Resumo operacional do inbox e das conversas tenant-aware.">
          {detail.whatsapp ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SimpleCard
                  label="Conversas"
                  value={formatNumber(detail.whatsapp.total_conversations)}
                  subvalue={detail.whatsapp.available ? "whatsapp_conversations" : "Sem dados"}
                />
                <SimpleCard
                  label="Mensagens"
                  value={formatNumber(detail.whatsapp.total_messages)}
                  subvalue={detail.whatsapp.available ? "whatsapp_messages" : "Sem dados"}
                />
                <SimpleCard
                  label="Última atividade"
                  value={formatDate(detail.whatsapp.last_activity_at)}
                  subvalue="org_slug tenant-aware"
                />
              </div>

              {detail.whatsapp.recent_conversations.length > 0 ? (
                <div className="space-y-3">
                  {detail.whatsapp.recent_conversations.map((conversation) => (
                    <div key={conversation.id} className="p-4 rounded-[24px] bg-white/[0.03] border border-white/5">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1">
                          <Heading as="h3" className="text-lg tracking-tighter">
                            {conversation.user_name || "Sem nome"}
                          </Heading>
                          <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                            {conversation.user_phone || "Sem telefone"} · {conversation.last_message || "Sem mensagem"}
                          </Text>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.3em]">
                          <span className={`px-3 py-1 rounded-full border ${badge("plan")}`}>{conversation.status}</span>
                          <span className={`px-3 py-1 rounded-full border ${badge("neutral")}`}>{conversation.priority}</span>
                          <span className={`px-3 py-1 rounded-full border ${badge("neutral")}`}>
                            unread {conversation.unread_count === null ? "Sem dados" : conversation.unread_count}
                          </span>
                          <span className={`px-3 py-1 rounded-full border ${badge("neutral")}`}>
                            {formatDate(conversation.last_updated || conversation.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Sem conversas recentes" description="Não há conversas recentes para exibir nessa org." />
              )}
            </div>
          ) : (
            <EmptyState title="Sem dados de WhatsApp" description="Não foi possível carregar o resumo do WhatsApp para esta org." />
          )}
        </SectionShell>

        <SectionShell title="Atividade recente" description="Eventos da org, com metadata resumida quando útil.">
          {detail.events.length > 0 ? (
            <div className="space-y-3">
              {detail.events.map((event) => (
                <div key={event.id} className="p-4 rounded-[24px] bg-white/[0.03] border border-white/5">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <Heading as="h3" className="text-lg tracking-tighter">
                        {event.event_type}
                      </Heading>
                      <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                        {event.event_source || "sem source"} · {event.payload_summary || "sem resumo"}
                      </Text>
                    </div>
                    <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                      {formatDate(event.created_at)}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sem eventos recentes" description="Nenhum tenant_event recente encontrado para esta org." />
          )}
        </SectionShell>
      </div>
    </div>
  );
}
