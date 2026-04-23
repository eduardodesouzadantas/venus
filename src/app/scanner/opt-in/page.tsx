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
  const { data, updateData, journey } = useOnboarding();
  const consultation = normalizeConsultationProfile(data.consultation);

  useEffect(() => {
    const hasStyleDirection = Boolean(consultation.styleDirection || data.intent.styleDirection);
    const hasDesiredPerception = Boolean(consultation.desiredPerception || data.intent.imageGoal);
    const hasOccasion = Boolean(consultation.occasion);

    if (!hasStyleDirection || !hasDesiredPerception || !hasOccasion) {
      router.replace(org ? `/onboarding/intent?org=${encodeURIComponent(org)}` : "/onboarding/intent");
    }
  }, [router, consultation, data.intent.styleDirection, data.intent.imageGoal, org]);

  const title =
    journey?.mode === "continue"
      ? "Retomando seu contexto."
      : journey?.mode === "light"
        ? "Seu perfil já está salvo."
        : "A Venus lê sua presença.";
  const subtitle =
    journey?.mode === "continue"
      ? "Vamos continuar de onde você parou, sem repetir etapas já concluídas."
      : journey?.mode === "light"
        ? "Agora só refinamos a leitura visual para esta loja, sem repetir o onboarding inteiro."
        : "Vamos usar a câmera para refinar proporções, rosto e presença com mais precisão.";

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
        {title}
      </Heading>

      <div className="relative z-10 w-full max-w-[520px] overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-6 text-center shadow-2xl backdrop-blur-[30px] sm:rounded-[32px] sm:p-8">
        <Text className="mb-4 text-white/80 sm:mb-6">{subtitle}</Text>
        <Text className="mb-8 text-[14px] text-white/60 sm:mb-10 sm:text-sm">
          Se preferir, você pode seguir sem câmera e ainda receber uma leitura forte com base no que já contou.
        </Text>

        <div className="flex flex-col gap-3 sm:gap-4">
          <VenusButton variant="solid" className="w-full" onClick={handleStartScan}>
            Ativar leitura visual
          </VenusButton>

          <button
            type="button"
            onClick={handleSkip}
            className="w-full rounded-full border border-transparent px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-white/42 underline-offset-4 transition-colors hover:text-white/80 hover:underline sm:text-xs"
          >
            Prefiro seguir sem câmera
          </button>
        </div>
      </div>
    </div>
  );
}