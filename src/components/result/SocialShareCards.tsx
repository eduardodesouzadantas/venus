"use client";

import React from "react";
import { Copy, Download, Share2, Sparkles, Check, Gift } from "lucide-react";
import { VenusButton } from "@/components/ui/VenusButton";

interface ShareCardData {
  signatureName: string;
  signatureSummary?: string;
  palette?: string[];
  colors?: { hex: string; name: string }[];
  storeName?: string;
  lookName?: string;
  storeHandle?: string;
  shareUrl?: string;
}

interface SocialShareCardProps {
  data: ShareCardData;
  variant?: "signature" | "palette" | "style_phrase" | "look";
  onShare?: () => void;
  onCopyText?: () => void;
  onDownload?: () => void;
}

function normalizeText(text: string | undefined): string {
  if (!text) return "";
  return text.trim();
}

function normalizeHandle(value: string | null | undefined): string | null {
  if (!value || value === "undefined" || value === "null") return null;
  const cleaned = value
    .replace(/^@+/, "")
    .replace(/[-\s]+/g, "")
    .replace(/[^a-zA-Z0-9_.]/g, "")
    .toLowerCase();
  return cleaned || null;
}

function safeHex(value: string | undefined, fallback = "#C9A84C"): string {
  if (!value) return fallback;
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : fallback;
}

export function SocialShareCard({ data, variant = "signature", onShare, onCopyText }: SocialShareCardProps) {
  const [copied, setCopied] = React.useState(false);

  const getCardContent = () => {
    switch (variant) {
      case "signature":
        return {
          title: "Assinatura visual",
          main: normalizeText(data.signatureName) || "Autoridade Silenciosa",
          subtitle: normalizeText(data.signatureSummary) || "Você transmite presença sem precisar exagerar.",
          accent: data.storeName ? data.storeName : "Powered by Venus",
        };
      case "palette":
        return {
          title: "Paleta Venus",
          main: "Cores que reforçam minha presença",
          subtitle: data.colors?.slice(0, 3).map(c => c.name).join(" • ") || "Preto • off white • vinho",
          accent: "Powered by Venus",
        };
      case "style_phrase":
        return {
          title: "Frase de estilo",
          main: "Eu não preciso parecer mais. Eu preciso parecer mais eu.",
          subtitle: normalizeText(data.signatureName) || "Assinatura revelada",
          accent: "Powered by Venus",
        };
      case "look":
        return {
          title: "Look recomendado",
          main: normalizeText(data.lookName) || "Base de Presença Limpa",
          subtitle: `Peças reais para ${normalizeText(data.signatureName) || "minha assinatura"}`,
          accent: data.storeName ? `Curadoria ${data.storeName}` : "Powered by Venus",
        };
      default:
        return {
          title: "Resultado",
          main: normalizeText(data.signatureName),
          subtitle: normalizeText(data.signatureSummary),
          accent: "Feito pela Venus",
        };
    }
  };

  const content = getCardContent();

  const buildOrganicCaption = () => {
    const handle = normalizeHandle(data.storeHandle);
    const storeRef = handle ? `@${handle}` : (data.storeName ? data.storeName : null);
    const lines = [
      storeRef
        ? `Descobri minha assinatura visual com ${storeRef} usando a Venus ✨`
        : "Descobri minha assinatura visual com a Venus ✨",
      `Meu resultado foi: ${data.signatureName || content.main}.`,
      data.shareUrl
        ? `Quer descobrir a sua também? Teste aqui: ${data.shareUrl}`
        : "Quer descobrir a sua também?",
    ];
    return lines.join("\n");
  };

  const handleCopy = async () => {
    const text = data.storeHandle || data.shareUrl
      ? buildOrganicCaption()
      : `${content.title}\n${content.main}\n${content.subtitle}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopyText?.();
    } catch {
      // Silent fail
    }
  };

  const handleShare = async () => {
    if (onShare) {
      onShare();
      return;
    }

    const text = data.storeHandle || data.shareUrl
      ? buildOrganicCaption()
      : `${content.title}\n${content.main}\n${content.subtitle}`;
    if (navigator.share) {
      try {
        await navigator.share({ text, url: data.shareUrl });
        return;
      } catch {
        return;
      }
    }

    await handleCopy();
  };

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#11100d] shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
      <div className="flex aspect-[4/5] flex-col justify-between p-5">
        <div className="flex items-center justify-between gap-3">
          <Sparkles className="h-3 w-3 text-[#C9A84C]" />
          <span className="truncate text-[8px] font-bold uppercase tracking-[0.24em] text-[#C9A84C]">{content.accent}</span>
        </div>

        <div className="space-y-3 text-left">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/42">{content.title}</p>
          <p className="font-serif text-3xl leading-tight text-white">{content.main}</p>
          <p className="text-[13px] leading-relaxed text-white/62">{content.subtitle}</p>
        </div>

        {variant === "palette" && (
          <div className="flex gap-2 pt-1">
            {(data.colors && data.colors.length > 0 ? data.colors : [
              { hex: "#0B0B0B", name: "preto" },
              { hex: "#F3EFE5", name: "off white" },
              { hex: "#6B1F2A", name: "vinho" },
            ]).slice(0, 4).map((color, index) => (
              <div
                key={index}
                className="h-10 w-10 rounded-full border border-white/15"
                style={{ backgroundColor: safeHex(color.hex) }}
                title={color.name}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-white/5 p-3">
        <button
          onClick={handleCopy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] py-2 text-[9px] font-medium uppercase tracking-wider text-white/70 transition-colors hover:bg-white/[0.05]"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
        <button
          onClick={handleShare}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#C9A84C] py-2 text-[9px] font-medium uppercase tracking-wider text-black transition-colors hover:bg-[#C9A84C]/90"
        >
          <Share2 className="h-3 w-3" />
          Compartilhar
        </button>
      </div>
    </div>
  );
}

interface ShareGridProps {
  data: ShareCardData;
  orgId?: string | null;
  resultId?: string | null;
  rewardLabel?: string | null;
}

type ActivationState = "idle" | "confirming" | "unlocked" | "already_shared" | "error";

export function ShareGrid({ data, orgId, resultId, rewardLabel }: ShareGridProps) {
  const [copied, setCopied] = React.useState(false);
  const [activationState, setActivationState] = React.useState<ActivationState>("idle");
  const [confirmError, setConfirmError] = React.useState(false);

  const handle = normalizeHandle(data.storeHandle);
  const storeRef = handle ? `@${handle}` : (data.storeName ? data.storeName : null);

  const organicCaption = [
    storeRef
      ? `Descobri minha assinatura visual com ${storeRef} usando a Venus ✨`
      : "Descobri minha assinatura visual com a Venus ✨",
    `Meu resultado foi: ${data.signatureName || "Assinatura revelada"}.`,
    data.shareUrl
      ? `Quer descobrir a sua também? Teste aqui: ${data.shareUrl}`
      : "Quer descobrir a sua também?",
  ].join("\n");

  const hasReward = Boolean(rewardLabel);
  const canTriggerReward = Boolean(orgId && resultId);

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(organicCaption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Silent fail
    }
  };

  const handleActivationShare = async () => {
    if (activationState === "confirming") return;

    if (navigator.share) {
      try {
        await navigator.share({ text: organicCaption, url: data.shareUrl });
      } catch {
        // User cancelled or share unavailable — still proceed to confirm step
      }
    } else {
      await handleCopyCaption();
    }

    setActivationState("confirming");
  };

  const handleConfirmPosted = async () => {
    setConfirmError(false);
    if (canTriggerReward) {
      try {
        const res = await fetch("/api/result/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            orgId,
            resultId,
            customerKey: resultId,
            platform: "organic_social",
            shareId: `${resultId}:organic_social`,
          }),
        });
        if (res.ok) {
          const payload = (await res.json()) as { granted?: number; duplicates?: number };
          setActivationState(payload.duplicates && payload.duplicates > 0 ? "already_shared" : "unlocked");
        } else {
          setConfirmError(true);
          setActivationState("unlocked");
        }
      } catch {
        setConfirmError(true);
        setActivationState("unlocked");
      }
    } else {
      setActivationState("unlocked");
    }
  };

  const primaryCtaLabel = hasReward
    ? "Postar e desbloquear vantagem"
    : "Compartilhar minha assinatura";

  const sectionTitle = hasReward
    ? "Compartilhe sua assinatura e desbloqueie sua vantagem"
    : "Compartilhe sua assinatura";

  const sectionSubtitle = storeRef
    ? `Poste seu resultado, marque ${storeRef} e convide outras pessoas a descobrirem sua assinatura visual com a Venus.`
    : "Poste seu resultado e convide outras pessoas a descobrirem sua assinatura visual com a Venus.";

  return (
    <div className="space-y-5">
      {/* Activation header */}
      <div className="rounded-[28px] border border-[#C9A84C]/15 bg-[#C9A84C]/[0.04] px-5 py-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#C9A84C]">
          {hasReward ? "Vantagem disponível" : "Motor orgânico"}
        </p>
        <h3 className="mt-2 font-serif text-xl text-white leading-snug">{sectionTitle}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-white/55">{sectionSubtitle}</p>

        {/* Caption preview */}
        <div className="mt-4 rounded-2xl border border-white/8 bg-black/30 px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-white/35 mb-2">Legenda pronta</p>
          <p className="text-[12px] leading-relaxed text-white/72 whitespace-pre-line">{organicCaption}</p>
        </div>

        {/* CTAs */}
        {activationState === "idle" && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => void handleActivationShare()}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#C9A84C] py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-black transition-colors hover:bg-[#C9A84C]/90"
            >
              {hasReward ? <Gift className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
              {primaryCtaLabel}
            </button>
            <button
              onClick={() => void handleCopyCaption()}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-white/70 transition-colors hover:bg-white/[0.06]"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado!" : "Copiar legenda"}
            </button>
          </div>
        )}

        {activationState === "confirming" && (
          <div className="mt-4 space-y-3">
            <p className="text-[13px] text-white/60">
              Já publicou o resultado? Confirme para {hasReward ? "desbloquear sua vantagem" : "registrar o compartilhamento"}.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => void handleConfirmPosted()}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#C9A84C] py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-black transition-colors hover:bg-[#C9A84C]/90"
              >
                <Check className="h-3.5 w-3.5" />
                Já postei
              </button>
              <button
                onClick={() => setActivationState("idle")}
                className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-white/50 transition-colors hover:bg-white/[0.06]"
              >
                Voltar
              </button>
            </div>
          </div>
        )}

        {(activationState === "unlocked" || activationState === "already_shared") && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            <p className="text-[13px] text-emerald-200">
              {activationState === "already_shared"
                ? "Vantagem já registrada. Obrigado por compartilhar novamente!"
                : confirmError
                  ? "Compartilhamento registrado. Não foi possível confirmar sua vantagem agora — a loja vai te contatar."
                  : hasReward
                    ? `Compartilhamento registrado! Sua vantagem da loja está em análise.`
                    : "Compartilhamento registrado. Obrigado por divulgar!"}
            </p>
          </div>
        )}

        {activationState === "error" && (
          <div className="mt-4 rounded-2xl border border-red-500/15 bg-red-500/8 px-4 py-3">
            <p className="text-[13px] text-red-300">Não foi possível registrar agora. Tente novamente.</p>
          </div>
        )}
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SocialShareCard data={data} variant="signature" />
        <SocialShareCard data={data} variant="palette" />
        <SocialShareCard data={data} variant="style_phrase" />
        <SocialShareCard data={data} variant="look" />
      </div>
    </div>
  );
}

interface QuickShareSectionProps {
  signatureName: string;
  signatureSummary?: string;
  storeName?: string;
  onShareWhatsApp?: () => void;
  onSaveImage?: () => void;
}

export function QuickShareSection({ signatureName, signatureSummary, storeName, onShareWhatsApp, onSaveImage }: QuickShareSectionProps) {
  const shareText = `Minha assinatura visual: ${signatureName}

${signatureSummary || "Presença limpa, elegante e sem excesso."}

Descubra a sua em ${storeName || "nossa loja"}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      // Silent fail
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#C9A84C]">COMPARTILHAR SUA ASSINATURA</p>
      </div>

      <div className="grid gap-3">
        <VenusButton
          onClick={onShareWhatsApp}
          className="h-12 text-[10px] tracking-[0.28em]"
        >
          Compartilhar no WhatsApp
        </VenusButton>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] py-3 text-[9px] font-medium uppercase tracking-wider text-white/70 transition-colors hover:bg-white/[0.05]"
          >
            <Copy className="h-3 w-3" />
            Copiar texto
          </button>
          <button
            onClick={onSaveImage}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] py-3 text-[9px] font-medium uppercase tracking-wider text-white/70 transition-colors hover:bg-white/[0.05]"
          >
            <Download className="h-3 w-3" />
            Baixar card
          </button>
        </div>
      </div>
    </div>
  );
}
