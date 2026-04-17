"use client";

import React, { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { VenusButton } from "@/components/ui/VenusButton";
import { SaveResultsModal } from "@/components/onboarding/SaveResultsModal";
import { ShareableLookCard } from "@/components/result/ShareableLookCard";
import { LookCompositionGallery } from "@/components/look-composition/LookCompositionGallery";
import { AssistedLookStrip } from "@/components/catalog/AssistedLookStrip";
import { ConversationalCatalogBlock } from "@/components/catalog/ConversationalCatalogBlock";
import type { LookComposition } from "@/lib/look-composition/engine";
import { ResultErrorBoundary } from "@/components/result/ResultErrorBoundary";
import { PremiumFallbackSurface } from "@/components/result/PremiumFallbackSurface";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { trackOnboardingConversionEvent } from "@/lib/onboarding/analytics";
import { useUserImage } from "@/lib/onboarding/UserImageContext";
import { syncLeadContext } from "@/lib/lead-context/client";
import { useTryOn, TRYON_LOADING_MESSAGES } from "@/hooks/useTryOn";
import { buildResultSurface, hasLegacyTryOnProducts, type ResultSurface } from "@/lib/result/surface";
import { buildAssistedCatalogProductCards, buildAssistedLookStripItems, buildAssistedRecommendationSurface } from "@/lib/catalog-query/presentation";
import { buildCatalogAccessCopy } from "@/lib/catalog-query/presentation";
import { isValidResultId } from "@/lib/result/id";
import { decideNextAction } from "@/lib/decision-engine/engine";
import { DecisionResult } from "@/lib/decision-engine/types";
import { buildWhatsAppHandoffMessage, buildWhatsAppHandoffUrl } from "@/lib/whatsapp/handoff";
import { ensureTryOnProductId } from "@/lib/tryon/product-id";
import { classifyTryOnQuality } from "@/lib/tryon/result-quality";
import { buildVenusResultNarrative, VENUS_STYLIST_NAME } from "@/lib/venus/brand";
import { buildVenusStylistAudit, type VenusStylistAudit } from "@/lib/venus/audit/engine";
import { TRYON_PREMIUM_FALLBACK_MESSAGE, TRYON_PREMIUM_REFINED_MESSAGE } from "@/lib/tryon/fallback-copy";
import { getStyleDirectionDisplayLabel, normalizeStyleDirectionPreference } from "@/lib/style-direction";
import { VenusLoadingScreen } from "@/components/ui/VenusLoadingScreen";

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
  const previewMode = searchParams.get("preview") === "1";
  const hasValidResultId = Boolean(id && isValidResultId(id));
  const { data: onboardingData } = useOnboarding();
  const { userPhoto } = useUserImage();
  const { status: tryOnStatus, imageUrl: tryOnImageUrl, error: tryOnError, lateSuccessNotice, startTryOn, progress: tryOnProgress } = useTryOn();

  const [surface, setSurface] = React.useState<ResultSurface | null>(null);
  const [persistedTryOn, setPersistedTryOn] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [redirecting, setRedirecting] = React.useState(false);
  const [showSaveModal, setShowSaveModal] = React.useState(false);
  const [catalogLink, setCatalogLink] = React.useState("");
  const [catalogSourceLabel, setCatalogSourceLabel] = React.useState<string | null>(null);
  const [socialFeedbackUrl, setSocialFeedbackUrl] = React.useState("");
  const [socialFeedbackNote, setSocialFeedbackNote] = React.useState("");
  const [socialFeedbackStatus, setSocialFeedbackStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [revealStage, setRevealStage] = React.useState(0);
  const [premiumFallback, setPremiumFallback] = React.useState<{
    transitionMessage: string;
    refinementMessage: string;
    message: string;
    suggestions: Array<any>;
    hasMoreOptions: boolean;
    presentation: ReturnType<typeof buildAssistedRecommendationSurface>;
  } | null>(null);
  const premiumFallbackRequestKeyRef = React.useRef<string | null>(null);
  const [tenantContext, setTenantContext] = React.useState<{
    whatsappNumber?: string | null;
    orgSlug?: string | null;
    orgId?: string | null;
    branchName?: string | null;
  } | null>(null);
  const [pendingTryOnProduct, setPendingTryOnProduct] = React.useState<{ id: string; product_id?: string | null; name?: string | null; photoUrl?: string | null; category?: string | null } | null>(null);
  const [decision, setDecision] = React.useState<DecisionResult | null>(null);
  const wowShownTrackedRef = React.useRef(false);

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
  const premiumFallbackSurface = useMemo(
    () =>
      buildAssistedRecommendationSurface(looks, {
        limit: 3,
        sourceLabel: catalogSourceLabel || tenantContext?.branchName || tenantContext?.orgSlug || "Catálogo da loja",
        explicit: false,
      }),
    [looks, catalogSourceLabel, tenantContext?.branchName, tenantContext?.orgSlug]
  );

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
  const hasTryOnArtifact = !!displayImageUrl || !!persistedTryOn?.image_url;
  const hasVisualFraming = !!displayImageUrl && !isGenerating && !tryOnError;
  const tryOnQuality = useMemo(() => classifyTryOnQuality({
    hasGeneratedImage: !!displayImageUrl,
    hasPersonImage: !!tryOnPersonImage,
    hasRealProduct: !!looks[0]?.product_id,
    isLegacyLook: hasLegacyTryOnLooks,
    isPreviousLook,
    hasTryOnError: !!tryOnError,
    primaryLookItemCount: looks[0]?.items?.length || 0,
    hasBeforeAfter: hasVisualFraming && !isPreviousLook,
    hasHeroFrame: hasVisualFraming && !isPreviousLook,
    hasNarrative: !!(persistedTryOn?.style_reason || surface?.hero?.subtitle),
    hasContextualCTA: !!resolvedOrgId,
    hasPremiumBadge: hasVisualFraming && !hasLegacyTryOnLooks,
  }), [
    displayImageUrl,
    tryOnPersonImage,
    looks,
    hasLegacyTryOnLooks,
    isPreviousLook,
    tryOnError,
    hasVisualFraming,
    persistedTryOn,
    surface?.hero?.subtitle,
    resolvedOrgId,
  ]);
  const resultNarrative = useMemo(
    () =>
      buildVenusResultNarrative({
        state: tryOnQuality.state,
        reason: tryOnQuality.reason,
        hasArtifact: hasTryOnArtifact,
        hasLegacy: hasLegacyTryOnLooks,
        styleDirection: onboardingData?.intent?.styleDirection || null,
      }),
    [tryOnQuality.state, tryOnQuality.reason, hasTryOnArtifact, hasLegacyTryOnLooks, onboardingData?.intent?.styleDirection]
  );
  const stylistAudit = useMemo<VenusStylistAudit | null>(() => {
    if (!surface) return null;

    return buildVenusStylistAudit({
      surface,
      tryOnQuality,
      onboardingData,
      contactName: onboardingData?.contact?.name || null,
      decision,
      resultId: id,
      orgName: tenantContext?.branchName || tenantContext?.orgSlug || null,
    });
  }, [surface, tryOnQuality, onboardingData, decision, id, tenantContext?.branchName, tenantContext?.orgSlug]);
  const assistedCatalogProducts = useMemo(
    () =>
      buildAssistedCatalogProductCards(looks, {
        limit: 3,
        sourceLabel: catalogSourceLabel || tenantContext?.branchName || tenantContext?.orgSlug || "Catálogo da loja",
      }),
    [catalogSourceLabel, looks, tenantContext?.branchName, tenantContext?.orgSlug]
  );
  const assistedLookStripItems = useMemo(
    () => buildAssistedLookStripItems(looks, { limit: 3 }),
    [looks]
  );
  const catalogCopy = useMemo(
    () =>
      buildCatalogAccessCopy({
        sourceLabel: catalogSourceLabel || tenantContext?.branchName || tenantContext?.orgSlug || "catálogo da loja",
        productCount: assistedCatalogProducts.length,
        lookCount: looks.length,
        explicit: false,
      }),
    [assistedCatalogProducts.length, catalogSourceLabel, looks.length, tenantContext?.branchName, tenantContext?.orgSlug]
  );
  const explicitCatalogCopy = useMemo(
    () =>
      buildCatalogAccessCopy({
        sourceLabel: catalogSourceLabel || tenantContext?.branchName || tenantContext?.orgSlug || "catálogo da loja",
        productCount: assistedCatalogProducts.length,
        lookCount: looks.length,
        explicit: true,
      }),
    [assistedCatalogProducts.length, catalogSourceLabel, looks.length, tenantContext?.branchName, tenantContext?.orgSlug]
  );
  const progressiveRevealLimit = tryOnQuality.state === "retry_required" ? 2 : 3;
  const canShowDiagnosis = revealStage >= 1;
  const canShowDirection = revealStage >= 2;
  const canShowCommerce = revealStage >= 3 && tryOnQuality.state !== "retry_required";

  const currentLoadingMessage = (() => {
    if (tryOnProgress < 30) return TRYON_LOADING_MESSAGES[0];
    if (tryOnProgress < 70) return TRYON_LOADING_MESSAGES[1];
    return TRYON_LOADING_MESSAGES[2];
  })();
  const shouldShowRetryCopy = tryOnQuality.state === "retry_required" && (hasTryOnArtifact || hasLegacyTryOnLooks || !!tryOnError);
  const retryPhotoHref = tenantContext?.orgSlug
    ? `/scanner/face?org=${encodeURIComponent(tenantContext.orgSlug)}`
    : "/scanner/face";
  const advanceReveal = React.useCallback(() => {
    if (resolvedOrgId && id) {
      void trackOnboardingConversionEvent({
        orgId: resolvedOrgId,
        savedResultId: id,
        eventType: "post_wow_cta_clicked",
        eventMeta: {
          surface: "result_page",
          cta: "next_suggestion",
          reveal_stage: revealStage,
        },
      });
    }
    setRevealStage((current) => Math.min(current + 1, progressiveRevealLimit));
  }, [progressiveRevealLimit, resolvedOrgId, id, revealStage]);
  const mainCtaLabel = resultNarrative.primaryCta;
  const tryOnPrimaryActionLabel = tryOnError || tryOnStatus === "failed" ? "Tentar novamente" : mainCtaLabel;

  React.useEffect(() => {
    if (tryOnStatus !== "fallback") {
      premiumFallbackRequestKeyRef.current = null;
      return;
    }

    if (!resolvedOrgId || !surface) {
      return;
    }

    const requestKey = `${resolvedOrgId}:${id || "no-id"}:${looks.map((look) => look.id).join("|")}`;
    if (premiumFallbackRequestKeyRef.current === requestKey) {
      return;
    }

    premiumFallbackRequestKeyRef.current = requestKey;
    let cancelled = false;

    const loadPremiumFallback = async () => {
      try {
        const response = await fetch("/api/tryon/premium-fallback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: resolvedOrgId,
            orgSlug: tenantContext?.orgSlug || null,
            branchName: tenantContext?.branchName || null,
            customerName: onboardingData?.contact?.name || null,
            styleDirection: onboardingData?.intent?.styleDirection || null,
            imageGoal: onboardingData?.intent?.imageGoal || null,
            bodyFit: onboardingData?.body?.fit || null,
            paletteFamily,
            essenceLabel,
            viewedLooks: looks.map((look) => look.id),
            lastLookId: looks[0]?.id || null,
            messageCount: 0,
          }),
        });

        if (!response.ok) {
          throw new Error(`fallback_http_${response.status}`);
        }

        const payload = (await response.json()) as {
          transitionMessage: string;
          refinementMessage: string;
          message: string;
          suggestions: Array<any>;
          hasMoreOptions: boolean;
          presentation: ReturnType<typeof buildAssistedRecommendationSurface>;
        };

        if (!cancelled) {
          setPremiumFallback(payload);
          console.info("[RESULT_FALLBACK] premium fallback loaded", {
            resultId: id,
            orgId: resolvedOrgId,
            suggestions: payload.suggestions?.length || 0,
          });
        }
      } catch (fallbackError) {
        if (!cancelled) {
          console.warn("[RESULT_FALLBACK] premium fallback load failed", {
            resultId: id,
            orgId: resolvedOrgId,
            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          });
          setPremiumFallback((current) =>
            current || {
              transitionMessage: TRYON_PREMIUM_FALLBACK_MESSAGE,
              refinementMessage: TRYON_PREMIUM_REFINED_MESSAGE,
              message: TRYON_PREMIUM_FALLBACK_MESSAGE,
              suggestions: [],
              hasMoreOptions: false,
              presentation: premiumFallbackSurface,
            }
          );
        }
      }
    };

    void loadPremiumFallback();

    return () => {
      cancelled = true;
    };
  }, [
    essenceLabel,
    id,
    looks,
    onboardingData?.body?.fit,
    onboardingData?.contact?.name,
    onboardingData?.intent?.imageGoal,
    onboardingData?.intent?.styleDirection,
    paletteFamily,
    premiumFallbackSurface,
    resolvedOrgId,
    surface,
    tenantContext?.branchName,
    tenantContext?.orgSlug,
    tryOnStatus,
  ]);

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

  React.useEffect(() => {
    if (!surface) return;

    console.info("[TRYON_QUALITY]", {
      resultId: id,
      orgId: resolvedOrgId || onboardingData?.tenant?.orgId || null,
      state: tryOnQuality.state,
      score: tryOnQuality.score,
      structuralScore: tryOnQuality.structural.score,
      visualScore: tryOnQuality.visual.score,
      badgeLabel: tryOnQuality.badgeLabel,
      reasons: tryOnQuality.reasons,
    });
  }, [surface, id, resolvedOrgId, onboardingData?.tenant?.orgId, tryOnQuality]);

  // ── WhatsApp URL (memo, always called) ──
  React.useEffect(() => {
    if (loading || !surface || wowShownTrackedRef.current || !resolvedOrgId || !id) {
      return;
    }

    wowShownTrackedRef.current = true;
    void trackOnboardingConversionEvent({
      orgId: resolvedOrgId,
      savedResultId: id,
      eventType: "wow_shown",
      eventMeta: {
        surface: "result_page",
        result_state: tryOnQuality.state,
        has_artifact: Boolean(displayImageUrl || persistedTryOn?.image_url),
      },
    });
  }, [loading, surface, resolvedOrgId, id, tryOnQuality.state, displayImageUrl, persistedTryOn?.image_url]);

  React.useEffect(() => {
    if (!surface || !displayImageUrl || tryOnQuality.state === "hero") {
      return;
    }

    console.warn("[TRYON_QUALITY_LOW]", {
      resultId: id,
      orgId: resolvedOrgId || onboardingData?.tenant?.orgId || null,
      styleDirection: getStyleDirectionDisplayLabel(onboardingData?.intent?.styleDirection || "Sem preferência"),
      state: tryOnQuality.state,
      score: tryOnQuality.score,
      reason: tryOnQuality.reason,
    });
  }, [displayImageUrl, id, onboardingData?.intent?.styleDirection, onboardingData?.tenant?.orgId, resolvedOrgId, surface, tryOnQuality]);

  const whatsappUrl = useMemo(() => {
    if (!surface) return "";
    const message = buildWhatsAppHandoffMessage({
      contactName: onboardingData?.contact?.name,
      resultState: tryOnQuality.state,
      styleIdentity: essenceLabel,
      imageGoal: onboardingData?.intent?.imageGoal,
      lookSummary: looks as any,
      lastTryOn: tryOnImageUrl ? { image_url: tryOnImageUrl, status: "completed" } : persistedTryOn,
      decision: decision ? { action: decision.chosenAction, reason: decision.reason } : undefined,
      audit: stylistAudit,
    });
    return buildWhatsAppHandoffUrl(message, tenantContext?.whatsappNumber || "5511967011133") || "";
  }, [surface, onboardingData, essenceLabel, looks, tryOnImageUrl, persistedTryOn, decision, tenantContext, stylistAudit]);

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

    if (!hasValidResultId) {
      if (previewMode) {
        if (onboardingData?.tenant && !tenantContext) {
          setTenantContext({
            whatsappNumber: onboardingData.tenant.whatsappNumber || null,
            orgSlug: onboardingData.tenant.orgSlug || null,
            orgId: onboardingData.tenant.orgId || null,
            branchName: onboardingData.tenant.branchName || null,
          });
        }

        setSurface(buildResultSurface(onboardingData, null, null));
        setLoading(false);
        return;
      }

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
              essence: { label: getStyleDirectionDisplayLabel(onboardingData?.intent?.styleDirection) || "Sua Essência", reason: "Sincronia baseada no seu perfil pessoal." },
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
        if (typeof payload.catalogLink === "string") setCatalogLink(payload.catalogLink);
        if (typeof payload.catalogSourceLabel === "string") setCatalogSourceLabel(payload.catalogSourceLabel);

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
  }, [hasValidResultId, id, onboardingData, previewMode, redirecting, router, tenantContext, tryOnImageUrl]);

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
        void trackOnboardingConversionEvent({
          orgId: resolvedOrgId,
          savedResultId: id,
          eventType: "post_wow_cta_clicked",
          eventMeta: {
            surface: "result_page",
            cta: "whatsapp",
            result_state: tryOnQuality.state,
          },
        });
      }

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
            resultState: tryOnQuality.state,
            whatsappClickedAt: new Date().toISOString(),
            lastAction: "SEND_WHATSAPP_MESSAGE",
            lastActionOutcome: "WHATSAPP_CLICKED",
          },
        });
      }

      window.open(url, "_blank", "noopener,noreferrer");
    },
    [resolvedOrgId, id, tryOnQuality.state]
  );

  const handleSaveSocialFeedback = React.useCallback(async () => {
    if (!resolvedOrgId || !id) return;

    setSocialFeedbackStatus("saving");
    try {
      const response = await fetch("/api/social-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: resolvedOrgId,
          resultId: id,
          platform: "manual",
          postUrl: socialFeedbackUrl || undefined,
          notes: socialFeedbackNote || undefined,
          aligned: tryOnQuality.state !== "retry_required",
          lookId: looks[0]?.id || undefined,
          productId: looks[0]?.product_id || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao registrar a postagem.");
      }

      setSocialFeedbackStatus("saved");
    } catch (err) {
      console.warn("[SOCIAL_FEEDBACK] failed", err);
      setSocialFeedbackStatus("error");
    }
  }, [resolvedOrgId, id, socialFeedbackUrl, socialFeedbackNote, tryOnQuality.state, looks]);

  // ──────────────────────────────────────────────────────────────
  // EARLY RETURNS (after ALL hooks have been called)
  // ──────────────────────────────────────────────────────────────

  if (redirecting) {
    return (
      <VenusLoadingScreen
        title="A Venus está ajustando sua leitura"
        subtitle="Carregando a próxima etapa sem interromper a experiência premium."
      />
    );
  }

  if (loading) {
    return (
      <VenusLoadingScreen
        title="A Venus está preparando sua leitura"
        subtitle="Aguarde um instante enquanto os dados da curadoria são hidratados com segurança."
      />
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
            <p className="font-serif text-xl text-white">Sua leitura está a caminho...</p>
            <p className="max-w-xs text-sm text-white/40 leading-relaxed">
              Estamos finalizando sua leitura premium. Se demorar um instante, a Venus está lapidando os últimos detalhes.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full border border-white/10 bg-white/5 px-8 py-3 text-[10px] font-bold uppercase tracking-widest text-[#C9A84C] transition-colors hover:bg-white/10"
          >
            Continuar a leitura
          </button>
          <Link href="/" className="text-[10px] font-bold uppercase tracking-widest text-white/20 hover:text-white transition-colors">Nova leitura</Link>
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
            <div className="mb-6 flex items-center justify-between gap-4 rounded-full border border-white/8 bg-white/[0.03] px-4 py-3 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#C9A84C]/25 bg-[#C9A84C]/10 text-[#C9A84C]">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">V</span>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-[#C9A84C]">{VENUS_STYLIST_NAME}</p>
                  <p className="text-[10px] text-white/45">Revelação premium da sua leitura</p>
                </div>
              </div>
              <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.28em] text-white/60">
                {resultNarrative.eyebrow}
              </div>
            </div>
            <div className="relative aspect-[3/4] overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.02] shadow-[0_22px_70px_rgba(0,0,0,0.6)]">
            {isGenerating ? (
              <div className="flex h-full w-full flex-col items-center justify-center bg-black/60 p-8 text-center backdrop-blur-sm">
                <div className="relative h-16 w-16">
                  <div className="absolute inset-0 rounded-full border-2 border-[#C9A84C]/20" />
                  <div className="absolute inset-0 animate-spin rounded-full border-2 border-[#C9A84C] border-t-transparent" />
                  <Sparkles className="absolute inset-5 h-6 w-6 animate-pulse text-[#C9A84C]" />
                </div>
                <p className="mt-8 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#C9A84C]">
                  Venus Stylist está revelando seu look
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
                {lateSuccessNotice && (
                  <div className="absolute right-6 top-6 rounded-full border border-[#C9A84C]/18 bg-[#C9A84C]/12 px-4 py-2 backdrop-blur-md">
                    <span className="text-[9px] font-black uppercase tracking-[0.22em] text-[#C9A84C]">
                      {lateSuccessNotice}
                    </span>
                  </div>
                )}
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="rounded-[22px] border border-white/10 bg-black/55 px-4 py-3 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">{stylistAudit?.tryOn.eyebrow || "Por que este look funciona"}</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-white/82">
                      {stylistAudit?.tryOn.helper || tryOnQuality.reason}
                    </p>
                  </div>
                </div>
              </div>
            ) : tryOnStatus === "fallback" ? (
              <div className="flex h-full w-full flex-col gap-5 overflow-y-auto p-4 sm:p-6">
                <div className="rounded-[28px] border border-white/8 bg-white/[0.04] p-5 text-left backdrop-blur-md">
                  <div className="flex items-center gap-2 text-[#C9A84C]">
                    <Sparkles className="h-4 w-4" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.32em]">Curadoria premium</p>
                  </div>
                  <h3 className="mt-3 font-serif text-2xl text-white">Já consegui identificar sua direção.</h3>
                  <p className="mt-3 text-[13px] leading-relaxed text-white/70">
                    Vou te mostrar o que mais valoriza seu estilo enquanto refino sua leitura visual.
                  </p>
                  {lateSuccessNotice && (
                    <p className="mt-3 rounded-full border border-[#C9A84C]/18 bg-[#C9A84C]/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#C9A84C]">
                      {lateSuccessNotice}
                    </p>
                  )}
                </div>
                <PremiumFallbackSurface
                  transitionMessage={premiumFallback?.transitionMessage || TRYON_PREMIUM_FALLBACK_MESSAGE}
                  refinementMessage={premiumFallback?.refinementMessage || TRYON_PREMIUM_REFINED_MESSAGE}
                  presentation={premiumFallback?.presentation || premiumFallbackSurface}
                  suggestions={premiumFallback?.suggestions || []}
                  orgId={resolvedOrgId}
                  userPhotoUrl={tryOnPersonImage || undefined}
                  storeName={tenantContext?.branchName || tenantContext?.orgSlug || "Loja"}
                  storePhone={tenantContext?.whatsappNumber || org.whatsapp_phone}
                  customerName={onboardingData?.contact?.name || undefined}
                  resultUrl={typeof window !== "undefined" && hasValidResultId ? `${window.location.origin}/result?id=${id}` : undefined}
                  refCode={hasValidResultId ? id || undefined : undefined}
                  onTryOnStart={(composition) => {
                    if (composition.anchorPiece.id) {
                      handleGenerateTryOn(composition.anchorPiece.id);
                    }
                  }}
                  onMoreOptions={() => {
                    document.getElementById("look-composition-gallery")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  onTalkToVenus={() => {
                    if (whatsappUrl) {
                      openWhatsApp(whatsappUrl);
                    }
                  }}
                  onSaveLook={() => setShowSaveModal(true)}
                />
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center p-12 text-center">
                <div className="mb-6 rounded-full bg-[#C9A84C]/10 p-5">
                  <Sparkles className="h-8 w-8 text-[#C9A84C]" />
                </div>
                <p className="text-balance text-[15px] font-medium leading-relaxed text-white/80">
                  {shouldShowRetryCopy
                    ? "Essa leitura ainda não chegou no ponto ideal. Vamos refazer com uma foto melhor."
                    : "A Venus está pronta para revelar seu primeiro look."}
                </p>
                {tryOnError && (
                  <p className="max-w-sm text-[12px] leading-relaxed text-white/45">
                    {tryOnError}
                  </p>
                )}
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
                  {tryOnAvailable ? tryOnPrimaryActionLabel : "Leitura indisponível"}
                </VenusButton>
                {!tryOnAvailable && (
                  <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                    Esse resultado veio de uma leitura antiga. Faça uma nova foto para liberar a versão premium.
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
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">Memória da Venus</span>
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 backdrop-blur-md">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#C9A84C] animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">Look validado</span>
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
              <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#C9A84C]">{stylistAudit?.opening.eyebrow || resultNarrative.eyebrow}</p>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-white">
                {stylistAudit?.opening.title || essenceLabel}
              </h1>
              <p className="mx-auto max-w-sm text-[16px] leading-relaxed text-white/60">
                {stylistAudit?.opening.subtitle || resultNarrative.subtitle}
              </p>
              <p className="mx-auto max-w-sm text-[12px] leading-relaxed text-white/40">
                {stylistAudit?.diagnosis.buyingGuidance || resultNarrative.helper}
              </p>
              {revealStage < 1 && (
                <button
                  type="button"
                  onClick={advanceReveal}
                  className="mt-2 inline-flex h-11 items-center justify-center rounded-full border border-[#C9A84C]/20 bg-[#C9A84C]/10 px-5 text-[9px] font-black uppercase tracking-[0.24em] text-[#C9A84C] transition-colors hover:bg-[#C9A84C]/16"
                >
                  Continuar leitura
                </button>
              )}
            </div>
          </div>

          {canShowDiagnosis && stylistAudit && (
            <div className="mt-10 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-white/5 bg-black/20 p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-[#C9A84C]">O que já funciona</p>
                  <div className="mt-3 space-y-2">
                    {stylistAudit.diagnosis.strengths.slice(0, 3).map((item) => (
                      <p key={item} className="text-[13px] leading-relaxed text-white/70">{item}</p>
                    ))}
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/5 bg-black/20 p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-[#C9A84C]">O que ainda pesa</p>
                  <div className="mt-3 space-y-2">
                    {stylistAudit.diagnosis.blockers.slice(0, 3).map((item) => (
                      <p key={item} className="text-[13px] leading-relaxed text-white/70">{item}</p>
                    ))}
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/5 bg-black/20 p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-[#C9A84C]">O que ampliar</p>
                  <div className="mt-3 space-y-2">
                    {stylistAudit.diagnosis.amplify.slice(0, 3).map((item) => (
                      <p key={item} className="text-[13px] leading-relaxed text-white/70">{item}</p>
                    ))}
                  </div>
                </div>
              </div>

              {revealStage < 2 && (
                <button
                  type="button"
                  onClick={advanceReveal}
                  className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[#C9A84C]/20 bg-[#C9A84C]/10 px-5 text-[9px] font-black uppercase tracking-[0.24em] text-[#C9A84C] transition-colors hover:bg-[#C9A84C]/16"
                >
                  Ver a direção
                </button>
              )}

              <div className={`${revealStage >= 2 ? "" : "hidden"} rounded-[28px] border border-white/5 bg-white/[0.03] p-5`}>
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#C9A84C]">{stylistAudit.direction.eyebrow}</p>
                <h2 className="mt-2 font-serif text-2xl text-white">{stylistAudit.direction.title}</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-white/65">{stylistAudit.direction.subtitle}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-white/50">{stylistAudit.direction.realWorldImpression}</p>
                <div className="mt-4 grid gap-2">
                  {stylistAudit.direction.bullets.map((bullet) => (
                    <div key={bullet} className="rounded-2xl border border-white/5 bg-black/25 px-4 py-3 text-[12px] leading-relaxed text-white/70">
                      {bullet}
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${revealStage >= 2 ? "" : "hidden"} rounded-[28px] border border-white/5 bg-white/[0.03] p-5`}>
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#C9A84C]">{stylistAudit.tryOn.eyebrow}</p>
                <h2 className="mt-2 font-serif text-2xl text-white">{stylistAudit.tryOn.title}</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-white/65">{stylistAudit.tryOn.subtitle}</p>
                <p className="mt-3 text-[12px] leading-relaxed text-white/45">{stylistAudit.tryOn.helper}</p>
              </div>

              {revealStage < 3 && tryOnQuality.state !== "retry_required" && (
                <button
                  type="button"
                  onClick={advanceReveal}
                  className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[#C9A84C]/20 bg-[#C9A84C]/10 px-5 text-[9px] font-black uppercase tracking-[0.24em] text-[#C9A84C] transition-colors hover:bg-[#C9A84C]/16"
                >
                  Ver o que comprar agora
                </button>
              )}
            </div>
          )}

          {canShowCommerce && (assistedCatalogProducts.length > 0 || assistedLookStripItems.length > 0) && (
            <div id="catalog-assistido" className="mt-10 space-y-6">
              <ConversationalCatalogBlock
                copy={catalogCopy}
                products={assistedCatalogProducts}
                reinforcement={[
                  "Baseado no seu corpo",
                  "Cores ideais para você",
                  "Look recomendado para você",
                ]}
                catalogAction={
                  catalogLink || "/catalog"
                    ? {
                      label: explicitCatalogCopy.openLabel,
                      href: catalogLink || "/catalog",
                      target: "_blank",
                      onClick: () => {
                        if (resolvedOrgId && id) {
                          void trackOnboardingConversionEvent({
                            orgId: resolvedOrgId,
                            savedResultId: id,
                            eventType: "post_wow_cta_clicked",
                            eventMeta: {
                              surface: "result_page",
                              cta: "catalog",
                              catalog_link: catalogLink || "/catalog",
                            },
                          });
                        }
                      },
                    }
                    : undefined
                }
                continueAction={{
                  label: explicitCatalogCopy.continueLabel,
                  onClick: () => {
                    if (resolvedOrgId && id) {
                      void trackOnboardingConversionEvent({
                        orgId: resolvedOrgId,
                        savedResultId: id,
                        eventType: "post_wow_cta_clicked",
                        eventMeta: {
                          surface: "result_page",
                          cta: "continue",
                        },
                      });
                    }

                    if (whatsappUrl) {
                      openWhatsApp(whatsappUrl);
                    }
                  },
                }}
                saveAction={{
                  label: explicitCatalogCopy.saveLabel,
                  onClick: () => {
                    if (resolvedOrgId && id) {
                      void trackOnboardingConversionEvent({
                        orgId: resolvedOrgId,
                        savedResultId: id,
                        eventType: "post_wow_cta_clicked",
                        eventMeta: {
                          surface: "result_page",
                          cta: "save",
                        },
                      });
                    }

                    setShowSaveModal(true);
                  },
                }}
                onOpenProduct={() => {
                  document.getElementById("look-composition-gallery")?.scrollIntoView({ behavior: "smooth" });
                }}
                onAskOpinion={() => {
                  if (resolvedOrgId && id) {
                    void trackOnboardingConversionEvent({
                      orgId: resolvedOrgId,
                      savedResultId: id,
                      eventType: "post_wow_cta_clicked",
                      eventMeta: {
                        surface: "result_page",
                        cta: "opinion",
                      },
                    });
                  }

                  if (whatsappUrl) {
                    openWhatsApp(whatsappUrl);
                  }
                }}
                onSaveLook={() => setShowSaveModal(true)}
              />

              <div className="rounded-[28px] border border-white/5 bg-white/[0.03] p-4 sm:p-5">
                <AssistedLookStrip
                  looks={assistedLookStripItems}
                  onSelectLook={() => {
                    document.getElementById("look-composition-gallery")?.scrollIntoView({ behavior: "smooth" });
                  }}
                />
              </div>
            </div>
          )}

          {/* Look Composition Gallery - Looks completos do catálogo */}
          {canShowCommerce && tryOnQuality.state !== "retry_required" && resolvedOrgId && (
            <div id="look-composition-gallery" className="mt-10">
              <LookCompositionGallery
                orgId={resolvedOrgId}
                userPhotoUrl={tryOnPersonImage}
                styleDirection={onboardingData?.intent?.styleDirection}
                imageGoal={onboardingData?.intent?.imageGoal}
                bodyFit={onboardingData?.body?.fit}
                colorContrast={onboardingData?.colors?.contrast}
                essenceLabel={surface?.essence?.label}
                paletteFamily={paletteFamily}
                storeName={tenantContext?.branchName || tenantContext?.orgSlug || "Loja"}
                storePhone={tenantContext?.whatsappNumber || org.whatsapp_phone}
                customerName={onboardingData?.contact?.name}
                resultUrl={typeof window !== "undefined" && hasValidResultId ? `${window.location.origin}/result?id=${id}` : undefined}
                onTryOnStart={(composition: LookComposition) => {
                  // Iniciar try-on com a peça âncora do look
                  if (composition.anchorPiece.id) {
                    handleGenerateTryOn(composition.anchorPiece.id);
                  }
                }}
              />
            </div>
          )}

          {looks[0] && tryOnQuality.state !== "retry_required" && (
            <div className="mt-10">
              <ShareableLookCard
                look={looks[0]}
                looks={looks}
                surface={surface}
                resultId={id}
                resultUrl={typeof window !== "undefined" && hasValidResultId ? `${window.location.origin}/result?id=${id}` : undefined}
                orgId={resolvedOrgId || null}
                brandName={tenantContext?.branchName || tenantContext?.orgSlug || "Venus"}
                appName={VENUS_STYLIST_NAME}
                orgName={tenantContext?.orgSlug || tenantContext?.branchName || null}
                storeHandle={tenantContext?.orgSlug || null}
                customerName={onboardingData?.contact?.name || null}
                userImageUrl={tryOnPersonImage || null}
                tryOnImageUrl={displayImageUrl || persistedTryOn?.image_url || null}
              />
            </div>
          )}

          {canShowCommerce && tryOnQuality.state !== "retry_required" && (
            <div className="mt-8 rounded-[28px] border border-white/5 bg-white/[0.03] p-5">
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#C9A84C]">{stylistAudit?.social.eyebrow || "Prova social e memória"}</p>
              <h2 className="mt-2 font-serif text-2xl text-white">{stylistAudit?.social.title || "Registrar a postagem ou o link da leitura"}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-white/60">
                {stylistAudit?.social.prompt || "Se você já publicou, a Venus guarda o sinal para refinar a próxima leitura."}
              </p>
              <div className="mt-4 grid gap-3">
                <input
                  type="url"
                  value={socialFeedbackUrl}
                  onChange={(event) => setSocialFeedbackUrl(event.target.value)}
                  placeholder="Cole o link do post, story ou foto"
                  className="h-12 rounded-2xl border border-white/10 bg-black/40 px-4 text-[12px] text-white placeholder:text-white/30 outline-none"
                />
                <textarea
                  value={socialFeedbackNote}
                  onChange={(event) => setSocialFeedbackNote(event.target.value)}
                  placeholder="Uma nota curta sobre o que aconteceu"
                  rows={3}
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-[12px] text-white placeholder:text-white/30 outline-none"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <VenusButton onClick={() => void handleSaveSocialFeedback()} className="h-12 px-5 text-[10px] tracking-[0.28em]">
                    Registrar postagem
                  </VenusButton>
                  <span className="text-[11px] text-white/45">
                    {socialFeedbackStatus === "saved"
                      ? "Memória registrada."
                      : socialFeedbackStatus === "error"
                        ? "Não foi possível registrar agora."
                        : "Opcional, mas útil para a próxima leitura."}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {canShowCommerce && (
      <section className="mt-16 border-y border-white/5 bg-white/[0.02] py-12 px-5">
        <div className="mx-auto max-w-lg space-y-10">
          <div className="rounded-[28px] border border-[#C9A84C]/15 bg-[#C9A84C]/8 p-5 text-left">
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#C9A84C]">{stylistAudit?.whatsapp.eyebrow || "Continuação natural"}</p>
            <h2 className="mt-2 font-serif text-2xl text-white">{stylistAudit?.whatsapp.title || `Continuar com ${VENUS_STYLIST_NAME}`}</h2>
            <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-white/65">{stylistAudit?.whatsapp.subtitle || "A conversa segue com a mesma leitura, sem começar do zero."}</p>
            <div className="mt-5 flex flex-col gap-3">
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
                {stylistAudit?.whatsapp.cta || mainCtaLabel}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <button
                onClick={() => router.push("/")}
                className="flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 text-[10px] font-bold uppercase tracking-[0.24em] text-white/80 transition-colors hover:bg-white/10"
              >
                Nova leitura
              </button>
            </div>
          </div>

          <div>
            <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.3em] text-[#C9A84C]">Leitura de cor • {paletteFamily}</p>
            <p className="mb-6 text-[13px] leading-relaxed text-white/55">
              A Venus leva essa paleta da imagem ao WhatsApp para manter a mesma assinatura.
            </p>
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
      )}

      <section className="px-5 py-12 pb-20">
        <div className="mx-auto max-w-lg text-center space-y-6">
          <p className="text-[12px] text-white/40">Curadoria assinada por {VENUS_STYLIST_NAME}</p>
          <div className="flex justify-center gap-4">
            <Link href="/" className="text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-[#C9A84C] transition-colors">
              Início
            </Link>
          </div>
        </div>
      </section>

      {canShowCommerce && (
      <div className="fixed bottom-0 left-0 right-0 z-[150] flex h-14 items-center justify-between bg-[#C9A84C] px-4 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-black flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-black animate-pulse" />
          {VENUS_STYLIST_NAME} está online — {org.name}
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
          Continuar no WhatsApp
        </Link>
      </div>
      )}

      <SaveResultsModal isOpen={showSaveModal} onClose={() => setShowSaveModal(false)} surface={surface} />
    </main>
  );
}

export default function ResultDashboardPage() {
  return (
    <Suspense fallback={<VenusLoadingScreen title="Abrindo seu resultado" subtitle="Carregando a leitura premium do resultado final." />}>
      <ResultErrorBoundary>
        <ResultDashboardContent />
      </ResultErrorBoundary>
    </Suspense>
  );
}
