"use client";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { GlassContainer } from "@/components/ui/GlassContainer";
import { PillSelector } from "@/components/ui/PillSelector";
import { EmotionalSlider } from "@/components/ui/EmotionalSlider";
import { BottomNav } from "@/components/ui/BottomNav";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

const STYLE_DIRECTIONS = ["Masculina", "Feminina", "Neutra"];
const SATISFACTION_LABELS: Record<number, string> = {
  0: "Ainda me perco",
  2: "Quero direção",
  5: "Preciso refinar",
  8: "Já estou no caminho",
  10: "Meu estilo está claro",
};

const IMAGE_GOALS = ["Autoridade", "Elegância", "Presença", "Criatividade", "Discrição sofisticada"];
const MAIN_PAINS = ["Falta de tempo", "Nada me representa", "Compro sem pensar"];

export default function IntentPage() {
  const { data, updateData } = useOnboarding();
  const { styleDirection, imageGoal, satisfaction, mainPain } = data.intent;

  const isValid = styleDirection !== "" && imageGoal !== "" && mainPain !== "";

  return (
    <div className="flex min-h-screen flex-col bg-[#050505]">
      <div className="relative overflow-hidden px-5 pb-7 pt-12">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(212,175,55,0.07) 0%, transparent 70%)" }}
        />

        <div className="mb-7 flex items-center gap-3">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-0.5 rounded-full transition-all duration-500"
                style={{
                  width: i === 0 ? 24 : 12,
                  backgroundColor: i === 0 ? "#C9A84C" : "rgba(255,255,255,0.12)",
                }}
              />
            ))}
          </div>
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/25">Leitura 1 de 3</span>
        </div>

        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#C9A84C]/20 bg-[#C9A84C]/5 px-3 py-1.5">
          <div className="h-1 w-1 rounded-full bg-[#C9A84C]" />
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#C9A84C]">Intenção</span>
        </div>

        <Heading
          as="h2"
          style={{ fontFamily: "var(--font-playfair), serif", fontSize: "1.9rem", lineHeight: 1.12, letterSpacing: "-0.01em" }}
        >
          Antes do look,<br />
          <span style={{ color: "#C9A84C" }}>vamos ler sua presença</span>.
        </Heading>

        <Text className="mt-3 max-w-[20rem] text-sm leading-relaxed text-white/48">
          A Venus usa essa calibragem para escolher peças que pareçam feitas para você, não para uma média genérica.
        </Text>
      </div>

      <div className="flex-1 space-y-3 px-4 pb-40">
        <GlassContainer className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-xs font-bold tracking-widest text-[#C9A84C]">00</span>
              <div className="space-y-1">
                <Heading as="h4" className="text-base leading-snug text-white/90">
                  Qual linha sustenta melhor a sua imagem?
                </Heading>
                <Text className="text-sm text-white/55">Essa escolha guia a leitura para a direção certa antes de cruzar cor, corpo e rotina.</Text>
              </div>
            </div>
            <PillSelector
              options={STYLE_DIRECTIONS}
              selected={styleDirection ? [styleDirection] : []}
              onChange={(sel) => updateData("intent", { styleDirection: (sel[0] as "Masculina" | "Feminina" | "Neutra" | "") || "" })}
            />
          </div>
        </GlassContainer>

        <GlassContainer className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-xs font-bold tracking-widest text-[#C9A84C]">01</span>
              <div className="space-y-1">
                <Heading as="h4" className="text-base leading-snug text-white/90">
                  Que leitura você quer que a roupa entregue?
                </Heading>
                <Text className="text-sm text-white/55">A IA usa isso para ajustar a curadoria ao tipo de presença que você quer sustentar.</Text>
              </div>
            </div>
            <PillSelector
              options={IMAGE_GOALS}
              selected={imageGoal ? [imageGoal] : []}
              onChange={(sel) => updateData("intent", { imageGoal: sel[0] || "" })}
            />
          </div>
        </GlassContainer>

        <GlassContainer className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-xs font-bold tracking-widest text-[#C9A84C]">02</span>
              <div className="space-y-1">
                <Heading as="h4" className="text-base leading-snug text-white/90">
                  Onde você se reconhece hoje?
                </Heading>
                <Text className="text-sm text-white/55">Isso ajuda a Venus a medir o salto entre o agora e a versão que você quer mostrar.</Text>
              </div>
            </div>
            <EmotionalSlider value={satisfaction} onChange={(val) => updateData("intent", { satisfaction: val })} labelMap={SATISFACTION_LABELS} />
          </div>
        </GlassContainer>

        <GlassContainer className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-xs font-bold tracking-widest text-[#C9A84C]">03</span>
              <div className="space-y-1">
                <Heading as="h4" className="text-base leading-snug text-white/90">
                  O que mais gera ruído na sua imagem hoje?
                </Heading>
                <Text className="text-sm text-white/55">Marque o principal atrito para a curadoria ficar mais precisa e menos genérica.</Text>
              </div>
            </div>
            <PillSelector
              options={MAIN_PAINS}
              selected={mainPain ? [mainPain] : []}
              onChange={(sel) => updateData("intent", { mainPain: sel[0] || "" })}
            />
          </div>
        </GlassContainer>
      </div>

      <BottomNav nextHref="/onboarding/lifestyle" backHref="/" nextDisabled={!isValid} />
    </div>
  );
}

