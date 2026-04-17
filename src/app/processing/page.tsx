"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { buildProcessingPersistInput } from "@/lib/onboarding/processing";
import { processAndPersistLead } from "@/lib/recommendation/actions";
import { isValidResultId } from "@/lib/result/id";
import { buildVenusBodyScannerIntro } from "@/lib/venus/brand";

const PHASES = [
  "Foto recebida. Analisando...",
  "Decifrando proporções e linhas...",
  "Cruzando paleta e presença...",
  "Montando combinações do catálogo...",
  "Refinando a leitura de stylist...",
  "Gerando seu resultado...",
];

type ProcessingError = {
  code: string;
  safeMessage: string;
  stage: string;
  details?: Record<string, unknown>;
};

function mapProcessingFailureCode(failureReason: string) {
  if (failureReason === "PAYLOAD_TOO_LARGE_PREVENTED") return "PAYLOAD_TOO_LARGE";
  if (failureReason === "PROCESSING_MISSING_PHOTO") return "IMAGE_UPLOAD_REQUIRED";
  return failureReason;
}

function mapProcessingSafeMessage(failureReason: string) {
  if (failureReason === "PAYLOAD_TOO_LARGE_PREVENTED") {
    return "A foto enviada precisa ser menor ou ser reenviada como upload.";
  }
  if (failureReason === "PROCESSING_MISSING_PHOTO") {
    return "Preciso de uma foto válida para seguir com segurança.";
  }
  if (failureReason === "PROCESSING_MISSING_TENANT") {
    return "Não consegui identificar a loja desta experiência.";
  }
  return "Não foi possível validar e salvar seu resultado com segurança.";
}

export default function ProcessingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgSlugFromQuery = searchParams.get("org") || "";
  const { data, isLoaded, journey, isJourneyLoaded } = useOnboarding();
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [error, setError] = useState<ProcessingError | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [savedResultId, setSavedResultId] = useState<string | null>(null);
  const [status, setStatus] = useState<"processing" | "completed">("processing");
  const isGenerating = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhaseIndex((p) => (p < PHASES.length - 1 ? p + 1 : p));
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Guard: wait for sessionStorage hydration before processing (prevents TENANT_RESOLUTION_FAILED on empty data).
    if (!isLoaded || !isJourneyLoaded || !data || isGenerating.current) return;

    const { readiness, payload } = buildProcessingPersistInput(data, orgSlugFromQuery || null, journey);

    if (readiness.failureReason) {
      const failureReason = readiness.failureReason;
      const safeMessage = mapProcessingSafeMessage(failureReason);
      const errorCode = mapProcessingFailureCode(failureReason);

      console.error("[processing:persistence-validation-failed]", {
        resultId: null,
        orgIdResolved: readiness.tenant?.orgId || null,
        hasTenantOrgId: Boolean(payload.tenant?.orgId),
        hasOrgId: Boolean(payload.tenant?.orgId),
        hasCamelOrgId: Boolean(payload.tenant?.orgId),
        responseStatus: null,
        responseKeys: Object.keys(payload),
        failureReason,
        stage: "pre_processAndPersistLead",
        hasScannerPhotos: readiness.hasVisualInput,
        hasFallback: readiness.hasFallback,
        hasInlineImage: readiness.hasInlineImage,
        orgSlugFromQuery: orgSlugFromQuery || null,
      });

      setError({
        code: errorCode,
        safeMessage,
        stage: "pre_processAndPersistLead",
        details: {
          orgSlugFromQuery: orgSlugFromQuery || null,
          hasVisualInput: readiness.hasVisualInput,
          hasFallback: readiness.hasFallback,
          hasInlineImage: readiness.hasInlineImage,
        },
      });
      return;
    }

    isGenerating.current = true;
    setError(null);

    let cancelled = false;

    async function persistAndNavigate() {
      try {
        setStatus("processing");
        setSavedResultId(null);
        console.info("[PROCESSING] persistence flow started", {
          commitSha: "4d65c5b",
          currentUrl: typeof window !== "undefined" ? window.location.href : null,
          isLoaded,
          isJourneyLoaded,
          hasOnboardingData: Boolean(data),
          orgId: payload?.tenant?.orgId || null,
          orgSlug: payload?.tenant?.orgSlug || null,
          hasTenant: Boolean(payload?.tenant && Object.keys(payload.tenant).some((k) => (payload.tenant as Record<string, unknown>)[k])),
          onboardingDataTopLevelNonEmpty: payload
            ? Object.entries(payload)
                .filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0) && !(typeof v === "object" && v !== null && Object.keys(v).length === 0))
                .map(([k]) => k)
            : [],
          hasScannerPhotos: Boolean(payload.scanner?.facePhoto || payload.scanner?.bodyPhoto),
          hasFallback: Boolean(payload.scanner?.skipped),
        });

        const dbReferenceId = await processAndPersistLead(payload);
        console.info("[PROCESSING] processAndPersistLead returned", { dbReferenceId });

        if (!isValidResultId(dbReferenceId)) {
          throw new Error("RESULT_PERSISTENCE_INVALID_ID");
        }

        const validationResponse = await fetch(`/api/result/${encodeURIComponent(dbReferenceId)}`, {
          cache: "no-store",
        });

        const validationText = await validationResponse.text().catch(() => "");
        let validationPayload: any = null;
        if (validationText) {
          try {
            validationPayload = JSON.parse(validationText);
          } catch {
            validationPayload = null;
          }
        }

        const validationTenantOrgId = validationPayload?.tenant?.orgId || validationPayload?.org_id || validationPayload?.orgId || "";
        const validationResponseKeys = validationPayload ? Object.keys(validationPayload) : [];

        if (!validationResponse.ok) {
          console.error("[processing:persistence-validation-failed]", {
            resultId: dbReferenceId,
            orgIdResolved: payload?.tenant?.orgId || null,
            hasTenantOrgId: Boolean(validationPayload?.tenant?.orgId),
            hasOrgId: Boolean(validationPayload?.org_id),
            hasCamelOrgId: Boolean(validationPayload?.orgId),
            responseStatus: validationResponse.status,
            responseKeys: validationResponseKeys,
            failureReason: "lookup_failed",
            stage: "processing_validation",
          });
          throw new Error("RESULT_PERSISTENCE_LOOKUP_FAILED");
        } else {
          console.info("[PROCESSING] result validation lookup ok", {
            resultId: dbReferenceId,
            tenantOrgId: validationTenantOrgId,
            responseKeys: validationResponseKeys,
          });
        }

        if (!validationTenantOrgId) {
          console.error("[processing:persistence-validation-failed]", {
            resultId: dbReferenceId,
            orgIdResolved: payload?.tenant?.orgId || null,
            hasTenantOrgId: Boolean(validationPayload?.tenant?.orgId),
            hasOrgId: Boolean(validationPayload?.org_id),
            hasCamelOrgId: Boolean(validationPayload?.orgId),
            responseStatus: validationResponse.status,
            responseKeys: validationResponseKeys,
            failureReason: "missing_tenant_org",
            stage: "processing_validation",
          });
          throw new Error("RESULT_PERSISTENCE_MISSING_ORG");
        } else if (!validationPayload?.tenant?.orgId) {
          console.warn("[PROCESSING] result validation normalized tenant from fallback org id", {
            resultId: dbReferenceId,
            tenantOrgId: validationTenantOrgId,
          });
        }

        if (!cancelled && dbReferenceId && status === "processing" && savedResultId !== dbReferenceId) {
          setSavedResultId(dbReferenceId);
          setStatus("completed");
          router.push(`/result?id=${dbReferenceId}`);
        }
      } catch (e) {
        if (e instanceof Error && e.message === "TENANT_RESOLUTION_FAILED") {
          console.warn("[PROCESSING] tenant resolution failed; falling back to preview result", {
            orgId: payload?.tenant?.orgId || null,
            orgSlug: payload?.tenant?.orgSlug || null,
          });
          if (!cancelled) {
            router.replace("/result?preview=1");
          }
          return;
        }

        const failureReason = e instanceof Error ? e.message : "UNKNOWN_NON_ERROR";
        const errorCode = mapProcessingFailureCode(failureReason);
        const safeMessage = mapProcessingSafeMessage(failureReason);
        console.error("[PROCESSING] critical persistence failure", {
          commitSha: "4d65c5b",
          currentUrl: typeof window !== "undefined" ? window.location.href : null,
          isLoaded,
          isJourneyLoaded,
          failureReason,
          orgSlug: payload?.tenant?.orgSlug || null,
          orgId: payload?.tenant?.orgId || null,
          hasTenant: Boolean(payload?.tenant && Object.keys(payload.tenant).some((k) => (payload.tenant as Record<string, unknown>)[k])),
          errorStack: e instanceof Error ? (e.stack?.split("\n").slice(0, 4).join(" | ") ?? null) : null,
        });
        if (!cancelled) {
          setError({
            code: errorCode,
            safeMessage,
            stage: "processing_validation",
          });
        }
      } finally {
        if (!cancelled) {
          isGenerating.current = false;
        }
      }
    }

    void persistAndNavigate();

    return () => {
      cancelled = true;
    };
  }, [data, isLoaded, isJourneyLoaded, journey, orgSlugFromQuery, router, retryTick, status]);

  const handleRetry = () => {
    isGenerating.current = false;
    setError(null);
    setRetryTick((value) => value + 1);
  };

  const restartOrgSlug = orgSlugFromQuery || data?.tenant?.orgSlug || journey?.onboardingSeed?.tenant?.orgSlug || "";
  const restartHref = restartOrgSlug ? `/onboarding/chat?org=${encodeURIComponent(restartOrgSlug)}` : "/onboarding/chat";

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-5">
          <div className="h-10 w-10 rounded-full border-2 border-[#C9A84C] border-t-transparent animate-spin" />
          <div className="space-y-2">
            <Heading as="h4" className="font-serif text-lg tracking-[0.2em] text-[#C9A84C]">
              PERSISTÊNCIA FALHOU
            </Heading>
            <Text className="text-sm leading-relaxed text-white/70">{error.safeMessage}</Text>
            <Text className="text-sm leading-relaxed text-white/55">
              A operação foi interrompida antes de navegar para a tela final.
            </Text>
            <Text className="font-mono text-[10px] text-[#C9A84C]/50 break-all">{error.code}</Text>
          </div>
          <div className="flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/10 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#C9A84C] transition-colors hover:bg-[#C9A84C]/20"
            >
              Tentar Novamente
            </button>
            <button
              type="button"
              onClick={() => router.replace(restartHref)}
              className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/70 transition-colors hover:bg-white/10"
            >
              Reiniciar Jornada
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-0 flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-5 py-6 sm:p-6">
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        <div className="h-[130vw] w-[130vw] max-h-[680px] max-w-[680px] animate-[spin_10s_linear_infinite] rounded-full border border-white/5 sm:h-[150vw] sm:w-[150vw] sm:max-h-[800px] sm:max-w-[800px]" />
        <div className="absolute h-[100vw] w-[100vw] max-h-[520px] max-w-[520px] animate-[spin_8s_linear_infinite_reverse] rounded-full border border-[#C9A84C]/20 sm:h-[120vw] sm:w-[120vw] sm:max-h-[600px] sm:max-w-[600px]" />
      </div>

      <div className="z-10 mb-8 flex h-32 w-32 items-center justify-center rounded-full border border-white/10 bg-white/5 p-6 shadow-[0_0_50px_rgba(212,175,55,0.1)] backdrop-blur-[30px] sm:mb-10 sm:h-40 sm:w-40 sm:p-8">
        <svg className="h-12 w-12 animate-pulse text-[#C9A84C] sm:h-16 sm:w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="z-10 w-full max-w-[300px] text-center">
        <Heading as="h4" className="mb-2 font-serif text-base tracking-widest text-[#C9A84C] transition-opacity duration-300 sm:text-lg">
          VENUS STYLIST
        </Heading>
        <Text className="text-sm leading-relaxed text-white/70">{buildVenusBodyScannerIntro()}</Text>
        <div className="relative mt-4 h-10 w-full">
          {PHASES.map((phase, i) => (
            <Text
              key={i}
              className={`absolute left-0 top-0 w-full font-mono text-[11px] leading-relaxed transition-opacity duration-500 sm:text-xs ${
                i === phaseIndex ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
            >
              {phase}
            </Text>
          ))}
        </div>
      </div>
    </div>
  );
}
