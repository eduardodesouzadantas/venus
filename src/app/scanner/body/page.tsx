"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { BodyPhotoUpload } from "@/components/ui/BodyPhotoUpload";
import { RealCamera } from "@/components/ui/RealCamera";
import { useUserImage } from "@/lib/onboarding/UserImageContext";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { analyzeColorimetry } from "@/lib/analysis/colorimetry-client";
import { buildVenusBodyScannerIntro } from "@/lib/venus/brand";
import { uploadOnboardingPhoto } from "@/lib/onboarding/photo-upload";
import { resolveOnboardingPhotoSignedUrl } from "@/lib/onboarding/photo-access";

export default function BodyScannerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const org = searchParams.get("org");
  const { data, updateData, updateConversation, journey } = useOnboarding();
  const { setUserPhoto } = useUserImage();
  const [mode, setMode] = useState<"upload" | "camera">("upload");
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleBodyCaptured = async (imageData: string) => {
    setIsUploading(true);
    setError(null);

    try {
      const uploaded = await uploadOnboardingPhoto({
        source: imageData,
        orgId: data.tenant?.orgId || "",
        orgSlug: data.tenant?.orgSlug || org || null,
        kind: "body",
        journeyId: journey?.lastState || null,
        fileName: "venus-body.jpg",
      });

      updateData("scanner", {
        bodyPhoto: uploaded.storagePath,
        bodyPhotoUrl: "",
        bodyPhotoPath: uploaded.storagePath,
      });
      setUserPhoto(uploaded.signedUrl);

      const sourceImage =
        data.scanner.facePhotoUrl ||
        (data.scanner.facePhotoPath
          ? await resolveOnboardingPhotoSignedUrl({
              storagePath: data.scanner.facePhotoPath,
              orgId: data.tenant?.orgId || null,
              orgSlug: data.tenant?.orgSlug || org || null,
            })
          : data.scanner.facePhoto || uploaded.signedUrl);
      if ((!data.colorimetry.justification || !data.favoriteColors.length || !data.avoidColors.length) && sourceImage) {
        const analysis = await analyzeColorimetry(sourceImage, data.tenant?.orgId || data.tenant?.orgSlug || "");
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
      }

      router.push(org ? `/processing?org=${encodeURIComponent(org)}` : "/processing");
    } catch (uploadError) {
      console.error("[ONBOARDING] body upload failed", {
        error: uploadError instanceof Error ? uploadError.message : String(uploadError),
      });
      setError("Não consegui salvar essa foto. Tente uma versão menor ou capture novamente.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-black px-4 pb-6 pt-12 sm:px-6 sm:pt-24">
      <div className="w-full max-w-[520px]">
        <div className="mb-4 space-y-2 text-center sm:mb-6">
          <span className="text-[9px] font-bold uppercase tracking-[0.34em] text-[#C9A84C]">Leitura final</span>
          <Heading as="h3" className="font-serif text-2xl text-white/90 sm:text-3xl">
            {buildVenusBodyScannerIntro()}
          </Heading>
          <Text className="mx-auto max-w-[26ch] text-sm text-white/55">
            Posicione a silhueta com luz frontal para a Venus calibrar proporção, caimento e presença.
          </Text>
        </div>

        {error ? <p className="mb-3 text-center text-sm text-[#ffb6a8]">{error}</p> : null}
        {mode === "upload" ? (
          <BodyPhotoUpload
            onPhotoSelected={handleBodyCaptured}
            onUseCamera={() => setMode("camera")}
          />
        ) : (
          <RealCamera
            instruction="Alinhe cabeça e pés nas guias pontilhadas."
            overlayType="body"
            showTimerOptions={true}
            onCaptured={handleBodyCaptured}
          />
        )}
        {isUploading ? <p className="mt-3 text-center text-xs text-white/45">Salvando a foto em segurança...</p> : null}
      </div>
    </div>
  );
}
