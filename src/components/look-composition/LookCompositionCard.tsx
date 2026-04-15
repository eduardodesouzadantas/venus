"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, ShoppingBag, ChevronRight, Check, Eye, Loader2, MessageCircle } from "lucide-react";
import { VenusButton } from "@/components/ui/VenusButton";
import { Text } from "@/components/ui/Text";
import type { LookComposition } from "@/lib/look-composition/engine";
import type { SavedLookComposition } from "@/lib/look-composition/db";
import { LookCompositionWhatsAppModal } from "./LookCompositionWhatsAppModal";
import { useLookCompositionTracking } from "@/hooks/useLookCompositionTracking";

interface LookCompositionCardProps {
  composition: LookComposition | SavedLookComposition;
  userPhotoUrl?: string;
  orgId?: string;
  resultId?: string;
  storeName?: string;
  storePhone?: string;
  customerName?: string;
  resultUrl?: string;
  refCode?: string;
  onTryOn?: (composition: LookComposition | SavedLookComposition) => void;
  onViewDetails?: (composition: LookComposition | SavedLookComposition) => void;
  isGenerating?: boolean;
  generatedImageUrl?: string | null;
}

export function LookCompositionCard({
  composition,
  userPhotoUrl,
  orgId,
  resultId,
  storeName = "Loja",
  storePhone = "",
  customerName,
  resultUrl,
  refCode,
  onTryOn,
  onViewDetails,
  isGenerating,
  generatedImageUrl,
}: LookCompositionCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppMode, setWhatsAppMode] = useState<"purchase" | "share">("purchase");
  
  // Tracking
  const lookId = 'dbId' in composition ? composition.dbId : composition.id;
  const { trackInteraction } = useLookCompositionTracking(lookId);
  
  // Track view on mount
  useEffect(() => {
    trackInteraction("view");
  }, [trackInteraction]);
  
  const totalItems = 1 + composition.supportPieces.length + composition.accessories.length;
  const confidencePercent = Math.round(composition.confidence * 100);
  
  // Verificar se é SavedLookComposition (tem tryonImageUrl)
  const hasGeneratedTryOn = generatedImageUrl || ('tryonImageUrl' in composition && composition.tryonImageUrl);
  const displayImageUrl = generatedImageUrl || ('tryonImageUrl' in composition ? composition.tryonImageUrl : null);
  
  return (
    <div className="rounded-[28px] border border-white/5 bg-white/[0.03] overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-[#D4AF37]" />
              <Text className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">
                Look Completo
              </Text>
            </div>
            <h3 className="mt-1 font-serif text-xl text-white">{composition.name}</h3>
            <p className="mt-1 text-[12px] text-white/50 line-clamp-2">{composition.description}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 rounded-full bg-[#D4AF37]/10 px-2 py-1">
              <Check size={10} className="text-[#D4AF37]" />
              <span className="text-[10px] font-bold text-[#D4AF37]">{confidencePercent}% match</span>
            </div>
            <span className="text-[10px] text-white/40">{totalItems} itens</span>
          </div>
        </div>
      </div>
      
      {/* Visual Grid */}
      <div className="p-5">
        {/* Try-on Generated Image */}
        {displayImageUrl && (
          <div className="mb-4 relative rounded-2xl overflow-hidden aspect-[3/4]">
            <img
              src={displayImageUrl}
              alt="Try-on gerado"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute top-3 left-3">
              <span className="rounded-full bg-[#D4AF37]/20 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[#D4AF37]">
                Seu Look
              </span>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-3 gap-2">
          {/* Anchor Piece - Larger */}
          <div className="col-span-2 row-span-2 relative rounded-2xl overflow-hidden aspect-square">
            <img
              src={composition.anchorPiece.image_url || "/placeholder-product.jpg"}
              alt={composition.anchorPiece.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#D4AF37]">Peça Principal</span>
              <p className="text-[12px] font-medium text-white line-clamp-1">{composition.anchorPiece.name}</p>
            </div>
          </div>
          
          {/* Support Pieces */}
          {composition.supportPieces.slice(0, 2).map((piece, idx) => (
            <div key={piece.id} className="relative rounded-2xl overflow-hidden aspect-square">
              <img
                src={piece.image_url || "/placeholder-product.jpg"}
                alt={piece.name}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2">
                <span className="text-[8px] uppercase tracking-wider text-white/60">Combina</span>
                <p className="text-[10px] text-white line-clamp-1">{piece.name}</p>
              </div>
            </div>
          ))}
          
          {/* Accessories */}
          {composition.accessories.slice(0, 1).map((piece) => (
            <div key={piece.id} className="relative rounded-2xl overflow-hidden aspect-square">
              <img
                src={piece.image_url || "/placeholder-product.jpg"}
                alt={piece.name}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2">
                <span className="text-[8px] uppercase tracking-wider text-white/60">Acessório</span>
                <p className="text-[10px] text-white line-clamp-1">{piece.name}</p>
              </div>
            </div>
          ))}
        </div>
        
        {/* Item List Toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 py-2 text-[10px] uppercase tracking-wider text-white/60 hover:bg-white/10 transition-colors"
        >
          <Eye size={12} />
          {showDetails ? 'Ocultar detalhes' : 'Ver todos os itens'}
          <ChevronRight size={12} className={`transition-transform ${showDetails ? 'rotate-90' : ''}`} />
        </button>
        
        {/* Expanded Details */}
        {showDetails && (
          <div className="mt-3 space-y-2 rounded-xl border border-white/5 bg-black/20 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">Itens do Look</p>
            
            {/* Anchor */}
            <div className="flex items-center gap-3 rounded-lg bg-white/5 p-2">
              <img
                src={composition.anchorPiece.image_url || ""}
                alt=""
                className="h-10 w-10 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-white truncate">{composition.anchorPiece.name}</p>
                <p className="text-[9px] text-white/40">Peça principal</p>
              </div>
            </div>
            
            {/* Supports */}
            {composition.supportPieces.map((piece) => (
              <div key={piece.id} className="flex items-center gap-3 rounded-lg bg-white/5 p-2">
                <img
                  src={piece.image_url || ""}
                  alt=""
                  className="h-10 w-10 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-white truncate">{piece.name}</p>
                  <p className="text-[9px] text-white/40">Combinação</p>
                </div>
              </div>
            ))}
            
            {/* Accessories */}
            {composition.accessories.map((piece) => (
              <div key={piece.id} className="flex items-center gap-3 rounded-lg bg-white/5 p-2">
                <img
                  src={piece.image_url || ""}
                  alt=""
                  className="h-10 w-10 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-white truncate">{piece.name}</p>
                  <p className="text-[9px] text-white/40">Acessório</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="p-5 pt-0">
        <div className="grid grid-cols-2 gap-2">
          <VenusButton
            onClick={() => {
              trackInteraction("tryon_click");
              onTryOn?.(composition);
            }}
            disabled={isGenerating}
            className="h-12 rounded-full bg-[#D4AF37] text-[10px] font-bold uppercase tracking-[0.3em] text-black disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 size={14} className="mr-2 animate-spin" />
            ) : (
              <Sparkles size={14} className="mr-2" />
            )}
            {isGenerating ? 'Gerando...' : 'Experimentar'}
          </VenusButton>
          <VenusButton
            onClick={() => {
              trackInteraction("whatsapp_click", { mode: "purchase" });
              setWhatsAppMode("purchase");
              setShowWhatsAppModal(true);
            }}
            variant="outline"
            className="h-12 rounded-full border-white/10 text-[10px] font-bold uppercase tracking-[0.3em]"
          >
            <MessageCircle size={14} className="mr-2" />
            Quero Esse Look
          </VenusButton>
        </div>
        
        {/* Share button */}
        <button
          onClick={() => {
            setWhatsAppMode("share");
            setShowWhatsAppModal(true);
          }}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] py-3 text-[10px] uppercase tracking-wider text-white/40 hover:bg-white/[0.05] hover:text-white/60 transition-colors"
        >
          <ShoppingBag size={12} />
          Compartilhar look com amigos
        </button>
      </div>
      
      {/* WhatsApp Modal */}
      <LookCompositionWhatsAppModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        look={composition}
        storeName={storeName}
        storePhone={storePhone}
        customerName={customerName}
        resultUrl={resultUrl}
        tryOnImageUrl={generatedImageUrl || undefined}
        refCode={refCode}
        mode={whatsAppMode}
      />
    </div>
  );
}
