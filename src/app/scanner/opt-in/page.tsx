"use client";

import Link from "next/link";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

export default function OptInPage() {
  const { updateData, journey } = useOnboarding();
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
          <Link href="/scanner/face" className="w-full">
            <VenusButton variant="solid" className="w-full">
              Ativar leitura visual
            </VenusButton>
          </Link>

          <Link href="/processing" className="w-full" onClick={handleSkip}>
            <VenusButton variant="ghost" className="w-full text-[11px] underline underline-offset-4 opacity-50 hover:opacity-100 sm:text-xs">
              Prefiro seguir sem câmera
            </VenusButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
