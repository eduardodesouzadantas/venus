"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleDashed, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import { AgencyTelemetryPanel } from "@/components/agency/AgencyTelemetryPanel";
import { MerchantProvisionCard } from "@/components/agency/MerchantProvisionCard";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";

type LeadStatus = "new" | "engaged" | "qualified" | "offer_sent" | "closing" | "won" | "lost";

type AgencyOrgSnapshot = {
  id: string;
  name: string;
  slug: string;
  group_id: string | null;
  branch_name: string | null;
  status: string;
  kill_switch: boolean;
  plan_id: string | null;
  created_at: string | null;
  last_activity_at: string | null;
  total_members: number;
  total_products: number;
  total_leads: number;
  total_saved_results: number;
  total_whatsapp_conversations: number | null;
  total_whatsapp_messages: number | null;
  lead_summary: {
    total: number;
    by_status: Record<LeadStatus, number>;
    followup_overdue: number;
    followup_without: number;
  };
};

type AgencyMerchantGroupSnapshot = {
  id: string;
  name: string;
  owner_user_id: string;
  org_id: string;
  created_at: string | null;
  branch_count: number;
};

type AgencySnapshotResponse = {
  ok: true;
  data: {
    agency_org_id: string | null;
    range: string;
    theme: "dark" | "light";
    operational_events: number;
    merchant_groups: AgencyMerchantGroupSnapshot[];
    rows: AgencyOrgSnapshot[];
  };
};

function buildHref(pathname: string, params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    searchParams.set(key, value);
  }
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function formatDate(value: string | null) {
  if (!value) return "Sem dados";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

function summarizeRows(rows: AgencyOrgSnapshot[]) {
  const leadStatusTotals = rows.reduce<Record<LeadStatus, number>>(
    (acc, row) => {
      (Object.keys(row.lead_summary.by_status) as LeadStatus[]).forEach((status) => {
        acc[status] += row.lead_summary.by_status[status] || 0;
      });
      return acc;
    },
    {
      new: 0,
      engaged: 0,
      qualified: 0,
      offer_sent: 0,
      closing: 0,
      won: 0,
      lost: 0,
    }
  );

  const topValueOrgs = [...rows]
    .sort((left, right) => {
      const leftValue = left.total_leads + left.total_saved_results + left.total_products;
      const rightValue = right.total_leads + right.total_saved_results + right.total_products;
      return rightValue - leftValue;
    })
    .slice(0, 4)
    .map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      total_leads: row.total_leads,
      total_saved_results: row.total_saved_results,
      total_products: row.total_products,
      lead_summary: {
        followup_overdue: row.lead_summary.followup_overdue,
        followup_without: row.lead_summary.followup_without,
      },
    }));

  return {
    totalOrgs: rows.length,
    activeOrgs: rows.filter((row) => row.status === "active" && !row.kill_switch).length,
    suspendedOrBlocked: rows.filter((row) => row.status !== "active" || row.kill_switch).length,
    killSwitchOn: rows.filter((row) => row.kill_switch).length,
    totalProducts: rows.reduce((sum, row) => sum + row.total_products, 0),
    totalLeads: rows.reduce((sum, row) => sum + row.total_leads, 0),
    totalSavedResults: rows.reduce((sum, row) => sum + row.total_saved_results, 0),
    orgsWithLeadRisk: rows.filter((row) => row.lead_summary.followup_overdue > 0 || row.lead_summary.followup_without > 0).length,
    totalLeadOverdue: rows.reduce((sum, row) => sum + row.lead_summary.followup_overdue, 0),
    totalLeadWithoutFollowUp: rows.reduce((sum, row) => sum + row.lead_summary.followup_without, 0),
    leadStatusTotals,
    leadStagePeak: Math.max(...Object.values(leadStatusTotals), 1),
    topValueOrgs,
    topValuePeak: Math.max(...topValueOrgs.map((row) => row.total_leads + row.total_saved_results + row.total_products), 1),
  };
}

export default function AgencyDashboardPage() {
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "all";
  const theme = searchParams.get("theme") === "light" ? "light" : "dark";
  const [snapshot, setSnapshot] = useState<AgencySnapshotResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const requestUrl = useMemo(() => buildHref("/api/agency/snapshot", { range, theme }), [range, theme]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function loadSnapshot() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(requestUrl, {
          signal: controller.signal,
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as AgencySnapshotResponse | Record<string, never> | null;

        if (!mounted) return;

        if (!response.ok || !payload || !("ok" in payload) || !payload.ok || !("data" in payload) || !payload.data) {
          setSnapshot(null);
          setError("Painel da agência — nenhuma loja cadastrada ainda.");
          return;
        }

        setSnapshot(payload.data);
      } catch (err) {
        if (mounted && !(err instanceof DOMException && err.name === "AbortError")) {
          setSnapshot(null);
          setError("Painel da agência — nenhuma loja cadastrada ainda.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadSnapshot();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [requestUrl, refreshToken]);

  const summary = snapshot ? summarizeRows(snapshot.rows) : null;

  return (
    <div className={`min-h-screen ${theme === "light" ? "bg-[#F5F0E7] text-[#141414]" : "bg-black text-white"}`}>
      <div className={`px-6 pt-10 pb-8 border-b sticky top-0 z-40 backdrop-blur-2xl ${theme === "light" ? "border-black/5 bg-[#F5F0E7]/90" : "border-white/5 bg-black/80"}`}>
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
            <Text className={`text-sm max-w-2xl ${theme === "light" ? "text-black/55" : "text-white/50"}`}>
              Renderização cliente com fetch pós-mount, timeout na rota e fallback simples se a base estiver vazia.
            </Text>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={buildHref("/agency", { range: range === "all" ? undefined : range, theme: theme === "light" ? "dark" : "light" })}>
              <VenusButton variant="outline" className="h-12 px-6 rounded-full tracking-[0.08em] text-[10px] font-medium border-white/10">
                {theme === "light" ? "Tema escuro" : "Tema claro"}
              </VenusButton>
            </Link>
            <Link href="#cadastro-lojista">
              <VenusButton variant="solid" className="h-12 px-6 rounded-full tracking-[0.08em] text-[10px] font-medium bg-[#D4AF37] text-black">
                Cadastrar lojista
              </VenusButton>
            </Link>
            <VenusButton
              type="button"
              variant="outline"
              className="h-12 px-6 rounded-full tracking-[0.08em] text-[10px] font-medium border-white/10"
              onClick={() => setRefreshToken((current) => current + 1)}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </VenusButton>
          </div>
        </div>
      </div>

      <main className="px-6 py-8 space-y-10">
        {error && !loading ? (
          <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4 rounded-[32px] border border-white/10 bg-white/[0.04] px-8 py-10">
              <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
              <Text className="text-sm text-white/50">Carregando painel da agência</Text>
            </div>
          </div>
        ) : snapshot && snapshot.rows.length > 0 && summary ? (
          <>
            <AgencyTelemetryPanel
              mode={theme}
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

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <MerchantProvisionCard
                mode={theme}
                agencyOrgId={snapshot?.agency_org_id ?? null}
                merchantGroups={snapshot?.merchant_groups ?? []}
              />
              <div className="space-y-4 rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
                  <Heading as="h2" className="text-xl tracking-tight">
                    Snapshot carregado
                  </Heading>
                </div>
                <Text className="text-sm text-white/55">
                  {snapshot.operational_events.toLocaleString("pt-BR")} eventos operacionais na janela selecionada.
                </Text>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <MiniStat label="Total de lojas" value={summary.totalOrgs} />
                  <MiniStat label="Risco comercial" value={summary.orgsWithLeadRisk} />
                  <MiniStat label="Produtos" value={summary.totalProducts} />
                  <MiniStat label="Leads" value={summary.totalLeads} />
                </div>
              </div>
            </div>

            <section className="space-y-4">
              <div className="space-y-1">
                <Heading as="h2" className="text-xs tracking-[0.08em] text-white/40 font-medium">
                  Detalhe por loja
                </Heading>
                <Text className="text-sm text-white/40">
                  Renderizado no cliente para evitar qualquer crash no servidor.
                </Text>
              </div>

              <div className="space-y-4">
                {snapshot.rows.map((org) => {
                  const statusLabel = org.kill_switch ? "blocked" : org.status;
                  return (
                    <div key={org.id} className="p-6 rounded-[32px] bg-white/[0.03] border border-white/5 space-y-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Heading as="h3" className="text-2xl tracking-tight">
                              {org.name}
                            </Heading>
                            <span className="px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border bg-white/5 text-white/70 border-white/10">
                              {statusLabel}
                            </span>
                            <span className="px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border bg-white/5 text-white/70 border-white/10">
                              {org.plan_id || "sem plano"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-[10px] tracking-[0.08em] text-white/35">
                            <span>slug: {org.slug}</span>
                            <span>código: {org.id}</span>
                            <span>criado: {formatDate(org.created_at)}</span>
                            <span>última atividade: {formatDate(org.last_activity_at)}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[10px] tracking-[0.08em] text-white/55">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                              follow-up atrasado {formatNumber(org.lead_summary.followup_overdue)}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                              sem follow-up {formatNumber(org.lead_summary.followup_without)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-[280px]">
                          <SmallMetric label="Membros" value={org.total_members} />
                          <SmallMetric label="Produtos" value={org.total_products} />
                          <SmallMetric label="Leads" value={org.total_leads} />
                          <SmallMetric label="Resultados" value={org.total_saved_results} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <InfoCard label="Conversas WhatsApp" value={org.total_whatsapp_conversations === null ? "Sem dados" : formatNumber(org.total_whatsapp_conversations)} />
                        <InfoCard label="Mensagens WhatsApp" value={org.total_whatsapp_messages === null ? "Sem dados" : formatNumber(org.total_whatsapp_messages)} />
                        <InfoCard label="Última atividade" value={formatDate(org.last_activity_at)} />
                        <InfoCard label="Status do pipeline" value={org.lead_summary.total > 0 ? "Ativo" : "Sem pipeline"} />
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Link href={`/agency/orgs/${org.id}?from=agency&range=${encodeURIComponent(range)}`}>
                          <VenusButton variant="glass" className="h-11 px-5 rounded-full tracking-[0.08em] text-[9px] font-medium border-white/10">
                            Ver detalhe
                          </VenusButton>
                        </Link>
                        <span className="px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border bg-white/5 text-white/70 border-white/10">
                          {org.lead_summary.total} leads
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <div className="p-8 rounded-[32px] bg-white/[0.03] border border-white/5 text-center">
            <CircleDashed className="w-6 h-6 text-white/30 mx-auto mb-3" />
            <Heading as="h3" className="text-lg tracking-tight">
              Nenhuma loja cadastrada ainda
            </Heading>
            <Text className="text-sm text-white/40 mt-2">
              A base está vazia agora. O painel não deve travar mesmo sem orgs cadastradas.
            </Text>
          </div>
        )}

        <section id="cadastro-lojista">
          <MerchantProvisionCard
            mode={theme}
            agencyOrgId={snapshot?.agency_org_id ?? null}
            merchantGroups={snapshot?.merchant_groups ?? []}
          />
        </section>
      </main>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/30 p-3 text-center">
      <div className="text-[10px] font-medium tracking-[0.08em] text-white/35">{label}</div>
      <div className="mt-1 text-xl tracking-tight">{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-1">
      <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">{label}</Text>
      <Heading as="h4" className="text-lg tracking-tight">
        {value.toLocaleString("pt-BR")}
      </Heading>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-1">
      <Text className="text-[9px] tracking-[0.08em] text-white/30 font-medium">{label}</Text>
      <Heading as="h4" className="text-lg tracking-tight">
        {value}
      </Heading>
    </div>
  );
}
