"use client";

import { useRouter } from "next/navigation";
import { Heading } from "@/components/ui/Heading";
import { SimulatedCamera } from "@/components/ui/SimulatedCamera";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

export default function FaceScannerPage() {
  const router = useRouter();
  const { updateData } = useOnboarding();

  const handleFaceCaptured = (fakeImageData: string) => {
    updateData("scanner", { facePhoto: fakeImageData });
    router.push("/scanner/body");
  };

  return (
    <div className="flex flex-col min-h-screen p-6 pt-24 items-center bg-black">
      <Heading as="h3" className="mb-8 text-center text-white/90 font-serif">
        Scanner de Visagismo
      </Heading>
      
      <SimulatedCamera 
        instruction="Enquadre rosto e pescoço no centro da linha ouro."
        overlayType="face"
        onCaptured={handleFaceCaptured}
      />
    </div>
  );
}
