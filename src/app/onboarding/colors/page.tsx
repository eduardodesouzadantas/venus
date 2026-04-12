"use client";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { GlassContainer } from "@/components/ui/GlassContainer";
import { PillSelector } from "@/components/ui/PillSelector";
import { BottomNav } from "@/components/ui/BottomNav";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

const COLOR_FAMILIES = [
  "Cores neutras (preto, branco, cinza)",
  "Tons terrosos (marrom, bege, mostarda)",
  "Cores frias (azul, verde, roxo)",
  "Cores quentes (vermelho, laranja)",
  "Tons pastel",
];

export default function ColorsPage() {
  const { data, updateData } = useOnboarding();
  const { favoriteColors, avoidColors, metal } = data.colors;

  const isValid = favoriteColors.length > 0 && metal !== "";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col px-5 pb-7 pt-12 sm:px-6 sm:pb-8 sm:pt-14">
      <Heading as="h2" className="max-w-[12ch]">
        Sua paleta
      </Heading>
      <Text className="mt-2 max-w-[28ch] text-white/60">As cores que sustentam sua presença e as que quebram a leitura.</Text>

      <GlassContainer className="mt-6 flex-1 space-y-6 sm:mt-8 sm:space-y-8">
        <div className="space-y-3 sm:space-y-4">
          <Heading as="h4" className="text-[15px] sm:text-lg">
            Famílias que mais te favorecem
          </Heading>
          <Text className="text-sm text-white/55">Escolha as famílias que mais sustentam sua presença visual.</Text>
          <PillSelector
            options={COLOR_FAMILIES}
            selected={favoriteColors}
            multiple
            onChange={(sel) => updateData("colors", { favoriteColors: sel })}
          />
        </div>

        <div className="space-y-3 border-t border-white/10 pt-4 sm:space-y-4">
          <Heading as="h4" className="text-[15px] sm:text-lg">
            Famílias que você evita
          </Heading>
          <Text className="text-sm text-white/55">Aqui entendemos quais tons enfraquecem a leitura da sua imagem.</Text>
          <PillSelector
            options={COLOR_FAMILIES}
            selected={avoidColors}
            multiple
            onChange={(sel) => updateData("colors", { avoidColors: sel })}
          />
        </div>

        <div className="space-y-3 border-t border-white/10 pt-4 sm:space-y-4">
          <Heading as="h4" className="text-[15px] sm:text-lg">
            Seu metal principal
          </Heading>
          <div className="flex gap-3 sm:gap-4">
            <button
              onClick={() => updateData("colors", { metal: "Dourado" })}
              className={`flex-1 rounded-2xl border px-3 py-6 sm:py-8 ${
                metal === "Dourado"
                  ? "border-[#C9A84C] ring-1 ring-[#C9A84C] shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                  : "border-white/10 opacity-50"
              }`}
              style={{ background: "linear-gradient(135deg, #FFD700 0%, #B8860B 100%)" }}
            >
              <Text className="text-sm font-medium text-black drop-shadow-md sm:text-lg">Dourado</Text>
            </button>
            <button
              onClick={() => updateData("colors", { metal: "Prateado" })}
              className={`flex-1 rounded-2xl border px-3 py-6 sm:py-8 ${
                metal === "Prateado" ? "border-white ring-1 ring-white shadow-[0_0_15px_rgba(255,255,255,0.4)]" : "border-white/10 opacity-50"
              }`}
              style={{ background: "linear-gradient(135deg, #E0E0E0 0%, #9E9E9E 100%)" }}
            >
              <Text className="text-sm font-medium text-black drop-shadow-md sm:text-lg">Prata</Text>
            </button>
          </div>
        </div>
      </GlassContainer>

      <BottomNav nextHref="/onboarding/body" backHref="/onboarding/lifestyle" nextDisabled={!isValid} />
    </div>
  );
}

