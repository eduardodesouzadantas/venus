"use client";

import { Sparkles } from "lucide-react";
import { AssistedRecommendationSurface } from "@/components/catalog/AssistedRecommendationSurface";
import { LookCompositionCard } from "@/components/look-composition/LookCompositionCard";
import { VenusButton } from "@/components/ui/VenusButton";
import type { AssistedRecommendationSurface as AssistedRecommendationSurfaceModel } from "@/lib/catalog-query/presentation";
import type { LookComposition } from "@/lib/look-composition/engine";
import type { SavedLookComposition } from "@/lib/look-composition/db";
import type { FollowUpSuggestion } from "@/lib/whatsapp/look-followup";

type PremiumFallbackSurfaceProps = {
  transitionMessage: string;
  refinementMessage: string;
  presentation: AssistedRecommendationSurfaceModel;
  suggestions: FollowUpSuggestion[];
  orgId: string;
  userPhotoUrl?: string;
  storeName?: string;
  storePhone?: string;
  customerName?: string;
  resultUrl?: string;
  refCode?: string;
  onTryOnStart?: (composition: LookComposition | SavedLookComposition) => void;
  onMoreOptions?: () => void;
  onTalkToVenus?: () => void;
  onSaveLook?: () => void;
};

export function PremiumFallbackSurface({
  transitionMessage,
  refinementMessage,
  presentation,
  suggestions,
  orgId,
  userPhotoUrl,
  storeName,
  storePhone,
  customerName,
  resultUrl,
  refCode,
  onTryOnStart,
  onMoreOptions,
  onTalkToVenus,
  onSaveLook,
}: PremiumFallbackSurfaceProps) {
  const lookSuggestions = suggestions
    .map((suggestion) => suggestion.look)
    .filter((look): look is LookComposition => Boolean(look))
    .slice(0, 3);

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-[#C9A84C]/16 bg-[#C9A84C]/8 p-5 text-left shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
        <div className="flex items-center gap-2 text-[#C9A84C]">
          <Sparkles className="h-4 w-4" />
          <p className="text-[10px] font-bold uppercase tracking-[0.32em]">Curadoria em andamento</p>
        </div>
        <h2 className="mt-3 font-serif text-2xl text-white">
          Você já saiu do loading. Agora está em curadoria.
        </h2>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-white/72">
          {transitionMessage}
        </p>
        <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-white/50">
          {refinementMessage}
        </p>
      </div>

      <AssistedRecommendationSurface
        surface={presentation}
        onMoreOptions={onMoreOptions}
        onTalkToVenus={onTalkToVenus}
        onSaveLook={onSaveLook}
      />

      {lookSuggestions.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-[#C9A84C]">Looks da loja</p>
              <h3 className="mt-1 font-serif text-xl text-white">
                2 a 3 caminhos que continuam vendáveis
              </h3>
            </div>
            <VenusButton
              onClick={onMoreOptions}
              className="h-10 px-4 text-[9px] tracking-[0.28em]"
            >
              Ver mais opções
            </VenusButton>
          </div>

          <div className="space-y-4">
            {lookSuggestions.map((composition) => (
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
                onTryOn={onTryOnStart}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
