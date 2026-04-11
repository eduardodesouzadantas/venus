"use client";

import React from "react";
import {
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

  React.useEffect(() => {
    const syncEconomy = () => {
      setEconomy(readSocialEconomyState());
      setConfig(readSocialEconomyConfig());
      setMerchantBenefits(readMerchantBenefitProgram(brandName));
    };

    syncEconomy();
    window.addEventListener("storage", syncEconomy);
    return () => window.removeEventListener("storage", syncEconomy);
  }, [brandName]);

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
    const currentThreshold = currentLevel.level >= 4 ? 175 : currentLevel.level === 3 ? 100 : currentLevel.level === 2 ? 50 : 0;
    if (nextThreshold === currentThreshold) return 100;
    return Math.min(100, ((economy.points - currentThreshold) / Math.max(1, nextThreshold - currentThreshold)) * 100);
  }, [economy.points, currentLevel.level, nextLevel.threshold]);

  const continuityMessage =
    streak > 0
      ? `Sequencia ativa de ${streak} dias. Compartilhe hoje para manter o ritmo.`
      : "Comece sua sequencia compartilhando hoje.";

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
          <Text className="line-clamp-2 text-[10px] leading-relaxed text-white/40">
            Legenda pronta para postar com marcação da loja.
          </Text>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/5 bg-black/20 p-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#D4AF37]" />
          <Text className="text-[9px] font-bold uppercase tracking-[0.34em] text-[#D4AF37]">Nível {currentLevel.title}</Text>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-white/40">
          <span>{economy.points} pts</span>
          <span>Próximo: {nextLevel.title}</span>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/5 bg-white/[0.02] p-4">
        <div className="flex items-center gap-2">
          <Flame size={14} className="text-[#D4AF37]" />
          <Text className="text-[9px] font-bold uppercase tracking-[0.34em] text-[#D4AF37]">Modo Descoberta</Text>
        </div>
        <Text className="mt-2 text-sm leading-relaxed text-white/70">{continuityMessage}</Text>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {missionBoard.map((mission) => (
            <div key={mission.id} className="rounded-[18px] border border-white/5 bg-black/25 p-3">
              <div className="flex items-center gap-2">
                {mission.done ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Lock size={12} className="text-white/30" />}
                <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/45">{mission.label}</span>
              </div>
              <Text className="mt-2 text-[12px] leading-relaxed text-white/60">{mission.reward}</Text>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-white/5 bg-white/[0.02] p-4">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-[#D4AF37]" />
          <Text className="text-[9px] font-bold uppercase tracking-[0.34em] text-[#D4AF37]">Sequência atual</Text>
        </div>
        <Text className="mt-2 text-sm leading-relaxed text-white/70">
          {streak > 0 ? `Você mantém ${streak} dias seguidos de consistência.` : "Ainda sem sequência registrada."}
        </Text>
        <div className="mt-4 rounded-[20px] border border-white/5 bg-black/25 p-3">
          <Text className="text-[11px] leading-relaxed text-white/55">
            +{streakBonusPreview} pts de bônus de sequência.
          </Text>
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-white/35">
          <span>{dailyFreeGenerations} gerações livres hoje</span>
          <span>{merchantBenefits.cta}</span>
        </div>
      </div>
    </div>
  );
}
