import * as React from "react";
import { ChevronRight, Info, Search, ShoppingBag, Sparkles, Star, TrendingUp } from "lucide-react";
import { LookData, LookItem } from "@/types/result";
import { Heading } from "./Heading";
import { Text } from "./Text";
import { VenusButton } from "./VenusButton";
import { ProductModal } from "./ProductModal";
import { TryOnModal } from "./TryOnModal";
import { LookSelectionModal } from "./LookSelectionModal";
import { trackBehavior } from "@/lib/analytics/tracker";
import { PriceAnchoring } from "./PriceAnchoring";
import type { AIRecommendation } from "@/lib/ai/orchestrator";

type SelectedProduct = LookItem & {
  price?: string;
  rationale?: string;
};

export function LookCardSwipeable({
  look,
  strategy,
  intensity,
}: {
  look: LookData;
  strategy?: AIRecommendation["strategy"];
  intensity?: "LOW" | "MEDIUM" | "HIGH";
}) {
  const [selectedProduct, setSelectedProduct] = React.useState<SelectedProduct | null>(null);
  const [selectedLookForPurchase, setSelectedLookForPurchase] = React.useState<LookData | null>(null);
  const [isTryOnOpen, setIsTryOnOpen] = React.useState(false);

  React.useEffect(() => {
    trackBehavior(look.id, "view", "look");
  }, [look.id]);

  const mockPrices: Record<string, string> = {
    "1": "R$ 890",
    "2": "R$ 1.250",
    "3": "R$ 540",
    "4": "R$ 780",
    default: "R$ ---",
  };

  const mockRationales: Record<string, string> = {
    "1": "A peça segura a base do look e deixa a leitura mais clara.",
    "2": "A combinação sobe a presença sem perder controle visual.",
    default: "A peça foi escolhida por coerência com o seu perfil e com a leitura geral do look.",
  };

  const handleOpenProduct = (item: LookItem) => {
    trackBehavior(item.id, "click", "product");
    setSelectedProduct({
      ...item,
      price: mockPrices[item.id] || mockPrices.default,
      rationale: mockRationales[item.id] || mockRationales.default,
    });
  };

  const handleOpenMainLook = () => {
    trackBehavior(look.id, "click", "look");
    setSelectedProduct({
      id: look.id,
      name: look.name,
      brand: "Venus Curation",
      photoUrl: look.items?.[0]?.photoUrl || "https://images.unsplash.com/photo-1544441893-675973e31d85?q=80&w=600&auto=format",
      price: "Acervo Completo",
      rationale: look.explanation || look.intention,
      conversionCopy: look.explanation || look.intention,
    } as SelectedProduct);
  };

  const primaryJustification = [
    look.items[0]?.role,
    look.items[0]?.direction,
    look.items[0]?.bodyEffect,
    look.items[0]?.faceEffect,
  ]
    .filter(Boolean)
    .slice(0, 3)
    .join(" • ");

  return (
    <>
      <div className="relative flex w-[92vw] max-w-[420px] flex-shrink-0 snap-center flex-col overflow-hidden rounded-[34px] border border-white/5 bg-slate-950 pb-7 shadow-2xl sm:w-[86vw] sm:max-w-[540px] sm:rounded-[42px] sm:pb-8">
        <button
          type="button"
          className="group relative aspect-[3/4] w-full overflow-hidden bg-[#0A0A0A] transition-transform duration-300 active:scale-[0.98] sm:aspect-[4/5]"
          onClick={handleOpenMainLook}
        >
          {look.items?.[0]?.photoUrl ? (
            <img
              src={look.items[0].photoUrl}
              alt={look.name}
              className="absolute inset-0 h-full w-full object-cover opacity-88 transition-all duration-700 group-hover:scale-105 group-hover:opacity-100"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center font-serif text-5xl italic uppercase tracking-tighter text-white/5">
              {look.name.split(" ")[0]}
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/28 to-transparent" />

          <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/50 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 sm:right-6 sm:top-6 sm:h-10 sm:w-10">
            <Search size={16} />
          </div>

          <div className="absolute left-4 top-4 flex flex-col gap-1.5 sm:left-6 sm:top-6 sm:gap-2">
            {look.isDailyPick && (
              <div className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[8px] font-bold uppercase tracking-widest text-black shadow-[0_0_20px_rgba(255,255,255,0.4)] sm:px-3 sm:text-[9px]">
                <Star size={10} />
                Escolha da curadoria
              </div>
            )}
            {look.popularityRank && look.popularityRank <= 3 && (
              <div className="flex items-center gap-1.5 rounded-full border border-slate-300/25 bg-slate-300/12 px-2.5 py-1 text-[8px] font-bold uppercase tracking-widest text-slate-200 backdrop-blur-md sm:px-3 sm:text-[9px]">
                <TrendingUp size={10} />
                Mais coerente
              </div>
            )}
            <div className="rounded-full bg-slate-200 px-2.5 py-1 text-[8px] font-bold uppercase tracking-widest text-black sm:px-3 sm:text-[9px]">
              {look.type || "Look curado"}
            </div>
          </div>

          <div className="absolute bottom-12 left-5 right-5 space-y-2 sm:bottom-14 sm:left-8 sm:right-8 sm:space-y-3">
            <Heading
              as="h3"
              className="max-w-[11ch] text-[1.95rem] leading-[0.96] tracking-tight transition-colors group-hover:text-slate-200 sm:max-w-[13ch] sm:text-[2.35rem]"
            >
              {look.items[0]?.premiumTitle || look.name}
            </Heading>
            <div className="flex items-start gap-2">
              <Info className="mt-1 h-3 w-3 flex-shrink-0 text-slate-300" />
              <Text className="line-clamp-2 max-w-[28ch] text-[12px] leading-relaxed italic text-white/60 sm:max-w-none sm:text-[13px]">
                {look.intention}
              </Text>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 sm:left-8">
            <span className="group/tryon flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-2.5 py-1.5 backdrop-blur-md transition-all active:scale-95 sm:px-3">
              <Sparkles className="h-3 w-3 text-slate-300 group-hover/tryon:animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/80 sm:text-[10px]">Ver no corpo</span>
            </span>
          </div>
        </button>

        <div className="px-6 pb-3 pt-5 sm:px-8 sm:pb-4 sm:pt-6">
          <Text className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-300 sm:mb-3 sm:text-[10px]">Leitura rápida</Text>
          <Text className="line-clamp-1 max-w-[34ch] text-[12px] leading-relaxed text-white/70 sm:line-clamp-2 sm:max-w-none sm:text-[13px]">
            {look.explanation || "Essa composição usa contraste seletivo e peças complementares para deixar a leitura mais clara, pessoal e fácil de usar."}
          </Text>
          <div className="mt-3 hidden rounded-[18px] border border-white/5 bg-black/20 px-3 py-2 sm:block">
            <Text className="text-[8px] font-bold uppercase tracking-[0.25em] text-white/35">Por que acerta em você</Text>
            <Text className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/68">
              {primaryJustification || look.items[0]?.authorityRationale || "Ela equilibra sua presença, respeita sua linha e melhora a leitura do corpo sem esforço."}
            </Text>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              look.items[0]?.role || "Base visual",
              look.items[0]?.impactLine || "Presença que aparece",
              look.items[0]?.socialEffect || "Pronto para postar",
            ]
              .filter(Boolean)
              .slice(0, 3)
              .map((cue) => (
                <span
                  key={cue}
                  className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[8px] font-bold uppercase tracking-[0.22em] text-white/58"
                >
                  {cue}
                </span>
              ))}
          </div>
        </div>

        <div className="mt-3 flex-1 space-y-4 px-5 sm:mt-4 sm:space-y-5 sm:px-8">
          <div className="space-y-3 sm:space-y-4">
            {look.items.map((item) => (
              <div key={item.id} className="group/item flex items-start justify-between gap-3 rounded-[24px] border border-white/5 bg-white/[0.02] p-2.5 sm:gap-4 sm:rounded-[28px] sm:p-3">
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                  <button
                    type="button"
                    className="flex h-[6.5rem] w-[6.5rem] flex-shrink-0 cursor-pointer overflow-hidden rounded-[18px] border border-white/5 bg-white/5 shadow-lg shadow-slate-900/20 transition-all hover:scale-[1.04] active:scale-95 hover:shadow-slate-900/30 sm:h-32 sm:w-32"
                    onClick={() => handleOpenProduct(item)}
                  >
                    <img
                      src={item.photoUrl || "https://images.unsplash.com/photo-1544441893-675973e31d85?q=80&w=200&auto=format"}
                      alt={item.name}
                      className="h-full w-full object-cover object-center grayscale transition-all group-hover/item:grayscale-0"
                    />
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col pt-1">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="text-[8px] font-medium uppercase tracking-widest text-white/30 sm:text-[9px]">{item.brand}</span>
                      {item.isBestseller && (
                        <span className="rounded-sm bg-white/10 px-1 py-0.5 text-[7px] font-bold text-slate-200">BEST SELLER</span>
                      )}
                      {item.role && (
                        <span className="rounded-sm border border-slate-300/20 bg-slate-300/10 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.18em] text-slate-200">
                          {item.role}
                        </span>
                      )}
                    </div>
                    <span className="max-w-[180px] truncate text-[11px] font-medium text-white/88 sm:max-w-[240px] sm:text-[12px]">{item.name}</span>
                    <span className="mt-1 hidden max-w-[26ch] text-[10px] leading-relaxed text-white/45 sm:block sm:text-[11px]">
                      {item.conversionCopy || item.authorityRationale || item.functionalBenefit || "Peça lida pelo stylist para compor a proposta com coerência."}
                    </span>
                    <span className="mt-2 font-serif text-[10px] text-slate-200 sm:text-[11px]">{mockPrices[item.id] || mockPrices.default}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    trackBehavior(item.id, "add", "product");
                    handleOpenProduct(item);
                  }}
                  className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/10 transition-all hover:border-slate-200 hover:bg-slate-200 hover:text-black"
                >
                  <ShoppingBag className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {look.accessories.length > 0 && (
            <div className="border-t border-white/[0.03] pt-4">
              <Text className="text-[9px] italic text-white/40 sm:text-[10px]">Finalizado com: {look.accessories.join(" • ")}</Text>
            </div>
          )}

          {strategy?.urgency && (
            <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-slate-300/20 bg-slate-300/10 p-3 animate-in slide-in-from-top-2 sm:mx-6 sm:mt-4 sm:p-4">
              <TrendingUp size={14} className="text-slate-200" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-200 leading-none">{strategy.urgency}</span>
            </div>
          )}

          <div className="mx-4 mt-3 sm:mx-6 sm:mt-4">
            <PriceAnchoring items={look.items.map((item) => ({ price: mockPrices[item.id] || "R$ 1.000" }))} label={`Investimento ${look.name}`} />

            <div className="mt-3 sm:mt-4">
              <VenusButton
                variant="solid"
                onClick={() => {
                  trackBehavior(look.id, "complete_look", "look");
                  setSelectedLookForPurchase(look);
                }}
                className={`group/btn h-auto w-full border-none bg-gradient-to-r from-[#D4AF37] to-[#F1D57F] py-5 text-[10px] font-bold uppercase tracking-[0.3em] text-black shadow-[0_15px_40px_rgba(212,175,55,0.2)] sm:py-6 sm:text-[11px] sm:tracking-[0.4em] ${intensity === "HIGH" ? "animate-pulse" : ""}`}
              >
                <span className="flex items-center justify-center gap-2">
                  {strategy?.cta || "Ver look completo"}
                  <ChevronRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-1" />
                </span>
              </VenusButton>
            </div>
          </div>
        </div>

        <div className="mt-5 hidden px-8">
          <VenusButton variant="outline" className="h-auto w-full py-4 text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 hover:opacity-100">
            Personalizar look
          </VenusButton>
        </div>
      </div>

      <ProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onRequestFullLook={() => {
          setSelectedProduct(null);
          setSelectedLookForPurchase(look);
        }}
      />

      <TryOnModal
        isOpen={isTryOnOpen}
        onClose={() => setIsTryOnOpen(false)}
        imageUrl={look.items[0]?.photoUrl}
        name={look.name}
        brandName={look.items[0]?.brand || "Venus Engine"}
        appName="InovaCortex"
        lookDescription={look.explanation || look.intention}
      />

      <LookSelectionModal
        look={selectedLookForPurchase}
        onClose={() => setSelectedLookForPurchase(null)}
        onSelectItem={(item) => {
          setSelectedLookForPurchase(null);
          handleOpenProduct(item);
        }}
      />
    </>
  );
}
