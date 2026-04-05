import { useEffect, useState, useRef } from "react";
import { X, ShoppingBag, ZoomIn, Search, Star, ArrowRight, ChevronLeft, ChevronRight, UserCircle2, Sparkles } from "lucide-react";
import { Heading } from "./Heading";
import { Text } from "./Text";
import { VenusButton } from "./VenusButton";
import { LookItem } from "@/types/result";
import { TryOnModal } from "./TryOnModal";

interface ProductModalProps {
  product: LookItem | null;
  onClose: () => void;
}

export function ProductModal({ product, onClose }: ProductModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isTryOnOpen, setIsTryOnOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const touchStartY = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (product) {
      setIsVisible(true);
      setCurrentImageIndex(0);
      document.body.style.overflow = "hidden";
    } else {
      setIsVisible(false);
      document.body.style.overflow = "auto";
    }
  }, [product]);

  if (!product) return null;

  const images = product.images && product.images.length > 0 ? product.images : [product.photoUrl];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    const diff = touchCurrentY.current - touchStartY.current;
    if (diff > 120 && !isZoomed) {
      onClose();
    }
  };

  const handleDoubleTap = () => {
    setIsZoomed(!isZoomed);
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Gallery Horizontal Swipe
  const touchStartXGallery = useRef<number>(0);
  const handleGalleryTouchStart = (e: React.TouchEvent) => {
    touchStartXGallery.current = e.touches[0].clientX;
  };
  const handleGalleryTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - touchStartXGallery.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handlePrevImage();
      else handleNextImage();
    }
  };

  // Mock Cross-sell Data with High-Conversion Rationale
  const recommendations = [
    { 
      id: "c1", 
      name: "Relógio Minimalista Prata", 
      brand: "Aethel", 
      photoUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=200&auto=format", 
      price: "R$ 1.890",
      reason: "Eleva contraste visual"
    },
    { 
      id: "c2", 
      name: "Cinto Couro Legítimo", 
      brand: "Sartorial", 
      photoUrl: "https://images.unsplash.com/photo-1624222247344-550fb8ec5522?q=80&w=200&auto=format", 
      price: "R$ 420",
      reason: "Reforçador de presença"
    }
  ];

  return (
    <>
      <div 
        className={`fixed inset-0 z-[100] flex flex-col bg-black transition-all duration-500 ease-out overflow-y-auto ${isVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Background Overlay */}
        <div className="absolute inset-0 z-0 bg-black min-h-full" onClick={onClose} />

        {/* Top Bar Navigation */}
        <div className="relative z-20 flex items-center justify-between px-6 pt-12 pb-6 flex-shrink-0">
          <div className="flex flex-col">
             <span className="text-[10px] uppercase font-bold tracking-[0.3em] text-[#D4AF37] mb-1">{product.brand}</span>
             <span className="text-white/60 text-[9px] uppercase tracking-widest leading-none">Curadoria Venus Engine</span>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform">
            <X size={20} />
          </button>
        </div>

        {/* Main Content Wrapper */}
        <div className="relative z-10 flex-1 flex flex-col items-center">
          
          {/* Gallery System */}
          <div className="w-full flex flex-col items-center flex-shrink-0 px-4">
            <div 
              className={`relative w-full aspect-[3/4] max-h-[60vh] transition-transform duration-500 ease-in-out cursor-zoom-in group rounded-[32px] overflow-hidden border border-white/10 shadow-2xl ${isZoomed ? "scale-[1.8]" : "scale-100"}`}
              onDoubleClick={handleDoubleTap}
              onTouchStart={handleGalleryTouchStart}
              onTouchEnd={handleGalleryTouchEnd}
            >
              <img 
                src={images[currentImageIndex]} 
                alt={product.name} 
                loading="lazy"
                className="w-full h-full object-cover"
              />
              
              {/* Gallery Controls */}
              {!isZoomed && images.length > 1 && (
                <>
                  <button 
                    onClick={handlePrevImage} 
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/60 active:scale-90 transition-all opacity-0 group-hover:opacity-100 md:opacity-100"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button 
                    onClick={handleNextImage} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/60 active:scale-90 transition-all opacity-0 group-hover:opacity-100 md:opacity-100"
                  >
                    <ChevronRight size={16} />
                  </button>
                  
                  {/* Pagination Dots */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-sm">
                    {images.map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-1 rounded-full transition-all duration-300 ${i === currentImageIndex ? "w-4 bg-[#D4AF37]" : "w-1 bg-white/40"}`} 
                      />
                    ))}
                  </div>
                </>
              )}

              {!isZoomed && (
                 <div className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/40 pointer-events-none">
                    <Search size={14} />
                 </div>
              )}
            </div>

            {/* Thumbnail Strip */}
            {images.length > 1 && !isZoomed && (
              <div className="w-full mt-4 flex gap-2 justify-center overflow-x-auto py-2 no-scrollbar px-4">
                {images.map((img, i) => (
                  <button 
                    key={i}
                    onClick={() => setCurrentImageIndex(i)}
                    className={`relative flex-shrink-0 w-16 aspect-square rounded-xl overflow-hidden border-2 transition-all ${i === currentImageIndex ? "border-[#D4AF37] scale-105" : "border-white/10 opacity-60"}`}
                  >
                    <img src={img} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details Area */}
          <div className="w-full px-8 pb-32 pt-8">
            <div className="flex items-center justify-between mb-8">
               <div className="flex flex-col">
                <Heading as="h2" className="text-2xl text-white tracking-tighter leading-tight">{product.premiumTitle || product.name}</Heading>
                <Text className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#D4AF37] mt-1">{product.brand}</Text>
               </div>
               <div className="flex flex-col items-end">
                 <span className="text-xl font-serif text-[#D4AF37] leading-none mb-1">{product.price || "R$ ---"}</span>
                 <span className="text-[8px] text-white/30 uppercase tracking-widest font-bold">Investimento em Imagem</span>
               </div>
            </div>
            
            {/* PERSUASIVE COPY SYSTEM */}
            <div className="space-y-8 mb-10">
              {/* Impact Line */}
              <div className="text-center px-4">
                <Text className="text-lg text-white font-medium italic leading-tight tracking-tight">
                  &quot;{product.impactLine || "Essa peça redefine sua presença imediatamente."}&quot;
                </Text>
              </div>

              {/* Benefits Grid */}
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-white/5 border border-white/10 p-5 rounded-3xl group hover:border-[#D4AF37]/40 transition-colors">
                  <Text className="text-[10px] uppercase font-bold tracking-widest text-[#D4AF37] mb-2 flex items-center gap-2">
                    <Star size={10} /> Benefíco Estrutural
                  </Text>
                  <Text className="text-xs text-white/80 leading-relaxed font-medium">
                    {product.functionalBenefit || "Estrutura seus ombros e cria uma silhueta dominante através do corte arquitetural."}
                  </Text>
                </div>

                <div className="bg-white/5 border border-white/10 p-5 rounded-3xl group hover:border-[#D4AF37]/40 transition-colors">
                  <Text className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-2 flex items-center gap-2">
                    Efeito Social
                  </Text>
                  <Text className="text-xs text-white/80 leading-relaxed font-medium">
                    {product.socialEffect || "Transmite autoridade sem esforço, posicionando você como figura central no ambiente."}
                  </Text>
                </div>

                <div className="bg-white/5 border border-white/10 p-5 rounded-3xl group hover:border-[#D4AF37]/40 transition-colors">
                  <Text className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-2 flex items-center gap-2">
                    Contexto de Uso
                  </Text>
                  <Text className="text-xs text-white/80 leading-relaxed font-medium">
                    {product.contextOfUse || "Perfeito para reuniões estratégicas ou eventos onde sua presença é sua maior ferramenta."}
                  </Text>
                </div>
              </div>
            </div>

            <div className="mb-8 px-4 text-center space-y-4">
               <span className="text-[11px] text-white/60 font-medium leading-relaxed tracking-tight block max-w-xs mx-auto">
                  Essa peça resolve exatamente o ponto que está limitando sua presença.
               </span>
               <div className="inline-block px-3 py-1 bg-[#D4AF37]/10 rounded-full">
                  <span className="text-[9px] text-[#D4AF37] font-bold uppercase tracking-widest">
                    Peça-chave para esse resultado de autoridade
                  </span>
               </div>
            </div>

            <div className="space-y-4">
              <VenusButton variant="solid" className="w-full py-7 h-auto text-sm font-bold uppercase tracking-[0.2em] shadow-[0_20px_50px_rgba(212,175,55,0.3)] bg-gradient-to-r from-[#D4AF37] via-[#F1D57F] to-[#D4AF37] text-black rounded-full transition-all active:scale-[0.98] group">
                <span className="flex items-center justify-center gap-3">
                  Adicionar ao meu estilo
                  <ShoppingBag className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                </span>
              </VenusButton>

              <VenusButton 
                variant="outline" 
                onClick={() => setIsTryOnOpen(true)}
                className="w-full py-6 h-auto text-xs font-bold uppercase tracking-[0.2em] border-white/10 text-white/60 hover:text-white hover:border-white/30 rounded-full transition-all group"
              >
                <span className="flex items-center justify-center gap-3">
                  Ver em mim
                  <Sparkles className="w-4 h-4 text-[#D4AF37] group-hover:scale-110 transition-transform" />
                </span>
              </VenusButton>
            </div>

            {/* INTELLIGENT CROSS-SELL */}
            <div className="mt-16 pt-10 border-t border-white/10 space-y-8">
               <div className="flex flex-col items-center">
                  <Heading as="h4" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold mb-2">Completa essa presença</Heading>
                  <div className="h-px w-12 bg-[#D4AF37]/40" />
               </div>
               
               <div className="grid grid-cols-2 gap-5">
                  {recommendations.map((rec) => (
                    <div key={rec.id} className="bg-white/[0.04] border border-white/10 p-3.5 rounded-[2.5rem] group active:scale-[0.98] transition-all relative overflow-hidden">
                       <div className="aspect-square rounded-[2rem] overflow-hidden mb-4 border border-white/5 relative">
                          <img src={rec.photoUrl} alt={rec.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                             <div className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                                <span className="text-[8px] text-white font-bold uppercase tracking-widest">{rec.reason}</span>
                             </div>
                          </div>
                       </div>
                       <div className="px-1">
                         <Text className="text-[9px] uppercase tracking-widest text-[#D4AF37] font-bold mb-1.5">{rec.brand}</Text>
                         <Text className="text-[11px] text-white/90 font-medium leading-tight mb-3 line-clamp-2 h-8">{rec.name}</Text>
                         <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                            <span className="text-[10px] font-serif text-white/60">{rec.price}</span>
                            <button className="text-[9px] uppercase tracking-widest font-bold text-[#D4AF37] hover:brightness-125 transition-all flex items-center gap-1">
                               Adicionar <ArrowRight size={10} />
                            </button>
                         </div>
                       </div>
                    </div>
                  ))}
               </div>
               
               <VenusButton variant="outline" className="w-full border-white/10 text-white/60 text-[10px] py-4 h-auto rounded-full uppercase tracking-widest hover:border-[#D4AF37]/40 hover:text-white transition-all">
                  Ver peças relacionadas
               </VenusButton>
            </div>

            <button onClick={onClose} className="w-full mt-16 mb-8 flex flex-col items-center group">
               <span className="text-[10px] text-white/30 uppercase tracking-[0.4em] font-bold group-hover:text-[#D4AF37] transition-colors">
                  Voltar para Estratégia
               </span>
               <div className="h-px w-0 group-hover:w-20 bg-[#D4AF37]/60 transition-all duration-700 mt-3" />
            </button>
          </div>
        </div>

        {/* Floating Background Glow */}
        <div className="fixed bottom-0 left-0 w-full h-[60vh] bg-gradient-to-t from-[#D4AF37]/10 to-transparent pointer-events-none z-0" />
      </div>

      <TryOnModal 
        isOpen={isTryOnOpen} 
        onClose={() => setIsTryOnOpen(false)} 
        imageUrl={product.photoUrl} 
        name={product.name} 
      />
    </>
  );
}

