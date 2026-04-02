"use client";

import { useRouter } from "next/navigation";
import { Heading } from "@/components/ui/Heading";
import { SimulatedCamera } from "@/components/ui/SimulatedCamera";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

export default function BodyScannerPage() {
  const router = useRouter();
  const { updateData } = useOnboarding();

  const handleBodyCaptured = (fakeImageData: string) => {
    updateData("scanner", { bodyPhoto: fakeImageData });
    router.push("/processing");
  };

  return (
    <div className="flex flex-col min-h-screen p-6 pt-24 items-center bg-black">
      <Heading as="h3" className="mb-8 text-center text-white/90 font-serif">
        Guia de Proporção
      </Heading>
      
      <SimulatedCamera 
        instruction="Posicione o topo da cabeça e o pé nas guias pontilhadas."
        overlayType="body"
        showTimerOptions={true}
        onCaptured={handleBodyCaptured}
      />
    </div>
  );
}
