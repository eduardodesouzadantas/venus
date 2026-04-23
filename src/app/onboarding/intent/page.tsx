"use client";

import { useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { BottomNav } from "@/components/ui/BottomNav";
import { GlassContainer } from "@/components/ui/GlassContainer";
import { Heading } from "@/components/ui/Heading";
import { PillSelector } from "@/components/ui/PillSelector";
import { Text } from "@/components/ui/Text";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import {
  CONSULTATION_BOLDNESS_OPTIONS,
  CONSULTATION_COLOR_OPTIONS,
  CONSULTATION_BODY_FOCUS_OPTIONS,
  CONSULTATION_DESIRED_PERCEPTION_OPTIONS,
  CONSULTATION_OCCASION_OPTIONS,
  CONSULTATION_RESTRICTION_OPTIONS,
  CONSULTATION_VIBE_OPTIONS,
  applyConsultationAnswer,
  getConsultationQuestions,
  inferConsultationConfidenceSource,
} from "@/lib/onboarding/consultation-flow";
import { normalizeConsultationProfile } from "@/lib/consultation-profile";
import { normalizeStyleDirectionPreference } from "@/lib/style-direction";

const LABEL_BY_BOLDNESS: Record<string, string> = {
  low: "Discreta",
  medium: "Equilibrada",
  high: "Marcante",
};

const STYLE_DIRECTION_UI_OPTIONS = [
  { value: "masculine", label: "Masculino", description: "Estrutura, linhas firmes e presença." },
  { value: "feminine", label: "Feminino", description: "Leveza, fluidez e acabamento." },
  { value: "neutral", label: "Neutro / Unissex", description: "Versátil, seguro e equilibrado." },
  { value: "streetwear", label: "Streetwear", description: "Urbano, atual e com atitude." },
  { value: "casual", label: "Casual", description: "Conforto real com proporção limpa." },
  { value: "social", label: "Social", description: "Elegância e refinamento para ocasiões." },
  { value: "no_preference", label: "Sem preferência", description: "A Venus calibra pela leitura completa." },
] as const;

const STYLE_DIRECTION_UI_BY_VALUE = Object.fromEntries(
  STYLE_DIRECTION_UI_OPTIONS.map((option) => [option.value, option]),
) as Record<(typeof STYLE_DIRECTION_UI_OPTIONS)[number]["value"], (typeof STYLE_DIRECTION_UI_OPTIONS)[number]>;

function getStyleDirectionUiLabel(value: string) {
  return STYLE_DIRECTION_UI_BY_VALUE[normalizeStyleDirectionPreference(value)]?.label || "Sem preferência";
}

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

function StyleDirectionSelection({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {STYLE_DIRECTION_UI_OPTIONS.map((option) => {
        const selected = option.value === normalizeStyleDirectionPreference(value);

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={[
              "min-h-[94px] rounded-[22px] border px-4 py-4 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b] active:scale-[0.99]",
              selected
                ? "border-[#C9A84C]/45 bg-[linear-gradient(180deg,rgba(212,175,55,0.18)_0%,rgba(212,175,55,0.08)_100%)] shadow-[0_18px_40px_rgba(212,175,55,0.12)]"
                : "border-white/10 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.06]",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[15px] font-semibold text-white/92">{option.label}</div>
                <div className="text-sm leading-6 text-white/58">{option.description}</div>
              </div>
              {selected ? (
                <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-[#C9A84C]/25 bg-[#C9A84C]/14 px-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#F6E2A1]">
                  <Check className="h-3 w-3" />
                  Selecionado
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function IntentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgSlug = searchParams.get("org") || "";
  const { data, updateData, updateConversation } = useOnboarding();
  const consultation = normalizeConsultationProfile(data.consultation);
  const questions = useMemo(() => getConsultationQuestions(data), [data]);
  const styleDirection = consultation.styleDirection || data.intent.styleDirection;
  const desiredPerception = consultation.desiredPerception || data.intent.imageGoal;
  const occasion = consultation.occasion;
  const optionalQuestions = questions.filter((step) => step.optional);
  const mandatoryComplete = Boolean(styleDirection && desiredPerception && occasion);

  const handleSelection = (stepKey: string, selected: string[]) => {
    const normalizedSelection = selected.filter(Boolean);
    const nextConsultation = normalizeConsultationProfile({
      ...consultation,
      ...applyConsultationAnswer(stepKey as Parameters<typeof applyConsultationAnswer>[0], normalizedSelection.length > 1 ? normalizedSelection : normalizedSelection[0] || ""),
    });
    const confidenceSource = inferConsultationConfidenceSource(
      {
        ...data,
        consultation: nextConsultation,
      },
      nextConsultation,
    );

    updateData("consultation", {
      ...nextConsultation,
      confidenceSource,
    });

    if (stepKey === "styleDirection") {
      const value = normalizedSelection[0] || "";
      const resolvedDirection = nextConsultation.styleDirection || (value as typeof data.intent.styleDirection);
      updateData("intent", { styleDirection: resolvedDirection });
      updateConversation({ styleDirection: getStyleDirectionUiLabel(resolvedDirection).toLowerCase() });
    }

    if (stepKey === "desiredPerception") {
      const value = normalizedSelection[0] || "";
      updateData("intent", { imageGoal: value });
      updateConversation({ imageGoal: value });
    }
  };

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
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/25">Consultoria 1 de 3</span>
        </div>

        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#C9A84C]/20 bg-[#C9A84C]/5 px-3 py-1.5">
          <div className="h-1 w-1 rounded-full bg-[#C9A84C]" />
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#C9A84C]">Styling</span>
        </div>

        <Heading
          as="h2"
          style={{ fontFamily: "var(--font-playfair), serif", fontSize: "1.9rem", lineHeight: 1.12, letterSpacing: "-0.01em" }}
        >
          Vamos construir uma leitura<br />
          <span style={{ color: "#C9A84C" }}>precisa e pouco genérica</span>.
        </Heading>

        <Text className="mt-3 max-w-[22rem] text-sm leading-relaxed text-white/48">
          A Venus usa esse bloco para montar uma consultoria real: direção, percepção, ocasião e apenas o que for necessário depois disso.
        </Text>
      </div>

      <div className="flex-1 space-y-3 px-4 pb-40">
        {questions.map((step, index) => {
          const displayStep =
            step.key === "styleDirection"
              ? {
                  ...step,
                  title: "Qual direção você quer explorar hoje?",
                  prompt: "Escolha a linha que deve guiar a leitura.",
                  note: "Isso ajuda a Venus a montar uma curadoria mais precisa para você. Você pode mudar isso depois.",
                }
              : step;

          const selectedValues =
            step.key === "styleDirection"
              ? [getStyleDirectionUiLabel(normalizeStyleDirectionPreference(consultation.styleDirection || data.intent.styleDirection))].filter(Boolean)
              : step.key === "desiredPerception"
                ? [consultation.desiredPerception || data.intent.imageGoal].filter(Boolean)
                : step.key === "occasion"
                  ? [consultation.occasion].filter(Boolean)
                  : step.key === "boldness"
                    ? consultation.boldness
                      ? [LABEL_BY_BOLDNESS[consultation.boldness]]
                      : []
                    : step.key === "restrictions"
                      ? consultation.restrictions
                      : step.key === "preferredColors"
                        ? consultation.preferredColors.length > 0
                          ? consultation.preferredColors
                          : data.colors.favoriteColors
                        : step.key === "bodyFocus"
                          ? [consultation.bodyFocus || data.body.highlight[0] || ""].filter(Boolean)
                          : step.key === "aestheticVibe"
                            ? [consultation.aestheticVibe].filter(Boolean)
                            : [];

          const options =
            step.key === "styleDirection"
              ? STYLE_DIRECTION_UI_OPTIONS.map((choice) => choice.label)
              : step.key === "desiredPerception"
                ? [...CONSULTATION_DESIRED_PERCEPTION_OPTIONS]
                : step.key === "occasion"
                  ? [...CONSULTATION_OCCASION_OPTIONS]
                  : step.key === "boldness"
                    ? CONSULTATION_BOLDNESS_OPTIONS.map((option) => option.label)
                    : step.key === "restrictions"
                      ? [...CONSULTATION_RESTRICTION_OPTIONS]
                      : step.key === "preferredColors"
                        ? [...CONSULTATION_COLOR_OPTIONS]
                        : step.key === "bodyFocus"
                          ? [...CONSULTATION_BODY_FOCUS_OPTIONS]
                          : [...CONSULTATION_VIBE_OPTIONS];

          return (
            <GlassContainer key={step.key} className="space-y-4">
              <div className="space-y-2">
                <StepTitle index={index + 1} title={displayStep.title} note={displayStep.note} />
                <Text className="text-sm text-white/55">{displayStep.prompt}</Text>
              </div>

              {step.key === "styleDirection" ? (
                <StyleDirectionSelection
                  value={normalizeStyleDirectionPreference(consultation.styleDirection || data.intent.styleDirection)}
                  onChange={(value) => handleSelection(step.key, [value])}
                />
              ) : (
                <PillSelector
                  options={options}
                  selected={selectedValues}
                  multiple={Boolean(step.multiple)}
                  onChange={(selected) => {
                    if (step.key === "boldness") {
                      const value = selected[0] || "";
                      const normalized = value === "Discreta" ? "low" : value === "Equilibrada" ? "medium" : value === "Marcante" ? "high" : "";
                      handleSelection(step.key, normalized ? [normalized] : []);
                      return;
                    }

                    handleSelection(step.key, selected);
                  }}
                />
              )}
            </GlassContainer>
          );
        })}

        {optionalQuestions.length === 0 ? (
          <GlassContainer>
            <Text className="text-sm leading-relaxed text-white/55">
              Eu já tenho contexto suficiente para seguir. O restante da leitura vem dos próximos passos do onboarding.
            </Text>
          </GlassContainer>
        ) : (
          <GlassContainer>
            <Text className="text-sm leading-relaxed text-white/55">
              Se faltar algum detalhe, a Venus segue com linguagem neutra e completa a leitura com segurança.
            </Text>
          </GlassContainer>
        )}
      </div>

      <BottomNav
        nextHref={orgSlug ? `/scanner/opt-in?org=${encodeURIComponent(orgSlug)}` : "/scanner/opt-in"}
        backHref={orgSlug ? `/onboarding/chat?org=${encodeURIComponent(orgSlug)}` : "/onboarding/chat"}
        nextDisabled={!mandatoryComplete}
      />
    </div>
  );
}
