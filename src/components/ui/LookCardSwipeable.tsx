import * as React from "react";
import { LookData, LookItem } from "@/types/result";
import { Heading } from "./Heading";
import { Text } from "./Text";
import { VenusButton } from "./VenusButton";
import { ShoppingBag, ChevronRight, Info, Search, Sparkles, TrendingUp, Star } from "lucide-react";
import { ProductModal } from "./ProductModal";
import { TryOnModal } from "./TryOnModal";
import { LookSelectionModal } from "./LookSelectionModal";
import { trackBehavior } from "@/lib/analytics/tracker";
import { PriceAnchoring } from "./PriceAnchoring";
import type { AIRecommendation } from "@/lib/ai/orchestrator";

export function LookCardSwipeable({
  look,
  strategy,
  intensity,
}: {
  look: LookData;
  strategy?: AIRecommendation["strategy"];
  intensity?: "LOW" | "MEDIUM" | "HIGH";
}) {
  type SelectedProduct = LookItem & {
    price?: string;
    rationale?: string;
  };

  const [selectedProduct, setSelectedProduct] = React.useState<SelectedProduct | null>(null);
  const [selectedLookForPurchase, setSelectedLookForPurchase] = React.useState<LookData | null>(null);
  const [isTryOnOpen, setIsTryOnOpen] = React.useState(false);

  React.useEffect(() => {
    trackBehavior(look.id, "view", "look");
  }, [look.id]);

  // Curated fallback prices and rationales when the catalog is sparse.
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
    });
  };

  return (
    <>
      <div className="relative flex w-[88vw] max-w-[360px] flex-shrink-0 snap-center flex-col overflow-hidden rounded-[40px] border border-white/5 bg-[#111111] pb-8 shadow-2xl">
        <div
          className="group relative aspect-[4/5] w-full cursor-pointer overflow-hidden bg-[#0A0A0A] transition-transform duration-300 active:scale-[0.98]"
          onClick={handleOpenMainLook}
        >
          {look.items?.[0]?.photoUrl ? (
            <img
              src={look.items[0].photoUrl}
              alt={look.name}
              className="absolute inset-0 h-full w-full object-cover opacity-80 transition-all duration-700 group-hover:scale-105 group-hover:opacity-100"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center font-serif text-5xl italic uppercase tracking-tighter text-white/5">
              {look.name.split(" ")[0]}
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/30 to-transparent" />

          <div className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white/50 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
            <Search size={16} />
          </div>

          <div className="absolute left-6 top-6 flex flex-col gap-2">
            {look.isDailyPick && (
              <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                <Star size={10} />
                Escolha da curadoria
              </div>
            )}
            {look.popularityRank && look.popularityRank <= 3 && (
              <div className="flex items-center gap-1.5 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/20 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-[#D4AF37] backdrop-blur-md">
                <TrendingUp size={10} />
                Mais coerente
              </div>
            )}
            <div className="rounded-full bg-[#D4AF37] px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-black">
              {look.type || "Look curado"}
            </div>
          </div>

          <div className="absolute bottom-12 left-8 right-8 space-y-3">
            <Heading as="h3" className="text-2xl leading-tight tracking-tight transition-colors group-hover:text-[#D4AF37]">
              {look.items[0]?.premiumTitle || look.name}
            </Heading>
            <div className="flex items-start gap-2">
              <Info className="mt-1 h-3 w-3 flex-shrink-0 text-[#D4AF37]" />
              <Text className="line-clamp-2 text-xs leading-relaxed italic text-white/60">{look.intention}</Text>
            </div>
          </div>

          <div className="absolute bottom-4 left-8">
            <button
              onClick={(e) => {
                e.stopPropagation();
                trackBehavior(look.id, "view", "look");
                setIsTryOnOpen(true);
              }}
              className="flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 transition-all active:scale-95 backdrop-blur-md group/tryon"
            >
              <Sparkles className="h-3 w-3 text-[#D4AF37] group-hover/tryon:animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Ver no corpo</span>
            </button>
          </div>
        </div>

        <div className="px-8 pb-4 pt-6">
          <Text className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]">Por que faz sentido</Text>
          <Text className="text-xs leading-relaxed text-white/70">
            {look.explanation || "Essa composição usa contraste seletivo e peças complementares para deixar a leitura mais clara, pessoal e fácil de usar."}
          </Text>
        </div>

        <div className="mt-4 flex-1 space-y-5 px-8">
          <div className="space-y-4">
            {look.items.map((item) => (
              <div key={item.id} className="group/item flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-12 w-12 flex-shrink-0 cursor-pointer overflow-hidden rounded-xl border border-white/5 bg-white/5 shadow-lg shadow-[#D4AF37]/20 transition-all hover:scale-110 active:scale-95 hover:shadow-[#D4AF37]/30"
                    onClick={() => handleOpenProduct(item)}
                  >
                    <img
                      src={item.photoUrl || "https://images.unsplash.com/photo-1544441893-675973e31d85?q=80&w=200&auto=format"}
                      alt={item.name}
                      className="h-full w-full object-cover grayscale transition-all group-hover/item:grayscale-0"
                    />
                  </div>
                  <div className="flex flex-col">
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="text-[9px] font-medium uppercase tracking-widest text-white/30">{item.brand}</span>
                      {item.isBestseller && (
                        <span className="rounded-sm bg-white/10 px-1 py-0.5 text-[7px] font-bold text-[#D4AF37]">BEST SELLER</span>
                      )}
                    </div>
                    <span className="max-w-[140px] truncate text-[11px] font-medium text-white/80">{item.name}</span>
                    <span className="mt-0.5 font-serif text-[10px] text-[#D4AF37]">{mockPrices[item.id] || mockPrices.default}</span>
                  </div>
                </div>
                <button
                  onClick={() => trackBehavior(item.id, "add", "product")}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 transition-all hover:border-[#D4AF37] hover:bg-[#D4AF37] hover:text-black"
                >
                  <ShoppingBag className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {look.accessories.length > 0 && (
            <div className="border-t border-white/[0.03] pt-4">
              <Text className="text-[10px] italic text-white/40">Finalizado com: {look.accessories.join(" • ")}</Text>
            </div>
          )}

          {strategy?.urgency && (
            <div className="mx-6 mt-4 flex items-center gap-3 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/10 p-4 animate-in slide-in-from-top-2">
              <TrendingUp size={14} className="text-[#D4AF37]" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#D4AF37] leading-none">{strategy.urgency}</span>
            </div>
          )}

          <div className="mx-6 mt-4">
            <PriceAnchoring items={look.items.map((item) => ({ price: mockPrices[item.id] || "R$ 1.000" }))} label={`Investimento ${look.name}`} />

            <div className="mt-4">
              <VenusButton
                variant="solid"
                onClick={() => {
                  trackBehavior(look.id, "complete_look", "look");
                  setSelectedLookForPurchase(look);
                }}
                className={`w-full h-auto border-none bg-gradient-to-r from-[#D4AF37] to-[#F1D57F] py-6 text-[11px] font-bold uppercase tracking-[0.4em] text-black shadow-[0_15px_40px_rgba(212,175,55,0.2)] group/btn ${intensity === "HIGH" ? "animate-pulse" : ""}`}
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

      <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />

      <TryOnModal isOpen={isTryOnOpen} onClose={() => setIsTryOnOpen(false)} imageUrl={look.items[0]?.photoUrl} name={look.name} />

      <LookSelectionModal look={selectedLookForPurchase} onClose={() => setSelectedLookForPurchase(null)} />
    </>
  );
}
