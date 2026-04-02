"use client";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { GlassContainer } from "@/components/ui/GlassContainer";
import { PillSelector } from "@/components/ui/PillSelector";
import { BottomNav } from "@/components/ui/BottomNav";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

const ENVIRONMENTS = ["Corporativo Rígido", "Escritório Casual", "Home Office", "Mundo Noturno", "Lazer / Outdoor", "Eventos Sociais"];
const PURCHASE_DNA = ["Poucas & Boas", "Variedade Constante"];
const PURCHASE_BEHAVIOR = ["Compras Planejadas", "Compro por Impulso"];

export default function LifestylePage() {
  const { data, updateData } = useOnboarding();
  const { environments, purchaseDna, purchaseBehavior } = data.lifestyle;

  const isValid = environments.length > 0 && purchaseDna !== "" && purchaseBehavior !== "";

  return (
    <div className="flex flex-col min-h-screen p-6 pt-24">
      <Heading as="h2">Seu Território</Heading>
      <Text className="mt-2 text-white/60">Onde sua vida acontece a maior parte do tempo.</Text>
      
      <GlassContainer className="mt-8 space-y-8 flex-1">
        <div className="space-y-4">
          <Heading as="h4" className="text-lg">Ambientes mais frequentes:</Heading>
          <PillSelector 
            options={ENVIRONMENTS} 
            selected={environments} 
            multiple
            onChange={(sel) => updateData("lifestyle", { environments: sel })} 
          />
        </div>

        <div className="space-y-4 pt-4 border-t border-white/10">
          <Heading as="h4" className="text-lg">Comportamento de Consumo:</Heading>
          <PillSelector 
            options={PURCHASE_DNA} 
            selected={purchaseDna ? [purchaseDna] : []} 
            onChange={(sel) => updateData("lifestyle", { purchaseDna: sel[0] || "" })} 
          />
        </div>

        <div className="space-y-4 pt-4 border-t border-white/10">
          <Heading as="h4" className="text-lg">Como você compra?</Heading>
          <PillSelector 
            options={PURCHASE_BEHAVIOR} 
            selected={purchaseBehavior ? [purchaseBehavior] : []} 
            onChange={(sel) => updateData("lifestyle", { purchaseBehavior: sel[0] || "" })} 
          />
        </div>
      </GlassContainer>
      
      <BottomNav 
        nextHref="/onboarding/colors" 
        backHref="/onboarding/intent" 
        nextDisabled={!isValid} 
      />
    </div>
  );
}
