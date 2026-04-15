"use client";

import React, { useState, useCallback } from "react";
import { X, MessageCircle, ShoppingBag, Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { VenusButton } from "@/components/ui/VenusButton";
import { Text } from "@/components/ui/Text";
import type { LookComposition } from "@/lib/look-composition/engine";
import type { SavedLookComposition } from "@/lib/look-composition/db";
import {
  generateLookWhatsAppMessage,
  generateLookShareMessage,
  buildWhatsAppUrl,
  openWhatsApp,
} from "@/lib/look-composition/whatsapp";
import { startLookConversation } from "@/lib/look-composition/conversation-starter";

interface LookCompositionWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  look: LookComposition | SavedLookComposition;
  storeName: string;
  storePhone: string;
  customerName?: string;
  customerPhone?: string;
  resultUrl?: string;
  tryOnImageUrl?: string;
  refCode?: string;
  orgId?: string;
  resultId?: string;
  mode?: "purchase" | "share";
}

export function LookCompositionWhatsAppModal({
  isOpen,
  onClose,
  look,
  storeName,
  storePhone,
  customerName,
  customerPhone: initialPhone,
  resultUrl,
  tryOnImageUrl,
  refCode,
  orgId,
  resultId,
  mode = "purchase",
}: LookCompositionWhatsAppModalProps) {
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState(customerName || "");
  const [phone, setPhone] = useState(initialPhone || "");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const message =
    mode === "purchase"
      ? generateLookWhatsAppMessage({
          look,
          customerName: name,
          customerPhone: phone,
          storeName,
          storePhone,
          resultUrl,
          tryOnImageUrl,
        })
      : generateLookShareMessage({
          look,
          storeName,
          refCode,
          resultUrl,
        });

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message]);

  const handleOpenWhatsApp = useCallback(async () => {
    if (mode === "purchase" && orgId) {
      // Usar sistema de conversa inteligente
      setIsSending(true);
      
      const result = await startLookConversation({
        look,
        orgId,
        storeName,
        storePhone,
        customerPhone: phone || storePhone,
        customerName: name,
        resultUrl,
        tryOnImageUrl,
        resultId,
      });
      
      setIsSending(false);
      
      if (result.success) {
        setSent(true);
        // Abrir WhatsApp após 1 segundo
        setTimeout(() => {
          openWhatsApp(storePhone, message);
          onClose();
        }, 1000);
      } else {
        // Fallback: abrir WhatsApp direto
        openWhatsApp(storePhone, message);
        onClose();
      }
    } else {
      // Modo share: abrir direto
      openWhatsApp(storePhone, message);
      onClose();
    }
  }, [storePhone, message, onClose, mode, orgId, look, storeName, phone, name, resultUrl, tryOnImageUrl, resultId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-[32px] border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#25D366]">
              <MessageCircle size={20} />
            </div>
            <div>
              <Text className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#25D366]">
                {mode === "purchase" ? "Comprar Look" : "Compartilhar Look"}
              </Text>
              <h2 className="font-serif text-xl text-white">{look.name}</h2>
            </div>
          </div>
        </div>

        {/* Customer Info (only for purchase mode) */}
        {mode === "purchase" && (
          <div className="mb-4 space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                Seu nome
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como podemos te chamar?"
                className="mt-1 h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#D4AF37]/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                Seu WhatsApp
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="mt-1 h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#D4AF37]/50"
              />
            </div>
          </div>
        )}

        {/* Items Summary */}
        <div className="mb-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <Text className="mb-3 text-[10px] font-bold uppercase tracking-wider text-white/40">
            Itens do Look ({1 + look.supportPieces.length + look.accessories.length})
          </Text>
          
          <div className="space-y-2">
            {/* Anchor */}
            <div className="flex items-center gap-3">
              <img
                src={look.anchorPiece.image_url || ""}
                alt=""
                className="h-10 w-10 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-white truncate">{look.anchorPiece.name}</p>
                <p className="text-[9px] text-[#D4AF37]">Peça principal</p>
              </div>
            </div>
            
            {/* Supports */}
            {look.supportPieces.map((piece) => (
              <div key={piece.id} className="flex items-center gap-3">
                <img
                  src={piece.image_url || ""}
                  alt=""
                  className="h-10 w-10 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-white truncate">{piece.name}</p>
                  <p className="text-[9px] text-white/40">Combinação</p>
                </div>
              </div>
            ))}
            
            {/* Accessories */}
            {look.accessories.map((piece) => (
              <div key={piece.id} className="flex items-center gap-3">
                <img
                  src={piece.image_url || ""}
                  alt=""
                  className="h-10 w-10 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-white truncate">{piece.name}</p>
                  <p className="text-[9px] text-white/40">Acessório</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Message Preview */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-white/40">
              Preview da mensagem
            </Text>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] text-[#D4AF37] hover:text-[#F1D77A] transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <pre className="text-[12px] text-white/70 whitespace-pre-wrap font-sans">
              {message}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <VenusButton
            onClick={handleCopy}
            variant="outline"
            disabled={isSending}
            className="h-12 rounded-full border-white/10 text-[10px] font-bold uppercase tracking-[0.3em]"
          >
            <Copy size={14} className="mr-2" />
            Copiar
          </VenusButton>
          <VenusButton
            onClick={handleOpenWhatsApp}
            disabled={isSending || sent}
            className="h-12 rounded-full bg-[#25D366] text-[10px] font-bold uppercase tracking-[0.3em] text-black hover:bg-[#128C7E] disabled:opacity-50"
          >
            {isSending ? (
              <Loader2 size={14} className="mr-2 animate-spin" />
            ) : sent ? (
              <Check size={14} className="mr-2" />
            ) : (
              <ExternalLink size={14} className="mr-2" />
            )}
            {isSending ? 'Enviando...' : sent ? 'Enviado!' : mode === "purchase" ? "Enviar Pedido" : "Compartilhar"}
          </VenusButton>
        </div>

        {/* Note */}
        <p className="mt-4 text-center text-[10px] text-white/30">
          {mode === "purchase"
            ? "Você será redirecionado para o WhatsApp da loja"
            : "Compartilhe com amigos e ganhe pontos!"}
        </p>
      </div>
    </div>
  );
}
