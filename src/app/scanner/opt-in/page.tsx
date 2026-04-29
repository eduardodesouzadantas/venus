"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { normalizeConsultationProfile } from "@/lib/consultation-profile";

export default function OptInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const org = searchParams.get("org") || "";
  const { data, updateData } = useOnboarding();
  const consultation = normalizeConsultationProfile(data.consultation);

  useEffect(() => {
    const hasStyleDirection = Boolean(consultation.styleDirection || data.intent.styleDirection);
    const hasDesiredPerception = Boolean(consultation.desiredPerception || data.intent.imageGoal);
    const hasOccasion = Boolean(consultation.occasion);

    if (!hasStyleDirection || !hasDesiredPerception || !hasOccasion) {
      router.replace(org ? `/onboarding/intent?org=${encodeURIComponent(org)}` : "/onboarding/intent");
    }
  }, [router, consultation, data.intent.styleDirection, data.intent.imageGoal, org]);

  const handleSkip = () => {
    updateData("scanner", { skipped: true });
    router.push(org ? `/processing?org=${encodeURIComponent(org)}` : "/processing");
  };

  const handleStartScan = () => {
    router.push(org ? `/scanner/face?org=${encodeURIComponent(org)}` : "/scanner/face");
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-5 py-8 sm:p-6">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-[72px] sm:h-[300px] sm:w-[300px] sm:blur-[80px]" />

      <Heading as="h1" className="z-10 mb-6 text-center font-light italic sm:mb-8">
        A leitura visual é opcional.
      </Heading>

      <div className="relative z-10 w-full max-w-[520px] overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-6 text-center shadow-2xl backdrop-blur-[30px] sm:rounded-[32px] sm:p-8">
        <Text className="mb-4 text-white/80 sm:mb-6">
          A foto pode refinar sua curadoria, mas sua assinatura já pode ser construída pelas respostas. Você escolhe como seguir.
        </Text>
        <Text className="mb-8 text-[14px] text-white/60 sm:mb-10 sm:text-sm">
          A Venus já tem sua intenção, contexto e limites de estilo. A imagem entra apenas como refinamento.
        </Text>

        <div className="flex flex-col gap-3 sm:gap-4">
          <VenusButton variant="solid" className="w-full" onClick={handleStartScan}>
            Enviar foto agora
          </VenusButton>

          <button
            type="button"
            onClick={handleSkip}
            className="w-full rounded-full border border-transparent px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-white/42 underline-offset-4 transition-colors hover:text-white/80 hover:underline sm:text-xs"
          >
            Continuar sem foto
          </button>
        </div>
      </div>
    </div>
  );
}
