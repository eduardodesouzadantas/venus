"use client";

import React from "react";
import { Copy, Share2, Store } from "lucide-react";
import { VenusButton } from "@/components/ui/VenusButton";
import { Text } from "@/components/ui/Text";
import { LookData } from "@/types/result";
import {
  copySocialCaption,
  shareSocialLook,
  type SocialShareInput,
} from "@/lib/social/share";
import { readMerchantBenefitProgram } from "@/lib/social/merchant-benefits";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

interface SocialShareActionsProps {
  look: LookData;
  styleIdentity: string;
  imageGoal: string;
  essenceLabel?: string;
  essenceSummary?: string;
  profileSignal?: string;
  intentScore?: number;
  brandName?: string;
  appName?: string;
  resultUrl?: string;
}

export function SocialShareActions({
  look,
  styleIdentity,
  imageGoal,
  essenceLabel,
  essenceSummary,
  profileSignal,
  intentScore,
  brandName,
  appName,
  resultUrl,
}: SocialShareActionsProps) {
  const { data: onboardingData } = useOnboarding();
  const [status, setStatus] = React.useState<"idle" | "sharing" | "copied">("idle");

  const shareInput = React.useMemo<SocialShareInput>(
    () => ({
      look,
      styleIdentity,
      imageGoal,
      essenceLabel,
      essenceSummary,
      profileSignal,
      userPhotoUrl: onboardingData.scanner.facePhoto || onboardingData.scanner.bodyPhoto || undefined,
      intentScore,
      brandName,
      appName,
      resultUrl,
    }),
    [
      look,
      styleIdentity,
      imageGoal,
      essenceLabel,
      essenceSummary,
      profileSignal,
      onboardingData.scanner.facePhoto,
      onboardingData.scanner.bodyPhoto,
      intentScore,
      brandName,
      appName,
      resultUrl,
    ]
  );

  const merchantProgram = React.useMemo(() => readMerchantBenefitProgram(brandName), [brandName]);
  const brandTag = React.useMemo(() => {
    const raw = (brandName || "Venus Engine")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .toLowerCase();
    return raw ? `@${raw}` : "@venusengine";
  }, [brandName]);

  const handleShare = async () => {
    setStatus("sharing");
    try {
      await shareSocialLook(shareInput);
      setStatus("idle");
    } catch {
      await copySocialCaption(shareInput);
      setStatus("idle");
    }
  };

  const handleCopy = async () => {
    await copySocialCaption(shareInput);
    setStatus("copied");
    window.setTimeout(() => setStatus("idle"), 1400);
  };

  return (
    <section className="space-y-4 rounded-[28px] border border-white/6 bg-white/[0.03] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Text className="text-[9px] font-bold uppercase tracking-[0.34em] text-white/35">Compartilhar</Text>
          <Text className="text-sm leading-relaxed text-white/68">{merchantProgram.intro}</Text>
        </div>
        <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.3em] text-white/55">
          {status === "sharing" ? "Compartilhando" : status === "copied" ? "Legenda copiada" : "Pronto"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.3em] text-white/60">
          {brandTag}
        </span>
        <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.3em] text-white/60">
          @InovaCortex
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <VenusButton
          onClick={handleShare}
          className="h-12 rounded-full bg-[#D4AF37] px-4 text-[9px] font-bold uppercase tracking-[0.35em] text-black"
        >
          <span className="flex items-center gap-2">
            <Share2 size={14} />
            Instagram
          </span>
        </VenusButton>
        <VenusButton
          onClick={handleCopy}
          variant="outline"
          className="h-12 rounded-full border-white/10 px-4 text-[9px] font-bold uppercase tracking-[0.35em] text-white"
        >
          <span className="flex items-center gap-2">
            <Copy size={14} />
            Copiar legenda
          </span>
        </VenusButton>
      </div>

      <div className="space-y-3 rounded-[22px] border border-white/6 bg-black/20 p-4">
        <div className="flex items-center gap-2">
          <Store size={14} className="text-[#D4AF37]" />
          <Text className="text-[9px] font-bold uppercase tracking-[0.34em] text-[#D4AF37]">Benefícios da loja</Text>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {merchantProgram.benefits.map((benefit) => (
            <div key={benefit.title} className="rounded-[18px] border border-white/5 bg-white/[0.03] p-3">
              <div className="text-[11px] font-semibold text-white">{benefit.title}</div>
              <div className="mt-1 text-[12px] leading-5 text-white/60">{benefit.description}</div>
            </div>
          ))}
        </div>
        <Text className="text-[11px] leading-relaxed text-white/40">{merchantProgram.cta}</Text>
      </div>

    </section>
  );
}
