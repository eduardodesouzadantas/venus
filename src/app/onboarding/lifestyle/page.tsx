"use client";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { GlassContainer } from "@/components/ui/GlassContainer";
import { PillSelector } from "@/components/ui/PillSelector";
import { BottomNav } from "@/components/ui/BottomNav";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

const ENVIRONMENTS = ["Rotina corporativa", "Escritório casual", "Home office", "Noites e eventos", "Lazer e viagens", "Compromissos sociais"];
const PURCHASE_DNA = ["Poucas peças boas", "Variedade constante"];
const PURCHASE_BEHAVIOR = ["Planejo antes de comprar", "Compro por impulso"];

export default function LifestylePage() {
  const { data, updateData } = useOnboarding();
  const { environments, purchaseDna, purchaseBehavior } = data.lifestyle;

  const isValid = environments.length > 0 && purchaseDna !== "" && purchaseBehavior !== "";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col px-5 pb-7 pt-12 sm:px-6 sm:pb-8 sm:pt-14">
      <Heading as="h2" className="max-w-[13ch]">
        Seu contexto
      </Heading>
      <Text className="mt-2 max-w-[28ch] text-white/60">A curadoria fica mais precisa quando entende onde a roupa realmente vive.</Text>

      <GlassContainer className="mt-6 flex-1 space-y-6 sm:mt-8 sm:space-y-8">
        <div className="space-y-3 sm:space-y-4">
          <Heading as="h4" className="text-[15px] sm:text-lg">
            Onde a sua imagem precisa funcionar?
          </Heading>
          <Text className="text-sm text-white/55">Escolha os cenários que mais pedem presença de verdade no seu dia a dia.</Text>
          <PillSelector
            options={ENVIRONMENTS}
            selected={environments}
            multiple
            onChange={(sel) => updateData("lifestyle", { environments: sel })}
          />
        </div>

        <div className="space-y-3 border-t border-white/10 pt-4 sm:space-y-4">
          <Heading as="h4" className="text-[15px] sm:text-lg">
            Quantidade que faz sentido
          </Heading>
          <Text className="text-sm text-white/55">Aqui entendemos se você prefere poucos acertos fortes ou mais variação no acervo.</Text>
          <PillSelector
            options={PURCHASE_DNA}
            selected={purchaseDna ? [purchaseDna] : []}
            onChange={(sel) => updateData("lifestyle", { purchaseDna: sel[0] || "" })}
          />
        </div>

        <div className="space-y-3 border-t border-white/10 pt-4 sm:space-y-4">
          <Heading as="h4" className="text-[15px] sm:text-lg">
            Como você compra normalmente?
          </Heading>
          <Text className="text-sm text-white/55">Esse padrão ajuda a Venus a calibrar o nível de impulso e planejamento real.</Text>
          <PillSelector
            options={PURCHASE_BEHAVIOR}
            selected={purchaseBehavior ? [purchaseBehavior] : []}
            onChange={(sel) => updateData("lifestyle", { purchaseBehavior: sel[0] || "" })}
          />
        </div>
      </GlassContainer>

      <BottomNav nextHref="/onboarding/colors" backHref="/onboarding/intent" nextDisabled={!isValid} />
    </div>
  );
}

