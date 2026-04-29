"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { RealCamera } from "@/components/ui/RealCamera";
import { useUserImage } from "@/lib/onboarding/UserImageContext";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { analyzeColorimetry } from "@/lib/analysis/colorimetry-client";
import { uploadOnboardingPhoto } from "@/lib/onboarding/photo-upload";

export default function FaceScannerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const org = searchParams.get("org");
  const { data, updateData, updateConversation, journey } = useOnboarding();
  const { setUserPhoto } = useUserImage();
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFaceCaptured = async (imageData: string) => {
    setIsUploading(true);
    setError(null);

    try {
      const uploaded = await uploadOnboardingPhoto({
        source: imageData,
        orgId: data.tenant?.orgId || "",
        orgSlug: data.tenant?.orgSlug || org || null,
        kind: "face",
        journeyId: journey?.lastState || null,
        fileName: "venus-face.jpg",
      });

      updateData("scanner", {
        facePhoto: uploaded.storagePath,
        facePhotoUrl: "",
        facePhotoPath: uploaded.storagePath,
      });
      setUserPhoto(uploaded.signedUrl);

      const analysis = await analyzeColorimetry(uploaded.signedUrl, data.tenant?.orgId || data.tenant?.orgSlug || "");
      if (analysis) {
        updateData("colorimetry", analysis);
        updateData("colors", {
          favoriteColors: analysis.basePalette.length > 0 ? analysis.basePalette : analysis.favoriteColors,
          avoidColors: analysis.avoidOrUseCarefully.length > 0 ? analysis.avoidOrUseCarefully : analysis.avoidColors,
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

      router.push(org ? `/scanner/body?org=${encodeURIComponent(org)}` : "/scanner/body");
    } catch (uploadError) {
      console.error("[ONBOARDING] face upload failed", {
        error: uploadError instanceof Error ? uploadError.message : String(uploadError),
      });
      setError("Não consegui salvar essa foto. Tente novamente com uma imagem menor ou mais nítida.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-black px-4 pb-6 pt-12 sm:px-6 sm:pt-24">
      <div className="w-full max-w-[520px]">
        <div className="mb-4 space-y-2 text-center sm:mb-6">
          <span className="text-[9px] font-bold uppercase tracking-[0.34em] text-[#C9A84C]">Leitura visual</span>
          <Heading as="h3" className="font-serif text-2xl text-white/90 sm:text-3xl">
            A leitura visual é opcional.
          </Heading>
          <Text className="mx-auto max-w-[28ch] text-sm text-white/55">
            A foto pode refinar sua curadoria, mas sua assinatura já pode ser construída pelas respostas. Você escolhe como seguir.
          </Text>
        </div>

        {error ? <p className="mb-3 text-center text-sm text-[#ffb6a8]">{error}</p> : null}
        <RealCamera instruction="Centralize a imagem com luz suave." overlayType="face" onCaptured={handleFaceCaptured} />
        {isUploading ? <p className="mt-3 text-center text-xs text-white/45">Salvando a foto em segurança...</p> : null}
      </div>
    </div>
  );
}
