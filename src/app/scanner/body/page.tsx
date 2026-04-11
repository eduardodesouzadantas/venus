"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { BodyPhotoUpload } from "@/components/ui/BodyPhotoUpload";
import { RealCamera } from "@/components/ui/RealCamera";
import { useUserImage } from "@/lib/onboarding/UserImageContext";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { analyzeColorimetry } from "@/lib/analysis/colorimetry-client";

export default function BodyScannerPage() {
  const router = useRouter();
  const { data, updateData, updateConversation } = useOnboarding();
  const { setUserPhoto } = useUserImage();
  const [mode, setMode] = useState<"upload" | "camera">("upload");

  const handleBodyCaptured = async (imageData: string) => {
    updateData("scanner", { bodyPhoto: imageData });
    setUserPhoto(imageData);

    if ((!data.colors.favoriteColors.length || !data.colors.avoidColors.length) && data.scanner.facePhoto) {
      const analysis = await analyzeColorimetry(data.scanner.facePhoto);
      if (analysis) {
        updateData("colors", {
          favoriteColors: analysis.favoriteColors,
          avoidColors: analysis.avoidColors,
        });
        updateConversation({
          favoriteColors: analysis.favoriteColors,
          avoidColors: analysis.avoidColors,
        });
      }
    }

    router.push("/processing");
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-black px-4 pb-6 pt-12 sm:px-6 sm:pt-24">
      <div className="w-full max-w-[520px]">
        <div className="mb-4 space-y-2 text-center sm:mb-6">
          <span className="text-[9px] font-bold uppercase tracking-[0.34em] text-[#D4AF37]">Leitura 04 de 04</span>
          <Heading as="h3" className="font-serif text-2xl text-white/90 sm:text-3xl">
            Agora a Venus ajusta a presença no corpo
          </Heading>
          <Text className="mx-auto max-w-[26ch] text-sm text-white/55">
            Posicione a silhueta para calibrar proporção, caimento e leitura final do look.
          </Text>
        </div>

        {mode === "upload" ? (
          <BodyPhotoUpload
            onPhotoSelected={handleBodyCaptured}
            onUseCamera={() => setMode("camera")}
          />
        ) : (
          <RealCamera
            instruction="Posicione o topo da cabeça e os pés nas guias pontilhadas."
            overlayType="body"
            showTimerOptions={true}
            onCaptured={handleBodyCaptured}
          />
        )}
      </div>
    </div>
  );
}
