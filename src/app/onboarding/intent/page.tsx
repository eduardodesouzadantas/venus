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
    <div className="flex flex-col min-h-screen bg-[#050505]">
      
      {/* Hero editorial de abertura */}
      <div className="relative px-6 pt-14 pb-8 overflow-hidden">
        {/* Luz de fundo */}
        <div
          className="absolute -top-20 -right-20 w-60 h-60 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(212,175,55,0.07) 0%, transparent 70%)" }}
        />
        
        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-0.5 rounded-full transition-all duration-500"
                style={{
                  width: i === 0 ? 24 : 12,
                  backgroundColor: i === 0 ? "#D4AF37" : "rgba(255,255,255,0.12)",
                }}
              />
            ))}
          </div>
          <span className="text-[9px] tracking-[0.3em] text-white/25 uppercase font-bold">Passo 1 de 3</span>
        </div>

        {/* Tag editorial */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/5">
          <div className="w-1 h-1 rounded-full bg-[#D4AF37]" />
          <span className="text-[9px] tracking-[0.3em] font-bold text-[#D4AF37] uppercase">Intenção</span>
        </div>

        <Heading
          as="h2"
          style={{ fontFamily: "var(--font-playfair), serif", fontSize: "1.9rem", lineHeight: 1.15, letterSpacing: "-0.01em" }}
        >
          O que você quer que<br />
          <span style={{ color: "#D4AF37" }}>o mundo veja</span> em você?
        </Heading>

        <Text className="mt-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)", maxWidth: 300 }}>
          Vamos calibrar sua assinatura visual antes de analisar seu corpo e estilo.
        </Text>
      </div>

      {/* Formulário */}
      <div className="flex-1 px-4 pb-40 space-y-3">
        <GlassContainer className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <span className="text-[#D4AF37] text-xs font-bold tracking-widest mt-0.5">01</span>
              <Heading as="h4" className="text-base leading-snug text-white/90">
                Qual imagem você quer que suas roupas projetem?
              </Heading>
            </div>
            <PillSelector
              options={IMAGE_GOALS}
              selected={imageGoal ? [imageGoal] : []}
              onChange={(sel) => updateData("intent", { imageGoal: sel[0] || "" })}
            />
          </div>
        </GlassContainer>

        <GlassContainer className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <span className="text-[#D4AF37] text-xs font-bold tracking-widest mt-0.5">02</span>
              <Heading as="h4" className="text-base leading-snug text-white/90">
                Onde você se vê hoje?
              </Heading>
            </div>
            <EmotionalSlider
              value={satisfaction}
              onChange={(val) => updateData("intent", { satisfaction: val })}
              labelMap={SATISFACTION_LABELS}
            />
          </div>
        </GlassContainer>

        <GlassContainer className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <span className="text-[#D4AF37] text-xs font-bold tracking-widest mt-0.5">03</span>
              <Heading as="h4" className="text-base leading-snug text-white/90">
                O que sabota seu estilo hoje?
              </Heading>
            </div>
            <PillSelector
              options={MAIN_PAINS}
              selected={mainPain ? [mainPain] : []}
              onChange={(sel) => updateData("intent", { mainPain: sel[0] || "" })}
            />
          </div>
        </GlassContainer>
      </div>

      <BottomNav
        nextHref="/onboarding/lifestyle"
        backHref="/"
        nextDisabled={!isValid}
      />
    </div>
  );
}
