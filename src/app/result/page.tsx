"use client";

import React, { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { SaveResultsModal } from "@/components/onboarding/SaveResultsModal";
import { SocialShareActions } from "@/components/ui/SocialShareActions";
import { ResultErrorBoundary } from "@/components/result/ResultErrorBoundary";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { useUserImage } from "@/lib/onboarding/UserImageContext";
import { syncLeadContext } from "@/lib/lead-context/client";
import { useTryOn, TRYON_LOADING_MESSAGES } from "@/hooks/useTryOn";
import { buildResultSurface, hasLegacyTryOnProducts, type ResultSurface } from "@/lib/result/surface";
import { RESULT_ID_PATTERN, isValidResultId } from "@/lib/result/id";
import { decideNextAction } from "@/lib/decision-engine/engine";
import { DecisionResult } from "@/lib/decision-engine/types";
import { buildWhatsAppHandoffMessage, buildWhatsAppHandoffUrl } from "@/lib/whatsapp/handoff";
import { ensureTryOnProductId } from "@/lib/tryon/product-id";
import { classifyTryOnQuality } from "@/lib/tryon/result-quality";

// Categorization logic for the try-on engine
function inferTryOnCategory(product: any): "tops" | "bottoms" | "one-pieces" {
  const source = `${product.category || ""} ${product.name || ""}`.toLowerCase();
  if (source.includes("vestido") || source.includes("dress") || source.includes("macacão")) return "one-pieces";
  if (source.includes("calça") || source.includes("saia") || source.includes("short") || source.includes("bermuda")) return "bottoms";
  return "tops";
}

function ResultDashboardContent() {
  // ──────────────────────────────────────────────────────────────
  // ALL HOOKS MUST BE CALLED UNCONDITIONALLY AT THE TOP
  // React Error #310 happens when hooks are called after early returns.
  // ──────────────────────────────────────────────────────────────
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");
  const { data: onboardingData } = useOnboarding();
  const { userPhoto } = useUserImage();
  const { status: tryOnStatus, imageUrl: tryOnImageUrl, error: tryOnError, startTryOn, progress: tryOnProgress } = useTryOn();

  const [surface, setSurface] = React.useState<ResultSurface | null>(null);
  const [persistedTryOn, setPersistedTryOn] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [redirecting, setRedirecting] = React.useState(false);
  const [showSaveModal, setShowSaveModal] = React.useState(false);
  const [tenantContext, setTenantContext] = React.useState<{
    whatsappNumber?: string | null;
    orgSlug?: string | null;
    orgId?: string | null;
    branchName?: string | null;
  } | null>(null);
  const [pendingTryOnProduct, setPendingTryOnProduct] = React.useState<{ id: string; product_id?: string | null; name?: string | null; photoUrl?: string | null; category?: string | null } | null>(null);
  const [decision, setDecision] = React.useState<DecisionResult | null>(null);

  // ── Derived values (safe even when surface is null) ──
  const looks = useMemo(() => (surface?.looks && Array.isArray(surface.looks) ? surface.looks : []), [surface]);
  const essenceLabel = surface?.essence?.label ?? "Sua Presença";
  const palette = surface?.palette ?? { family: "Personalizada", colors: [] as any[], metal: "Prateado", contrast: "Médio Alto" };
  const paletteFamily = palette.family ?? "Personalizada";
  const paletteColors = Array.isArray(palette.colors) ? palette.colors : [];
  const bodyFit = onboardingData?.body?.fit ?? "Ajuste preciso";
  const colorContrast = onboardingData?.colors?.contrast ?? "Natural";
  const hasLegacyTryOnLooks = hasLegacyTryOnProducts(looks);
  const tryOnAvailable = !!looks[0]?.product_id;
  const primaryTryOnProductId = looks[0]?.product_id || "";

  const org = useMemo(() => ({
    name: tenantContext?.branchName || tenantContext?.orgSlug || "sua loja",
    whatsapp_phone: tenantContext?.whatsappNumber || "5511967011133",
  }), [tenantContext]);

  const tryOnPersonImage = userPhoto || onboardingData?.scanner?.bodyPhoto || onboardingData?.scanner?.facePhoto || "";
  const resolvedOrgId = tenantContext?.orgId || onboardingData?.tenant?.orgId || "";
  const displayImageUrl = tryOnImageUrl || persistedTryOn?.image_url;
  const isPreviousLook = !tryOnImageUrl && !!persistedTryOn?.image_url;
  const isGenerating = tryOnStatus === "queued" || tryOnStatus === "processing";
  const firstTryOnProduct = looks[0]?.items?.[0] || null;
  const tryOnQuality = useMemo(() => classifyTryOnQuality({
    hasGeneratedImage: !!displayImageUrl,
    hasPersonImage: !!tryOnPersonImage,
    hasRealProduct: !!looks[0]?.product_id,
    isLegacyLook: hasLegacyTryOnLooks,
    isPreviousLook,
    hasTryOnError: !!tryOnError,
    primaryLookItemCount: looks[0]?.items?.length || 0,
  }), [displayImageUrl, tryOnPersonImage, looks, hasLegacyTryOnLooks, isPreviousLook, tryOnError]);

  const currentLoadingMessage = (() => {
    if (tryOnProgress < 30) return TRYON_LOADING_MESSAGES[0];
    if (tryOnProgress < 70) return TRYON_LOADING_MESSAGES[1];
    return TRYON_LOADING_MESSAGES[2];
  })();
  const needsPhotoRetry = tryOnQuality.state === "retry_required" && (hasLegacyTryOnLooks || !tryOnPersonImage || !!tryOnError);
  const retryPhotoHref = tenantContext?.orgSlug
    ? `/scanner/face?org=${encodeURIComponent(tenantContext.orgSlug)}`
    : "/scanner/face";
  const mainCtaLabel =
    tryOnQuality.state === "hero"
      ? "Garantir esse look agora"
      : tryOnQuality.state === "preview"
        ? "Refazer foto"
        : needsPhotoRetry
          ? "Tirar nova foto"
          : "Gerar minha imagem";
  const secondaryCtaLabel =
    tryOnQuality.state === "hero"
      ? "Ver no WhatsApp"
      : "Voltar ao resultado";

  React.useEffect(() => {
    if (!surface) return;

    if (hasLegacyTryOnLooks) {
      console.warn("[TRYON_LEGACY_LOOKS]", {
        resultId: id,
        orgId: resolvedOrgId || onboardingData?.tenant?.orgId || null,
        lookIds: looks.map((look) => look.id),
        productIds: looks.flatMap((look) => [look.product_id, ...look.items.map((item) => item.product_id || "")]),
      });
    }
  }, [surface, hasLegacyTryOnLooks, id, resolvedOrgId, onboardingData?.tenant?.orgId, looks]);

  // ── WhatsApp URL (memo, always called) ──
  const whatsappUrl = useMemo(() => {
    if (!surface) return "";
    const message = buildWhatsAppHandoffMessage({
      contactName: onboardingData?.contact?.name,
      styleIdentity: essenceLabel,
      imageGoal: onboardingData?.intent?.imageGoal,
      lookSummary: looks as any,
      lastTryOn: tryOnImageUrl ? { image_url: tryOnImageUrl, status: "completed" } : persistedTryOn,
      decision: decision ? { action: decision.chosenAction, reason: decision.reason } : undefined,
    });
    return buildWhatsAppHandoffUrl(message, tenantContext?.whatsappNumber || "5511967011133") || "";
  }, [surface, onboardingData, essenceLabel, looks, tryOnImageUrl, persistedTryOn, decision, tenantContext]);

  // ── Global error instrumentation (always called) ──
  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error("[CLIENT_FATAL]", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("[CLIENT_REJECTION]", event.reason);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  // ── Data loading effect (always called) ──
  React.useEffect(() => {
    if (redirecting) {
      return;
    }

    if (!id || !isValidResultId(id)) {
      const restartTarget = onboardingData?.tenant?.orgSlug
        ? `/onboarding/chat?org=${encodeURIComponent(onboardingData.tenant.orgSlug)}`
        : "/onboarding/chat";

      setRedirecting(true);
      router.replace(restartTarget);
      return;
    }

    let shouldAbort = false;

    async function load() {
      try {
        console.log(`[DEBUG][RESULT_PAGE] Fetching result: ${id}`);
        const response = await fetch(`/api/result/${encodeURIComponent(id || "")}`, { cache: "no-store" });

        if (!response.ok) {
          console.warn(`[DEBUG][RESULT_PAGE] Result ${id} 404. Attempting recovery via Lead Context...`);
          const recoveryRes = await fetch(`/api/lead-context/recovery?result_id=${encodeURIComponent(id || "")}`);

          if (recoveryRes.ok) {
            const recoveryPayload = await recoveryRes.json();
            console.log(`[DEBUG][RESULT_PAGE] Recovery success:`, recoveryPayload);
            if (recoveryPayload.tenant) setTenantContext(recoveryPayload.tenant);
            if (recoveryPayload.lastTryOn) setPersistedTryOn(recoveryPayload.lastTryOn);

            const fallbackAnalysis = recoveryPayload.analysis || {
              essence: { label: onboardingData?.intent?.styleDirection || "Sua Essência", reason: "Sincronia baseada no seu perfil pessoal." },
              palette: { family: "Personalizada", colors: [] },
              looks: [],
            };
            setSurface(buildResultSurface(onboardingData, fallbackAnalysis));
            return;
          }

          shouldAbort = true;
          setRedirecting(true);
          router.replace(
            onboardingData?.tenant?.orgSlug
              ? `/onboarding/chat?org=${encodeURIComponent(onboardingData.tenant.orgSlug)}`
              : "/onboarding/chat"
          );
          return;
        }

        const payload = await response.json();
        console.log(`[DEBUG][RESULT_PAGE] Result loaded successfully`);
        if (payload.tenant) setTenantContext(payload.tenant);
        if (payload.lastTryOn) setPersistedTryOn(payload.lastTryOn);

        const builtSurface = buildResultSurface(onboardingData, payload.analysis, payload.finalResult);
        setSurface(builtSurface);
      } catch (err) {
        if (!shouldAbort) {
          console.error(`[DEBUG][RESULT_PAGE] Load error:`, err);
          setError(err instanceof Error ? err.message : "Sintonizando...");
        }
      } finally {
        if (!shouldAbort) {
          setLoading(false);
        }
      }
    }
    load();
  }, [id, onboardingData, redirecting, router, tryOnImageUrl]);

  // ── Try-on sync effect (always called) ──
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
        lookName: pendingTryOnProduct.name || looks[0]?.name || null,
        lookId: pendingTryOnProduct.id,
        category: pendingTryOnProduct.category || inferTryOnCategory(pendingTryOnProduct),
        requestId: null,
        updatedAt: new Date().toISOString(),
      },
      lastAction: "SUGGEST_NEW_LOOK",
      lastActionOutcome: "REQUESTED_VARIATION",
    });

    setPendingTryOnProduct(null);
  }, [tryOnStatus, tryOnImageUrl, resolvedOrgId, id, pendingTryOnProduct, tryOnPersonImage, looks]);

  // ── Decision engine effect (always called) ──
  React.useEffect(() => {
    if (loading || !surface) return;

    const intentScore = (onboardingData?.intent?.satisfaction || 5) as number;
    const nextAction = decideNextAction({
      intent_score: intentScore,
      last_tryon: tryOnImageUrl ? { image_url: tryOnImageUrl, status: "completed" } : persistedTryOn,
      last_products_viewed: [],
      last_recommendations: looks || [],
      whatsapp_context: {},
      emotional_state: {},
      timestamps: {
        last_interaction_at: new Date().toISOString(),
      },
    });

    setDecision(nextAction);
    console.log("[Decision Engine] Next Action:", nextAction);
  }, [tryOnImageUrl, persistedTryOn, surface, loading, onboardingData?.intent?.satisfaction, looks]);

  // ── Handlers ──
  const handleGenerateTryOn = React.useCallback(
    (productId: string) => {
      if (!tryOnPersonImage || !resolvedOrgId || !id) return;
      const selectedProduct = looks[0]?.items?.find((item) => item.product_id === productId || item.id === productId) || firstTryOnProduct;
      const resolvedProductId = ensureTryOnProductId(selectedProduct?.product_id || "");
      if (!resolvedProductId) {
        console.error("[TRYON] Missing real product_id for try-on", {
          requestedProductId: productId,
          selectedProduct,
          org_id: resolvedOrgId,
        });
        return;
      }
      setPendingTryOnProduct(
        selectedProduct
          ? {
            id: selectedProduct.id,
            product_id: selectedProduct.product_id || null,
            name: selectedProduct.name,
            photoUrl: selectedProduct.photoUrl || null,
            category: selectedProduct.category || null,
          }
          : null
      );
      startTryOn({
        model_image: tryOnPersonImage,
        product_id: resolvedProductId,
        org_id: resolvedOrgId,
        saved_result_id: id,
      });
    },
    [tryOnPersonImage, resolvedOrgId, id, looks, firstTryOnProduct, startTryOn]
  );

  const openWhatsApp = React.useCallback(
    async (url: string) => {
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
    },
    [resolvedOrgId, id]
  );

  // ──────────────────────────────────────────────────────────────
  // EARLY RETURNS (after ALL hooks have been called)
  // ──────────────────────────────────────────────────────────────

  if (redirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C9A84C] border-t-transparent" />
          <p className="font-mono text-[9px] tracking-[0.2em] text-[#C9A84C]">REINICIANDO FLUXO...</p>
        </div>
      </div>
    );
  }

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
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#C9A84C]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-[#C9A84C] animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-serif text-xl text-white">Quase lá...</p>
            <p className="max-w-xs text-sm text-white/40 leading-relaxed">
              Estamos finalizando a sintonização do seu look. Essa conexão leva alguns segundos.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full border border-white/10 bg-white/5 px-8 py-3 text-[10px] font-bold uppercase tracking-widest text-[#C9A84C] transition-colors hover:bg-white/10"
          >
            Tentar Sincronizar Agora
          </button>
          <Link href="/" className="text-[10px] font-bold uppercase tracking-widest text-white/20 hover:text-white transition-colors">Voltar ao início</Link>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // MAIN RENDER (surface is guaranteed non-null here)
  // ──────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#0a0a0a] pb-24 text-[#f0ece4] selection:bg-[#C9A84C]/30">
      <section className="px-5 pt-8">
          <div className="relative mx-auto max-w-lg">
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
                <div className="mt-10 h-1 w-48 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-[#C9A84C]/50 to-[#C9A84C] transition-all duration-500 ease-out"
                    style={{ width: `${tryOnProgress}%` }}
                  />
                </div>
              </div>
            ) : displayImageUrl ? (
              <div className="relative h-full w-full">
                <img
                  src={displayImageUrl}
                  alt="Seu look Venus"
                  className="h-full w-full object-cover"
                />
                <div className="absolute left-6 top-6 rounded-full border border-[#C9A84C]/25 bg-black/65 px-4 py-2 backdrop-blur-md">
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#C9A84C]">
                    {tryOnQuality.badgeLabel}
                  </span>
                </div>
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="rounded-[22px] border border-white/10 bg-black/55 px-4 py-3 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">Por que este look funciona</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-white/82">
                      {tryOnQuality.reason}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center p-12 text-center">
                <div className="mb-6 rounded-full bg-[#C9A84C]/10 p-5">
                  <Sparkles className="h-8 w-8 text-[#C9A84C]" />
                </div>
                <p className="text-balance text-[15px] font-medium leading-relaxed text-white/80">
                  {tryOnQuality.state === "retry_required"
                    ? "Essa leitura ainda não atingiu o padrão premium. Vamos refazer com uma foto melhor."
                    : "A Venus está pronta para projetar seu primeiro look."}
                </p>
                <VenusButton
                  onClick={() => {
                    if (!tryOnAvailable) {
                      console.warn("[TRYON] blocked by legacy look without product_id", {
                        resultId: id,
                        orgId: resolvedOrgId || onboardingData?.tenant?.orgId || null,
                        lookId: looks[0]?.id || null,
                      });
                      return;
                    }
                    handleGenerateTryOn(primaryTryOnProductId);
                  }}
                  disabled={!tryOnAvailable}
                  className="mt-8"
                >
                  {tryOnAvailable ? mainCtaLabel : "Try-on indisponível"}
                </VenusButton>
                {!tryOnAvailable && (
                  <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                    Esse resultado veio de um legado salvo antes do Venus registrar o UUID real do produto.
                  </p>
                )}
              </div>
            )}

            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/80 via-transparent to-transparent" />

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

          {tryOnQuality.showBeforeAfter && displayImageUrl && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[24px] border border-white/5 bg-white/[0.03] p-3">
                <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.25em] text-white/35">Antes</p>
                <div className="aspect-[3/4] overflow-hidden rounded-[18px]">
                  <img src={tryOnPersonImage || displayImageUrl} alt="Foto de entrada" className="h-full w-full object-cover" />
                </div>
              </div>
              <div className="rounded-[24px] border border-[#C9A84C]/20 bg-[#C9A84C]/6 p-3">
                <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.25em] text-[#C9A84C]">Depois</p>
                <div className="aspect-[3/4] overflow-hidden rounded-[18px]">
                  <img src={displayImageUrl} alt="Try-on gerado" className="h-full w-full object-cover" />
                </div>
              </div>
            </div>
          )}

          <div className="mt-10 space-y-6 text-center">
            <div className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#C9A84C]">Sua Presença</p>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-white">
                {essenceLabel}
              </h1>
              <p className="mx-auto max-w-sm text-[16px] leading-relaxed text-white/60">
                {tryOnQuality.state === "hero"
                  ? "Sua imagem foi elevada ao padrão premium. A curadoria fecha com produto real, foto consistente e narrativa de transformação."
                  : tryOnQuality.state === "preview"
                    ? "A imagem existe e está perto da faixa hero, mas ainda merece validação antes de virar vitrine."
                    : "Esse resultado não atingiu integridade suficiente para exibição premium. Reenvie uma foto melhor para liberar a versão hero."
                }
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              {tryOnQuality.state === "hero" ? (
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
                  {mainCtaLabel}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              ) : (
                <Link
                  href={retryPhotoHref}
                  className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 text-[11px] font-bold uppercase tracking-widest text-white/90 transition-colors hover:bg-white/10"
                >
                  {mainCtaLabel}
                </Link>
              )}

              {tryOnQuality.showRetryPhotoCta && (
                tryOnQuality.state === "preview" && (
                  <button
                    type="button"
                    onClick={() => void openWhatsApp(whatsappUrl)}
                    className="flex h-12 items-center justify-center rounded-2xl border border-[#C9A84C]/20 bg-[#C9A84C]/8 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-[#C9A84C] transition-colors hover:bg-[#C9A84C]/12"
                  >
                    {secondaryCtaLabel}
                  </button>
                )
              )}

              {decision?.chosenAction === "OFFER_DISCOUNT" && (
                <div className="rounded-2xl border border-[#C9A84C]/20 bg-[#C9A84C]/5 p-4 text-center animate-in fade-in zoom-in-95">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#C9A84C]">Oportunidade Única</p>
                  <p className="mt-1 text-xs text-white/70">Use **VENUSPRO** para 10% OFF agora.</p>
                </div>
              )}

              <button
                onClick={() => router.push('/')}
                className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 text-[11px] font-bold uppercase tracking-widest text-white/90 transition-colors hover:bg-white/10"
              >
                Novo Perfil
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-16 bg-white/[0.02] border-y border-white/5 py-12 px-5">
        <div className="mx-auto max-w-lg space-y-10">
          <div>
            <p className="mb-6 font-mono text-[9px] uppercase tracking-[0.3em] text-[#C9A84C]">Análise de Paleta • {paletteFamily}</p>
            <div className="flex gap-2">
              {paletteColors.slice(0, 5).map((cor: any, i: number) => (
                <div key={i} className="flex-1">
                  <div className="h-14 rounded-xl border border-white/5 shadow-lg" style={{ background: cor.hex }} />
                  <p className="mt-2 text-[8px] text-center text-white/40 uppercase">{cor.name}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/5 bg-black/20 p-5">
              <p className="text-[9px] text-white/40 uppercase tracking-widest mb-2 font-mono">Caimento</p>
              <p className="text-white text-[13px] font-medium">{bodyFit}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/20 p-5">
              <p className="text-[9px] text-white/40 uppercase tracking-widest mb-2 font-mono">Contraste</p>
              <p className="text-white text-[13px] font-medium">{colorContrast}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-12 pb-20">
        <div className="mx-auto max-w-lg text-center space-y-6">
          <p className="text-[12px] text-white/40">Venus Engine v1.0 • Catalog Synchronization</p>
          <div className="flex justify-center gap-4">
            <Link href="/" className="text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-[#C9A84C] transition-colors">
              Início
            </Link>
          </div>
        </div>
      </section>

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
      <ResultErrorBoundary>
        <ResultDashboardContent />
      </ResultErrorBoundary>
    </Suspense>
  );
}
