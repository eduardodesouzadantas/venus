"use client";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { GlassContainer } from "@/components/ui/GlassContainer";
import { PillSelector } from "@/components/ui/PillSelector";
import { BottomNav } from "@/components/ui/BottomNav";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

const BODY_PARTS = ["Ombros", "Cintura", "Quadril", "Pernas", "Colo/Busto", "Braços"];
const FIT_PREFERENCES = ["Justíssimo", "Slim", "Relaxed", "Oversized"];
const FACE_LINES = ["Suaves (Arredondado)", "Marcantes (Angular)"];
const HAIR_LENGTH = ["Curto", "Médio", "Longo"];

export default function BodyPage() {
  const { data, updateData } = useOnboarding();
  const { highlight, camouflage, fit, faceLines, hairLength } = data.body;

  const isValid = fit !== "" && faceLines !== "" && hairLength !== "";

  return (
    <div className="flex flex-col min-h-screen p-6 pt-24">
      <Heading as="h2">Engenharia do Corpo</Heading>
      <Text className="mt-2 text-white/60">Suas proporções mapeadas sem mistérios.</Text>
      
      <GlassContainer className="mt-8 space-y-8 flex-1">
        <div className="space-y-4">
          <Heading as="h4" className="text-lg">Eu amo e gostaria de destacar ({`❤️`}):</Heading>
          <PillSelector 
            options={BODY_PARTS.filter(p => !camouflage.includes(p))} 
            selected={highlight} 
            multiple
            onChange={(sel) => updateData("body", { highlight: sel })} 
          />
        </div>

        <div className="space-y-4 pt-4 border-t border-white/10">
          <Heading as="h4" className="text-lg">Prefiro camuflar/disfarçar ({`👁️‍🗨️`}):</Heading>
          <PillSelector 
            options={BODY_PARTS.filter(p => !highlight.includes(p))} 
            selected={camouflage} 
            multiple
            onChange={(sel) => updateData("body", { camouflage: sel })} 
          />
        </div>

        <div className="space-y-4 pt-4 border-t border-white/10">
          <Heading as="h4" className="text-lg">Como você prefere o caimento (Fit)?</Heading>
          <PillSelector 
            options={FIT_PREFERENCES} 
            selected={fit ? [fit] : []} 
            onChange={(sel) => updateData("body", { fit: sel[0] as any || "" })} 
          />
        </div>

        <div className="space-y-4 pt-4 border-t border-white/10">
          <Heading as="h4" className="text-lg">Seu Rosto e Cabelo (Visagismo):</Heading>
          <div className="space-y-3">
            <PillSelector 
              options={FACE_LINES} 
              selected={faceLines ? [faceLines] : []} 
              onChange={(sel) => updateData("body", { faceLines: sel[0] as any || "" })} 
            />
            <PillSelector 
              options={HAIR_LENGTH} 
              selected={hairLength ? [hairLength] : []} 
              onChange={(sel) => updateData("body", { hairLength: sel[0] as any || "" })} 
            />
          </div>
        </div>
      </GlassContainer>
      
      <BottomNav 
        nextHref="/scanner/opt-in" 
        backHref="/onboarding/colors" 
        nextDisabled={!isValid} 
      />
    </div>
  );
}
