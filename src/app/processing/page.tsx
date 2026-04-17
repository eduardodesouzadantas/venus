"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import type { OnboardingData } from "@/types/onboarding";
import { processAndPersistLead } from "@/lib/recommendation/actions";
import { RESULT_ID_PATTERN, isValidResultId } from "@/lib/result/id";

const PHASES = [
  "Lendo sua foto...",
  "Decifrando proporções e linhas...",
  "Cruzando paleta e presença...",
  "Montando combinações do catálogo...",
  "Refinando a leitura de stylist...",
  "Gerando seu resultado...",
];

function buildProcessingSnapshot(data: OnboardingData): OnboardingData {
  return {
    ...data,
    scanner: {
      ...data.scanner,
      facePhoto: "",
      bodyPhoto: "",
    },
  };
}

export default function ProcessingPage() {
  const router = useRouter();
  const { data, isLoaded } = useOnboarding();
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
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
    // Guard: wait for sessionStorage to be loaded into context before processing.
    // Without this, the effect runs with defaultOnboardingData (empty tenant) on first mount,
    // causing resolveAppTenantOrg to fail with TENANT_RESOLUTION_FAILED on multi-org deployments.
    if (!isLoaded || !data || isGenerating.current) return;

    isGenerating.current = true;
    setError(null);

    let cancelled = false;

    async function persistAndNavigate() {
      try {
        setStatus("processing");
        setSavedResultId(null);

        const orgSlug = data?.tenant?.orgSlug || null;
        const orgId = data?.tenant?.orgId || null;
        const hasContact = Boolean(data?.contact?.phone || data?.contact?.email);
        const scannerSource = data?.scanner?.skipped
          ? "skipped"
          : data?.scanner?.facePhoto || data?.scanner?.bodyPhoto
            ? "captured"
            : "unknown";

        console.info("[PROCESSING] persistence flow started", {
          isLoaded,
          hasOnboardingData: Boolean(data),
          orgId,
          orgSlug,
          hasContact,
          scannerSource,
        });

        const dbReferenceId = await processAndPersistLead(buildProcessingSnapshot(data));
        console.info("[PROCESSING] processAndPersistLead returned", { dbReferenceId });

        if (!isValidResultId(dbReferenceId)) {
          console.error("[PROCESSING] invalid result id returned", {
            dbReferenceId,
            failureReason: "RESULT_PERSISTENCE_INVALID_ID",
          });
          throw new Error("RESULT_PERSISTENCE_INVALID_ID");
        }

        const validationResponse = await fetch(`/api/result/${encodeURIComponent(dbReferenceId)}`, {
          cache: "no-store",
        });

        const validationText = await validationResponse.text().catch(() => "");
        let validationPayload: Record<string, unknown> | null = null;
        if (validationText) {
          try {
            validationPayload = JSON.parse(validationText) as Record<string, unknown>;
          } catch {
            validationPayload = null;
          }
        }

        if (!validationResponse.ok) {
          console.error("[PROCESSING] result validation lookup failed", {
            resultId: dbReferenceId,
            currentUrl: typeof window !== "undefined" ? window.location.href : null,
            httpStatus: validationResponse.status,
            payloadKeys: validationPayload ? Object.keys(validationPayload) : [],
            failureReason: "RESULT_PERSISTENCE_LOOKUP_FAILED",
          });
          throw new Error("RESULT_PERSISTENCE_LOOKUP_FAILED");
        }

        const tenantBlock = validationPayload?.tenant as Record<string, unknown> | null | undefined;
        const hasTenantOrgId = Boolean(tenantBlock?.orgId);
        const hasOrgId = Boolean(validationPayload?.org_id);
        const hasCamelOrgId = Boolean(validationPayload?.orgId);
        const hasImageUrl = Boolean(validationPayload?.imageUrl || (tenantBlock as any)?.imageUrl);
        const hasFallbackPayload = Boolean(validationPayload?.fallback);

        console.info("[PROCESSING] result validation lookup ok", {
          resultId: dbReferenceId,
          httpStatus: validationResponse.status,
          payloadKeys: validationPayload ? Object.keys(validationPayload) : [],
          hasTenantOrgId,
          hasOrgId,
          hasCamelOrgId,
          hasImageUrl,
          hasFallbackPayload,
        });

        const resolvedOrgId = (tenantBlock?.orgId as string) || (validationPayload?.orgId as string) || null;

        if (!resolvedOrgId) {
          console.error("[PROCESSING] result validation missing tenant org", {
            resultId: dbReferenceId,
            currentUrl: typeof window !== "undefined" ? window.location.href : null,
            orgSlug,
            httpStatus: validationResponse.status,
            payloadKeys: validationPayload ? Object.keys(validationPayload) : [],
            hasTenantOrgId,
            hasOrgId,
            hasCamelOrgId,
            hasImageUrl,
            hasFallbackPayload,
            scannerSource,
            failureReason: "RESULT_PERSISTENCE_MISSING_ORG",
          });
          throw new Error("RESULT_PERSISTENCE_MISSING_ORG");
        }

        if (!cancelled && dbReferenceId && status === "processing" && savedResultId !== dbReferenceId) {
          setSavedResultId(dbReferenceId);
          setStatus("completed");
          router.push(`/result?id=${dbReferenceId}`);
        }
      } catch (e) {
        const failureReason = e instanceof Error ? e.message : "UNKNOWN";
        console.error("[PROCESSING] critical persistence failure", {
          currentUrl: typeof window !== "undefined" ? window.location.href : null,
          orgId: data?.tenant?.orgId || null,
          orgSlug: data?.tenant?.orgSlug || null,
          isLoaded,
          failureReason,
        });
        if (!cancelled) {
          setError(failureReason);
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
  }, [data, isLoaded, router, retryTick, status]);

  const handleRetry = () => {
    isGenerating.current = false;
    setError(null);
    setRetryTick((value) => value + 1);
  };

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-5">
          <div className="h-10 w-10 rounded-full border-2 border-[#C9A84C] border-t-transparent animate-spin" />
          <div className="space-y-2">
            <Heading as="h4" className="font-serif text-lg tracking-[0.2em] text-[#C9A84C]">
              PERSISTÊNCIA FALHOU
            </Heading>
            <Text className="text-sm leading-relaxed text-white/70">
              Não foi possível validar e salvar seu resultado com segurança.
              A operação foi interrompida antes de navegar para a tela final.
            </Text>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/10 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#C9A84C] transition-colors hover:bg-[#C9A84C]/20"
          >
            Tentar Novamente
          </button>
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
          VENUS ENGINE CORE
        </Heading>
        <Text className="text-sm leading-relaxed text-white/70">
          A Venus está cruzando foto, corpo, paleta e catálogo para devolver uma curadoria que pareça feita por stylist.
        </Text>
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
