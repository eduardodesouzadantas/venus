"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Search, ShoppingBag, Sparkles, Star, X, ZoomIn } from "lucide-react";
import { Heading } from "./Heading";
import { Text } from "./Text";
import { VenusButton } from "./VenusButton";
import { LookItem } from "@/types/result";
import { TryOnModal } from "./TryOnModal";

interface ProductModalProps {
  product: LookItem | null;
  onClose: () => void;
  onRequestFullLook?: () => void;
}

type ProductModalContentProps = {
  product: LookItem;
  onClose: () => void;
  onRequestFullLook?: () => void;
};

export function ProductModal({ product, onClose, onRequestFullLook }: ProductModalProps) {
  if (!product) return null;
  return <ProductModalContent product={product} onClose={onClose} onRequestFullLook={onRequestFullLook} />;
}

function ProductModalContent({ product, onClose, onRequestFullLook }: ProductModalContentProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isTryOnOpen, setIsTryOnOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const touchStartY = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);
  const touchStartXGallery = useRef<number>(0);

  const images = product.images && product.images.length > 0 ? product.images : [product.photoUrl, product.tryOnUrl].filter(Boolean) as string[];

  useEffect(() => {
    setIsVisible(true);
    setCurrentImageIndex(0);
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

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
    setIsZoomed((current) => !current);
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

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

  const recommendations = [
    {
      id: "c1",
      name: "Relógio minimalista prata",
      brand: "Aethel",
      photoUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=600&auto=format",
      price: "R$ 1.890",
      reason: "Eleva contraste visual",
    },
    {
      id: "c2",
      name: "Cinto couro legítimo",
      brand: "Sartorial",
      photoUrl: "https://images.unsplash.com/photo-1624222247344-550fb8ec5522?q=80&w=600&auto=format",
      price: "R$ 420",
      reason: "Reforça presença",
    },
  ];

  const stylistCues = Array.from(
    new Set(
      [
        ...(product.styleTags || []),
        ...(product.categoryTags || []),
        ...(product.fitTags || []),
        ...(product.colorTags || []),
        ...(product.targetProfile || []),
      ].filter(Boolean),
    ),
  ).slice(0, 8);

  const metaLine = [product.role, product.direction, product.formality].filter(Boolean).join(" • ");
  const fitJustification = [
    product.role,
    product.direction,
    product.bodyEffect,
    product.faceEffect,
  ]
    .filter(Boolean)
    .slice(0, 3)
    .join(" • ");

  return (
    <>
      <div
        className={`fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-black transition-all duration-500 ease-out ${isVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="absolute inset-0 z-0 min-h-full bg-black" onClick={onClose} />

        <div className="relative z-20 flex items-center justify-between px-5 pb-5 pt-10 sm:px-6 lg:px-8">
          <div className="flex flex-col">
            <span className="mb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-300">{product.brand}</span>
            <span className="text-[9px] uppercase leading-none tracking-widest text-white/60">Curadoria Venus Engine</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-transform active:scale-90"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[1280px] px-4 pb-10 sm:px-6 lg:px-8 lg:pb-14">
          <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
            <div className="space-y-4">
              <div
                className={`group relative aspect-[4/5] w-full cursor-zoom-in overflow-hidden rounded-[32px] border border-white/10 bg-slate-950 shadow-2xl transition-transform duration-500 ease-in-out ${isZoomed ? "scale-[1.02]" : "scale-100"} sm:aspect-[5/6] sm:rounded-[36px]`}
                onDoubleClick={handleDoubleTap}
                onTouchStart={handleGalleryTouchStart}
                onTouchEnd={handleGalleryTouchEnd}
              >
                <img src={images[currentImageIndex]} alt={product.name} loading="lazy" className="h-full w-full object-cover object-center" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />

                {!isZoomed && images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrevImage}
                      className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white/70 backdrop-blur-md transition-all active:scale-90"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextImage}
                      className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white/70 backdrop-blur-md transition-all active:scale-90"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/25 px-3 py-1.5 backdrop-blur-sm">
                      {images.map((_, index) => (
                        <div
                          key={index}
                          className={`h-1 rounded-full transition-all duration-300 ${index === currentImageIndex ? "w-4 bg-slate-200" : "w-1 bg-white/40"}`}
                        />
                      ))}
                    </div>
                  </>
                )}

                {!isZoomed && (
                  <div className="pointer-events-none absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white/40 backdrop-blur-md">
                    <ZoomIn size={14} />
                  </div>
                )}

                <div className="absolute bottom-6 left-6 max-w-[80%] rounded-full border border-white/10 bg-black/35 px-4 py-2 backdrop-blur-md">
                  <Text className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/75">
                    {currentImageIndex + 1}/{images.length} fotos da peça
                  </Text>
                </div>
              </div>

              {images.length > 1 && !isZoomed && (
                <div className="grid grid-flow-col auto-cols-[6.75rem] gap-3 overflow-x-auto pb-1 sm:auto-cols-[7.5rem] sm:gap-4 lg:grid-cols-4 lg:overflow-visible lg:pb-0">
                  {images.map((img, index) => (
                    <button
                      type="button"
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                        className={`relative aspect-[3/4] overflow-hidden rounded-[1.4rem] border-2 transition-all ${index === currentImageIndex ? "border-slate-200 scale-[1.03]" : "border-white/10 opacity-60"}`}
                    >
                      <img src={img} alt={`${product.name} foto ${index + 1}`} className="h-full w-full object-cover object-center" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6 pb-10 lg:sticky lg:top-6 lg:pb-0">
              <div className="rounded-[32px] border border-white/8 bg-white/[0.03] p-5 sm:rounded-[36px] sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Heading as="h2" className="max-w-[14ch] text-[2rem] leading-[0.96] tracking-tighter text-white sm:max-w-none sm:text-[2.4rem]">
                      {product.premiumTitle || product.name}
                    </Heading>
                    <Text className="mt-2 text-[10px] uppercase font-bold tracking-[0.2em] text-slate-300">{product.brand}</Text>
                    {metaLine && <Text className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/30">{metaLine}</Text>}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="mb-1 text-xl font-serif leading-none text-slate-200">{product.price || "Ver na loja →"}</span>
                    <span className="text-[8px] uppercase tracking-widest text-white/30">Investimento em imagem</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {[product.role, product.direction, product.formality].filter(Boolean).slice(0, 3).map((cue) => (
                      <span
                        key={cue}
                        className="rounded-full border border-slate-300/15 bg-slate-300/8 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.22em] text-slate-200"
                      >
                        {cue}
                      </span>
                    ))}
                  </div>

                  <div className="rounded-[28px] border border-white/5 bg-white/[0.03] px-5 py-5 text-center">
                    <Text className="text-base font-medium italic leading-tight tracking-tight text-white sm:text-lg">
                      &quot;{product.impactLine || "Essa peça redefine sua presença imediatamente."}&quot;
                    </Text>
                  </div>

                  <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
                    <Text className="mb-2 text-[9px] font-bold uppercase tracking-[0.35em] text-slate-300">Leitura de stylist</Text>
                    <Text className="text-sm leading-relaxed text-white/80">
                      {product.authorityRationale || "Essa peça entra como leitura estratégica: base, apoio ou destaque, sem perder coerência com o perfil."}
                    </Text>
                    <div className="mt-4 hidden rounded-[18px] border border-white/6 bg-slate-950/25 px-3 py-2 sm:block">
                      <Text className="text-[8px] font-bold uppercase tracking-[0.24em] text-white/35">Por que acerta em você</Text>
                      <Text className="mt-1 text-[11px] leading-relaxed text-white/70">
                        {fitJustification || "Ela acompanha seu caimento, reforça sua linha e organiza a presença sem parecer forçada."}
                      </Text>
                    </div>
                    {stylistCues.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {stylistCues.map((cue) => (
                          <span
                            key={cue}
                            className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.24em] text-white/55"
                          >
                            {cue}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5 transition-colors group hover:border-slate-300/40">
                    <Text className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                      <Star size={10} /> Benefício estrutural
                    </Text>
                    <Text className="text-xs font-medium leading-relaxed text-white/80">
                      {product.functionalBenefit || "Estrutura seus ombros e cria uma silhueta dominante através do corte arquitetural."}
                    </Text>
                  </div>

                    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 transition-colors group hover:border-slate-300/40">
                      <Text className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                        <Sparkles size={10} /> Efeito social
                      </Text>
                      <Text className="text-xs font-medium leading-relaxed text-white/80">
                        {product.socialEffect || "Transmite autoridade sem esforço, posicionando você como figura central no ambiente."}
                      </Text>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 transition-colors group hover:border-slate-300/40">
                      <Text className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                        <Search size={10} /> Contexto de uso
                      </Text>
                      <Text className="text-xs font-medium leading-relaxed text-white/80">
                        {product.contextOfUse || "Perfeito para reuniões estratégicas ou eventos onde sua presença é sua maior ferramenta."}
                      </Text>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/6 bg-white/[0.03] p-4 sm:rounded-[32px] sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <Text className="text-[9px] font-bold uppercase tracking-[0.34em] text-white/35">Porta de entrada para a loja inteira</Text>
                    <Text className="text-[16px] font-semibold leading-tight text-white sm:text-[17px]">
                      {product.conversionCopy || "Essa peça abre o resto da loja com mais intenção."}
                    </Text>
                    <Text className="max-w-[30rem] text-[13px] leading-relaxed text-white/58 sm:text-sm">
                      A leitura de stylist conecta essa peça ao look completo e ao próximo passo de conversa.
                    </Text>
                  </div>
                  <span className="rounded-full border border-slate-300/20 bg-slate-300/10 px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.28em] text-slate-200">
                    Máxima conversão
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <VenusButton
                  variant="solid"
                  type="button"
                  onClick={onRequestFullLook}
                    className="h-auto w-full rounded-full bg-gradient-to-r from-[#D4AF37] via-[#F1D57F] to-[#D4AF37] px-4 py-7 text-sm font-bold uppercase tracking-[0.2em] text-black shadow-[0_20px_50px_rgba(212,175,55,0.3)] transition-all active:scale-[0.98]"
                >
                  <span className="flex items-center justify-center gap-3">
                    Ver look completo
                    <ShoppingBag className="h-5 w-5 transition-transform group-hover:rotate-12" />
                  </span>
                </VenusButton>

                <VenusButton
                  type="button"
                  variant="outline"
                  onClick={() => setIsTryOnOpen(true)}
                  className="h-auto w-full rounded-full border border-white/10 px-4 py-6 text-xs font-bold uppercase tracking-[0.2em] text-white/60 transition-all group hover:border-white/30 hover:text-white"
                >
                  <span className="flex items-center justify-center gap-3">
                    Ver em mim
                    <Sparkles className="h-4 w-4 text-slate-200 transition-transform group-hover:scale-110" />
                  </span>
                </VenusButton>
              </div>

              <div className="rounded-[28px] border border-white/6 bg-white/[0.03] p-4 sm:rounded-[32px] sm:p-5">
                <Heading as="h4" className="mb-4 text-xs font-bold uppercase tracking-[0.4em] text-white/40">
                  Completa essa presença
                </Heading>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {recommendations.map((rec) => (
                    <div key={rec.id} className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-3.5 transition-all active:scale-[0.98]">
                      <div className="relative mb-4 aspect-[4/5] overflow-hidden rounded-[1.6rem] border border-white/5">
                        <img src={rec.photoUrl} alt={rec.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                          <div className="mb-4 rounded-full border border-white/20 bg-white/10 px-3 py-1 backdrop-blur-md">
                            <span className="text-[8px] font-bold uppercase tracking-widest text-white">{rec.reason}</span>
                          </div>
                        </div>
                      </div>
                      <Text className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-300">{rec.brand}</Text>
                      <Text className="mb-3 line-clamp-2 h-8 text-[11px] font-medium leading-tight text-white/90">{rec.name}</Text>
                      <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2">
                        <span className="text-[10px] font-serif text-white/60">{rec.price}</span>
                        <button
                          type="button"
                          onClick={() => setIsTryOnOpen(true)}
                          className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-200 transition-all hover:brightness-125"
                        >
                          Adicionar <ArrowRight size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <VenusButton
                  type="button"
                  variant="outline"
                  onClick={onRequestFullLook}
                  className="mt-4 h-auto w-full rounded-full border border-white/10 py-4 text-[10px] uppercase tracking-widest text-white/60 transition-all hover:border-slate-300/40 hover:text-white"
                >
                  Ver peças relacionadas
                </VenusButton>
              </div>

              <button onClick={onClose} className="group mt-8 flex w-full flex-col items-center pb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 transition-colors group-hover:text-slate-200">Voltar para estratégia</span>
                <div className="mt-3 h-px w-0 bg-slate-200/60 transition-all duration-700 group-hover:w-20" />
              </button>
            </div>
          </div>
        </div>

        <div className="pointer-events-none fixed bottom-0 left-0 z-0 h-[60vh] w-full bg-gradient-to-t from-slate-200/8 to-transparent" />
      </div>

      <TryOnModal
        isOpen={isTryOnOpen}
        onClose={() => setIsTryOnOpen(false)}
        imageUrl={images[currentImageIndex] || product.photoUrl}
        name={product.name}
        brandName={product.brand}
        appName="InovaCortex"
        lookDescription={product.persuasiveDescription || product.baseDescription || product.impactLine || product.name}
      />
    </>
  );
}
