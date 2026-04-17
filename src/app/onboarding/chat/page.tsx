"use client";

import { AnimatePresence, motion } from "framer-motion";
import { SendHorizonal } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VenusAvatar } from "@/components/venus/VenusAvatar";
import { TenantResolutionFallbackScreen } from "@/components/onboarding/public-surface";
import { VenusLoadingScreen } from "@/components/ui/VenusLoadingScreen";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { trackOnboardingConversionEvent } from "@/lib/onboarding/analytics";
import { isOnboardingWowSurfaceEnabled } from "@/lib/onboarding/feature-flags";
import { buildOnboardingWowCopy } from "@/lib/onboarding/wow-surface";
import { defaultOnboardingData, type OnboardingData } from "@/types/onboarding";
import { buildVenusStylistIntro } from "@/lib/venus/brand";
import { PremiumWowFirstChatContent } from "@/components/onboarding/PremiumWowFirstChatContent";
import { normalizeTenantSlug } from "@/lib/tenant/core";
import { resolveVenusTenantBrand } from "@/lib/venus/brand";
import { STYLE_DIRECTION_VALUES, type StyleDirectionPreference } from "@/lib/style-direction";

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
    prompt: "Antes de tudo, qual direção de estilo você quer declarar?",
    placeholder: "Digite ou toque em uma opção.",
    options: STYLE_DIRECTION_VALUES.map((value) => ({
      label: value,
      value,
      conversationValue: value.toLowerCase(),
    })),
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
        ? `Pelo que eu já leio em você, ${visionCue}. Qual direção de estilo você quer declarar para eu calibrar a leitura?`
        : "Antes de tudo, qual direção de estilo você quer declarar?";
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

function WowActionButton({
  label,
  variant,
  onClick,
  disabled,
}: {
  label: string;
  variant: "primary" | "secondary";
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex min-h-12 items-center justify-center rounded-full px-5 text-[10px] font-black uppercase tracking-[0.24em] transition-transform active:scale-[0.98]",
        variant === "primary"
          ? "border border-[#C9A84C]/25 bg-[linear-gradient(180deg,#F1D77A_0%,#C9A84C_100%)] text-[#0a0a0a] shadow-[0_18px_40px_rgba(212,175,55,0.18)]"
          : "border border-white/10 bg-white/[0.05] text-white/82",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export function WowFirstChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgSlug = searchParams.get("org") || "";
  const { data, updateData, journey, isJourneyLoaded } = useOnboarding();
  const result = data ?? defaultOnboardingData;
  const resolvedOrgId = result.tenant?.orgId || journey?.onboardingSeed?.tenant?.orgId || "";
  const resolvedOrgSlug = result.tenant?.orgSlug || journey?.onboardingSeed?.tenant?.orgSlug || orgSlug || "";
  const orgLabel = result.tenant?.branchName || result.tenant?.orgSlug || orgSlug || "sua loja";
  const copy = useMemo(() => buildOnboardingWowCopy(orgLabel), [orgLabel]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "intro",
      role: "venus",
      text: copy.intro,
    },
  ]);
  const [isRouting, setIsRouting] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showAnalyzing, setShowAnalyzing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const followUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTrackedIntroRef = useRef(false);
  const nextHref = useMemo(() => (orgSlug ? `/scanner/opt-in?org=${encodeURIComponent(orgSlug)}` : "/scanner/opt-in"), [orgSlug]);
  const skipHref = useMemo(() => (orgSlug ? `/processing?org=${encodeURIComponent(orgSlug)}` : "/processing"), [orgSlug]);

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
    if (hasTrackedIntroRef.current || !resolvedOrgId) {
      return;
    }

    hasTrackedIntroRef.current = true;
    void trackOnboardingConversionEvent({
      orgId: resolvedOrgId,
      eventType: "first_message_shown",
      eventMeta: {
        surface: "onboarding_chat",
        variant: "wow_first",
        org_slug: resolvedOrgSlug || null,
      },
    });
  }, [resolvedOrgId, resolvedOrgSlug]);

  useEffect(() => {
    followUpTimerRef.current = setTimeout(() => {
      setShowFollowUp(true);
      setMessages((prev) => [
        ...prev,
        {
          id: "follow-up",
          role: "venus",
          text: copy.followUp,
        },
      ]);
    }, 3600);

    return () => {
      if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);
      if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
    };
  }, [copy.followUp]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, showAnalyzing, isRouting]);

  const routeWithDelay = (path: string, callback?: () => void) => {
    setIsRouting(true);
    setShowAnalyzing(true);
    if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);

    routeTimerRef.current = setTimeout(() => {
      callback?.();
      router.push(path);
    }, 650);
  };

  const handleSendPhoto = () => {
    if (isRouting || !resolvedOrgId) return;

    updateData("scanner", { skipped: false });
    setMessages((prev) => [
      ...prev,
      {
        id: "client-send-photo",
        role: "client",
        text: copy.sendPhotoLabel,
      },
    ]);
    void trackOnboardingConversionEvent({
      orgId: resolvedOrgId,
      eventType: "photo_sent",
      eventMeta: {
        surface: "onboarding_chat",
        cta: "send_photo",
        org_slug: resolvedOrgSlug || null,
      },
    });
    routeWithDelay(nextHref);
  };

  const handleContinueWithoutPhoto = () => {
    if (isRouting || !resolvedOrgId) return;

    updateData("scanner", { skipped: true });
    setMessages((prev) => [
      ...prev,
      {
        id: "client-skip-photo",
        role: "client",
        text: copy.continueLabel,
      },
    ]);
    void trackOnboardingConversionEvent({
      orgId: resolvedOrgId,
      eventType: "photo_not_sent",
      eventMeta: {
        surface: "onboarding_chat",
        cta: "continue_without_photo",
        org_slug: resolvedOrgSlug || null,
      },
    });
    routeWithDelay(skipHref);
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#090909] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12%] top-[-8%] h-72 w-72 rounded-full bg-[#C9A84C]/10 blur-[120px]" />
        <div className="absolute right-[-8%] top-[10%] h-64 w-64 rounded-full bg-white/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[18%] h-80 w-80 rounded-full bg-[#C9A84C]/6 blur-[130px]" />
      </div>

      <header className="relative z-10 flex items-center gap-3 px-4 pb-4 pt-4 sm:px-6">
        <VenusAvatar size={42} animated />
        <div className="space-y-0.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.38em] text-[#C9A84C]">Venus Stylist</div>
          <div className="text-[11px] text-white/42">Primeiro wow em uma única decisão</div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-4 pb-40 pt-3 sm:px-6">
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

          {showAnalyzing ? (
            <div className="flex items-start gap-3">
              <div className="mt-1 shrink-0">
                <VenusAvatar size={34} animated />
              </div>
              <div className="w-full rounded-[26px] border border-white/10 bg-white/[0.055] px-5 py-4 text-sm text-white/82 shadow-[0_18px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#C9A84C]">Analisando</p>
                <p className="mt-2 text-[15px] leading-7 text-white/90">{copy.sending}</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-[linear-gradient(90deg,#F1D77A_0%,#C9A84C_100%)]" />
                </div>
                <p className="mt-3 text-[13px] leading-6 text-white/60">{copy.analyzing}</p>
              </div>
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>
      </main>

      <div className="relative z-10 border-t border-white/8 bg-[#090909]/96 backdrop-blur-2xl">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
          <div className="rounded-[30px] border border-white/10 bg-white/[0.045] px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#C9A84C]">Leitura inicial</p>
            <p className="mt-2 text-[15px] leading-7 text-white/90">{copy.consultiveNote}</p>
            <p className="mt-2 text-[13px] leading-6 text-white/50">Sem formulário. Sem etapas escondidas. Só direção.</p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <WowActionButton
                label={copy.sendPhotoLabel}
                variant="primary"
                disabled={isRouting}
                onClick={handleSendPhoto}
              />
              <WowActionButton
                label={copy.continueLabel}
                variant="secondary"
                disabled={isRouting}
                onClick={handleContinueWithoutPhoto}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/54">
                Foto cedo
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/54">
                Wow rápido
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/54">
                Continuidade consultiva
              </span>
            </div>
          </div>

          {showFollowUp ? (
            <div className="mt-3 rounded-[26px] border border-white/8 bg-white/[0.03] px-4 py-3 text-[13px] leading-6 text-white/64">
              {copy.followUp}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LegacyChatContent() {
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
      updateData("intent", { styleDirection: option.value as StyleDirectionPreference });
      updateConversation({ line: option.conversationValue });
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

function ChatContent() {
  const { data, updateData, journey, isLoaded, isJourneyLoaded } = useOnboarding();
  const searchParams = useSearchParams();
  const orgSlug = normalizeTenantSlug(
    searchParams.get("org") || data?.tenant?.orgSlug || journey?.onboardingSeed?.tenant?.orgSlug || ""
  );
  const orgId = data?.tenant?.orgId || journey?.onboardingSeed?.tenant?.orgId || "";
  const [tenantResolutionStatus, setTenantResolutionStatus] = useState<"loading" | "ready" | "missing" | "invalid">("loading");
  const validatedTenantSlugRef = useRef<string>("");
  const validationInFlightRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isJourneyLoaded) {
      return;
    }

    if (!orgSlug) {
      validationInFlightRef.current = null;
      validatedTenantSlugRef.current = "";
      setTenantResolutionStatus("missing");
      return;
    }

    if (validatedTenantSlugRef.current === orgSlug) {
      setTenantResolutionStatus("ready");
      return;
    }

    if (validationInFlightRef.current === orgSlug) {
      return;
    }

    validationInFlightRef.current = orgSlug;
    setTenantResolutionStatus("loading");

    let cancelled = false;

    void fetch(`/api/public/org/${encodeURIComponent(orgSlug)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (cancelled) {
          return;
        }

        validationInFlightRef.current = null;

        if (!response.ok || !payload?.org?.slug) {
          validatedTenantSlugRef.current = "";
          setTenantResolutionStatus("invalid");
          return;
        }

        const brand = resolveVenusTenantBrand({
          orgSlug: payload.org.slug,
          orgName: payload.org.name,
          branchName: payload.org.branch_name,
          logoUrl: payload.org.logo_url,
          primaryColor: payload.org.primary_color,
        });

        validatedTenantSlugRef.current = brand.slug || orgSlug;
        setTenantResolutionStatus("ready");
        updateData("tenant", {
          ...data?.tenant,
          orgSlug: payload.org.slug,
          orgId: payload.org.id,
          branchName: brand.displayName,
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        validationInFlightRef.current = null;
        validatedTenantSlugRef.current = "";
        setTenantResolutionStatus("invalid");
      });

    return () => {
      cancelled = true;
    };
  }, [data?.tenant, isJourneyLoaded, isLoaded, orgSlug, updateData]);

  if (tenantResolutionStatus === "loading") {
    return <div className="min-h-screen bg-[#090909]" />;
  }

  if (tenantResolutionStatus === "missing" || tenantResolutionStatus === "invalid") {
    return (
      <TenantResolutionFallbackScreen
        title="Não consegui identificar a loja desta experiência."
        message="A jornada precisa começar com uma loja ativa e reconhecida. Volte para a entrada segura e tente novamente."
        actionHref="/"
        actionLabel="Voltar para a entrada"
      />
    );
  }

  const isWowPilot = isOnboardingWowSurfaceEnabled({
    orgSlug: orgSlug || null,
    orgId: orgId || journey?.onboardingSeed?.tenant?.orgId || null,
  });

  return isWowPilot ? <PremiumWowFirstChatContent /> : <LegacyChatContent />;
}

export default function OnboardingChatPage() {
  return (
    <Suspense fallback={<VenusLoadingScreen title="Abrindo o chat da Venus" subtitle="Carregando a experiência premium da sua loja." />}>
      <ChatContent />
    </Suspense>
  );
}

