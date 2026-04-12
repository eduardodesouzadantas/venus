"use client";

import React, { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { SaveResultsModal } from "@/components/onboarding/SaveResultsModal";
import { SocialShareActions } from "@/components/ui/SocialShareActions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { useUserImage } from "@/lib/onboarding/UserImageContext";
import { syncLeadContext } from "@/lib/lead-context/client";
import { useTryOn, TRYON_LOADING_MESSAGES } from "@/hooks/useTryOn";
import { buildResultSurface, type ResultSurface } from "@/lib/result/surface";
import { decideNextAction } from "@/lib/decision-engine/engine";
import { DecisionResult } from "@/lib/decision-engine/types";
import { buildWhatsAppHandoffMessage, buildWhatsAppHandoffUrl } from "@/lib/whatsapp/handoff";

// Categorization logic for the try-on engine
function inferTryOnCategory(product: any): "tops" | "bottoms" | "one-pieces" {
  const source = `${product.category || ""} ${product.name || ""}`.toLowerCase();
  if (source.includes("vestido") || source.includes("dress") || source.includes("macacão")) return "one-pieces";
  if (source.includes("calça") || source.includes("saia") || source.includes("short") || source.includes("bermuda")) return "bottoms";
  return "tops";
}

function ResultDashboardContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const { data: onboardingData } = useOnboarding();
  const { userPhoto } = useUserImage();
  const { status: tryOnStatus, imageUrl: tryOnImageUrl, error: tryOnError, startTryOn, progress: tryOnProgress } = useTryOn();

  const [surface, setSurface] = React.useState<ResultSurface | null>(null);
  const [persistedTryOn, setPersistedTryOn] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [showSaveModal, setShowSaveModal] = React.useState(false);
  const [tenantContext, setTenantContext] = React.useState<{
    whatsappNumber?: string | null;
    orgSlug?: string | null;
    orgId?: string | null;
    branchName?: string | null;
  } | null>(null);
  const [pendingTryOnProduct, setPendingTryOnProduct] = React.useState<{ id: string; name?: string | null; photoUrl?: string | null; category?: string | null } | null>(null);
  const [decision, setDecision] = React.useState<DecisionResult | null>(null);


  React.useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const response = await fetch(`/api/result/${encodeURIComponent(id || "")}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Result not found");
        const payload = await response.json();
        if (payload.tenant) setTenantContext(payload.tenant);
        if (payload.lastTryOn) setPersistedTryOn(payload.lastTryOn);

        const builtSurface = buildResultSurface(onboardingData, payload.analysis);
        setSurface(builtSurface);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load results");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, onboardingData, tryOnImageUrl]); // Refresh when new image is generated

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C9A84C] border-t-transparent" />
          <p className="font-mono text-[9px] tracking-[0.2em] text-[#C9A84C]">SINTONIZANDO ESSÊNCIA...</p>
        </div>
      </div>
    );
  }

  if (error || !surface) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center">
        <p className="text-sm text-white/40">{error || "Resultado não encontrado"}</p>
        <Link href="/" className="mt-6 text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">Voltar ao início</Link>
      </div>
    );
  }

  const result = surface;
  const org = {
    name: tenantContext?.branchName || tenantContext?.orgSlug || "sua loja",
    whatsapp_phone: tenantContext?.whatsappNumber || "5511967011133"
  };

  const whatsappUrl = useMemo(() => {
    if (!result || !surface) return "";
    const message = buildWhatsAppHandoffMessage({
      contactName: onboardingData.contact?.name,
      styleIdentity: result.essence.label,
      imageGoal: onboardingData.intent?.imageGoal,
      lookSummary: result.looks as any,
      lastTryOn: tryOnImageUrl ? { image_url: tryOnImageUrl, status: "completed" } : persistedTryOn,
      decision: decision ? { action: decision.chosenAction, reason: decision.reason } : undefined,
    });
    return buildWhatsAppHandoffUrl(message, tenantContext?.whatsappNumber || "5511967011133") || "";
  }, [result, surface, onboardingData, tryOnImageUrl, persistedTryOn, decision, tenantContext]);

  const tryOnPersonImage = userPhoto || onboardingData.scanner.bodyPhoto || onboardingData.scanner.facePhoto || "";
  const resolvedOrgId = tenantContext?.orgId || onboardingData.tenant?.orgId || "";
  const displayImageUrl = tryOnImageUrl || persistedTryOn?.image_url;
  const isPreviousLook = !tryOnImageUrl && !!persistedTryOn?.image_url;
  const isGenerating = tryOnStatus === "queued" || tryOnStatus === "processing";
  const firstTryOnProduct = result.looks[0]?.items?.[0] || null;

  const currentLoadingMessage = (() => {
    if (tryOnProgress < 30) return TRYON_LOADING_MESSAGES[0];
    if (tryOnProgress < 70) return TRYON_LOADING_MESSAGES[1];
    return TRYON_LOADING_MESSAGES[2];
  })();

  const handleGenerateTryOn = (productId: string) => {
    if (!tryOnPersonImage || !resolvedOrgId || !id) return;
    const selectedProduct = result.looks[0]?.items?.find((item) => item.id === productId) || firstTryOnProduct;
    setPendingTryOnProduct(
      selectedProduct
        ? {
          id: selectedProduct.id,
          name: selectedProduct.name,
          photoUrl: selectedProduct.photoUrl || null,
          category: selectedProduct.category || null,
        }
        : null
    );
    startTryOn({
      model_image: tryOnPersonImage,
      product_id: productId,
      org_id: resolvedOrgId,
      saved_result_id: id
    });
  };

  React.useEffect(() => {
    if (tryOnStatus !== "completed" || !tryOnImageUrl || !resolvedOrgId || !id || !pendingTryOnProduct) {
      return;
    }

    void syncLeadContext({
      orgId: resolvedOrgId,
      savedResultId: id,
      eventType: "tryon_generated",
      action: "SUGGEST_NEW_LOOK",
      outcome: "REQUESTED_VARIATION",
      lastTryon: {
        personImageUrl: tryOnPersonImage || null,
        garmentImageUrl: pendingTryOnProduct.photoUrl || null,
        generatedImageUrl: tryOnImageUrl,
        lookName: pendingTryOnProduct.name || result.looks[0]?.name || null,
        lookId: pendingTryOnProduct.id,
        category: pendingTryOnProduct.category || inferTryOnCategory(pendingTryOnProduct),
        requestId: null,
        updatedAt: new Date().toISOString(),
      },
      lastAction: "SUGGEST_NEW_LOOK",
      lastActionOutcome: "REQUESTED_VARIATION",
    });

    setPendingTryOnProduct(null);
  }, [tryOnStatus, tryOnImageUrl, resolvedOrgId, id, pendingTryOnProduct, tryOnPersonImage, result.looks]);

  // Decision Engine Trigger
  React.useEffect(() => {
    if (loading || !result) return;

    const intentScore = (onboardingData.intent?.satisfaction || 5) as number;
    const nextAction = decideNextAction({
      intent_score: intentScore,
      last_tryon: tryOnImageUrl ? { image_url: tryOnImageUrl, status: "completed" } : persistedTryOn,
      last_products_viewed: [], // To be populated if needed
      last_recommendations: result.looks || [],
      whatsapp_context: {}, // To be populated from session
      emotional_state: {},
      timestamps: {
        last_interaction_at: new Date().toISOString(),
      }
    });

    setDecision(nextAction);
    console.log("[Decision Engine] Next Action:", nextAction);
  }, [tryOnImageUrl, persistedTryOn, result, loading, onboardingData.intent?.satisfaction]);

  const openWhatsApp = async (url: string) => {
    if (resolvedOrgId && id) {
      void syncLeadContext({
        orgId: resolvedOrgId,
        savedResultId: id,
        eventType: "whatsapp_clicked",
        action: "SEND_WHATSAPP_MESSAGE",
        outcome: "WHATSAPP_CLICKED",
        whatsappContext: {
          source: "result_page",
          destination: url,
          whatsappClickedAt: new Date().toISOString(),
          lastAction: "SEND_WHATSAPP_MESSAGE",
          lastActionOutcome: "WHATSAPP_CLICKED",
        },
      });
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] pb-24 text-[#f0ece4] selection:bg-[#C9A84C]/30">
      {/* SEÇÃO HERO - TRY-ON CENTRIC */}
      <section className="px-5 pt-8">
        <div className="relative mx-auto max-w-lg">
          {/* Container "Dark Luxury" */}
          <div className="relative aspect-[3/4] overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.02] shadow-[0_22px_70px_rgba(0,0,0,0.6)]">
            {isGenerating ? (
              <div className="flex h-full w-full flex-col items-center justify-center bg-black/60 p-8 text-center backdrop-blur-sm">
                <div className="relative h-16 w-16">
                  <div className="absolute inset-0 rounded-full border-2 border-[#C9A84C]/20" />
                  <div className="absolute inset-0 animate-spin rounded-full border-2 border-[#C9A84C] border-t-transparent" />
                  <Sparkles className="absolute inset-5 h-6 w-6 animate-pulse text-[#C9A84C]" />
                </div>
                <p className="mt-8 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#C9A84C]">
                  Gerando seu look
                </p>
                <p className="mt-4 text-[13px] text-white/60">
                  {currentLoadingMessage}
                </p>

                {/* Progress Bar */}
                <div className="mt-10 h-1 w-48 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-[#C9A84C]/50 to-[#C9A84C] transition-all duration-500 ease-out"
                    style={{ width: `${tryOnProgress}%` }}
                  />
                </div>
              </div>
            ) : displayImageUrl ? (
              <img
                src={displayImageUrl}
                alt="Seu look Venus"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center p-12 text-center">
                <div className="mb-6 rounded-full bg-[#C9A84C]/10 p-5">
                  <Sparkles className="h-8 w-8 text-[#C9A84C]" />
                </div>
                <p className="text-balance text-[15px] font-medium leading-relaxed text-white/80">
                  A Venus está pronta para projetar seu primeiro look.
                </p>
                <VenusButton
                  onClick={() => result.looks[0]?.items[0] && handleGenerateTryOn(result.looks[0].items[0].id)}
                  className="mt-8"
                >
                  Gerar minha imagem
                </VenusButton>
              </div>
            )}

            {/* Overlay Gradient (Luxury Feel) */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/80 via-transparent to-transparent" />

            {/* Validation Tag / Memory Tag */}
            {displayImageUrl && !isGenerating && (
              <div className="absolute top-6 left-6 flex flex-col gap-2">
                {isPreviousLook && (
                  <div className="flex items-center gap-2 rounded-full border border-[#C9A84C]/20 bg-black/60 px-4 py-2 backdrop-blur-md">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#C9A84C]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">Memória Venus</span>
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 backdrop-blur-md">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#C9A84C] animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">Venus Verified Look</span>
                </div>
              </div>
            )}
          </div>

          {/* Consultative Content */}
          <div className="mt-10 space-y-6 text-center">
            <div className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#C9A84C]">Sua Presença</p>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-white">
                {result.essence.label}
              </h1>
              <p className="mx-auto max-w-sm text-[16px] leading-relaxed text-white/60">
                {isPreviousLook
                  ? "Você testou esse look antes. Ele continua sendo uma escolha poderosa para sua essência."
                  : decision?.chosenAction === "SEND_WHATSAPP_MESSAGE"
                    ? "Sua imagem projetada com precisão. Este visual transmite a confiança que você busca."
                    : persistedTryOn?.style_reason || "Uma leitura baseada na sua colorimetria e curadoria pessoal."
                }
              </p>
            </div>

            {/* Primary CTAs */}
            <div className="flex flex-col gap-3 pt-4">
              <Link
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => {
                  event.preventDefault();
                  void openWhatsApp(whatsappUrl);
                }}
                className="flex h-14 items-center justify-center rounded-2xl bg-[#C9A84C] px-6 text-[13px] font-black uppercase tracking-widest text-black transition-transform active:scale-95 group"
              >
                {decision?.chosenAction === "SEND_WHATSAPP_MESSAGE"
                  ? "Garantir esse look agora"
                  : decision?.chosenAction === "SUGGEST_NEW_LOOK"
                    ? "Quer ver outra opção?"
                    : "Ver no WhatsApp"
                }
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>

              {decision?.chosenAction === "OFFER_DISCOUNT" && (
                <div className="rounded-2xl border border-[#C9A84C]/20 bg-[#C9A84C]/5 p-4 text-center animate-in fade-in zoom-in-95">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#C9A84C]">Oportunidade Única</p>
                  <p className="mt-1 text-xs text-white/70">Use **VENUSPRO** para 10% OFF agora.</p>
                </div>
              )}

              <button
                onClick={() => setShowSaveModal(true)}
                className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 text-[11px] font-bold uppercase tracking-widest text-white/90 transition-colors hover:bg-white/10"
              >
                Gerar outro look
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* DASHBOARD DETAILS - (More Discrete) */}
      <section className="mt-16 bg-white/[0.02] border-y border-white/5 py-12 px-5">
        <div className="mx-auto max-w-lg space-y-10">
          {/* Palette */}
          <div>
            <p className="mb-6 font-mono text-[9px] uppercase tracking-[0.3em] text-[#C9A84C]">Análise de Paleta • {result.palette.family}</p>
            <div className="flex gap-2">
              {result.palette.colors.slice(0, 5).map((cor: any, i: number) => (
                <div key={i} className="flex-1">
                  <div className="h-14 rounded-xl border border-white/5 shadow-lg" style={{ background: cor.hex }} />
                  <p className="mt-2 text-[8px] text-center text-white/40 uppercase">{cor.name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Core Signals */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/5 bg-black/20 p-5">
              <p className="text-[9px] text-white/40 uppercase tracking-widest mb-2 font-mono">Caimento</p>
              <p className="text-white text-[13px] font-medium">{onboardingData.body.fit || "Ajuste preciso"}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/20 p-5">
              <p className="text-[9px] text-white/40 uppercase tracking-widest mb-2 font-mono">Contraste</p>
              <p className="text-white text-[13px] font-medium">{onboardingData.colors.contrast || "Natural"}</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER NAV RE-SYNC */}
      <section className="px-5 py-12 pb-20">
        <div className="mx-auto max-w-lg text-center space-y-6">
          <p className="text-[12px] text-white/40">Venus Engine v1.0 • Catalog Synchronization</p>
          <div className="flex justify-center gap-4">
            {["Novidades", "Outlet", "Sair"].map(item => (
              <button key={item} className="text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-[#C9A84C] transition-colors">
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* WHATSAPP FIXED BANNER */}
      <div className="fixed bottom-0 left-0 right-0 z-[150] flex h-14 items-center justify-between bg-[#C9A84C] px-4 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-black flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-black animate-pulse" />
          A Venus está online — {org.name}
        </span>
        <Link
          href={`https://wa.me/${org.whatsapp_phone}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => {
            event.preventDefault();
            void openWhatsApp(`https://wa.me/${org.whatsapp_phone}`);
          }}
          className="rounded-lg bg-black px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#C9A84C] transition-transform active:scale-95"
        >
          Conversar Agora
        </Link>
      </div>

      <SaveResultsModal isOpen={showSaveModal} onClose={() => setShowSaveModal(false)} surface={surface} />
    </main>
  );
}

export default function ResultDashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <ResultDashboardContent />
    </Suspense>
  );
}
