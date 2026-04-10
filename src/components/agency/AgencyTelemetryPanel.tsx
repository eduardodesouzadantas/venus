import { Activity, Orbit, Signal, TrendingUp } from "lucide-react";

import { GlassContainer } from "@/components/ui/GlassContainer";
import { Heading } from "@/components/ui/Heading";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Text } from "@/components/ui/Text";
import type { LeadStatus } from "@/lib/leads";

type AgencyVisualMode = "dark" | "light";

type TopValueOrg = {
  id: string;
  name: string;
  slug: string;
  total_leads: number;
  total_saved_results: number;
  total_products: number;
  lead_summary: {
    followup_overdue: number;
    followup_without: number;
  };
};

const LEAD_STAGE_LABELS: Record<LeadStatus, string> = {
  new: "Novo",
  engaged: "Em conversa",
  qualified: "Qualificado",
  offer_sent: "Proposta enviada",
  closing: "Fechamento",
  won: "Ganho",
  lost: "Perdido",
};

export function AgencyTelemetryPanel({
  mode = "dark",
  totalOrgs,
  activeOrgs,
  suspendedOrBlocked,
  killSwitchOn,
  totalProducts,
  totalLeads,
  totalSavedResults,
  orgsWithLeadRisk,
  totalLeadOverdue,
  totalLeadWithoutFollowUp,
  leadStatusTotals,
  leadStagePeak,
  topValueOrgs,
  topValuePeak,
}: {
  mode?: AgencyVisualMode;
  totalOrgs: number;
  activeOrgs: number;
  suspendedOrBlocked: number;
  killSwitchOn: number;
  totalProducts: number;
  totalLeads: number;
  totalSavedResults: number;
  orgsWithLeadRisk: number;
  totalLeadOverdue: number;
  totalLeadWithoutFollowUp: number;
  leadStatusTotals: Record<LeadStatus, number>;
  leadStagePeak: number;
  topValueOrgs: TopValueOrg[];
  topValuePeak: number;
}) {
  const isLight = mode === "light";
  const shellClass = isLight
    ? "border-black/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.88)_0%,_rgba(247,241,231,0.94)_100%)] text-[#161616] shadow-[0_24px_80px_rgba(17,17,17,0.08)]"
    : "border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.10),_rgba(255,255,255,0.03)_32%,_rgba(0,0,0,0.94)_100%)] text-white";
  const muted = isLight ? "text-black/55" : "text-white/55";
  const chip = isLight
    ? "border-black/10 bg-black/5 text-black/65"
    : "border-white/10 bg-white/5 text-white/55";

  return (
    <GlassContainer className={`space-y-6 ${shellClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-[10px] font-medium tracking-[0.08em] ${isLight ? "border border-[#8F6D10]/15 bg-[#8F6D10]/10 text-[#8F6D10]" : "border border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37]"}`}>
          Resumo rápido
        </span>
        <span className={`rounded-full px-3 py-1 text-[10px] font-medium tracking-[0.08em] ${chip}`}>{totalOrgs} lojas</span>
        <span className={`rounded-full px-3 py-1 text-[10px] font-medium tracking-[0.08em] ${chip}`}>{orgsWithLeadRisk} com risco</span>
      </div>

      <div className="space-y-3">
        <Heading as="h2" className="text-2xl sm:text-[2.2rem] tracking-tight">
          Visão geral da operação
        </Heading>
        <Text className={`max-w-2xl text-sm leading-relaxed ${muted}`}>
          Um bloco único para ver a saúde da base, a pressão dos leads e a densidade de produto sem espalhar o foco pela tela.
        </Text>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className={`rounded-[30px] border p-5 ${isLight ? "border-black/10 bg-white" : "border-white/10 bg-black/40"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <Text className={`text-[10px] font-medium tracking-[0.08em] ${isLight ? "text-black/40" : "text-white/40"}`}>
                Atendimento
              </Text>
              <Heading as="h3" className="text-lg tracking-tight">
                Distribuição dos estágios
              </Heading>
            </div>
            <div className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-medium tracking-[0.08em] ${chip}`}>
              <Signal className="w-3.5 h-3.5" />
              {totalLeadOverdue} em atraso
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(["new", "engaged", "qualified", "offer_sent", "closing", "won", "lost"] as LeadStatus[]).map((status) => {
              const value = leadStatusTotals[status];
              const width = Math.max((value / leadStagePeak) * 100, value > 0 ? 14 : 6);
              return (
                <div key={status} className="space-y-2 rounded-[22px] border border-white/5 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Text className={`text-[10px] font-medium tracking-[0.08em] ${muted}`}>{LEAD_STAGE_LABELS[status]}</Text>
                    <Text className="text-sm font-medium">{value}</Text>
                  </div>
                  <ProgressBar progress={width} />
                </div>
              );
            })}
          </div>
        </div>

        <div className={`rounded-[30px] border p-5 ${isLight ? "border-black/10 bg-white" : "border-white/10 bg-black/40"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <Text className={`text-[10px] font-medium tracking-[0.08em] ${isLight ? "text-black/40" : "text-white/40"}`}>
                Lojas em destaque
              </Text>
              <Heading as="h3" className="text-lg tracking-tight">
                Lojas com mais volume
              </Heading>
            </div>
            <TrendingUp className={`w-5 h-5 ${isLight ? "text-[#8F6D10]" : "text-[#D4AF37]"}`} />
          </div>

          <div className="mt-4 space-y-3">
            {topValueOrgs.slice(0, 3).map((org, index) => {
              const score = org.total_leads + org.total_saved_results + org.total_products;
              const width = Math.max((score / topValuePeak) * 100, 14);
              return (
                <div key={org.id} className="rounded-[20px] border border-white/5 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <Text className={`text-[10px] font-medium tracking-[0.08em] ${muted}`}>#{index + 1} loja</Text>
                      <Text className="text-sm font-medium tracking-tight">{org.name}</Text>
                    </div>
                    <Text className="text-sm font-medium">{score}</Text>
                  </div>
                  <div className="mt-2">
                    <ProgressBar progress={width} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] tracking-[0.08em]">
                    <span className={muted}>{org.slug}</span>
                    <span className={muted}>{org.lead_summary.followup_overdue + org.lead_summary.followup_without} sinais de atenção</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <MiniStat label="Ativas" value={activeOrgs} mode={mode} />
            <MiniStat label="Bloqueadas" value={suspendedOrBlocked} mode={mode} />
            <MiniStat label="Bloqueio" value={killSwitchOn} mode={mode} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MiniMetric label="Produtos" value={totalProducts} mode={mode} />
        <MiniMetric label="Leads" value={totalLeads} mode={mode} />
        <MiniMetric label="Resultados salvos" value={totalSavedResults} mode={mode} />
      </div>
    </GlassContainer>
  );
}

function MiniStat({
  label,
  value,
  mode,
}: {
  label: string;
  value: number;
  mode: AgencyVisualMode;
}) {
  const isLight = mode === "light";
  return (
    <div className={`rounded-[18px] border p-3 text-center ${isLight ? "border-black/10 bg-black/[0.03]" : "border-white/10 bg-black/30"}`}>
      <div className={`text-[10px] font-medium tracking-[0.08em] ${isLight ? "text-black/45" : "text-white/35"}`}>{label}</div>
      <div className={`mt-1 text-xl tracking-tight ${isLight ? "text-[#141414]" : "text-white"}`}>{value}</div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  mode,
}: {
  label: string;
  value: number;
  mode: AgencyVisualMode;
}) {
  const isLight = mode === "light";
  return (
    <div className={`rounded-[24px] border p-4 ${isLight ? "border-black/10 bg-white" : "border-white/10 bg-black/40"}`}>
      <div className={`text-[10px] font-medium tracking-[0.08em] ${isLight ? "text-black/45" : "text-white/35"}`}>{label}</div>
      <div className={`mt-1 text-2xl tracking-tight ${isLight ? "text-[#141414]" : "text-white"}`}>{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}


