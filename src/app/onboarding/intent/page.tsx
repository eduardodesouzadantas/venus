"use client";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { GlassContainer } from "@/components/ui/GlassContainer";
import { PillSelector } from "@/components/ui/PillSelector";
import { EmotionalSlider } from "@/components/ui/EmotionalSlider";
import { BottomNav } from "@/components/ui/BottomNav";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

const SATISFACTION_LABELS: Record<number, string> = {
  0: "Desespero total",
  2: "Nada funciona",
  5: "Preciso melhorar",
  8: "Estou no caminho",
  10: "Domino meu estilo",
};

const IMAGE_GOALS = ["Autoridade", "Elegância", "Atração", "Criatividade", "Discrição sofisticada"];
const MAIN_PAINS = ["Falta de tempo", "Nada combina", "Compro por impulso"];

export default function IntentPage() {
  const { data, updateData } = useOnboarding();
  const { imageGoal, satisfaction, mainPain } = data.intent;

  const isValid = imageGoal !== "" && mainPain !== "";

  return (
    <div className="flex flex-col min-h-screen p-6 pt-24">
      <Heading as="h2">Intenção & Emoção</Heading>
      <Text className="mt-2 text-white/60">Vamos codificar o que você quer transmitir e o que te incomoda hoje.</Text>
      
      <GlassContainer className="mt-8 space-y-8 flex-1">
        <div className="space-y-4">
          <Heading as="h4" className="text-lg">O que você quer que suas roupas digam por você?</Heading>
          <PillSelector 
            options={IMAGE_GOALS} 
            selected={imageGoal ? [imageGoal] : []} 
            onChange={(sel) => updateData("intent", { imageGoal: sel[0] || "" })} 
          />
        </div>

        <div className="space-y-4 pt-4 border-t border-white/10">
          <Heading as="h4" className="text-lg">Qual seu nível de satisfação hoje?</Heading>
          <EmotionalSlider 
            value={satisfaction} 
            onChange={(val) => updateData("intent", { satisfaction: val })}
            labelMap={SATISFACTION_LABELS}
          />
        </div>

        <div className="space-y-4 pt-4 border-t border-white/10">
          <Heading as="h4" className="text-lg">Maior queixa ao se vestir:</Heading>
          <PillSelector 
            options={MAIN_PAINS} 
            selected={mainPain ? [mainPain] : []} 
            onChange={(sel) => updateData("intent", { mainPain: sel[0] || "" })} 
          />
        </div>
      </GlassContainer>
      
      <BottomNav 
        nextHref="/onboarding/lifestyle" 
        backHref="/" 
        nextDisabled={!isValid} 
      />
    </div>
  );
}
