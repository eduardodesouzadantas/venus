"use client";

import React, { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Activity, Bookmark, BrainCircuit, History, LayoutGrid, PackageCheck, Sparkles, Star, Target, Watch } from "lucide-react";
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
import { orchestrateExperience } from "@/lib/ai/orchestrator";
import { buildResultSurface } from "@/lib/result/surface";
import { buildWhatsAppHandoffMessage, buildWhatsAppHandoffPayload, buildWhatsAppHandoffUrl } from "@/lib/whatsapp/handoff";
import { registerSocialAction } from "@/lib/social/economy";
import { trackPotentialAbandonment } from "@/lib/whatsapp/AutomationEngine";

function ResultDashboardContent() {
  const searchParams = useSearchParams();
  const isSaved = searchParams.get("saved") === "true";
  const id = searchParams.get("id");
  const hardCapOperation = id?.startsWith("HARD_CAP_BLOCKED") ? id.split(":")[1] || "saved_result_generation" : null;
  const tenantBlockReason = id?.startsWith("TENANT_BLOCKED") ? id.split(":")[1] || "tenant_not_found" : null;
  const { data: onboardingData } = useOnboarding();

  const [engagedLookIds, setEngagedLookIds] = React.useState<string[]>([]);
  const [statsSummary, setStatsSummary] = React.useState<BehaviorStatsSummary | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isHandoffLoading, setIsHandoffLoading] = React.useState(false);

  React.useEffect(() => {
    setEngagedLookIds(getEngagedIds("look"));
    setStatsSummary(getStatsSummary());
  }, []);

  React.useEffect(() => {
    if (statsSummary && onboardingData.contact?.phone) {
      trackPotentialAbandonment(statsSummary, onboardingData.contact);
    }
  }, [statsSummary, onboardingData.contact]);

  React.useEffect(() => {
    if (!isSaved && !onboardingData.contact?.phone) {
      const timer = setTimeout(() => setIsModalOpen(true), 15000);
      return () => clearTimeout(timer);
    }
  }, [isSaved, onboardingData.contact]);

  const surface = useMemo(() => buildResultSurface(onboardingData), [onboardingData]);

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

  const handleWhatsAppHandoff = async () => {
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
    const url = buildWhatsAppHandoffUrl(message);

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

  if (hardCapOperation) {
    const title =
      hardCapOperation === "catalog_product_creation"
        ? "Limite do catálogo atingido"
        : "Limite de geração atingido";

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
            <Link href="/onboarding/intent" onClick={handleRestartConsultation}>
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
            <Link href="/onboarding/intent" onClick={handleRestartConsultation}>
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
      <div className="flex h-screen flex-col items-center justify-center bg-black">
        <Text className="mb-4 text-red-500">Dossiê não encontrado ou expirado.</Text>
        <Link href="/onboarding/intent" onClick={handleRestartConsultation}>
          <VenusButton variant="solid">Recomeçar consulta</VenusButton>
        </Link>
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen flex-col overflow-x-hidden pb-48 transition-colors duration-1000 ${aiInsight.intensity === "HIGH" ? "bg-black" : "bg-[#0A0A0A]"}`}>
      {isSaved && <SavedProfileToast />}

      <div className="fixed left-1/2 top-8 z-[300] flex -translate-x-1/2 items-center gap-3 rounded-full border border-[#D4AF37]/30 bg-black/40 px-4 py-2 backdrop-blur-3xl animate-in fade-in slide-in-from-top-4">
        <div className="relative">
          <Activity className="h-3 w-3 animate-pulse text-[#D4AF37]" />
          <div className="absolute inset-0 rounded-full bg-[#D4AF37]/20 blur-md" />
        </div>
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#D4AF37]">
          Leitura de intenção: {aiInsight.intentScore}%
        </span>
        <div className="h-3 w-[1px] bg-white/10" />
        <BrainCircuit className="h-3 w-3 text-white/40" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">Modo: {aiInsight.strategy.mode}</span>
      </div>

      <div className="relative overflow-hidden px-6 pb-12 pt-24 transition-all">
        <div className="pointer-events-none absolute left-0 top-0 h-full w-full bg-gradient-to-b from-[#D4AF37]/10 to-transparent" />

        <div className="flex flex-col space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-px bg-[#D4AF37]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#D4AF37]">Sua leitura pessoal</span>
          </div>

          <h1 className="text-4xl font-serif uppercase leading-none tracking-tighter">
            {surface.headline}
          </h1>

          <Text className="max-w-[280px] text-sm leading-relaxed text-white/60">
            {surface.subheadline}
          </Text>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <VenusButton
              onClick={handleWhatsAppHandoff}
              disabled={isHandoffLoading}
              className="h-12 w-full bg-[#D4AF37] px-6 text-[9px] font-bold uppercase tracking-[0.35em] text-black hover:bg-[#D4AF37]/90 sm:w-auto"
            >
              {isHandoffLoading ? "Abrindo WhatsApp..." : surface.primaryCtaLabel}
            </VenusButton>
            <Link href="#looks" className="w-full sm:w-auto">
              <VenusButton variant="outline" className="h-12 w-full border-white/10 px-6 text-[9px] font-bold uppercase tracking-[0.35em] sm:w-auto">
                {surface.secondaryCtaLabel}
              </VenusButton>
            </Link>
          </div>

          {featuredShareLook && (
            <div className="pt-4">
              <SocialShareActions
                look={featuredShareLook}
                styleIdentity={surface.hero.dominantStyle}
                imageGoal={onboardingData.intent.imageGoal || surface.diagnostic.desiredGoal}
                intentScore={aiInsight.intentScore}
                brandName="Maison Elite"
                appName="Venus Engine"
              />
            </div>
          )}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-[24px] border border-white/5 bg-white/[0.03] p-4">
            <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">Paleta</span>
            <span className="mt-2 block text-[10px] font-bold uppercase">{surface.palette.family}</span>
          </div>
          <div className="rounded-[24px] border border-white/5 bg-white/[0.03] p-4">
            <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">Contraste</span>
            <span className="mt-2 block text-[10px] font-bold uppercase">{surface.palette.contrast}</span>
          </div>
          <div className="rounded-[24px] border border-white/5 bg-white/[0.03] p-4">
            <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">Metal</span>
            <span className="mt-2 block text-[10px] font-bold uppercase">{surface.palette.metal}</span>
          </div>
          <div className="rounded-[24px] border border-white/5 bg-white/[0.03] p-4">
            <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">Fit</span>
            <span className="mt-2 block text-[10px] font-bold uppercase">{onboardingData.body.fit || "Slim"}</span>
          </div>
        </div>
      </div>

      <div className="px-6 space-y-14">
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <Target className="h-4 w-4 text-[#D4AF37]" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Leitura pessoal</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-3 rounded-[32px] border border-white/5 bg-white/[0.03] p-6">
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">O que o perfil pede</span>
              <Text className="text-sm italic text-white/90">&quot;{surface.diagnostic.desiredGoal}&quot;</Text>
            </div>
            <div className="space-y-3 rounded-[32px] border border-[#D4AF37]/10 bg-[#D4AF37]/5 p-6">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#D4AF37]">Como o resultado fecha o gap</span>
              <Text className="text-sm text-white/90">{surface.diagnostic.gapSolution}</Text>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LayoutGrid className="h-4 w-4 text-white/40" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Sua paleta pessoal</span>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#D4AF37]">{surface.palette.family}</span>
          </div>

          <div className="flex h-20 gap-3 overflow-hidden rounded-[32px]">
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
          <div className="rounded-[32px] border border-white/5 bg-white/[0.03] p-6">
            <Text className="text-[9px] font-bold uppercase tracking-widest text-white/30">Por que isso combina com você</Text>
            <Text className="mt-2 text-sm leading-relaxed text-white/80">
              {surface.palette.description}
            </Text>
          </div>
        </section>

        <section id="looks" className="space-y-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-[#D4AF37]" />
                <span className="px-2 text-[10px] font-bold uppercase tracking-widest">Looks sugeridos</span>
              </div>
              {aiInsight.intentScore > 60 && (
                <span className="animate-pulse rounded-full bg-red-500/10 px-3 py-1 text-[8px] font-bold uppercase tracking-widest text-red-500">
                  Intenção alta: prioridade de contato
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {surface.lookHierarchy.map((item) => (
              <div key={item.label} className="rounded-[24px] border border-white/5 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#D4AF37]">{item.label}</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">{item.title}</span>
                </div>
                <Text className="mt-2 text-xs leading-relaxed text-white/70">{item.description}</Text>
              </div>
            ))}
          </div>

          <div className="space-y-16">
            {rankedLooks.map((look: LookData, index: number) => (
              <div key={look.id} className="relative">
                {(index === 0 || aiInsight.intensity === "HIGH") && (
                  <div className="absolute -top-6 left-2 flex items-center gap-2">
                    <Star size={10} className="text-[#D4AF37]" />
                    <span className="text-[8px] font-bold uppercase tracking-widest text-white/40">
                      Este é o look mais coerente com o seu perfil
                    </span>
                  </div>
                )}
                <LookCardSwipeable look={look} strategy={aiInsight.strategy} intensity={aiInsight.intensity} />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <PackageCheck className="h-4 w-4 text-white/40" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Como o look te favorece</span>
          </div>
          <div className="space-y-4">
            <div className="group rounded-[32px] border border-white/5 bg-white/[0.02] p-6">
              <Text className="mb-2 text-[9px] font-bold uppercase tracking-widest text-white/30">Ombros</Text>
              <Text className="text-sm leading-relaxed text-white/80">{surface.bodyVisagism.shoulders}</Text>
            </div>
            <div className="group rounded-[32px] border border-white/5 bg-white/[0.02] p-6">
              <Text className="mb-2 text-[9px] font-bold uppercase tracking-widest text-white/30">Rosto</Text>
              <Text className="text-sm leading-relaxed text-white/80">{surface.bodyVisagism.face}</Text>
            </div>
            <div className="group rounded-[32px] border border-white/5 bg-white/[0.02] p-6">
              <Text className="mb-2 text-[9px] font-bold uppercase tracking-widest text-white/30">Caimento</Text>
              <Text className="text-sm leading-relaxed text-white/80">{surface.bodyVisagism.generalFit}</Text>
            </div>
          </div>
        </section>

        <section className="space-y-6">
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

        <div className="flex flex-col items-center space-y-4 pb-10 pt-20 text-center">
          <Text className="text-[9px] font-bold uppercase tracking-[0.5em] text-white/20">{surface.footerLabel}</Text>
          <Text className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/40">
            Seu próximo passo já está acima: WhatsApp, salvar ou revisar os looks.
          </Text>
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 z-[200] flex w-[calc(100%-48px)] max-w-sm -translate-x-1/2 flex-col items-center gap-4">
        {!onboardingData.contact?.phone && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#D4AF37] p-4 text-black shadow-2xl transition-all active:scale-95"
          >
            <Bookmark size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Salvar meus resultados</span>
          </button>
        )}
        <Link href="#looks" className="group relative flex w-full cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-full bg-white p-4 text-black shadow-2xl transition-transform active:scale-[0.98]">
          <div className="absolute inset-0 translate-x-full bg-[#D4AF37] transition-transform duration-500 group-hover:translate-x-0" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5">
              <Watch size={16} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">Ir para os looks</span>
          </div>
          <ArrowRight size={16} className="relative z-10" />
        </Link>
      </div>

      <SaveResultsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} stats={statsSummary} />
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
