"use client";

import React from "react";
import { CheckCircle2, Copy, Download, Share2, Sparkles, Star } from "lucide-react";
import { VenusButton } from "@/components/ui/VenusButton";
import type { LookData } from "@/types/result";
import type { ResultSurface } from "@/lib/result/surface";
import {
  buildShareCardTexts,
  downloadShareCard,
  generateShareCard,
  type ShareableLookCardInput,
} from "@/lib/tryon/share-card";
import {
  getShareBonusPreview,
  getSocialLevel,
  readSocialEconomyConfig,
  readSocialEconomyState,
  registerSocialAction,
  type SocialEconomyConfig,
  type SocialEconomyState,
} from "@/lib/social/economy";

type ShareableLookCardProps = {
  look: LookData;
  looks?: LookData[];
  surface: ResultSurface;
  resultId?: string | null;
  resultUrl?: string | null;
  orgId?: string | null;
  brandName?: string | null;
  appName?: string | null;
  orgName?: string | null;
  storeHandle?: string | null;
  customerName?: string | null;
  userImageUrl?: string | null;
  tryOnImageUrl?: string | null;
  onSaveLook?: () => void;
};

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function ShareableLookCard({
  look,
  looks,
  surface,
  resultId,
  resultUrl,
  orgId,
  brandName,
  appName,
  orgName,
  storeHandle,
  customerName,
  userImageUrl,
  tryOnImageUrl,
  onSaveLook,
}: ShareableLookCardProps) {
  const [status, setStatus] = React.useState<"idle" | "sharing" | "copied" | "saved" | "error">("idle");
  const [feedback, setFeedback] = React.useState("Pronto para transformar o resultado em post.");
  const [economy, setEconomy] = React.useState<SocialEconomyState>(readSocialEconomyState());
  const [config, setConfig] = React.useState<SocialEconomyConfig>(readSocialEconomyConfig());

  const shareInput = React.useMemo<ShareableLookCardInput>(
    () => ({
      look,
      looks,
      surface,
      resultId,
      resultUrl,
      orgId,
      brandName,
      appName,
      orgName,
      storeHandle,
      customerName,
      userImageUrl,
      tryOnImageUrl,
    }),
    [look, looks, surface, resultId, resultUrl, orgId, brandName, appName, orgName, storeHandle, customerName, userImageUrl, tryOnImageUrl]
  );

  const shareTexts = React.useMemo(() => buildShareCardTexts(shareInput), [shareInput]);
  const currentLevel = React.useMemo(() => getSocialLevel(economy.points), [economy.points]);
  const shareBonusPreview = React.useMemo(() => getShareBonusPreview(economy, config), [economy, config]);
  const totalShareBonus = config.sharePoints + shareBonusPreview;

  React.useEffect(() => {
    const syncEconomy = () => {
      setEconomy(readSocialEconomyState());
      setConfig(readSocialEconomyConfig());
    };

    syncEconomy();
    window.addEventListener("storage", syncEconomy);
    return () => window.removeEventListener("storage", syncEconomy);
  }, []);

  const recordAction = React.useCallback((action: "share" | "copy" | "download") => {
    const next = registerSocialAction(action);
    setEconomy(next);
    setConfig(readSocialEconomyConfig());
    return next;
  }, []);

  const pushShareBonus = React.useCallback(
    async (platform: string) => {
      if (!resultId || !orgId) return;

      try {
        await fetch("/api/result/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            orgId,
            resultId,
            customerKey: resultId,
            customerLabel: customerName || look.name,
            platform,
            shareId: `${resultId}:${platform}`,
            caption: shareTexts.shareText,
            lookName: look.name,
          }),
        });
      } catch {
        // Silent fallback. The local gamification still works.
      }
    },
    [orgId, resultId, customerName, look.name, shareTexts.shareText]
  );

  const handleShareLook = React.useCallback(async () => {
      setStatus("sharing");
      setFeedback("Gerando sua versão pronta para compartilhar...");

      try {
        const file = await generateShareCard(shareInput);
      const sharePayload: ShareData = {
        title: `${shareTexts.model.styleName} • ${brandName || "Venus"}`,
        text: shareTexts.shareText,
        files: [file],
      };

      if (navigator.share) {
        const canShareFiles = typeof navigator.canShare === "function" ? navigator.canShare({ files: [file] }) : true;
        if (canShareFiles) {
          await navigator.share(sharePayload);
        } else {
          await navigator.share({
            title: sharePayload.title,
            text: sharePayload.text,
            url: resultUrl || undefined,
          });
          await downloadShareCard(shareInput);
        }
      } else {
        const copied = await copyText(shareTexts.shareText);
        if (!copied) {
          throw new Error("Clipboard unavailable");
        }
        await downloadShareCard(shareInput);
      }

      recordAction("share");
      void pushShareBonus("share_sheet");
      setStatus("idle");
      setFeedback(`Compartilhado. +${totalShareBonus} pts em jogo.`);
    } catch (error) {
      try {
        await downloadShareCard(shareInput);
        await copyText(shareTexts.shareText);
        recordAction("share");
        void pushShareBonus("download_fallback");
        setStatus("saved");
        setFeedback(`Fallback pronto. +${totalShareBonus} pts em jogo.`);
      } catch {
        console.warn("[SHARE_CARD] share failed", error);
        setStatus("error");
        setFeedback("Nao foi possivel gerar o card agora.");
      }
    }
  }, [brandName, pushShareBonus, recordAction, resultUrl, shareInput, shareTexts, totalShareBonus]);

  const handleAskOpinion = React.useCallback(async () => {
    setStatus("sharing");
    const text = shareTexts.opinionText;

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTexts.model.styleName,
          text,
          url: resultUrl || undefined,
        });
      } else {
        const copied = await copyText(text);
        if (!copied) {
          throw new Error("Clipboard unavailable");
        }
      }

      recordAction("copy");
      setStatus("copied");
      setFeedback("Pergunta pronta. Agora e so colher opinioes.");
    } catch {
      const copied = await copyText(text);
      if (copied) {
        recordAction("copy");
        setStatus("copied");
        setFeedback("Texto copiado para perguntar a opiniao.");
        return;
      }

      setStatus("error");
      setFeedback("Nao foi possivel preparar a pergunta agora.");
    }
  }, [recordAction, resultUrl, shareTexts.model.styleName, shareTexts.opinionText]);

  const handleSaveLook = React.useCallback(async () => {
    setStatus("sharing");
    try {
      await downloadShareCard(shareInput);
      recordAction("download");
      onSaveLook?.();
      setStatus("saved");
      setFeedback(`${shareTexts.saveText} +${config.downloadPoints} pts adicionados.`);
    } catch {
      setStatus("error");
      setFeedback("Nao foi possivel salvar a imagem agora.");
    }
  }, [config.downloadPoints, onSaveLook, recordAction, shareInput, shareTexts.saveText]);

  const variations = shareTexts.model.variations;

  return (
    <section className="overflow-hidden rounded-[36px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] shadow-[0_24px_90px_rgba(0,0,0,0.45)]">
      <div className="border-b border-white/5 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.3em] text-[#D4AF37]">
                <Sparkles size={12} />
                Resultado premium
              </span>
              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.28em] text-white/55">
                {shareTexts.model.styleName}
              </span>
            </div>
            <h2 className="font-serif text-2xl text-white sm:text-3xl">{shareTexts.model.headline}</h2>
            <p className="max-w-2xl text-[14px] leading-relaxed text-white/62">{shareTexts.model.emotionalCopy}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:min-w-[240px]">
            <div className="rounded-2xl border border-white/5 bg-black/25 px-4 py-3">
              <p className="text-[8px] font-bold uppercase tracking-[0.28em] text-white/35">Nivel</p>
              <p className="mt-1 text-sm font-semibold text-white">{currentLevel.title}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/25 px-4 py-3">
              <p className="text-[8px] font-bold uppercase tracking-[0.28em] text-white/35">Bonus</p>
              <p className="mt-1 text-sm font-semibold text-[#D4AF37]">+{totalShareBonus} pts</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-5 sm:px-6">
        <div className="relative overflow-hidden rounded-[30px] border border-white/8 bg-black/30">
          <div className="relative aspect-[3/4] min-h-[420px]">
            <img
              src={tryOnImageUrl || look.items?.[0]?.photoUrl || look.tryOnUrl || "/hero-final.jpg"}
              alt={`${shareTexts.model.styleName} com ${look.name}`}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.58)_100%)]" />
            <div className="absolute left-4 top-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-[#D4AF37]/20 bg-black/60 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.28em] text-[#D4AF37]">
                {shareTexts.model.styleName}
              </span>
              <span className="rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.28em] text-white/70">
                Qual voce escolheria?
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
              <div className="rounded-[26px] border border-white/10 bg-black/55 p-4 backdrop-blur-md">
                <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-[#D4AF37]">Leitura emocional</p>
                <p className="mt-2 text-balance font-serif text-xl text-white sm:text-2xl">{shareTexts.model.emotionalCopy}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {shareTexts.model.reinforcement.map((item) => (
                    <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.24em] text-white/70">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {variations.map((variation) => (
            <div key={`${variation.label}-${variation.title}`} className="overflow-hidden rounded-[24px] border border-white/5 bg-black/20">
              <div className="aspect-[4/5] overflow-hidden bg-black/40">
                <img
                  src={variation.imageUrl || tryOnImageUrl || look.items?.[0]?.photoUrl || "/hero-final.jpg"}
                  alt={variation.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-2 p-4">
                <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-[#D4AF37]">{variation.label}</p>
                <h3 className="text-[15px] font-semibold text-white">{variation.title}</h3>
                <p className="text-[12px] leading-relaxed text-white/58">{variation.reason}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {shareTexts.model.reinforcement.map((item) => (
            <div key={item} className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
              <p className="text-[8px] font-bold uppercase tracking-[0.28em] text-[#D4AF37]">{item}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-white/58">
                {item === "Baseado na sua intenção"
                  ? "A leitura respeita sua direção visual e o caimento das peças."
                  : item === "Cores ideais para voce"
                    ? "A paleta reforca contraste e harmonia."
                    : "A proposta foi montada para funcionar no mundo real."}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <VenusButton
            onClick={() => void handleShareLook()}
            className="h-12 rounded-full bg-[#D4AF37] px-4 text-[9px] font-bold uppercase tracking-[0.32em] text-black"
          >
            <span className="flex items-center gap-2">
              <Share2 size={14} />
              Compartilhar look
            </span>
          </VenusButton>
          <VenusButton
            onClick={() => void handleAskOpinion()}
            variant="outline"
            className="h-12 rounded-full border-white/10 px-4 text-[9px] font-bold uppercase tracking-[0.32em] text-white"
          >
            <span className="flex items-center gap-2">
              <Copy size={14} />
              Perguntar opiniao
            </span>
          </VenusButton>
          <VenusButton
            onClick={() => void handleSaveLook()}
            variant="outline"
            className="h-12 rounded-full border-white/10 px-4 text-[9px] font-bold uppercase tracking-[0.32em] text-white"
          >
            <span className="flex items-center gap-2">
              <Download size={14} />
              Salvar look
            </span>
          </VenusButton>
        </div>

        <div className="flex flex-col gap-3 rounded-[24px] border border-white/5 bg-black/25 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#D4AF37]/10 text-[#D4AF37]">
              <Star size={16} />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-[#D4AF37]">Light gamification</p>
              <p className="text-[12px] leading-relaxed text-white/58">{feedback}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[8px] font-bold uppercase tracking-[0.24em] text-white/55">
              +{config.sharePoints} share
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[8px] font-bold uppercase tracking-[0.24em] text-white/55">
              +{config.copyPoints} copy
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[8px] font-bold uppercase tracking-[0.24em] text-white/55">
              +{config.downloadPoints} save
            </span>
          </div>
        </div>

        {status === "saved" && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-emerald-200">
            <CheckCircle2 size={16} />
            <p className="text-[12px] leading-relaxed">Seu look foi salvo e o bonus foi registrado.</p>
          </div>
        )}
      </div>
    </section>
  );
}
