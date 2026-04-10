"use client";

import React from "react";
import {
  ChevronRight,
  CheckCircle2,
  Copy,
  Download,
  Flame,
  Lock,
  Share2,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import { VenusButton } from "@/components/ui/VenusButton";
import { Text } from "@/components/ui/Text";
import { LookData } from "@/types/result";
import {
  buildSocialCaption,
  copySocialCaption,
  downloadSocialShareImage,
  shareSocialLook,
  type SocialShareInput,
} from "@/lib/social/share";
import {
  getActiveStreak,
  getDailyFreeGenerationsRemaining,
  getNextSocialUnlock,
  getShareBonusPreview,
  getSocialLevel,
  getSocialMissionBoard,
  readSocialEconomyConfig,
  readSocialEconomyState,
  registerSocialAction,
  type SocialAction,
  type SocialEconomyConfig,
  type SocialEconomyState,
} from "@/lib/social/economy";
import {
  DEFAULT_MERCHANT_BENEFIT_PROGRAM,
  readMerchantBenefitProgram,
  type MerchantBenefitProgram,
} from "@/lib/social/merchant-benefits";
import { useUserImage } from "@/lib/onboarding/UserImageContext";
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
  const { userPhoto } = useUserImage();
  const { data: onboardingData } = useOnboarding();
  const [status, setStatus] = React.useState<"idle" | "sharing" | "copied" | "downloaded">("idle");
  const [economy, setEconomy] = React.useState<SocialEconomyState>({
    points: 0,
    shares: 0,
    streak: 0,
    lastShareDate: null,
    lastActionDate: null,
    dailyActionDate: null,
    dailyActionCount: 0,
    shareCount: 0,
    copyCount: 0,
    downloadCount: 0,
    advanceCount: 0,
    purchaseTotal: 0,
  });
  const [config, setConfig] = React.useState<SocialEconomyConfig>({
    sharePoints: 25,
    copyPoints: 5,
    downloadPoints: 8,
    advancePoints: 10,
    purchasePoints: 50,
    streakBonusPerDay: 5,
    streakBonusCap: 20,
    dailyFreeGenerations: 3,
    minSpendToUnlock: 0,
  });
  const [merchantBenefits, setMerchantBenefits] = React.useState<MerchantBenefitProgram>(DEFAULT_MERCHANT_BENEFIT_PROGRAM);

  const shareInput = React.useMemo<SocialShareInput>(
    () => ({
      look,
      styleIdentity,
      imageGoal,
      essenceLabel,
      essenceSummary,
      profileSignal,
      userPhotoUrl: userPhoto || onboardingData.scanner.facePhoto || onboardingData.scanner.bodyPhoto || undefined,
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
      userPhoto,
      onboardingData.scanner.facePhoto,
      onboardingData.scanner.bodyPhoto,
      intentScore,
      brandName,
      appName,
      resultUrl,
    ]
  );

  const caption = React.useMemo(() => buildSocialCaption(shareInput), [shareInput]);
  const currentLevel = React.useMemo(() => getSocialLevel(economy.points), [economy.points]);
  const nextLevel = React.useMemo(() => getNextSocialUnlock(economy.points), [economy.points]);
  const missionBoard = React.useMemo(() => getSocialMissionBoard(economy, config), [economy, config]);
  const streak = React.useMemo(() => getActiveStreak(economy), [economy]);
  const streakBonusPreview = React.useMemo(() => getShareBonusPreview(economy, config), [economy, config]);
  const dailyFreeGenerations = getDailyFreeGenerationsRemaining();
  const brandTag = React.useMemo(() => {
    const raw = (brandName || "Venus Engine")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .toLowerCase();
    return raw ? `@${raw}` : "@venusengine";
  }, [brandName]);
  const cortexTag = "@InovaCortex";
  const currentThreshold = React.useMemo(() => {
    if (economy.points >= 175) return 175;
    if (economy.points >= 100) return 100;
    if (economy.points >= 50) return 50;
    return 0;
  }, [economy.points]);

  React.useEffect(() => {
    const syncEconomy = () => {
      setEconomy(readSocialEconomyState());
      setConfig(readSocialEconomyConfig());
      setMerchantBenefits(readMerchantBenefitProgram(brandName));
    };

    syncEconomy();
    window.addEventListener("storage", syncEconomy);
    return () => window.removeEventListener("storage", syncEconomy);
  }, []);

  React.useEffect(() => {
    const syncBenefits = () => setMerchantBenefits(readMerchantBenefitProgram(brandName));

    syncBenefits();
    window.addEventListener("storage", syncBenefits);
    return () => window.removeEventListener("storage", syncBenefits);
  }, [brandName]);

  const recordAction = React.useCallback((action: SocialAction, amount = 0) => {
    const next = registerSocialAction(action, amount);
    setEconomy(next);
    setConfig(readSocialEconomyConfig());
    return next;
  }, []);

  const progress = React.useMemo(() => {
    const nextThreshold = nextLevel.threshold;

    if (nextThreshold === currentThreshold) return 100;
    return Math.min(100, ((economy.points - currentThreshold) / Math.max(1, nextThreshold - currentThreshold)) * 100);
  }, [economy.points, currentThreshold, nextLevel.threshold]);

  const continuityMessage =
    streak > 0
      ? `Sequência ativa de ${streak} dias. Compartilhe hoje para manter o ritmo.`
      : "Comece sua sequência compartilhando hoje.";

  const handleShare = async () => {
    setStatus("sharing");
    try {
      await shareSocialLook(shareInput);
      recordAction("share");
      setStatus("idle");
    } catch {
      await downloadSocialShareImage(shareInput);
      recordAction("share");
      setStatus("downloaded");
    }
  };

  const handleCopy = async () => {
    await copySocialCaption(shareInput);
    recordAction("copy");
    setStatus("copied");
  };

  const handleDownload = async () => {
    await downloadSocialShareImage(shareInput);
    recordAction("download");
    setStatus("downloaded");
  };

  const statusLabel =
    status === "sharing"
      ? "Gerando..."
      : status === "copied"
        ? "Legenda copiada"
        : status === "downloaded"
          ? "Imagem pronta"
          : brandName || "Venus Engine";

  return (
    <div className="space-y-4 rounded-[32px] border border-white/5 bg-white/[0.03] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-2xl bg-[#D4AF37]/10 text-[#D4AF37]">
          <Sparkles size={16} />
        </div>
        <div className="space-y-1">
          <Text className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">Compartilhar e destravar</Text>
          <Text className="text-sm leading-relaxed text-white/70">
            Publique a leitura com legenda pronta, marcação da loja e CTA para testar a Venus.
          </Text>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.3em] text-white/60">
          {brandTag}
        </span>
        <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.3em] text-white/60">
          {cortexTag}
        </span>
        <span className="rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.3em] text-[#D4AF37]">
          Teste a Venus
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <VenusButton onClick={handleShare} className="h-12 rounded-full bg-[#D4AF37] px-4 text-[9px] font-bold uppercase tracking-[0.35em] text-black">
          <span className="flex items-center gap-2">
            <Share2 size={14} />
            Postar agora
          </span>
        </VenusButton>
        <VenusButton onClick={handleDownload} variant="outline" className="h-12 rounded-full border-white/10 px-4 text-[9px] font-bold uppercase tracking-[0.35em] text-white">
          <span className="flex items-center gap-2">
            <Download size={14} />
            Baixar arte
          </span>
        </VenusButton>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <VenusButton
          onClick={handleCopy}
          variant="outline"
          className="h-11 flex-1 rounded-full border-white/10 px-4 text-[9px] font-bold uppercase tracking-[0.35em] text-white/80"
        >
          <span className="flex items-center gap-2">
            <Copy size={14} />
            Copiar legenda
          </span>
        </VenusButton>
        <div className="flex flex-1 items-center rounded-full border border-white/5 bg-black/30 px-4 py-3">
          <Text className="line-clamp-2 text-[10px] leading-relaxed text-white/40">{caption}</Text>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Text className="text-[8px] uppercase tracking-[0.35em] text-white/25 sm:text-[8px]">
          Legenda pronta para postar.
        </Text>
        <Text className="text-[8px] uppercase tracking-[0.35em] text-[#D4AF37]">{statusLabel}</Text>
      </div>
    </div>
  );
}
