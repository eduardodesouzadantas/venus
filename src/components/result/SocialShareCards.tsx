"use client";

import React from "react";
import { Copy, Download, Share2, Sparkles, Check } from "lucide-react";
import { VenusButton } from "@/components/ui/VenusButton";

interface ShareCardData {
  signatureName: string;
  signatureSummary?: string;
  palette?: string[];
  colors?: { hex: string; name: string }[];
  storeName?: string;
  lookName?: string;
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${content.title}\n${content.main}\n${content.subtitle}`);
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

    const text = `${content.title}\n${content.main}\n${content.subtitle}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
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
}

export function ShareGrid({ data }: ShareGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <SocialShareCard data={data} variant="signature" />
      <SocialShareCard data={data} variant="palette" />
      <SocialShareCard data={data} variant="style_phrase" />
      <SocialShareCard data={data} variant="look" />
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
