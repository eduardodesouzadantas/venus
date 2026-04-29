"use client";

import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { BottomNav } from "@/components/ui/BottomNav";
import { GlassContainer } from "@/components/ui/GlassContainer";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { normalizeConsultationProfile } from "@/lib/consultation-profile";
import type { StyleDirectionPreference } from "@/lib/style-direction";

const CONSULTATION_BLOCKS = [
  {
    key: "styleDirection",
    title: "Qual direção de peças você quer explorar hoje?",
    note: "Isso ajuda a Venus a escolher melhor as peças da loja para a sua curadoria.",
    options: [
      { label: "Masculina", value: "masculine", description: "Estrutura, linhas firmes e presença." },
      { label: "Feminina", value: "feminine", description: "Leveza, fluidez e acabamento." },
      { label: "Neutra / Unissex", value: "neutral", description: "Versátil, limpo e adaptável." },
      { label: "Sem preferência", value: "no_preference", description: "A Venus escolhe pela sua intenção e pelo catálogo disponível." },
    ],
    response: "Perfeito. Vou usar essa direção para filtrar melhor as peças da loja.",
  },
  {
    key: "desiredPerception",
    title: "Que presença você quer transmitir?",
    options: ["Presença firme", "Elegância discreta", "Criatividade controlada", "Leveza sofisticada", "Segurança casual"],
    response: "Entendi. Vou buscar peças que sustentem essa presença sem exagero.",
  },
  {
    key: "occasion",
    title: "Onde essa imagem precisa funcionar primeiro?",
    options: ["Trabalho", "Rotina", "Social", "Evento", "Jantar", "Viagem"],
    response: "Perfeito. Isso ajuda a Venus a equilibrar estética, conforto e intenção real de uso.",
  },
  {
    key: "restriction",
    title: "O que você prefere evitar na sua imagem?",
    options: ["Excesso visual", "Formalidade demais", "Básico demais", "Chamativo demais", "Rigidez", "Infantilidade"],
    response: "Ótimo. A curadoria também fica mais precisa quando sabe o que deve deixar de fora.",
  },
] as const;

type ConsultationBlockKey = (typeof CONSULTATION_BLOCKS)[number]["key"];

const CONSULTATION_RESPONSES: Record<ConsultationBlockKey, Record<string, string>> = {
  styleDirection: {
    masculine: "Perfeito. Vou priorizar estrutura, linhas firmes e peças com presença clara.",
    feminine: "Perfeito. Vou priorizar fluidez, acabamento e leveza visual.",
    neutral: "Perfeito. Vou buscar peças versáteis, limpas e fáceis de combinar.",
    no_preference: "Perfeito. A Venus vai cruzar sua intenção com o catálogo disponível.",
  },
  desiredPerception: {
    "Presença firme": "Entendi. A curadoria deve transmitir segurança sem parecer rígida.",
    "Elegância discreta": "Entendi. A leitura vai buscar sofisticação sem excesso.",
    "Criatividade controlada": "Entendi. A curadoria pode ter personalidade, mas sem perder precisão.",
    "Leveza sofisticada": "Entendi. A Venus vai equilibrar fluidez, acabamento e presença.",
    "Segurança casual": "Entendi. A leitura precisa funcionar no uso real com aparência cuidada.",
  },
  occasion: {
    Trabalho: "Ótimo. Então a leitura precisa sustentar presença profissional sem exagero.",
    Rotina: "Ótimo. Então a leitura precisa funcionar no uso real, não só em produção bonita.",
    Social: "Ótimo. A curadoria vai equilibrar presença, conforto e naturalidade.",
    Evento: "Ótimo. A leitura pode ganhar mais intenção e acabamento.",
    Jantar: "Ótimo. A curadoria pode ter mais presença sem ficar pesada.",
    Viagem: "Ótimo. A Venus vai priorizar versatilidade e combinações inteligentes.",
  },
  restriction: {
    "Excesso visual": "Boa direção. A Venus vai evitar informação demais no mesmo look.",
    "Formalidade demais": "Boa direção. A curadoria não deve deixar sua imagem rígida demais.",
    "Básico demais": "Boa direção. A leitura precisa manter intenção, não cair no neutro sem força.",
    "Chamativo demais": "Boa direção. A Venus vai evitar protagonismo visual exagerado.",
    Rigidez: "Boa direção. A Venus vai evitar peças que deixem sua imagem dura demais.",
    Infantilidade: "Boa direção. A curadoria deve manter maturidade visual e presença.",
  },
};

function StepTitle({ index, title, note }: { index: number; title: string; note?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-xs font-bold tracking-widest text-[#C9A84C]">{String(index).padStart(2, "0")}</span>
      <div className="space-y-1">
        <Heading as="h4" className="text-base leading-snug text-white/90">
          {title}
        </Heading>
        {note ? <Text className="text-sm text-white/55">{note}</Text> : null}
      </div>
    </div>
  );
}

export default function IntentPage() {
  const searchParams = useSearchParams();
  const orgSlug = searchParams.get("org") || "";
  const { data, updateData, updateConversation } = useOnboarding();
  const consultation = normalizeConsultationProfile(data.consultation);
  const styleDirection = consultation.styleDirection || data.intent.styleDirection;
  const desiredPerception = consultation.desiredPerception || data.intent.imageGoal;
  const occasion = consultation.occasion;
  const restriction = consultation.restrictions[0] || data.intent.mainPain;
  const mandatoryComplete = Boolean(styleDirection && desiredPerception && occasion && restriction);

  const handleSelection = (stepKey: ConsultationBlockKey, value: string) => {
    const nextStyleDirection = stepKey === "styleDirection" ? (value as StyleDirectionPreference) : styleDirection;
    const nextConsultation = normalizeConsultationProfile({
      ...consultation,
      styleDirection: nextStyleDirection,
      desiredPerception: stepKey === "desiredPerception" ? value : desiredPerception,
      occasion: stepKey === "occasion" ? value : occasion,
      restrictions: stepKey === "restriction" ? [value] : consultation.restrictions,
      confidenceSource: "conversation",
    });

    updateData("consultation", nextConsultation);
    updateData("intent", {
      styleDirection: nextConsultation.styleDirection,
      imageGoal: nextConsultation.desiredPerception,
      mainPain: nextConsultation.restrictions[0] || data.intent.mainPain,
    });
    updateData("lifestyle", {
      environments: nextConsultation.occasion ? [nextConsultation.occasion] : data.lifestyle.environments,
    });
    updateConversation({
      imageGoal: nextConsultation.desiredPerception,
      styleDirection: stepKey === "styleDirection" ? value : data.conversation.styleDirection,
    });
  };

  const selectedByKey: Record<ConsultationBlockKey, string> = {
    styleDirection,
    desiredPerception,
    occasion,
    restriction,
  };
  const visibleBlocks = CONSULTATION_BLOCKS.filter((step) => {
    if (step.key === "styleDirection") return true;
    if (step.key === "desiredPerception") return Boolean(styleDirection);
    if (step.key === "occasion") return Boolean(desiredPerception);
    return Boolean(occasion);
  });

  return (
    <div className="flex min-h-screen flex-col bg-[#050505]">
      <div className="relative overflow-hidden px-5 pb-7 pt-12">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(212,175,55,0.07) 0%, transparent 70%)" }}
        />

        <div className="mb-7 flex items-center gap-3">
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-0.5 rounded-full transition-all duration-500"
                style={{
                  width: 24,
                  backgroundColor: "#C9A84C",
                  opacity: i === 0 ? 1 : 0.45,
                }}
              />
            ))}
          </div>
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/25">Consultoria guiada</span>
        </div>

        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#C9A84C]/20 bg-[#C9A84C]/5 px-3 py-1.5">
          <div className="h-1 w-1 rounded-full bg-[#C9A84C]" />
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#C9A84C]">Styling</span>
        </div>

        <Heading
          as="h2"
          style={{ fontFamily: "var(--font-playfair), serif", fontSize: "1.9rem", lineHeight: 1.12, letterSpacing: "-0.01em" }}
        >
          Vamos traduzir sua presença em peças reais.
        </Heading>

        <Text className="mt-3 max-w-[22rem] text-sm leading-relaxed text-white/48">
          A Venus cruza direção de peças, intenção, contexto e o que você quer evitar para montar uma curadoria mais precisa da loja.
        </Text>
      </div>

      <div className="flex-1 space-y-3 px-4 pb-40">
        {visibleBlocks.map((step, index) => {
          const selected = selectedByKey[step.key];

          return (
            <GlassContainer key={step.key} className="space-y-4 transition-all duration-300">
              <StepTitle index={index + 1} title={step.title} note={"note" in step ? step.note : undefined} />

              <div className="grid gap-2 sm:grid-cols-2">
                {step.options.map((option) => {
                  const optionLabel = typeof option === "string" ? option : option.label;
                  const optionValue = typeof option === "string" ? option : option.value;
                  const optionDescription = typeof option === "string" ? "" : option.description;
                  const isSelected = selected === optionValue;

                  return (
                    <button
                      key={optionValue}
                      type="button"
                      onClick={() => handleSelection(step.key, optionValue)}
                      aria-pressed={isSelected}
                      className={[
                        "flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors",
                        isSelected
                          ? "border-[#C9A84C]/45 bg-[#C9A84C]/12 text-white"
                          : "border-white/10 bg-white/[0.03] text-white/68 hover:border-white/18 hover:bg-white/[0.06]",
                      ].join(" ")}
                    >
                      <span>
                        {optionLabel}
                        {optionDescription ? <span className="mt-1 block text-xs leading-relaxed text-white/45">{optionDescription}</span> : null}
                      </span>
                      {isSelected ? <Check className="h-4 w-4 text-[#C9A84C]" /> : null}
                    </button>
                  );
                })}
              </div>

              {selected ? (
                <Text className="rounded-2xl border border-[#C9A84C]/15 bg-[#C9A84C]/8 px-4 py-3 text-sm leading-relaxed text-[#F6E2A1]/85">
                  {CONSULTATION_RESPONSES[step.key][selected] || step.response}
                </Text>
              ) : null}
            </GlassContainer>
          );
        })}

        {mandatoryComplete ? (
          <GlassContainer>
            <Text className="text-sm leading-relaxed text-white/55">
              Com esses quatro sinais, a Venus já consegue montar sua assinatura com mais intenção antes da foto.
            </Text>
          </GlassContainer>
        ) : null}
      </div>

      <BottomNav
        nextHref={orgSlug ? `/scanner/opt-in?org=${encodeURIComponent(orgSlug)}` : "/scanner/opt-in"}
        backHref={orgSlug ? `/onboarding/chat?org=${encodeURIComponent(orgSlug)}` : "/onboarding/chat"}
        nextDisabled={!mandatoryComplete}
      />
    </div>
  );
}
