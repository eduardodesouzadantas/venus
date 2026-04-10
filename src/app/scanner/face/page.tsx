"use client";

import { useRouter } from "next/navigation";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { RealCamera } from "@/components/ui/RealCamera";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

export default function FaceScannerPage() {
  const router = useRouter();
  const { updateData } = useOnboarding();

  const handleFaceCaptured = (imageData: string) => {
    updateData("scanner", { facePhoto: imageData });
    router.push("/scanner/body");
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-black px-4 pb-6 pt-12 sm:px-6 sm:pt-24">
      <div className="w-full max-w-[520px]">
        <div className="mb-4 space-y-2 text-center sm:mb-6">
          <span className="text-[9px] font-bold uppercase tracking-[0.34em] text-[#D4AF37]">Leitura 03 de 04</span>
          <Heading as="h3" className="font-serif text-2xl text-white/90 sm:text-3xl">
            O rosto é o primeiro sinal da leitura
          </Heading>
          <Text className="mx-auto max-w-[26ch] text-sm text-white/55">
            Centralize o rosto para a Venus ler linhas, contraste e direção com mais precisão.
          </Text>
        </div>

        <RealCamera instruction="Enquadre rosto e pescoço no centro da moldura." overlayType="face" onCaptured={handleFaceCaptured} />
      </div>
    </div>
  );
}
