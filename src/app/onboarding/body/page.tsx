"use client";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { GlassContainer } from "@/components/ui/GlassContainer";
import { PillSelector } from "@/components/ui/PillSelector";
import { BottomNav } from "@/components/ui/BottomNav";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

const BODY_PARTS = ["Ombros", "Cintura", "Quadril", "Pernas", "Colo/Busto", "Braços"];
const FIT_PREFERENCES = ["Justíssimo", "Slim", "Relaxed", "Oversized"];
const FACE_LINES = ["Suaves (arredondado)", "Marcantes (angular)"];
const HAIR_LENGTH = ["Curto", "Médio", "Longo"];

export default function BodyPage() {
  const { data, updateData } = useOnboarding();
  const { highlight, camouflage, fit, faceLines, hairLength } = data.body;

  const isValid = fit !== "" && faceLines !== "" && hairLength !== "";

  const handleHighlightChange = (values: string[]) => {
    updateData("body", { highlight: values });
    updateData("consultation", { bodyFocus: values[0] || "" });
  };

  const handleCamouflageChange = (values: string[]) => {
    updateData("body", { camouflage: values });
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col px-5 pb-7 pt-12 sm:px-6 sm:pb-8 sm:pt-14">
      <Heading as="h2" className="max-w-[15ch]">
        Mapa da presença
      </Heading>
      <Text className="mt-2 max-w-[28ch] text-white/60">O que destacar, o que suavizar e como o caimento deve sustentar sua leitura.</Text>

      <GlassContainer className="mt-6 flex-1 space-y-6 sm:mt-8 sm:space-y-8">
        <div className="space-y-3 sm:space-y-4">
          <Heading as="h4" className="text-[15px] sm:text-lg">
            O que eu quero destacar
          </Heading>
          <Text className="text-sm text-white/55">Marque o que você quer evidenciar com mais intenção e equilíbrio.</Text>
          <PillSelector
            options={BODY_PARTS.filter((p) => !camouflage.includes(p))}
            selected={highlight}
            multiple
            onChange={(sel) => handleHighlightChange(sel)}
          />
        </div>

        <div className="space-y-3 border-t border-white/10 pt-4 sm:space-y-4">
          <Heading as="h4" className="text-[15px] sm:text-lg">
            O que eu prefiro suavizar
          </Heading>
          <Text className="text-sm text-white/55">Aqui a leitura entende o que você prefere não enfatizar no corpo e no look.</Text>
          <PillSelector
            options={BODY_PARTS.filter((p) => !highlight.includes(p))}
            selected={camouflage}
            multiple
            onChange={(sel) => handleCamouflageChange(sel)}
          />
        </div>

        <div className="space-y-3 border-t border-white/10 pt-4 sm:space-y-4">
          <Heading as="h4" className="text-[15px] sm:text-lg">
            Como você prefere o caimento?
          </Heading>
          <Text className="text-sm text-white/55">O caimento muda completamente a leitura da peça no corpo.</Text>
          <PillSelector
            options={FIT_PREFERENCES}
            selected={fit ? [fit] : []}
            onChange={(sel) => updateData("body", { fit: (sel[0] as any) || "" })}
          />
        </div>

        <div className="space-y-3 border-t border-white/10 pt-4 sm:space-y-4">
          <Heading as="h4" className="text-[15px] sm:text-lg">
            Rosto e cabelo
          </Heading>
          <Text className="text-sm text-white/55">Essa leitura ajuda a alinhar linhas, proporção e acabamento visual do styling.</Text>
          <div className="space-y-3">
            <PillSelector
              options={FACE_LINES}
              selected={faceLines ? [faceLines] : []}
              onChange={(sel) => updateData("body", { faceLines: (sel[0] as any) || "" })}
            />
            <PillSelector
              options={HAIR_LENGTH}
              selected={hairLength ? [hairLength] : []}
              onChange={(sel) => updateData("body", { hairLength: (sel[0] as any) || "" })}
            />
          </div>
        </div>
      </GlassContainer>

      <BottomNav nextHref="/scanner/opt-in" backHref="/onboarding/colors" nextDisabled={!isValid} />
    </div>
  );
}

