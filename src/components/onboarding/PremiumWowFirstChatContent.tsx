"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VenusAvatar } from "@/components/venus/VenusAvatar";
import { PhotoUploadCTA, PublicOnboardingFrame, TenantBrandHeader } from "@/components/onboarding/public-surface";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { trackOnboardingConversionEvent } from "@/lib/onboarding/analytics";
import { buildOnboardingIntroCopy, buildOnboardingWowCopy } from "@/lib/onboarding/wow-surface";
import { defaultOnboardingData } from "@/types/onboarding";
import { resolveVenusTenantBrand, type VenusTenantBrand } from "@/lib/venus/brand";

type ChatRole = "venus" | "client";

type Message = {
  id: string;
  role: ChatRole;
  text: string;
};

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

export function PremiumWowFirstChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgSlug = searchParams.get("org") || "";
  const { data, updateData, journey, isJourneyLoaded } = useOnboarding();
  const result = data ?? defaultOnboardingData;
  const resolvedOrgId = result.tenant?.orgId || journey?.onboardingSeed?.tenant?.orgId || "";
  const resolvedOrgSlug = result.tenant?.orgSlug || journey?.onboardingSeed?.tenant?.orgSlug || orgSlug || "";
  const [hasStarted, setHasStarted] = useState(false);
  const [brand, setBrand] = useState<VenusTenantBrand>(() =>
    resolveVenusTenantBrand(
      {
        orgSlug: resolvedOrgSlug || null,
        orgName: result.tenant?.branchName || journey?.onboardingSeed?.tenant?.branchName || null,
        branchName: result.tenant?.branchName || journey?.onboardingSeed?.tenant?.branchName || null,
        logoUrl: null,
        primaryColor: null,
      },
      "sua loja"
    )
  );
  const copy = useMemo(() => buildOnboardingWowCopy(brand.displayName), [brand.displayName]);
  const introCopy = useMemo(() => buildOnboardingIntroCopy(brand.displayName), [brand.displayName]);

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
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTrackedIntroRef = useRef(false);

  const nextHref = useMemo(() => (resolvedOrgSlug ? `/onboarding/intent?org=${encodeURIComponent(resolvedOrgSlug)}` : "/onboarding/intent"), [resolvedOrgSlug]);
  const skipHref = useMemo(() => (resolvedOrgSlug ? `/onboarding/intent?org=${encodeURIComponent(resolvedOrgSlug)}` : "/onboarding/intent"), [resolvedOrgSlug]);

  useEffect(() => {
    let cancelled = false;

    const fallbackBrand = resolveVenusTenantBrand(
      {
        orgSlug: resolvedOrgSlug || null,
        orgName: result.tenant?.branchName || journey?.onboardingSeed?.tenant?.branchName || null,
        branchName: result.tenant?.branchName || journey?.onboardingSeed?.tenant?.branchName || null,
        logoUrl: null,
        primaryColor: null,
      },
      "sua loja"
    );

    if (!resolvedOrgSlug) {
      setBrand(fallbackBrand);
      return () => {
        cancelled = true;
      };
    }

    void fetch(`/api/public/org/${encodeURIComponent(resolvedOrgSlug)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("brand_fetch_failed");
        }

        const payload = (await response.json()) as {
          ok?: boolean;
          org?: {
            slug?: string | null;
            name?: string | null;
            branch_name?: string | null;
            logo_url?: string | null;
            primary_color?: string | null;
          };
        };

        if (cancelled || !payload?.org) {
          return;
        }

        setBrand(
          resolveVenusTenantBrand(
            {
              orgSlug: payload.org.slug || resolvedOrgSlug,
              orgName: payload.org.name || null,
              branchName: payload.org.branch_name || payload.org.name || null,
              logoUrl: payload.org.logo_url || null,
              primaryColor: payload.org.primary_color || null,
            },
            fallbackBrand.displayName
          )
        );
      })
      .catch(() => {
        if (!cancelled) {
          setBrand(fallbackBrand);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [journey?.onboardingSeed?.tenant?.branchName, resolvedOrgSlug, result.tenant?.branchName]);

  useEffect(() => {
    if (!hasStarted) {
      setMessages([
        {
          id: "intro",
          role: "venus",
          text: copy.intro,
        },
      ]);
    }
  }, [copy.intro, hasStarted]);

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
    if (!hasStarted || hasTrackedIntroRef.current || !resolvedOrgId) {
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
  }, [hasStarted, resolvedOrgId, resolvedOrgSlug]);

  useEffect(() => {
    if (!hasStarted) {
      return;
    }

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
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [copy.followUp, hasStarted]);

  useEffect(() => {
    if (!hasStarted) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [hasStarted, isRouting, messages, showAnalyzing]);

  const routeWithDelay = (path: string, callback?: () => void) => {
    setIsRouting(true);
    setShowAnalyzing(true);
    if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);

    redirectTimerRef.current = setTimeout(() => {
      callback?.();
      router.push(path);
    }, 650);
  };

  const handleSendPhoto = () => {
    if (isRouting) return;

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
      orgId: resolvedOrgId || null,
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
    if (isRouting) return;

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
      orgId: resolvedOrgId || null,
      eventType: "photo_not_sent",
      eventMeta: {
        surface: "onboarding_chat",
        cta: "continue_without_photo",
        org_slug: resolvedOrgSlug || null,
      },
    });
    routeWithDelay(skipHref);
  };

  const handleStart = () => {
    setHasStarted(true);
  };

  const chatSurface = (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#090909] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12%] top-[-8%] h-72 w-72 rounded-full bg-[#C9A84C]/10 blur-[120px]" />
        <div className="absolute right-[-8%] top-[10%] h-64 w-64 rounded-full bg-white/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[18%] h-80 w-80 rounded-full bg-[#C9A84C]/6 blur-[130px]" />
      </div>

      <header className="relative z-10 flex items-center gap-3 px-4 pb-4 pt-4 sm:px-6">
        <TenantBrandHeader brand={brand} compact />
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
          <PhotoUploadCTA
            label={copy.sendPhotoLabel}
            helperText="Me envie uma foto para abrir a leitura premium. Se preferir, você pode continuar sem foto."
            secondaryLabel={copy.continueLabel}
            onPrimary={handleSendPhoto}
            onSecondary={handleContinueWithoutPhoto}
            disabled={isRouting}
          />

          {showFollowUp ? (
            <div className="mt-3 rounded-[26px] border border-white/8 bg-white/[0.03] px-4 py-3 text-[13px] leading-6 text-white/64">
              {copy.followUp}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={hasStarted ? "chat" : "intro"}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <PublicOnboardingFrame started={hasStarted} brand={brand} copy={introCopy} onStart={handleStart}>
          {chatSurface}
        </PublicOnboardingFrame>
      </motion.div>
    </AnimatePresence>
  );
}
