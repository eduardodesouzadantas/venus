"use client";

import Link from "next/link";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

export default function OptInPage() {
  const { updateData } = useOnboarding();

  const handleSkip = () => {
    updateData("scanner", { skipped: true });
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6 bg-black">
      
      {/* Glow Center Aura */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-white/5 blur-[80px] rounded-full pointer-events-none" />

      <Heading as="h1" className="text-center italic font-light z-10 mb-12">
        A Inteligência que te Vê.
      </Heading>

      <div className="z-10 bg-white/5 backdrop-blur-[30px] border border-white/10 p-8 rounded-[32px] w-full text-center shadow-2xl relative overflow-hidden">
        <Text className="text-white/80 mb-6">
          Mapeamos sua arquitetura visual, não fazemos julgamentos médicos ou estéticos depreciativos.
        </Text>
        <Text className="text-white/60 text-sm mb-10">
          A câmera permite à IA calibrar a temperatura da sua pele, as linhas do seu rosto e o real comprimento do seu tronco de forma tão precisa que equivale a uma consultoria humana presencial.
        </Text>

        <div className="flex flex-col space-y-4">
          <Link href="/scanner/face" className="w-full">
            <VenusButton variant="solid" className="w-full">
              Ativar Scanner Visual
            </VenusButton>
          </Link>

          <Link href="/processing" className="w-full" onClick={handleSkip}>
            <VenusButton variant="ghost" className="w-full text-xs underline underline-offset-4 opacity-50 hover:opacity-100">
              Prefiro pular esta etapa e usar apenas texto
            </VenusButton>
          </Link>
        </div>
      </div>

    </div>
  );
}
