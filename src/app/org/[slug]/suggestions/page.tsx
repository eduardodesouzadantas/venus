import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  BadgeAlert,
  BadgeCheck,
  BadgeHelp,
  CalendarDays,
  CheckCircle2,
  LayoutGrid,
  Package,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { getAgencyOrgDetail } from "@/lib/agency/org-details";
import { buildOrgOperationalRecommendations, formatOperationalPriorityLabel } from "@/lib/agency/operational-recommendations";
import type { AgencyTimeRange } from "@/lib/agency/time-range";
import { createClient } from "@/lib/supabase/server";
import { fetchTenantBySlug, isAgencyRole, isTenantActive } from "@/lib/tenant/core";

export const dynamic = "force-dynamic";

type NavItemProps = {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
};

type SuggestionType = "urgente" | "oportunidade" | "viral";

type SuggestionCard = {
  key: string;
  type: SuggestionType;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  action: string;
  date: string | null;
  evidence: string[];
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.round(value)));
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sem data";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sem data";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function NavItem({ href, icon, label, active = false }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-[10px] border ${
        active
          ? "bg-white text-black border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.08)]"
          : "bg-white/[0.02] text-white/45 border-white/5 hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}
      <span className="uppercase tracking-[0.24em] font-bold">{label}</span>
    </Link>
  );
}

function StatusDot({ tone }: { tone: "green" | "amber" | "red" }) {
  const toneMap = {
    green: "bg-[#00ff88] shadow-[0_0_12px_rgba(0,255,136,0.5)]",
    amber: "bg-[#ffaa00] shadow-[0_0_12px_rgba(255,170,0,0.45)]",
    red: "bg-[#ff4444] shadow-[0_0_12px_rgba(255,68,68,0.45)]",
  };
  return <span className={`h-2 w-2 rounded-full ${toneMap[tone]}`} />;
}

function typeTone(type: SuggestionType) {
  switch (type) {
    case "urgente":
      return "text-[#ff4444] border-[#ff4444]/25 bg-[#ff4444]/10";
    case "oportunidade":
      return "text-[#ffaa00] border-[#ffaa00]/25 bg-[#ffaa00]/10";
    default:
      return "text-[#00ff88] border-[#00ff88]/25 bg-[#00ff88]/10";
  }
}

function typeIcon(type: SuggestionType) {
  switch (type) {
    case "urgente":
      return <BadgeAlert size={14} />;
    case "oportunidade":
      return <BadgeHelp size={14} />;
    default:
      return <BadgeCheck size={14} />;
  }
}

function deriveSuggestionType(index: number, priority: string): SuggestionType {
  if (priority === "high") {
    return "urgente";
  }
  if (priority === "medium") {
    return index % 2 === 0 ? "oportunidade" : "viral";
  }
  return "viral";
}

function buildFallbackViralSuggestion(detail: NonNullable<Awaited<ReturnType<typeof getAgencyOrgDetail>>>, date: string | null): SuggestionCard | null {
  const recentConversationCount = detail.whatsapp.recent_conversations_count ?? 0;
  const recentMessages = detail.whatsapp.recent_messages_count ?? 0;
  const closeRatio = detail.lead_summary.total > 0 ? (detail.lead_summary.by_status.won / detail.lead_summary.total) * 100 : 0;

  if (recentConversationCount <= 0 && recentMessages <= 0) {
    return null;
  }

  return {
    key: "viral-loop",
    type: "viral",
    priority: "low",
    title: "Amplificar prova social",
    description: `Converter ${formatNumber(recentConversationCount)} conversas e ${formatNumber(recentMessages)} mensagens recentes em prova social para acelerar descoberta.`,
    action: closeRatio > 10 ? "Publicar melhores respostas como narrativa viral" : "Transformar respostas recorrentes em post de autoridade",
    date,
    evidence: [
      `${formatNumber(recentConversationCount)} conversas recentes`,
      `${formatNumber(recentMessages)} mensagens recentes`,
      `fechamento ${closeRatio.toFixed(1)}%`,
    ],
  };
}

async function loadSuggestionsData(orgId: string, orgName: string, range: AgencyTimeRange) {
  const detail = await getAgencyOrgDetail(orgId, range);
  if (!detail) {
    return { detail: null, suggestions: [] as SuggestionCard[] };
  }

  const recommendations = buildOrgOperationalRecommendations(detail.operational_summary, detail.lead_summary, orgName, 6);
  const latestDate = detail.events[0]?.created_at || detail.whatsapp.latest_whatsapp_activity_at || detail.org.updated_at || new Date().toISOString();

  const suggestions: SuggestionCard[] = recommendations.map((recommendation, index) => ({
    key: recommendation.key,
    type: deriveSuggestionType(index, recommendation.priority),
    priority: recommendation.priority,
    title: recommendation.title,
    description: recommendation.summary,
    action: recommendation.action,
    date: detail.events[index]?.created_at || latestDate,
    evidence: recommendation.evidence,
  }));

  const viralSuggestion = buildFallbackViralSuggestion(detail, latestDate);
  if (viralSuggestion && !suggestions.some((item) => item.type === "viral")) {
    suggestions.push(viralSuggestion);
  }

  return { detail, suggestions };
}

export default async function MerchantSuggestionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { org } = await fetchTenantBySlug(supabase, slug);
  if (!org || !isTenantActive(org)) {
    redirect("/merchant");
  }

  const appMeta = user.app_metadata as Record<string, string> | undefined;
  const userMeta = user.user_metadata as Record<string, string> | undefined;
  const userRole = appMeta?.role ?? userMeta?.role ?? "";
  const userOrgSlug = appMeta?.org_slug ?? userMeta?.org_slug ?? "";

  if (!isAgencyRole(userRole) && userOrgSlug !== slug) {
    redirect("/merchant");
  }

  const orgBase = `/org/${slug}`;
  const displayName = org.name || slug;
  const range: AgencyTimeRange = "30d";
  const data = await loadSuggestionsData(org.id, displayName, range);
  const suggestions = data.suggestions;
  const counters = suggestions.reduce(
    (acc, item) => {
      acc[item.type] += 1;
      return acc;
    },
    { urgente: 0, oportunidade: 0, viral: 0 } as Record<SuggestionType, number>
  );

  return (
    <div className="min-h-screen bg-[#080c0a] text-[#e8f0e9] flex">
      <aside className="w-72 flex-shrink-0 border-r border-[#1e2820] bg-[#0f1410] sticky top-0 h-screen p-5 flex flex-col gap-6">
        <div className="rounded-[28px] border border-[#1e2820] bg-[#141a15] p-4">
          <Text className="text-[9px] uppercase tracking-[0.35em] text-[#C9A84C]">Venus Engine</Text>
          <div className="mt-2 flex items-center justify-between gap-3">
            <Heading as="h2" className="text-sm tracking-[0.2em] uppercase text-[#e8f0e9] truncate max-w-[160px]">
              {org.name ? org.name.slice(0, 16) + (org.name.length > 16 ? "..." : "") : (org.slug?.slice(0, 16) || slug)}
            </Heading>
            <StatusDot tone={org.status === "active" && !org.kill_switch ? "green" : org.status === "blocked" ? "red" : "amber"} />
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem href={`${orgBase}/dashboard`} icon={<LayoutGrid size={16} />} label="Executivo" />
          <NavItem href={`${orgBase}/performance`} icon={<Activity size={16} />} label="Performance" />
          <NavItem href={`${orgBase}/audience`} icon={<Users size={16} />} label="Audiência" />
          <NavItem href={`${orgBase}/suggestions`} icon={<Sparkles size={16} />} label="Sugestões IA" active />
          <NavItem href={`${orgBase}/catalog`} icon={<Package size={16} />} label="Catálogo" />
          <NavItem href={`${orgBase}/settings`} icon={<Settings size={16} />} label="Configurações" />
        </nav>

        <Link href={`${orgBase}/dashboard`} className="inline-flex items-center gap-2 rounded-full border border-[#1e2820] bg-[#141a15] px-4 py-3 text-[10px] uppercase tracking-[0.28em] text-[#6b7d6c]">
          <ArrowLeft size={14} />
          Voltar ao dashboard
        </Link>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between rounded-[32px] border border-[#1e2820] bg-[#0f1410] p-5">
          <div className="space-y-2">
            <Text className="text-[10px] uppercase tracking-[0.4em] text-[#C9A84C]">Strategic Advisor</Text>
            <div className="font-mono text-[18px] font-medium tracking-tight text-[#e8f0e9]">Sugestões IA</div>
            <Text className="text-xs text-[#6b7d6c]">Lista operacional com prioridade e recomendação.</Text>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-[#1e2820] bg-[#141a15] px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-[#00ff88]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00ff88] animate-pulse" />
              <span>● TEMPO REAL</span>
            </div>
            <div className="rounded-full border border-[#1e2820] bg-[#141a15] px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-[#ff4444]">
              {formatNumber(counters.urgente)} urgentes
            </div>
          </div>
        </header>

        <section className="rounded-[32px] border border-[#1e2820] bg-[#0f1410] p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Text className="text-[9px] uppercase tracking-[0.3em] text-[#6b7d6c]">Lista do advisor</Text>
              <Heading as="h2" className="mt-1 text-xl uppercase tracking-tight">
                Plano de ação para agora
              </Heading>
            </div>
            <CalendarDays size={18} className="text-[#C9A84C]" />
          </div>

          <div className="mt-5 grid gap-4">
            {suggestions.length > 0 ? (
              suggestions.map((suggestion, index) => (
                <article key={suggestion.key} className="rounded-[26px] border border-[#1e2820] bg-[#141a15] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[9px] uppercase tracking-[0.28em] ${typeTone(suggestion.type)}`}>
                        {typeIcon(suggestion.type)}
                        {suggestion.type}
                      </div>
                      <div className="space-y-1">
                        <Heading as="h3" className="text-xl uppercase tracking-tight">
                          {suggestion.title}
                        </Heading>
                        <Text className="max-w-3xl text-sm text-[#c7d4c7]">{suggestion.description}</Text>
                      </div>
                    </div>

                    <form action={`/api/org/${slug}/suggestions/complete`} method="post" className="shrink-0">
                      <input type="hidden" name="suggestion_key" value={suggestion.key} />
                      <input type="hidden" name="suggestion_type" value={suggestion.type} />
                      <input type="hidden" name="suggestion_title" value={suggestion.title} />
                      <input type="hidden" name="redirect_to" value={`${orgBase}/suggestions`} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 rounded-full border border-[#1e2820] bg-[#0f1410] px-4 py-3 text-[10px] uppercase tracking-[0.28em] text-[#e8f0e9] transition-colors hover:border-[#C9A84C]/50 hover:text-[#C9A84C]"
                      >
                        <CheckCircle2 size={14} />
                        Marcar como concluída
                      </button>
                    </form>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-[22px] border border-[#1e2820] bg-[#0f1410] p-4">
                      <Text className="text-[9px] uppercase tracking-[0.28em] text-[#6b7d6c]">Ação recomendada</Text>
                      <div className="mt-2 text-sm leading-relaxed text-[#e8f0e9]">{suggestion.action}</div>
                    </div>
                    <div className="rounded-[22px] border border-[#1e2820] bg-[#0f1410] p-4">
                      <Text className="text-[9px] uppercase tracking-[0.28em] text-[#6b7d6c]">Data</Text>
                      <div className="mt-2 font-mono text-lg font-bold text-[#C9A84C]">{formatDate(suggestion.date)}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-[#6b7d6c]">
                        prioridade {formatOperationalPriorityLabel(suggestion.priority)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {suggestion.evidence.map((item) => (
                      <span key={item} className="rounded-full border border-[#1e2820] bg-[#0f1410] px-3 py-2 text-[9px] uppercase tracking-[0.25em] text-[#6b7d6c]">
                        {item}
                      </span>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[26px] border border-dashed border-[#1e2820] bg-[#141a15] p-6 text-sm text-[#6b7d6c]">
                Nenhuma sugestão disponível no momento.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
