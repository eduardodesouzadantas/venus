import * as React from "react";
import { LookData, LookItem } from "@/types/result";
import { Heading } from "./Heading";
import { Text } from "./Text";
import { VenusButton } from "./VenusButton";
import { ShoppingBag, ChevronRight, Info, Search, PackageCheck, Sparkles, TrendingUp, Star } from "lucide-react";
import { ProductModal } from "./ProductModal";
import { TryOnModal } from "./TryOnModal";
import { LookSelectionModal } from "./LookSelectionModal";
import { trackBehavior } from "@/lib/analytics/tracker";
import { PriceAnchoring } from "./PriceAnchoring";

export function LookCardSwipeable({ 
  look, 
  strategy, 
  intensity 
}: { 
  look: LookData, 
  strategy?: any, 
  intensity?: 'LOW' | 'MEDIUM' | 'HIGH' 
}) {
  const [selectedProduct, setSelectedProduct] = React.useState<any | null>(null);
  const [selectedLookForPurchase, setSelectedLookForPurchase] = React.useState<LookData | null>(null);
  const [isTryOnOpen, setIsTryOnOpen] = React.useState(false);

  // Behavior Tracking
  React.useEffect(() => {
    trackBehavior(look.id, 'view', 'look');
  }, [look.id]);

  // Aspirational Mock Prices & Rationales if not in DB
  const mockPrices: Record<string, string> = {
    "1": "R$ 890",
    "2": "R$ 1.250",
    "3": "R$ 540",
    "4": "R$ 780",
    "default": "R$ ---"
  };

  const mockRationales: Record<string, string> = {
    "1": "O blazer estruturado é a âncora visual deste look, proporcionando uma silhueta inabalável e profissional.",
    "2": "A seda italiana oferece um contraste de textura que suaviza a autoridade, tornando-a mais acessível e sofisticada.",
    "default": "Esta peça foi selecionada por sua precisão geométrica e paleta alinhada ao seu diagnóstico visual."
  };

  const handleOpenProduct = (item: LookItem) => {
    trackBehavior(item.id, 'click', 'product');
    setSelectedProduct({
      ...item,
      price: mockPrices[item.id] || mockPrices.default,
      rationale: mockRationales[item.id] || mockRationales.default
    });
  };

  const handleOpenMainLook = () => {
    trackBehavior(look.id, 'click', 'look');
    // If the main look can be treated as a product ensemble
    setSelectedProduct({
       id: look.id,
       name: look.name,
       brand: "Venus Curation",
       photoUrl: look.items?.[0]?.photoUrl || "https://images.unsplash.com/photo-1544441893-675973e31d85?q=80&w=600&auto=format",
       price: "Acervo Completo",
       rationale: look.explanation || look.intention
    });
  };

  // Calculate full look total price (mock)
  const totalPrice = look.items.reduce((acc, item) => {
     const priceStr = mockPrices[item.id] || "R$ 1.000";
     const priceNum = parseInt(priceStr.replace(/[^0-9]/g, ""));
     return acc + priceNum;
  }, 450); // Small premium addition for accessories

  return (
    <>
      <div className="flex-shrink-0 w-[88vw] max-w-[360px] snap-center rounded-[40px] overflow-hidden border border-white/5 bg-[#111111] relative flex flex-col pb-8 shadow-2xl">
        
        {/* Editorial Banner - CLICKABLE */}
        <div 
          className="relative w-full aspect-[4/5] bg-[#0A0A0A] overflow-hidden group cursor-pointer active:scale-[0.98] transition-transform duration-300"
          onClick={handleOpenMainLook}
        >
          {look.items?.[0]?.photoUrl ? (
            <img 
               src={look.items[0].photoUrl} 
               alt={look.name} 
               className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 group-hover:opacity-100 transition-all duration-700" 
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/5 font-serif text-5xl italic uppercase tracking-tighter">
              {look.name.split(' ')[0]}
            </div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/30 to-transparent" />
          
          {/* Interaction Hint */}
          <div className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/50 opacity-0 group-hover:opacity-100 transition-opacity">
             <Search size={16} />
          </div>

          <div className="absolute top-6 left-6 flex flex-col gap-2">
              {look.isDailyPick && (
                <div className="px-3 py-1 rounded-full bg-white text-black text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_20px_rgba(255,255,255,0.4)] animate-pulse">
                   <Star size={10} /> ESCOLHA DO DIA
                </div>
              )}
              {look.popularityRank && look.popularityRank <= 3 && (
                <div className="px-3 py-1 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 backdrop-blur-md text-[#D4AF37] text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                   <TrendingUp size={10} /> EM ALTA HOJE
                </div>
              )}
              <div className="px-3 py-1 rounded-full bg-[#D4AF37] text-black text-[9px] font-bold uppercase tracking-widest">
                 {look.type || "Premium"}
              </div>
          </div>

          <div className="absolute bottom-12 left-8 right-8 space-y-3">
            <Heading as="h3" className="text-2xl tracking-tight leading-tight group-hover:text-[#D4AF37] transition-colors">
              {look.items[0]?.premiumTitle || look.name}
            </Heading>
            <div className="flex items-start gap-2">
               <Info className="w-3 h-3 text-[#D4AF37] mt-1 flex-shrink-0" />
               <Text className="text-white/60 text-xs leading-relaxed italic line-clamp-2">{look.intention}</Text>
            </div>
          </div>
          
          {/* VIRTUAL TRY ON CTA overlay */}
          <div className="absolute bottom-4 left-8">
             <button 
                onClick={(e) => { e.stopPropagation(); trackBehavior(look.id, 'view', 'look'); setIsTryOnOpen(true); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 active:scale-95 transition-all group/tryon"
             >
                <Sparkles className="w-3 h-3 text-[#D4AF37] group-hover/tryon:animate-pulse" />
                <span className="text-[10px] text-white/80 font-bold uppercase tracking-widest">Ver em mim</span>
             </button>
          </div>
        </div>

        {/* Rationale: Por que funciona? */}
        <div className="px-8 pt-6 pb-4">
          <Text className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold mb-3">A Lógica da Autoridade</Text>
          <Text className="text-xs text-white/70 leading-relaxed">
            {look.explanation || "Essa composição utiliza o contraste seletivo para destacar sua silhueta, garantindo que sua comunicação visual seja focada e poderosa."}
          </Text>
        </div>

        {/* Product Integration List */}
        <div className="px-8 flex-1 space-y-5 mt-4">
          <div className="space-y-4">
             {look.items.map((item, i) => (
               <div key={item.id} className="flex items-center justify-between group/item">
                  <div className="flex items-center gap-4">
                     {/* Product Image - CLICKABLE */}
                     <div 
                        className="w-12 h-12 rounded-xl bg-white/5 overflow-hidden flex-shrink-0 border border-white/5 cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-lg hover:shadow-[#D4AF37]/20"
                        onClick={() => handleOpenProduct(item)}
                     >
                        <img src={item.photoUrl || "https://images.unsplash.com/photo-1544441893-675973e31d85?q=80&w=200&auto=format"} alt={item.name} className="w-full h-full object-cover grayscale group-hover/item:grayscale-0 transition-all" />
                     </div>
                     <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-0.5">
                           <span className="text-[9px] uppercase tracking-widest text-white/30 font-medium">{item.brand}</span>
                           {item.isBestseller && (
                              <span className="text-[7px] px-1 py-0.5 rounded-sm bg-white/10 text-[#D4AF37] font-bold">BEST SELLER</span>
                           )}
                        </div>
                        <span className="text-[11px] text-white/80 font-medium truncate max-w-[140px]">{item.name}</span>
                        <span className="text-[10px] text-[#D4AF37] font-serif mt-0.5">{mockPrices[item.id] || mockPrices.default}</span>
                     </div>
                  </div>
                  <button 
                    onClick={() => trackBehavior(item.id, 'add', 'product')}
                    className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:bg-[#D4AF37] hover:border-[#D4AF37] hover:text-black transition-all"
                  >
                    <ShoppingBag className="w-3 h-3" />
                  </button>
               </div>
             ))}
          </div>

          {look.accessories.length > 0 && (
            <div className="pt-4 border-t border-white/[0.03]">
               <Text className="text-[10px] text-white/40 italic">
                 Finalizado com: {look.accessories.join(" • ")}
               </Text>
            </div>
          )}
         {/* Part 3: Urgency Overlay (Contextual) */}
        {strategy?.urgency && (
           <div className="mx-6 mt-4 p-4 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center gap-3 animate-in slide-in-from-top-2">
              <TrendingUp size={14} className="text-[#D4AF37]" />
              <span className="text-[9px] uppercase font-bold tracking-widest text-[#D4AF37] leading-none">{strategy.urgency}</span>
           </div>
        )}

        {/* Part 4 & 5: PRICE ANCHORING & FULL LOOK BUNDLE BLOCK */}
        <div className="mx-6 mt-4">
           <PriceAnchoring 
              items={look.items.map(i => ({ price: mockPrices[i.id] || "R$ 1.000" }))} 
              label={`Investimento ${look.name}`}
           />
           
           <div className="mt-4">
              <VenusButton 
                 variant="solid" 
                 onClick={() => { trackBehavior(look.id, 'complete_look', 'look'); setSelectedLookForPurchase(look); }}
                 className={`w-full py-6 h-auto text-[11px] font-bold uppercase tracking-[0.4em] shadow-[0_15px_40px_rgba(212,175,55,0.2)] bg-gradient-to-r from-[#D4AF37] to-[#F1D57F] text-black border-none group/btn ${intensity === 'HIGH' ? "animate-pulse" : ""}`}
              >
                 <span className="flex items-center justify-center gap-2">
                   {strategy?.cta || "APLICAR ESTILO COMPLETO"}
                   <ChevronRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
                 </span>
              </VenusButton>
           </div>
        </div>

        </div>

        {/* Regular Action - Smaller or Removed in favor of bundle? Let's make it secondary */}
        <div className="px-8 mt-5 hidden">
          <VenusButton variant="outline" className="w-full py-4 h-auto text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 hover:opacity-100">
             Personalizar Look
          </VenusButton>
        </div>
      </div>

      <ProductModal 
        product={selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
      />

      <TryOnModal 
        isOpen={isTryOnOpen} 
        onClose={() => setIsTryOnOpen(false)} 
        imageUrl={look.items[0]?.photoUrl} 
        name={look.name} 
      />

      <LookSelectionModal 
        look={selectedLookForPurchase} 
        onClose={() => setSelectedLookForPurchase(null)} 
      />
    </>
  );
}

