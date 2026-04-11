"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
  ArrowRight, Sparkles, Download, Share2, Camera, 
  MessageCircle, Check, Wand2, Loader2 
} from "lucide-react";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { LookCardSwipeable } from "@/components/ui/LookCardSwipeable";
import { SavedProfileToast } from "@/components/ui/SavedProfileToast";
import { SaveResultsModal } from "@/components/onboarding/SaveResultsModal";
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
  buildWhatsAppHandoffUrl,
  getWhatsAppHandoffPhone,
} from "@/lib/whatsapp/handoff";
import { registerSocialAction } from "@/lib/social/economy";

const dataUrlToFile = async (dataUrl: string, fileName: string) => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || "image/png" });
};

export default function DramaticResultPage() {
  const searchParams = useSearchParams();
  const isSaved = searchParams.get("saved") === "true";
  const id = searchParams.get("id");
  const { data: onboardingData } = useOnboarding();

  const [tenantContext, setTenantContext] = useState<{
    whatsappNumber?: string | null;
    orgSlug?: string | null;
    branchName?: string | null;
  } | null>(null);
  
  const whatsappHandoffPhone = tenantContext?.whatsappNumber || getWhatsAppHandoffPhone();
  const canOpenWhatsApp = Boolean(whatsappHandoffPhone);

  const [engagedLookIds, setEngagedLookIds] = useState<string[]>([]);
  const [statsSummary, setStatsSummary] = useState<BehaviorStatsSummary | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [visualAnalysis, setVisualAnalysis] = useState<VisualAnalysisPayload | null>(null);

  const [currentSection, setCurrentSection] = useState<1 | 2 | 3 | 4>(1);
  const [isTryOnGenerating, setIsTryOnGenerating] = useState(false);
  const [tryOnProgress, setTryOnProgress] = useState(0);
  const [tryOnMessages, setTryOnMessages] = useState<string[]>([]);
  const [tryOnResult, setTryOnResult] = useState<string | null>(null);
  const [tryOnError, setTryOnError] = useState<string | null>(null);

  const [shareCaption, setShareCaption] = useState("");
  const [hasPosted, setHasPosted] = useState(false);
  const [isConfirmingShare, setIsConfirmingShare] = useState(false);

  useEffect(() => {
    setEngagedLookIds(getEngagedIds("look"));
    setStatsSummary(getStatsSummary());
  }, []);

  useEffect(() => {
    if (!id || id === "MOCK_DB_FAIL") return;

    let cancelled = false;
    const loadVisualAnalysis = async () => {
      try {
        const response = await fetch(`/api/result/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!response.ok) return;

        const payload = await response.json() as {
          analysis?: VisualAnalysisPayload | null;
          finalResult?: unknown;
          tenant?: { whatsappNumber?: string | null; orgSlug?: string | null; branchName?: string | null } | null;
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
    return () => { cancelled = true; };
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

  const featuredLook = rankedLooks?.[0] || surface.looks?.[0];

  const userPhoto = onboardingData.scanner.facePhoto || onboardingData.scanner.bodyPhoto || "";
  const lookImageUrl = featuredLook?.items?.[0]?.photoUrl || "";

  useEffect(() => {
    if (currentSection >= 2) {
      const baseCaption = `Acabei de descobrir meu estilo com a Venus ✨
A IA entendeu minha essência: ${surface.essence.label}
Quer descobrir o seu?`;

      const resultUrl = typeof window !== "undefined" ? window.location.href : "";
      setShareCaption(`${baseCaption}\n${resultUrl}`);
    }
  }, [currentSection, surface.essence.label]);

  const handleGenerateTryOn = async () => {
    if (!userPhoto || !lookImageUrl) {
      setTryOnError("Fotos não disponíveis para gerar o look.");
      return;
    }

    setIsTryOnGenerating(true);
    setTryOnProgress(0);
    setTryOnMessages(["Analisando sua silhueta..."]);
    setTryOnResult(null);
    setTryOnError(null);

    const messages = [
      "Analisando sua silhueta...",
      "Aplicando a peça...",
      "Ajustando os detalhes...",
    ];

    let progress = 0;
    const interval = setInterval(() => {
      progress += 15;
      setTryOnProgress(Math.min(progress, 90));
      
      const msgIndex = Math.floor(progress / 35);
      if (msgIndex < messages.length && !setTryOnMessages.toString().includes(messages[msgIndex])) {
        setTryOnMessages(prev => [...prev, messages[msgIndex]]);
      }
    }, 800);

    try {
      const response = await fetch("/api/try-on/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPhotoUrl: userPhoto,
          lookImageUrl: lookImageUrl,
          lookName: featuredLook?.name || "Look",
          brandName: "Venus Engine",
          appName: "Venus Engine",
          styleDirection: surface.essence.styleDirection,
          imageGoal: onboardingData.intent.imageGoal || surface.diagnostic.desiredGoal,
          essenceLabel: surface.essence.label,
          essenceSummary: surface.essence.summary,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || "Falha ao gerar imagem");
      }

      const data = await response.json() as { imageDataUrl?: string };

      clearInterval(interval);
      setTryOnProgress(100);
      setTryOnMessages(prev => [...prev, "Pronto!"]);
      
      if (data.imageDataUrl) {
        setTryOnResult(data.imageDataUrl);
      } else {
        setTryOnResult(userPhoto);
      }

      setTimeout(() => setCurrentSection(3), 1500);
    } catch (error) {
      clearInterval(interval);
      setTryOnError("Não foi possível gerar o try-on. Use a foto do look como alternativa.");
      setTryOnResult(lookImageUrl);
      setTimeout(() => setCurrentSection(3), 2000);
    } finally {
      setIsTryOnGenerating(false);
    }
  };

  const handleDownloadTryOn = async () => {
    if (!tryOnResult) return;
    const file = await dataUrlToFile(tryOnResult, "venus-tryon.png");
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleShareInstagram = async () => {
    setHasPosted(true);
    registerSocialAction("share");
  };

  const handleShareWhatsApp = () => {
    setHasPosted(true);
    registerSocialAction("share");
    const message = encodeURIComponent(`${shareCaption}\n\nPostado via Venus Engine`);
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  const handleConfirmShare = async () => {
    setIsConfirmingShare(true);
    try {
      await fetch("/api/share/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref_code: id, platform: "instagram", org_id: tenantContext?.orgSlug }),
      });
    } catch {}
    setIsConfirmingShare(false);
  };

  const handleGoToLooks = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      document.getElementById("looks")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  if (!id) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
        <div className="w-full max-w-sm space-y-8 text-center">
          <h1 className="text-2xl font-serif uppercase">Sua leitura ainda não foi gerada</h1>
          <Link href="/onboarding/chat">
            <VenusButton variant="solid">Começar agora</VenusButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {isSaved && <SavedProfileToast />}

      {currentSection === 1 && (
        <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-lg text-center space-y-8">
            <div className="space-y-4 animate-in fade-in zoom-in duration-1000">
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#D4AF37]">
                Essência captada
              </span>
              
              <h1 className="text-5xl font-serif uppercase tracking-tighter text-white leading-none">
                {surface.essence.label}
              </h1>
              
              <p className="text-lg text-white/60 max-w-md mx-auto">
                {surface.essence.summary}
              </p>
            </div>

            <div className="space-y-2 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
              {surface.essence.keySignals.slice(0, 3).map((signal, i) => (
                <p key={signal} className="text-sm text-white/40 animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${(i + 1) * 500}ms` }}>
                  {signal}
                </p>
              ))}
            </div>

            <div className="pt-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-1000">
              <VenusButton 
                onClick={() => setCurrentSection(2)}
                className="h-14 px-8 text-[11px] tracking-[0.3em]"
              >
                Ver como isso fica em mim →
              </VenusButton>
            </div>
          </div>
        </div>
      )}

      {currentSection === 2 && (
        <div className="flex min-h-screen flex-col px-6 py-12">
          <div className="w-full max-w-lg mx-auto space-y-6">
            <div className="text-center space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#D4AF37]">
                A Venus escolheu a peça certa para o seu perfil
              </span>
              <h2 className="text-2xl font-serif uppercase">{featuredLook?.name}</h2>
            </div>

            {lookImageUrl && (
              <div className="aspect-[3/4] rounded-[32px] overflow-hidden border border-white/10">
                <img src={lookImageUrl} alt="Peça selecionada" className="w-full h-full object-cover" />
              </div>
            )}

            <VenusButton 
              onClick={handleGenerateTryOn}
              disabled={isTryOnGenerating}
              className="h-14 w-full text-[11px] tracking-[0.3em]"
            >
              {isTryOnGenerating ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4" />
                  Gerar meu look
                </span>
              )}
            </VenusButton>

            {isTryOnGenerating && (
              <div className="space-y-4">
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F1D57F] transition-all duration-500"
                    style={{ width: `${tryOnProgress}%` }}
                  />
                </div>
                <div className="space-y-1">
                  {tryOnMessages.map((msg, i) => (
                    <p key={i} className="text-[10px] text-white/50 animate-in fade-in">
                      {msg}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {tryOnError && (
              <div className="p-4 rounded-[20px] border border-red-500/20 bg-red-500/10">
                <p className="text-sm text-red-200">{tryOnError}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {currentSection === 3 && (
        <div className="flex min-h-screen flex-col px-4 py-8">
          <div className="w-full max-w-md mx-auto space-y-6">
            <div className="text-center space-y-2">
              <p className="text-xl font-serif text-white">Esse sou eu.</p>
            </div>

            <div className="aspect-[3/4] rounded-[32px] overflow-hidden border border-white/10 shadow-2xl">
              <img 
                src={tryOnResult || lookImageUrl} 
                alt="Try-on resultado" 
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex flex-col gap-3">
              <VenusButton 
                onClick={() => setHasPosted(true)}
                className="h-14 w-full text-[11px] tracking-[0.3em] bg-gradient-to-r from-[#D4AF37] to-[#F1D57F]"
              >
                <span className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Postar e desbloquear vantagens →
                </span>
              </VenusButton>

              <div className="flex gap-3">
                <VenusButton 
                  onClick={handleShareWhatsApp}
                  variant="outline"
                  className="flex-1 h-12 text-[10px] tracking-[0.2em]"
                  disabled={!canOpenWhatsApp}
                >
                  <span className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </span>
                </VenusButton>

                <VenusButton 
                  onClick={handleDownloadTryOn}
                  variant="outline"
                  className="flex-1 h-12 text-[10px] tracking-[0.2em]"
                >
                  <span className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Baixar
                  </span>
                </VenusButton>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 block mb-2">
                  Légenda
                </label>
                <textarea
                  value={shareCaption}
                  onChange={(e) => setShareCaption(e.target.value)}
                  className="w-full h-24 bg-white/5 border border-white/10 rounded-[16px] p-4 text-sm text-white/80 resize-none focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="text-[9px] text-white/40">@VenusEngine @InovaCortex #VenusEngine</span>
              </div>
            </div>

            {hasPosted && (
              <VenusButton 
                onClick={handleConfirmShare}
                disabled={isConfirmingShare}
                className="h-14 w-full text-[11px] tracking-[0.3em]"
              >
                {isConfirmingShare ? "Confirmando..." : "Já postei — liberar minhas vantagens"}
              </VenusButton>
            )}

            <button 
              onClick={() => setCurrentSection(4)}
              className="w-full text-center text-[10px] text-white/40 hover:text-white/60 py-2"
            >
              Ver todos os looks →
            </button>
          </div>
        </div>
      )}

      {currentSection === 4 && (
        <div className="px-4 py-8 space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-serif uppercase">Looks completos</h2>
          </div>

          <div className="space-y-6 overflow-x-auto pb-4 -mx-4 px-4">
            {rankedLooks.map((look: LookData) => (
              <div key={look.id} className="flex-shrink-0 mx-auto">
                <LookCardSwipeable look={look} strategy={aiInsight.strategy} intensity={aiInsight.intensity} />
              </div>
            ))}
          </div>

          {canOpenWhatsApp && (
            <div className="max-w-md mx-auto">
              <VenusButton 
                onClick={() => {
                  const message = buildWhatsAppHandoffMessage({
                    resultId: id || "",
                    contactName: onboardingData.contact?.name || "",
                    contactPhone: onboardingData.contact?.phone || "",
                    styleIdentity: surface.hero.dominantStyle,
                    dominantStyle: surface.hero.dominantStyle,
                    imageGoal: onboardingData.intent.imageGoal || surface.diagnostic.desiredGoal,
                    paletteFamily: surface.palette.family,
                    lookSummary: rankedLooks.slice(0, 2),
                    intentScore: aiInsight.intentScore,
                    fit: onboardingData.body.fit || "",
                    metal: onboardingData.colors.metal || surface.palette.metal,
                  });
                  const url = buildWhatsAppHandoffUrl(message, whatsappHandoffPhone);
                  if (url) window.open(url, "_blank");
                }}
                className="h-12 w-full text-[10px] tracking-[0.3em]"
              >
                Falar com a loja no WhatsApp
              </VenusButton>
            </div>
          )}
        </div>
      )}

      <SaveResultsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onGoToLooks={handleGoToLooks}
        stats={statsSummary}
      />
    </div>
  );
}
