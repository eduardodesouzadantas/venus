"use client";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { GlassContainer } from "@/components/ui/GlassContainer";
import { PillSelector } from "@/components/ui/PillSelector";
import { BottomNav } from "@/components/ui/BottomNav";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

const COLOR_FAMILIES = ["Cores Neutras (Preto/Branco/Cinza)", "Tons Terrosos (Marrom/Bege/Mostarda)", "Cores Frias (Azul/Verde/Roxo)", "Cores Quentes (Vermelho/Laranja)", "Tons Pastéis"];

export default function ColorsPage() {
  const { data, updateData } = useOnboarding();
  const { favoriteColors, avoidColors, metal } = data.colors;

  const isValid = favoriteColors.length > 0 && metal !== "";

  return (
    <div className="flex flex-col min-h-screen p-6 pt-24">
      <Heading as="h2">A Física da Luz</Heading>
      <Text className="mt-2 text-white/60">As cores que te abraçam e as que você rejeita.</Text>
      
      <GlassContainer className="mt-8 space-y-8 flex-1">
        <div className="space-y-4">
          <Heading as="h4" className="text-lg">Famílias de Cor: Você ama usar</Heading>
          <PillSelector 
            options={COLOR_FAMILIES} 
            selected={favoriteColors} 
            multiple
            onChange={(sel) => updateData("colors", { favoriteColors: sel })} 
          />
        </div>

        <div className="space-y-4 pt-4 border-t border-white/10">
          <Heading as="h4" className="text-lg">Famílias de Cor: Jamais usaria</Heading>
          <PillSelector 
            options={COLOR_FAMILIES} 
            selected={avoidColors} 
            multiple
            onChange={(sel) => updateData("colors", { avoidColors: sel })} 
          />
        </div>

        <div className="space-y-4 pt-4 border-t border-white/10">
          <Heading as="h4" className="text-lg">A base dos seus metais:</Heading>
          <div className="flex gap-4">
            <button 
              onClick={() => updateData("colors", { metal: "Dourado" })}
              className={`flex-1 py-8 rounded-2xl border ${metal === "Dourado" ? "border-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.4)]" : "border-white/10 opacity-50"}`}
              style={{ background: "linear-gradient(135deg, #FFD700 0%, #B8860B 100%)" }}
            >
              <Text className="text-black font-medium text-lg drop-shadow-md">Dourado</Text>
            </button>
            <button 
              onClick={() => updateData("colors", { metal: "Prateado" })}
              className={`flex-1 py-8 rounded-2xl border ${metal === "Prateado" ? "border-white ring-1 ring-white shadow-[0_0_15px_rgba(255,255,255,0.4)]" : "border-white/10 opacity-50"}`}
              style={{ background: "linear-gradient(135deg, #E0E0E0 0%, #9E9E9E 100%)" }}
            >
              <Text className="text-black font-medium text-lg drop-shadow-md">Prata</Text>
            </button>
          </div>
        </div>
      </GlassContainer>
      
      <BottomNav 
        nextHref="/onboarding/body" 
        backHref="/onboarding/lifestyle" 
        nextDisabled={!isValid} 
      />
    </div>
  );
}
