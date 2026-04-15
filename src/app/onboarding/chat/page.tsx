"use client";

import { AnimatePresence, motion } from "framer-motion";
import { SendHorizonal } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VenusAvatar } from "@/components/venus/VenusAvatar";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { defaultOnboardingData, type OnboardingData } from "@/types/onboarding";
import { buildVenusStylistIntro } from "@/lib/venus/brand";

type ChatRole = "venus" | "client";

type ChoiceOption = {
  label: string;
  value: string;
  conversationValue: string;
};

type ChatStep =
  | {
    key: "line";
    kind: "single";
    prompt: string;
    placeholder: string;
    options: ChoiceOption[];
  }
  | {
    key: "imageGoal";
    kind: "single";
    prompt: string;
    placeholder: string;
    options: ChoiceOption[];
  }
  | {
    key: "styleDirection";
    kind: "text";
    prompt: string;
    placeholder: string;
  }
  | {
    key: "avoidColorNote";
    kind: "text";
    prompt: string;
    placeholder: string;
    optional: true;
  };

type Message = {
  id: string;
  role: ChatRole;
  text: string;
};


const CHAT_STEPS: ChatStep[] = [
  {
    key: "line",
    kind: "single",
    prompt: "Antes de tudo, qual linha sustenta sua imagem?",
    placeholder: "Digite ou toque em uma opção.",
    options: [
      { label: "Feminina", value: "Feminina", conversationValue: "feminina" },
      { label: "Masculina", value: "Masculina", conversationValue: "masculina" },
      { label: "Neutra", value: "Neutra", conversationValue: "neutra" },
    ],
  },
  {
    key: "imageGoal",
    kind: "single",
    prompt: "Que presença você quer que a roupa entregue?",
    placeholder: "Digite ou toque em uma opção.",
    options: [
      { label: "Autoridade", value: "Autoridade", conversationValue: "autoridade" },
      { label: "Elegancia", value: "Elegancia", conversationValue: "elegancia" },
      { label: "Presenca", value: "Presenca", conversationValue: "presenca" },
      { label: "Criatividade", value: "Criatividade", conversationValue: "criatividade" },
      { label: "Discricao sofisticada", value: "Discricao sofisticada", conversationValue: "discricao sofisticada" },
    ],
  },
  {
    key: "styleDirection",
    kind: "text",
    prompt: "Me conta uma coisa: quando você se olha no espelho e pensa 'hoje está certo', o que você está vestindo?",
    placeholder: "Escreva sua resposta livre.",
  },
];

const INTRO_MESSAGE = buildVenusStylistIntro();

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ");
}

function findSingleOption(step: Extract<ChatStep, { kind: "single" }>, raw: string) {
  const normalized = normalize(raw);
  if (!normalized) return null;

  return step.options.find((option) => {
    const optionVariants = [option.label, option.value, option.conversationValue];
    return optionVariants.some((variant) => normalize(variant) === normalized);
  }) || null;
}

function buildVisionCue(data: OnboardingData) {
  const safeData = data ?? defaultOnboardingData;
  const cues: string[] = [];
  if (safeData.colorimetry?.colorSeason) cues.push(safeData.colorimetry.colorSeason.toLowerCase());
  if (safeData.colorimetry?.contrast) cues.push(`contraste ${safeData.colorimetry.contrast.toLowerCase()}`);
  if (safeData.colorimetry?.faceShape) cues.push(`rosto ${safeData.colorimetry.faceShape}`);
  if (safeData.body?.faceLines) cues.push(`traços ${safeData.body.faceLines.toLowerCase()}`);
  if (safeData.body?.fit) cues.push(`caimento ${safeData.body.fit.toLowerCase()}`);
  return cues.length > 0 ? cues.slice(0, 3).join(" • ") : "a sua presença";
}

function buildStepPrompt(stepKey: ChatStep["key"], data: OnboardingData) {
  const safeData = data ?? defaultOnboardingData;
  const visionCue = buildVisionCue(safeData);

  switch (stepKey) {
    case "line":
      return safeData.colorimetry?.justification
        ? `Pelo que eu já leio em você, ${visionCue}. Você quer que essa imagem imponha autoridade, entregue elegância ou fique mais neutra?`
        : "Antes de tudo, qual linha sustenta sua imagem?";
    case "imageGoal":
      return safeData.colorimetry?.justification
        ? "Agora eu quero afinar a intenção: o que a roupa precisa fazer pela sua presença quando alguém te vê?"
        : "Que presença você quer que a roupa entregue?";
    case "styleDirection":
      return safeData.colorimetry?.justification
        ? "Me conta um exemplo real: quando você olha no espelho e pensa 'hoje está certo', o que você está vestindo?"
        : "Me conta uma coisa: quando você se olha no espelho e pensa 'hoje está certo', o que você está vestindo?";
    case "avoidColorNote":
      return "Existe alguma cor que você evita por motivo pessoal ou por memória afetiva?";
  }

  return "";
}

function TypingBubble() {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 shrink-0">
        <VenusAvatar size={34} animated />
      </div>
      <div className="rounded-[22px] rounded-bl-none border border-white/10 bg-white/[0.055] px-5 py-4 text-sm text-white/68 shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C9A84C]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C9A84C] [animation-delay:120ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C9A84C] [animation-delay:240ms]" />
        </span>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isVenus = message.role === "venus";

  return (
    <div className={`flex items-end gap-3 ${isVenus ? "justify-start" : "justify-end"}`}>
      {isVenus ? (
        <div className="mt-1 shrink-0">
          <VenusAvatar size={34} animated />
        </div>
      ) : null}

      <div
        className={[
          "max-w-[min(84vw,32rem)] rounded-[26px] px-5 py-4 text-[15px] leading-7 shadow-[0_20px_60px_rgba(0,0,0,0.5)]",
          isVenus
            ? "rounded-bl-none border border-white/10 bg-white/[0.055] text-white/95 backdrop-blur-xl"
            : "rounded-br-none border border-[#C9A84C]/25 bg-[linear-gradient(180deg,rgba(201,168,76,0.15)_0%,rgba(201,168,76,0.05)_100%)] text-white",
        ].join(" ")}
      >
        <p className="whitespace-pre-line">{message.text}</p>
      </div>
    </div>
  );
}

function ChoiceChip({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-2 text-[13px] font-medium transition-all duration-200 active:scale-[0.98]",
        selected
          ? "border-[#C9A84C]/40 bg-[#C9A84C]/18 text-[#F5E2A0] shadow-[0_12px_24px_rgba(212,175,55,0.12)]"
          : "border-white/10 bg-white/[0.04] text-white/74 hover:border-white/18 hover:bg-white/[0.07]",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgSlug = searchParams.get("org") || "";
  const { data, updateData, updateConversation, journey, isJourneyLoaded } = useOnboarding();
  const result = data ?? defaultOnboardingData;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "intro",
      role: "venus",
      text: INTRO_MESSAGE,
    },
  ]);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [isTyping, setIsTyping] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef(data);

  useEffect(() => {
    latestDataRef.current = result;
  }, [result]);

  const currentStep = activeStepIndex !== null ? CHAT_STEPS[activeStepIndex] : null;
  const currentPrompt = currentStep ? buildStepPrompt(currentStep.key, result) : "";
  const nextHref = useMemo(() => {
    return orgSlug ? `/scanner/opt-in?org=${encodeURIComponent(orgSlug)}` : "/scanner/opt-in";
  }, [orgSlug]);

  useEffect(() => {
    if (!isJourneyLoaded || !journey) {
      return;
    }

    if (!journey.skipOnboarding) {
      return;
    }

    const target = journey.mode === "continue" ? journey.resumeRoute || journey.entryRoute : journey.entryRoute;
    if (!target || target === "/onboarding/chat" || target.startsWith("/onboarding/chat?")) {
      return;
    }

    router.replace(target);
  }, [isJourneyLoaded, journey, router]);

  useEffect(() => {
    introTimerRef.current = setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: "step-0",
          role: "venus",
          text: buildStepPrompt(CHAT_STEPS[0].key, latestDataRef.current),
        },
      ]);
      setActiveStepIndex(0);
      setIsTyping(false);
    }, 800);

    return () => {
      if (introTimerRef.current) clearTimeout(introTimerRef.current);
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isTyping, activeStepIndex]);

  useEffect(() => {
    if (currentStep && !isTyping) {
      inputRef.current?.focus();
    }
  }, [currentStep, isTyping]);


  const scheduleNextStep = (nextIndex: number) => {
    setIsTyping(true);
    stepTimerRef.current = setTimeout(() => {
      setIsTyping(false);

      if (nextIndex < CHAT_STEPS.length) {
        setMessages((prev) => [
          ...prev,
          {
            id: `step-${nextIndex}`,
            role: "venus",
            text: buildStepPrompt(CHAT_STEPS[nextIndex].key, latestDataRef.current),
          },
        ]);
        setActiveStepIndex(nextIndex);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: "closing",
          role: "venus",
          text: "Perfeito. Agora vou ler sua presença.",
        },
      ]);
      setActiveStepIndex(null);
      setIsFinishing(true);

      redirectTimerRef.current = setTimeout(() => {
        router.push(nextHref);
      }, 900);
    }, 3500);
  };

  const handleChoiceSelect = (option: ChoiceOption) => {
    if (!currentStep || currentStep.kind !== "single" || isTyping || isFinishing) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `${currentStep.key}-answer`,
        role: "client",
        text: option.label,
      },
    ]);

    if (currentStep.key === "line") {
      updateData("intent", { styleDirection: option.value as "Masculina" | "Feminina" | "Neutra" | "" });
      updateConversation({ line: option.conversationValue as "masculina" | "feminina" | "neutra" });
    } else if (currentStep.key === "imageGoal") {
      updateData("intent", { imageGoal: option.value });
      updateConversation({ imageGoal: option.conversationValue });
    }

    setInputValue("");
    setError(null);
    setActiveStepIndex(null);
    scheduleNextStep((activeStepIndex ?? 0) + 1);
  };

  const handleSubmit = () => {
    if (!currentStep || isTyping || isFinishing) return;

    if (currentStep.kind === "text") {
      const trimmed = inputValue.trim();
      if (!trimmed && !("optional" in currentStep && currentStep.optional)) {
        setError("Escreva uma resposta antes de enviar.");
        return;
      }

      if (trimmed) {
        setMessages((prev) => [
          ...prev,
          {
            id: `${currentStep.key}-answer`,
            role: "client",
            text: trimmed,
          },
        ]);
      }

      if (currentStep.key === "styleDirection" && trimmed) {
        updateConversation({ styleDirection: trimmed });
      } else if (currentStep.key === "avoidColorNote" && trimmed) {
        updateConversation({ avoidColorNote: trimmed });
      }

      setInputValue("");
      setError(null);
      setActiveStepIndex(null);
      scheduleNextStep((activeStepIndex ?? 0) + 1);
      return;
    }

    if (currentStep.kind === "single") {
      const typed = inputValue.trim();
      const matched = typed ? findSingleOption(currentStep, typed) : null;
      if (matched) {
        handleChoiceSelect(matched);
        return;
      }

      if (!typed) {
        setError("Escolha uma opcao ou digite exatamente uma das respostas acima.");
      } else {
        setError("Nao reconheci essa resposta. Use uma das opcoes acima.");
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const canSend =
    !!currentStep &&
    !isTyping &&
    !isFinishing &&
    (currentStep.kind === "text" ? inputValue.trim().length > 0 || ("optional" in currentStep && currentStep.optional) : Boolean(inputValue.trim()));

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0a0a0a] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-8%] h-72 w-72 rounded-full bg-[#C9A84C]/8 blur-[100px]" />
        <div className="absolute right-[-8%] top-[18%] h-64 w-64 rounded-full bg-white/5 blur-[120px]" />
        <div className="absolute bottom-[-8%] left-[18%] h-80 w-80 rounded-full bg-[#C9A84C]/5 blur-[120px]" />
      </div>

      <header className="relative z-10 flex items-center gap-3 px-4 pb-3 pt-4 sm:px-6">
        <div className="flex items-center gap-3">
          <VenusAvatar size={42} animated />
          <div className="space-y-0.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.38em] text-[#C9A84C]">Venus Stylist</div>
            <div className="text-[11px] text-white/42">Conversa consultiva em andamento</div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-4 pb-44 pt-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
              >
                <MessageBubble message={message} />
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping ? <TypingBubble /> : null}

          <div ref={messagesEndRef} />
        </div>
      </main>

      <div className="relative z-10 border-t border-white/8 bg-[#0a0a0a]/95 backdrop-blur-2xl">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
          {currentStep ? (
            <div className="mb-3 space-y-3">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.045] px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#C9A84C]">Venus</p>
                <p className="mt-2 text-[15px] leading-7 text-white/90 sm:text-[16px]">{currentPrompt}</p>
              </div>

              {currentStep.kind !== "text" ? (
                <div className="flex flex-wrap gap-2.5">
                  {currentStep.options.map((option) => {
                    const isSelected = inputValue.trim() === option.value || inputValue.trim() === option.label || inputValue.trim() === option.conversationValue;

                    return (
                      <ChoiceChip
                        key={option.value}
                        label={option.label}
                        selected={isSelected}
                        disabled={isTyping || isFinishing}
                        onClick={() => handleChoiceSelect(option)}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/48">
                  {"optional" in currentStep && currentStep.optional
                    ? "Opcional. Se houver uma cor que você evita por motivo pessoal, me conta; se não, eu sigo."
                    : "Responda em texto livre. A Venus lê o contexto, não só palavras-chave."}
                </div>
              )}
            </div>
          ) : null}

          {error ? <p className="mb-3 text-[12px] text-[#ffb6a8]">{error}</p> : null}

          <div className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(event) => {
                setInputValue(event.target.value);
                if (error) setError(null);
              }}
              onKeyDown={handleKeyDown}
              rows={currentStep?.kind === "text" ? 3 : 1}
              disabled={!currentStep || isTyping || isFinishing}
              placeholder={currentStep?.placeholder || "Aguarde a proxima pergunta."}
              className="min-h-14 flex-1 resize-none rounded-[26px] border border-white/10 bg-white/[0.04] px-4 py-4 text-[15px] leading-6 text-white outline-none placeholder:text-white/28 focus:border-[#C9A84C]/35 disabled:cursor-not-allowed disabled:opacity-50"
            />

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSend}
              className="inline-flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[22px] border border-[#C9A84C]/25 bg-[linear-gradient(180deg,#F1D77A_0%,#C9A84C_100%)] text-[#0a0a0a] shadow-[0_20px_40px_rgba(212,175,55,0.18)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Enviar resposta"
            >
              <SendHorizonal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <ChatContent />
    </Suspense>
  );
}

