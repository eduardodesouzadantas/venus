"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { Text } from "@/components/ui/Text";
import { LookCompositionCard } from "./LookCompositionCard";
import type { LookComposition, CompositionInput } from "@/lib/look-composition/engine";

interface LookCompositionGalleryProps {
  orgId: string;
  userPhotoUrl?: string;
  styleDirection?: string;
  imageGoal?: string;
  bodyFit?: string;
  colorContrast?: string;
  essenceLabel?: string;
  paletteFamily?: string;
  storeName?: string;
  storePhone?: string;
  customerName?: string;
  resultUrl?: string;
  refCode?: string;
  onTryOnStart?: (composition: LookComposition) => void;
}

export function LookCompositionGallery({
  orgId,
  userPhotoUrl,
  styleDirection,
  imageGoal,
  bodyFit,
  colorContrast,
  essenceLabel,
  paletteFamily,
  storeName,
  storePhone,
  customerName,
  resultUrl,
  refCode,
  onTryOnStart,
}: LookCompositionGalleryProps) {
  const [compositions, setCompositions] = useState<LookComposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCompositions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params: CompositionInput = {
        orgId,
        userPhotoUrl,
        styleDirection,
        imageGoal,
        bodyFit,
        colorContrast,
        essenceLabel,
        paletteFamily,
      };
      
      const response = await fetch('/api/look-composition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        throw new Error('Failed to load compositions');
      }
      
      const data = await response.json();
      setCompositions(data.compositions || []);
    } catch (err) {
      console.error('Error loading compositions:', err);
      setError('Não foi possível carregar os looks. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [orgId, userPhotoUrl, styleDirection, imageGoal, bodyFit, colorContrast, essenceLabel, paletteFamily]);

  useEffect(() => {
    loadCompositions();
  }, [loadCompositions]);

  const handleTryOn = useCallback(async (composition: LookComposition) => {
    setGeneratingId(composition.id);
    
    try {
      // Chamar callback se existir
      if (onTryOnStart) {
        onTryOnStart(composition);
      }
      
      // Aqui você integraria com o useTryOn existente
      // Por enquanto, apenas simulamos
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (err) {
      console.error('Error generating try-on:', err);
    } finally {
      setGeneratingId(null);
    }
  }, [onTryOnStart]);

  const handleViewDetails = useCallback((composition: LookComposition) => {
    // Abrir modal ou navegar para página de detalhes
    console.log('View details:', composition);
  }, []);

  if (loading) {
    return (
      <div className="rounded-[28px] border border-white/5 bg-white/[0.03] p-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 size={32} className="animate-spin text-[#D4AF37]" />
          <Text className="text-[12px] text-white/60">Venus está montando looks exclusivos do seu catálogo...</Text>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[28px] border border-white/5 bg-white/[0.03] p-8 text-center">
        <Text className="text-[14px] text-white/60">{error}</Text>
        <button
          onClick={loadCompositions}
          className="mt-4 flex items-center gap-2 rounded-full bg-[#D4AF37]/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors"
        >
          <RefreshCw size={12} />
          Tentar novamente
        </button>
      </div>
    );
  }

  if (compositions.length === 0) {
    return (
      <div className="rounded-[28px] border border-white/5 bg-white/[0.03] p-8 text-center">
        <Sparkles size={32} className="mx-auto mb-4 text-[#D4AF37]/50" />
        <Text className="text-[14px] text-white/60">
          Ainda não há produtos suficientes no catálogo para montar looks completos.
        </Text>
        <Text className="mt-2 text-[12px] text-white/40">
          Adicione mais peças ao catálogo para liberar essa funcionalidade.
        </Text>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#D4AF37]" />
            <Text className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">
              Looks Completos
            </Text>
          </div>
          <h2 className="mt-1 font-serif text-2xl text-white">
            Combinações do Seu Catálogo
          </h2>
          <p className="mt-1 text-[13px] text-white/50">
            {compositions.length} looks montados especialmente para você
          </p>
        </div>
        <button
          onClick={loadCompositions}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white/60 hover:bg-white/10 transition-colors"
        >
          <RefreshCw size={12} />
          Atualizar
        </button>
      </div>

      {/* Compositions Grid */}
      <div className="grid gap-4">
        {compositions.map((composition) => (
          <LookCompositionCard
            key={composition.id}
            composition={composition}
            userPhotoUrl={userPhotoUrl}
            orgId={orgId}
            storeName={storeName}
            storePhone={storePhone}
            customerName={customerName}
            resultUrl={resultUrl}
            refCode={refCode}
            onTryOn={handleTryOn}
            onViewDetails={handleViewDetails}
            isGenerating={generatingId === composition.id}
          />
        ))}
      </div>

      {/* Footer Note */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        <p className="text-[11px] text-white/40 text-center">
          Looks montados automaticamente com produtos do catálogo da loja. 
          Clique em "Experimentar" para ver como ficaria em você.
        </p>
      </div>
    </div>
  );
}
