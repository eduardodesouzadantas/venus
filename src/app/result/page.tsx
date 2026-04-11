"use client";

import React, { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Activity, Bookmark, BrainCircuit, History, LayoutGrid, PackageCheck, Sparkles, Star, Target, Watch, BookOpen } from "lucide-react";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { LookCardSwipeable } from "@/components/ui/LookCardSwipeable";
import { SavedProfileToast } from "@/components/ui/SavedProfileToast";
import { SaveResultsModal } from "@/components/onboarding/SaveResultsModal";
import { SocialShareActions } from "@/components/ui/SocialShareActions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { getEngagedIds, getStatsSummary } from "@/lib/analytics/tracker";
import type { BehaviorStatsSummary } from "@/lib/analytics/tracker";
import type { UserStats } from "@/lib/ai/orchestrator";
import type { LookData } from "@/types/result";
import type { VisualAnalysisPayload } from "@/types/visual-analysis";
import { orchestrateExperience } from "@/lib/ai/orchestrator";
import { buildResultSurface } from "@/lib/result/surface";
import {
  buildWhatsAppHandoffMessage,
  buildWhatsAppHandoffPayload,
  buildWhatsAppHandoffUrl,
  getWhatsAppHandoffPhone,
} from "@/lib/whatsapp/handoff";
import { registerSocialAction } from "@/lib/social/economy";
import { trackPotentialAbandonment } from "@/lib/whatsapp/AutomationEngine";

function ResultDashboardContent() {
  const searchParams = useSearchParams();
  const isSaved = searchParams.get("saved") === "true";
  const id = searchParams.get("id");
  const hardCapOperation = id?.startsWith("HARD_CAP_BLOCKED") ? id.split(":")[1] || "saved_result_generation" : null;
  const tenantBlockReason = id?.startsWith("TENANT_BLOCKED") ? id.split(":")[1] || "tenant_not_found" : null;
  const { data: onboardingData } = useOnboarding();
  const [tenantContext, setTenantContext] = React.useState<{
    whatsappNumber?: string | null;
    orgSlug?: string | null;
    branchName?: string | null;
  } | null>(null);
  const whatsappHandoffPhone = tenantContext?.whatsappNumber || getWhatsAppHandoffPhone();
  const canOpenWhatsAppHandoff = Boolean(whatsappHandoffPhone);

  const [engagedLookIds, setEngagedLookIds] = React.useState<string[]>([]);
  const [statsSummary, setStatsSummary] = React.useState<BehaviorStatsSummary | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [visualAnalysis, setVisualAnalysis] = React.useState<VisualAnalysisPayload | null>(null);

  const [isHandoffLoading, setIsHandoffLoading] = React.useState(false);

  React.useEffect(() => {
    if (!id || id === "MOCK_DB_FAIL") return;

    let cancelled = false;

    const loadVisualAnalysis = async () => {
      try {
        const response = await fetch(`/api/result/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as {
          analysis?: VisualAnalysisPayload | null;
          finalResult?: unknown;
          tenant?: {
            whatsappNumber?: string | null;
            orgSlug?: string | null;
            branchName?: string | null;
          } | null;
        };

        if (!cancelled && payload.analysis) {
          setVisualAnalysis(payload.analysis);
        }
        if (!cancelled) {
          setTenantContext(payload.tenant || null);
        }
      } catch (error) {
        console.warn("[RESULT] failed to load persisted visual analysis", error);
      }
    };

    void loadVisualAnalysis();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const surface = useMemo(() => buildResultSurface(onboardingData, visualAnalysis), [onboardingData, visualAnalysis]);

  const { rankedLooks, aiInsight } = useMemo(() => {
    const rawStats = statsSummary || { looks: {}, products: {} };
    const looksEntries = Object.entries(rawStats.looks) as Array<[string, Record<string, number>]>;
    const normalized = {
      views: Object.fromEntries(looksEntries.map(([lookId, data]) => [lookId, data.view || 0])),
      clicks: Object.fromEntries(looksEntries.map(([lookId, data]) => [lookId, data.click || 0])),
      shares: {},
      bundles: Object.fromEntries(looksEntries.map(([lookId, data]) => [lookId, data.complete_look || 0])),
      timeSpent: 130,
      tryOnUsed: engagedLookIds.length > 0,
    } satisfies UserStats;

    return orchestrateExperience(normalized, surface.looks || []);
  }, [surface.looks, statsSummary, engagedLookIds]);

  const featuredShareLook = rankedLooks?.[0] || surface.looks?.[0];
  const profileSignal = (
    visualAnalysis?.keySignals?.length
      ? visualAnalysis.keySignals.slice(0, 3)
      : [
          onboardingData.lifestyle.purchaseDna,
          onboardingData.lifestyle.purchaseBehavior,
          onboardingData.lifestyle.environments.slice(0, 2).join(", "),
        ]
  )
    .filter(Boolean)
    .join(" • ");

  const handleWhatsAppHandoff = async () => {
    if (!canOpenWhatsAppHandoff) {
      return;
    }

    const topLooks = (rankedLooks?.length ? rankedLooks : surface.looks).slice(0, 2);
    const handoffInput = {
      resultId: id,
      contactName: onboardingData.contact?.name || "",
      contactPhone: onboardingData.contact?.phone || "",
      styleIdentity: surface.hero.dominantStyle,
      dominantStyle: surface.hero.dominantStyle,
      imageGoal: onboardingData.intent.imageGoal || surface.diagnostic.desiredGoal,
      paletteFamily: surface.palette.family,
      lookSummary: topLooks,
      intentScore: aiInsight.intentScore,
      fit: onboardingData.body.fit || "",
      metal: onboardingData.colors.metal || surface.palette.metal,
    };

    const message = buildWhatsAppHandoffMessage(handoffInput);
    const url = buildWhatsAppHandoffUrl(message, whatsappHandoffPhone);
    if (!url) {
      return;
    }

    if (id) {
      const payload = buildWhatsAppHandoffPayload(handoffInput);
      const body = JSON.stringify({ resultId: id, payload });

      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/whatsapp-handoff", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/whatsapp-handoff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      }
    }

    registerSocialAction("advance");
    setIsHandoffLoading(true);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => setIsHandoffLoading(false), 1200);
  };

  const handleRestartConsultation = () => {
    sessionStorage.removeItem("venus_onboarding");
    localStorage.removeItem("venus_user_photo");
  };

  const handleGoToLooks = () => {
    setIsModalOpen(false);
    window.setTimeout(() => {
      document.getElementById("looks")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  if (hardCapOperation) {
    const title = hardCapOperation === "catalog_product_creation" ? "Limite do catálogo atingido" : "Limite de geração atingido";
    const description =
      hardCapOperation === "catalog_product_creation"
        ? "A criação deste produto foi bloqueada porque a org atingiu o limite server-side do plano atual."
        : "A geração deste dossiê foi bloqueada porque a org atingiu o limite server-side do plano atual.";

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
        <div className="w-full max-w-lg space-y-4 rounded-[32px] border border-red-500/20 bg-red-500/10 p-8">
          <Text className="text-[10px] font-bold uppercase tracking-[0.35em] text-red-400">Hard cap server-side</Text>
          <h1 className="text-2xl font-serif uppercase tracking-tighter">{title}</h1>
          <Text className="text-sm text-white/70">{description}</Text>
          <Text className="text-xs text-white/40">O bloqueio foi auditado no tenant core e a operação não foi executada.</Text>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Link href="/onboarding/chat" onClick={handleRestartConsultation}>
              <VenusButton variant="solid" className="w-full bg-white text-black sm:w-auto">
                Recomeçar consulta
              </VenusButton>
            </Link>
            <Link href="/">
              <VenusButton variant="outline" className="w-full border-white/10 sm:w-auto">
                Voltar ao início
              </VenusButton>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (tenantBlockReason) {
    const title =
      tenantBlockReason === "kill_switch_on"
        ? "Kill switch ativo"
        : tenantBlockReason === "suspended"
          ? "Org suspensa"
          : tenantBlockReason === "blocked"
            ? "Org bloqueada"
            : "Tenant sem acesso";
    const description =
      tenantBlockReason === "kill_switch_on"
        ? "A operação foi bloqueada porque o tenant está com kill switch ativo."
        : tenantBlockReason === "suspended"
          ? "A operação foi bloqueada porque a org está suspensa."
          : tenantBlockReason === "blocked"
            ? "A operação foi bloqueada porque a org está bloqueada."
            : "A operação foi bloqueada porque o tenant não pôde ser validado.";

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
        <div className="w-full max-w-lg space-y-4 rounded-[32px] border border-red-500/20 bg-red-500/10 p-8">
          <Text className="text-[10px] font-bold uppercase tracking-[0.35em] text-red-400">Tenant operational block</Text>
          <h1 className="text-2xl font-serif uppercase tracking-tighter">{title}</h1>
          <Text className="text-sm text-white/70">{description}</Text>
          <Text className="text-xs text-white/40">O bloqueio foi auditado em tenant core e a operação não foi executada.</Text>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Link href="/onboarding/chat" onClick={handleRestartConsultation}>
              <VenusButton variant="solid" className="w-full bg-white text-black sm:w-auto">
                Recomeçar consulta
              </VenusButton>
            </Link>
            <Link href="/">
              <VenusButton variant="outline" className="w-full border-white/10 sm:w-auto">
                Voltar ao início
              </VenusButton>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#04070A] px-6 text-white">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/5">
            <BookOpen className="h-8 w-8 text-[#D4AF37]" />
          </div>
          
          <div className="space-y-3">
            <h1 className="text-2xl font-serif uppercase tracking-tighter text-white">
              Sua leitura ainda não foi gerada
            </h1>
            <p className="text-sm leading-relaxed text-white/60">
              Complete o onboarding para revelar seu dossiê de estilo
            </p>
          </div>

          <Link href="/onboarding/chat" onClick={handleRestartConsultation}>
            <VenusButton variant="solid" className="w-full bg-[#D4AF37] text-black">
              Começar agora <ArrowRight className="ml-2 h-4 w-4" />
            </VenusButton>
          </Link>
        </div>
      </div>
    );
  }

  const showStickyActions = !isModalOpen;

  return (
    <div className={`flex min-h-screen flex-col overflow-x-hidden pb-36 transition-colors duration-1000 ${aiInsight.intensity === "HIGH" ? "bg-black" : "bg-[#0A0A0A]"}`}>
      {isSaved && <SavedProfileToast />}

      <div className="fixed left-1/2 top-4 z-[300] hidden -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-slate-950/55 px-4 py-2 backdrop-blur-3xl animate-in fade-in slide-in-from-top-4 sm:flex">
        <div className="relative">
          <Activity className="h-3 w-3 animate-pulse text-slate-300" />
          <div className="absolute inset-0 rounded-full bg-slate-300/15 blur-md" />
        </div>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-200">Leitura de intenção: {aiInsight.intentScore}%</span>
        <div className="h-3 w-[1px] bg-white/10" />
        <BrainCircuit className="h-3 w-3 text-white/40" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">Modo: {aiInsight.strategy.mode}</span>
      </div>

      <div className="relative overflow-hidden px-5 pb-10 pt-[4.5rem] transition-all sm:px-6 sm:pb-12 sm:pt-24">
        <div className="pointer-events-none absolute left-0 top-0 h-full w-full bg-gradient-to-b from-slate-200/8 to-transparent" />

        <div className="flex flex-col space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2">
            <div className="h-6 w-px bg-slate-200/70" />
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-200">Essência captada</span>
          </div>

          <h1 className="max-w-[11ch] text-[2.05rem] font-serif uppercase leading-[0.95] tracking-tighter sm:max-w-none sm:text-4xl">{surface.headline}</h1>

          <Text className="max-w-[18rem] text-[15px] leading-relaxed text-white/60 sm:max-w-[280px] sm:text-sm">{surface.subheadline}</Text>

          <div className="rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)] sm:rounded-[36px] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <Text className="text-[9px] font-bold uppercase tracking-[0.34em] text-slate-300">Leitura personalizada</Text>
                <Text className="text-[15px] font-semibold text-white sm:text-base">
                  {surface.essence.label} • {surface.essence.styleDirection}
                </Text>
              </div>
              <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.28em] text-slate-200">
                {surface.essence.confidenceLabel}
              </span>
            </div>
            <Text className="mt-2 text-[14px] leading-relaxed text-white/74 sm:text-sm">
              A Venus interpreta seu perfil e devolve uma curadoria de stylist, não um formulário.
            </Text>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                surface.essence.styleDirection,
                surface.palette.family,
                surface.palette.contrast,
                "Curadoria real",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/8 bg-black/25 px-3 py-2 text-[8px] font-bold uppercase tracking-[0.24em] text-white/55"
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {surface.essence.keySignals.slice(0, 3).map((signal) => (
                <span
                  key={signal}
                  className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.2em] text-white/45"
                >
                  {signal}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            {canOpenWhatsAppHandoff && (
              <VenusButton
                type="button"
                onClick={handleWhatsAppHandoff}
                disabled={isHandoffLoading}
              className="h-12 w-full bg-[#D4AF37] px-5 text-[9px] font-bold uppercase tracking-[0.28em] text-black hover:bg-[#D4AF37]/90 sm:w-auto sm:px-6 sm:tracking-[0.35em]"
              >
                {isHandoffLoading ? "Abrindo WhatsApp..." : surface.primaryCtaLabel}
              </VenusButton>
            )}
            <VenusButton
              type="button"
              variant="outline"
              onClick={handleGoToLooks}
              className="h-12 w-full border-white/10 px-5 text-[9px] font-bold uppercase tracking-[0.28em] sm:w-auto sm:px-6 sm:tracking-[0.35em]"
            >
              {surface.secondaryCtaLabel}
            </VenusButton>
          </div>

          {featuredShareLook && (
            <div className="pt-0">
              <SocialShareActions
                look={featuredShareLook}
                styleIdentity={surface.hero.dominantStyle}
                imageGoal={onboardingData.intent.imageGoal || surface.diagnostic.desiredGoal}
                essenceLabel={surface.essence.label}
                essenceSummary={surface.essence.summary}
                profileSignal={profileSignal}
                intentScore={aiInsight.intentScore}
                brandName="Venus Engine"
                appName="Venus Engine"
                resultUrl={typeof window !== "undefined" ? window.location.href : undefined}
              />
            </div>
          )}

          <div className="rounded-[30px] border border-white/6 bg-white/[0.03] p-4 sm:rounded-[34px] sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <Text className="text-[9px] font-bold uppercase tracking-[0.34em] text-white/35">Porta de entrada para a loja inteira</Text>
                <Text className="text-[16px] font-semibold leading-tight text-white sm:text-[17px]">
                  {surface.desirePulse.title}
                </Text>
                <Text className="max-w-[30rem] text-[14px] leading-relaxed text-white/65 sm:text-sm">
                  {surface.desirePulse.body}
                </Text>
              </div>
              <span className="rounded-full border border-white/10 bg-slate-200/10 px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.28em] text-slate-200">
                Máquina de aquisição
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {surface.desirePulse.bullets.map((bullet, index) => (
                <div key={bullet} className="rounded-[22px] border border-white/5 bg-black/20 p-3">
                  <div className="flex items-center justify-between">
                    <Text className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-200">{String(index + 1).padStart(2, "0")}</Text>
                    <Text className="text-[8px] uppercase tracking-[0.26em] text-white/30">
                      {index === 0 ? "Entende" : index === 1 ? "Posta" : "Atrai"}
                    </Text>
                  </div>
                  <Text className="mt-2 text-[13px] leading-relaxed text-white/72">{bullet}</Text>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/6 bg-white/[0.03] p-4 sm:rounded-[34px] sm:p-5">
            <div className="flex items-center gap-3">
              <BrainCircuit className="h-4 w-4 text-slate-300" />
              <span className="text-[10px] font-bold uppercase tracking-[0.34em] text-white/45">Leitura guiada</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                surface.essence.label,
                surface.palette.family,
                surface.hero.dominantStyle,
                "Curadoria real",
              ]
                .filter(Boolean)
                .slice(0, 4)
                .map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/8 bg-black/25 px-3 py-2 text-[8px] font-bold uppercase tracking-[0.24em] text-white/55"
                  >
                    {item}
                  </span>
                ))}
            </div>
            <Text className="mt-3 text-[13px] leading-relaxed text-white/65">
              A Venus usa a leitura visual e o catálogo para chegar ao look mais coerente sem expor bastidores técnicos para o cliente.
            </Text>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:mt-10 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-[24px] border border-white/5 bg-white/[0.03] p-3 sm:p-4">
            <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">Paleta</span>
            <span className="mt-2 block text-[10px] font-bold uppercase leading-tight">{surface.palette.family}</span>
          </div>
          <div className="rounded-[24px] border border-white/5 bg-white/[0.03] p-3 sm:p-4">
            <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">Contraste</span>
            <span className="mt-2 block text-[10px] font-bold uppercase leading-tight">{surface.palette.contrast}</span>
          </div>
          <div className="rounded-[24px] border border-white/5 bg-white/[0.03] p-3 sm:p-4">
            <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">Metal</span>
            <span className="mt-2 block text-[10px] font-bold uppercase leading-tight">{surface.palette.metal}</span>
          </div>
          <div className="rounded-[24px] border border-white/5 bg-white/[0.03] p-3 sm:p-4">
            <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">Fit</span>
            <span className="mt-2 block text-[10px] font-bold uppercase leading-tight">{onboardingData.body.fit || "Slim"}</span>
          </div>
        </div>
      </div>

      <div className="space-y-11 px-5 sm:space-y-14 sm:px-6">
        <section className="space-y-5 sm:space-y-6">
          <div className="flex items-center gap-3">
            <Target className="h-4 w-4 text-slate-300" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Leitura pessoal</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-3 rounded-[28px] border border-white/5 bg-white/[0.03] p-5 sm:rounded-[32px] sm:p-6">
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">O que o perfil pede</span>
              <Text className="text-[15px] italic text-white/90 sm:text-sm">&quot;{surface.diagnostic.desiredGoal}&quot;</Text>
            </div>
            <div className="space-y-3 rounded-[28px] border border-white/8 bg-white/[0.03] p-5 sm:rounded-[32px] sm:p-6">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">Como o resultado fecha o gap</span>
              <Text className="text-[15px] text-white/90 sm:text-sm">{surface.diagnostic.gapSolution}</Text>
            </div>
          </div>
        </section>

        <section className="space-y-5 sm:space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LayoutGrid className="h-4 w-4 text-white/40" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Sua paleta pessoal</span>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">{surface.palette.family}</span>
          </div>

          <div className="flex h-[4.5rem] gap-2.5 overflow-hidden rounded-[28px] sm:h-20 sm:gap-3 sm:rounded-[32px]">
            {surface.palette.colors.map((color, index) => (
              <div key={index} className="group relative flex-1 transition-all hover:flex-[2]" style={{ backgroundColor: color.hex }}>
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-white">{color.name}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-[28px] border border-white/5 bg-white/[0.03] p-5 sm:rounded-[32px] sm:p-6">
            <Text className="text-[9px] font-bold uppercase tracking-widest text-white/30">Por que isso combina com você</Text>
            <Text className="mt-2 text-[15px] leading-relaxed text-white/80 sm:text-sm">{surface.palette.description}</Text>
          </div>
        </section>

        <section id="looks" className="space-y-6 sm:space-y-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-slate-300" />
                <span className="px-2 text-[10px] font-bold uppercase tracking-widest">Looks sugeridos</span>
              </div>
              {aiInsight.intentScore > 60 && (
                <span className="animate-pulse rounded-full bg-red-500/10 px-3 py-1 text-[8px] font-bold uppercase tracking-widest text-red-500">
                  Intenção alta: prioridade de contato
                </span>
              )}
            </div>
          </div>

          <div className="hidden grid-cols-1 gap-3 sm:grid">
            {surface.lookHierarchy.map((item) => (
              <div key={item.label} className="rounded-[24px] border border-white/5 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-200">{item.label}</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">{item.title}</span>
                </div>
                <Text className="mt-2 text-xs leading-relaxed text-white/70">{item.description}</Text>
              </div>
            ))}
          </div>

          <div className="space-y-10 sm:space-y-16">
            {rankedLooks.map((look: LookData, index: number) => (
              <div key={look.id} className="relative">
                {(index === 0 || aiInsight.intensity === "HIGH") && (
                  <div className="absolute -top-5 left-2 flex items-center gap-2 sm:-top-6">
                    <Star size={10} className="text-slate-300" />
                    <span className="text-[8px] font-bold uppercase tracking-widest text-white/40">Este é o look mais coerente com o seu perfil</span>
                  </div>
                )}
                <LookCardSwipeable look={look} strategy={aiInsight.strategy} intensity={aiInsight.intensity} />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6 sm:space-y-8">
          <div className="flex items-center gap-3">
            <PackageCheck className="h-4 w-4 text-white/40" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Como o look te favorece</span>
          </div>
          <div className="space-y-3 sm:space-y-4">
            <div className="group rounded-[28px] border border-white/5 bg-white/[0.02] p-5 sm:rounded-[32px] sm:p-6">
              <Text className="mb-2 text-[9px] font-bold uppercase tracking-widest text-white/30">Ombros</Text>
              <Text className="text-[15px] leading-relaxed text-white/80 sm:text-sm">{surface.bodyVisagism.shoulders}</Text>
            </div>
            <div className="group rounded-[28px] border border-white/5 bg-white/[0.02] p-5 sm:rounded-[32px] sm:p-6">
              <Text className="mb-2 text-[9px] font-bold uppercase tracking-widest text-white/30">Rosto</Text>
              <Text className="text-[15px] leading-relaxed text-white/80 sm:text-sm">{surface.bodyVisagism.face}</Text>
            </div>
            <div className="group rounded-[28px] border border-white/5 bg-white/[0.02] p-5 sm:rounded-[32px] sm:p-6">
              <Text className="mb-2 text-[9px] font-bold uppercase tracking-widest text-white/30">Caimento</Text>
              <Text className="text-[15px] leading-relaxed text-white/80 sm:text-sm">{surface.bodyVisagism.generalFit}</Text>
            </div>
          </div>
        </section>

        <section className="space-y-5 sm:space-y-6">
          <div className="flex items-center gap-3">
            <History className="h-4 w-4 text-red-500/40" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">O que evitar</span>
          </div>
          <div className="space-y-3">
            {surface.toAvoid.map((item, index) => (
              <div key={index} className="group flex items-center gap-4 border-b border-white/5 py-4">
                <div className="h-1.5 w-1.5 rounded-full bg-red-500/20 transition-colors group-hover:bg-red-500" />
                <Text className="text-xs text-white/40 transition-colors group-hover:text-white/80">{item}</Text>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col items-center space-y-3 pb-10 pt-14 text-center sm:space-y-4 sm:pt-20">
          <Text className="text-[9px] font-bold uppercase tracking-[0.5em] text-white/20">{surface.footerLabel}</Text>
          <Text className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40 sm:tracking-[0.35em]">
            Seu próximo passo já está acima: WhatsApp, salvar ou compartilhar os looks.
          </Text>
        </div>
      </div>

      {showStickyActions && (
        <div className="fixed bottom-4 left-1/2 z-[200] flex w-[calc(100%-24px)] max-w-sm -translate-x-1/2 flex-col items-center gap-3 sm:bottom-6 sm:w-[calc(100%-48px)] sm:gap-4">
          {!onboardingData.contact?.phone && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mb-1 flex w-full items-center justify-center gap-2 rounded-full bg-[#D4AF37] p-3.5 text-black shadow-2xl transition-all active:scale-95 sm:mb-2 sm:p-4"
            >
              <Bookmark size={16} />
              <span className="text-[9px] font-bold uppercase tracking-widest sm:text-[10px]">Salvar minha leitura</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleGoToLooks}
            className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-full bg-white p-3.5 text-black shadow-2xl transition-transform active:scale-[0.98] sm:p-4"
          >
            <div className="absolute inset-0 translate-x-full bg-slate-200 transition-transform duration-500 group-hover:translate-x-0" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/5 sm:h-8 sm:w-8">
                <Watch size={16} />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest sm:text-[10px]">Ir para os looks</span>
            </div>
            <ArrowRight size={16} className="relative z-10" />
          </button>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-[150] flex h-14 items-center justify-between bg-[#C9A84C] px-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-black">● A Venus está online — {tenantContext?.branchName || tenantContext?.orgSlug || "Venus"}</span>
          <a
            href={whatsappHandoffPhone ? `https://wa.me/${whatsappHandoffPhone}` : "#"}
            className="flex items-center gap-2 rounded-full bg-black px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-[#C9A84C]"
          >
            Continuar no WhatsApp →
          </a>
        </div>

      <SaveResultsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onGoToLooks={handleGoToLooks}
        stats={statsSummary}
      />
    </div>
  );
}

export default function ResultDashboardPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black text-white">Carregando...</div>}>
      <ResultDashboardContent />
    </Suspense>
  );
}
