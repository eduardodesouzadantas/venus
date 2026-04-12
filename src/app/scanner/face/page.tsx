"use client";

import { useRouter } from "next/navigation";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { RealCamera } from "@/components/ui/RealCamera";
import { useUserImage } from "@/lib/onboarding/UserImageContext";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { analyzeColorimetry } from "@/lib/analysis/colorimetry-client";

export default function FaceScannerPage() {
  const router = useRouter();
  const { data, updateData, updateConversation } = useOnboarding();
  const { setUserPhoto } = useUserImage();

  const handleFaceCaptured = async (imageData: string) => {
    updateData("scanner", { facePhoto: imageData });
    setUserPhoto(imageData);

    const analysis = await analyzeColorimetry(imageData, data.tenant?.orgId || data.tenant?.orgSlug || "");
    if (analysis) {
      updateData("colorimetry", analysis);
      updateData("colors", {
        favoriteColors: analysis.favoriteColors,
        avoidColors: analysis.avoidColors,
        colorSeason: analysis.colorSeason,
        skinTone: analysis.skinTone,
        undertone: analysis.undertone,
        contrast: analysis.contrast,
        faceShape: analysis.faceShape,
        idealNeckline: analysis.idealNeckline,
        idealFit: analysis.idealFit,
        idealFabrics: analysis.idealFabrics,
        avoidFabrics: analysis.avoidFabrics,
      });
      updateData("favoriteColors", analysis.favoriteColors);
      updateData("avoidColors", analysis.avoidColors);
      updateData("colorSeason", analysis.colorSeason);
      updateData("faceShape", analysis.faceShape);
      updateData("idealNeckline", analysis.idealNeckline);
      updateData("idealFit", analysis.idealFit);
      updateData("idealFabrics", analysis.idealFabrics);
      updateData("avoidFabrics", analysis.avoidFabrics);
      updateConversation({
        favoriteColors: analysis.favoriteColors,
        avoidColors: analysis.avoidColors,
      });
    }

    router.push("/scanner/body");
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-black px-4 pb-6 pt-12 sm:px-6 sm:pt-24">
      <div className="w-full max-w-[520px]">
        <div className="mb-4 space-y-2 text-center sm:mb-6">
          <span className="text-[9px] font-bold uppercase tracking-[0.34em] text-[#C9A84C]">Leitura 03 de 04</span>
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
