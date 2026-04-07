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

interface SocialShareActionsProps {
  look: LookData;
  styleIdentity: string;
  imageGoal: string;
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
  profileSignal,
  intentScore,
  brandName,
  appName,
  resultUrl,
}: SocialShareActionsProps) {
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
      profileSignal,
      intentScore,
      brandName,
      appName,
      resultUrl,
    }),
    [look, styleIdentity, imageGoal, profileSignal, intentScore, brandName, appName, resultUrl]
  );

  const caption = React.useMemo(() => buildSocialCaption(shareInput), [shareInput]);
  const currentLevel = React.useMemo(() => getSocialLevel(economy.points), [economy.points]);
  const nextLevel = React.useMemo(() => getNextSocialUnlock(economy.points), [economy.points]);
  const missionBoard = React.useMemo(() => getSocialMissionBoard(economy, config), [economy, config]);
  const streak = React.useMemo(() => getActiveStreak(economy), [economy]);
  const streakBonusPreview = React.useMemo(() => getShareBonusPreview(economy, config), [economy, config]);
  const dailyFreeGenerations = getDailyFreeGenerationsRemaining();
  const brandTag = React.useMemo(() => {
    const raw = (brandName || "Maison Elite")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .toLowerCase();
    return raw ? `@${raw}` : "@maisonelite";
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
          : brandName || "Maison Elite";

  return (
    <div className="space-y-4 rounded-[32px] border border-white/5 bg-white/[0.03] p-5">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-2xl bg-[#D4AF37]/10 text-[#D4AF37]">
          <Sparkles size={16} />
        </div>
        <div className="space-y-1">
          <Text className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">Compartilhar e destravar</Text>
          <Text className="text-sm leading-relaxed text-white/70">
            Publique esta leitura com legenda pronta, marcação da loja e CTA para testar a Venus. Compartilhar libera pontos e mantém sua sequência viva.
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

      <div className="space-y-3 rounded-[28px] border border-[#D4AF37]/15 bg-black/25 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#D4AF37]">
            <Trophy size={14} />
            <Text className="text-[10px] font-bold uppercase tracking-[0.35em]">Nível {currentLevel.level}</Text>
          </div>
          <Text className="text-[8px] uppercase tracking-[0.35em] text-white/35">{economy.points} pontos</Text>
        </div>
        <Text className="text-sm font-medium text-white/80">{currentLevel.title}</Text>
        <div className="h-2 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F1D57F] transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.25em]">
          <span className="text-white/40">Próximo desbloqueio</span>
          <span className="text-[#D4AF37]">{nextLevel.title}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-[24px] border border-white/5 bg-black/25 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#D4AF37]">
              <Flame size={14} />
              <Text className="text-[9px] font-bold uppercase tracking-[0.35em]">Sequência atual</Text>
            </div>
            <Text className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70">{streak} dias</Text>
          </div>
          <Text className="mt-3 text-xs leading-relaxed text-white/65">{continuityMessage}</Text>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2">
              <Text className="text-[8px] uppercase tracking-[0.25em] text-white/30">Bônus de sequência</Text>
              <Text className="mt-1 text-xs font-medium text-[#D4AF37]">+{streakBonusPreview} pts</Text>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2">
              <Text className="text-[8px] uppercase tracking-[0.25em] text-white/30">Gerações livres hoje</Text>
              <Text className="mt-1 text-xs font-medium text-white/80">{dailyFreeGenerations}</Text>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/5 bg-black/25 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white/60">
              <Star size={14} className="text-[#D4AF37]" />
              <Text className="text-[9px] font-bold uppercase tracking-[0.35em]">Próxima meta</Text>
            </div>
            <Text className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#D4AF37]">{nextLevel.threshold} pts</Text>
          </div>
          <Text className="mt-3 text-xs leading-relaxed text-white/65">{nextLevel.unlock}</Text>
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2">
            <Text className="text-[8px] uppercase tracking-[0.25em] text-white/30">Faixa atual</Text>
            <Text className="text-[10px] font-medium text-white/80">{currentLevel.title}</Text>
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-[28px] border border-white/5 bg-black/25 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#D4AF37]">
            <CheckCircle2 size={14} />
            <Text className="text-[9px] font-bold uppercase tracking-[0.35em]">Missões</Text>
          </div>
          <Text className="text-[8px] uppercase tracking-[0.3em] text-white/30">Acompanhe progresso e ritmo</Text>
        </div>
        <div className="space-y-2">
          {missionBoard.map((mission) => (
            <div key={mission.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2">
              <div className="space-y-0.5">
                <Text className="text-xs font-medium text-white/80">{mission.label}</Text>
                <Text className="text-[8px] uppercase tracking-[0.25em] text-white/30">{mission.reward}</Text>
              </div>
              <div className="flex items-center gap-2">
                {mission.locked ? (
                  <Lock size={14} className="text-white/20" />
                ) : mission.done ? (
                  <CheckCircle2 size={14} className="text-[#D4AF37]" />
                ) : (
                  <ChevronRight size={14} className="text-white/20" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-[28px] border border-[#D4AF37]/15 bg-[#D4AF37]/5 p-4">
        <div className="space-y-1">
          <Text className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">{merchantBenefits.headline}</Text>
          <Text className="text-sm leading-relaxed text-white/70">{merchantBenefits.intro}</Text>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {merchantBenefits.benefits.map((benefit, index) => (
            <div key={index} className="rounded-[22px] border border-white/5 bg-black/25 p-3">
              <Text className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">{benefit.unlock}</Text>
              <Text className="mt-2 text-sm font-medium text-white/90">{benefit.title}</Text>
              <Text className="mt-2 text-xs leading-relaxed text-white/60">{benefit.description}</Text>
            </div>
          ))}
        </div>
        <Text className="text-[9px] uppercase tracking-[0.3em] text-[#D4AF37]">{merchantBenefits.cta}</Text>
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
        <Text className="text-[8px] uppercase tracking-[0.35em] text-white/25">
          Legenda pronta para Instagram, WhatsApp e apps compatíveis.
        </Text>
        <Text className="text-[8px] uppercase tracking-[0.35em] text-[#D4AF37]">{statusLabel}</Text>
      </div>
    </div>
  );
}
