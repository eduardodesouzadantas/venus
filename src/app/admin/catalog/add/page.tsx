"use client";

import { useState, useRef } from "react";
import { Upload, X, Sparkles, CheckCircle2, ChevronRight, LayoutGrid, Type, ShieldCheck, ShoppingBag, Eye, Save, Plus, Star } from "lucide-react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { LookItem } from "@/types/result";
import { enrichProductWithAI } from "@/lib/ai/catalog-enricher";

export default function AdminCatalogAddPage() {
  const [images, setImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [item, setItem] = useState<Partial<LookItem>>({
    name: "",
    brand: "Sua Marca Premium",
    price: "",
  });
  const [status, setStatus] = useState<"idle" | "uploaded" | "enriched" | "saved">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages = Array.from(files).map(f => URL.createObjectURL(f));
      setImages(prev => [...prev, ...newImages]);
      setStatus("uploaded");
    }
  };

  const handleEnrich = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    try {
      const result = await enrichProductWithAI(images, item.name, "Vestuário Premium");
      setItem(prev => ({ ...prev, ...result }));
      setStatus("enriched");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = () => {
    setStatus("saved");
    // In real app, this would save to database
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Header */}
      <div className="px-6 pt-12 pb-8 border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#C9A84C] mb-1">Catalog Enzyme</span>
            <Heading as="h1" className="text-2xl tracking-tighter">Enriquecer Produto</Heading>
          </div>
          <VenusButton variant="outline" className="border-white/10 rounded-full h-10 w-10 flex items-center justify-center p-0">
             <LayoutGrid className="w-4 h-4 text-white/40" />
          </VenusButton>
        </div>
      </div>

      <div className="px-6 mt-10 space-y-12 max-w-lg mx-auto">
        {/* Upload Section */}
        <div className="space-y-6">
           <div className="flex items-center justify-between">
              <Heading as="h3" className="text-sm uppercase tracking-widest text-white/60">1. Ativos Visuais</Heading>
              {images.length > 0 && <Text className="text-[10px] text-[#C9A84C] font-bold">{images.length} IMAGENS</Text>}
           </div>

           <div 
             className={`relative w-full aspect-video rounded-[32px] border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-4 group transition-all hover:border-[#C9A84C]/30 hover:bg-[#C9A84C]/5 ${status !== "idle" ? "hidden" : "flex"}`}
             onClick={() => fileInputRef.current?.click()}
           >
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                 <Upload className="w-6 h-6 text-white/40" />
              </div>
              <div className="text-center">
                 <Text className="text-xs font-bold text-white/60">Arraste fotos do produto</Text>
                 <Text className="text-[9px] text-white/20 uppercase tracking-widest mt-1">Frente, Verso, Detalhes, Textura</Text>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleImageUpload} accept="image/*" />
           </div>

           {images.length > 0 && (
             <div className="grid grid-cols-2 gap-4">
                {images.map((img, i) => (
                  <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 group">
                     <img src={img} className="w-full h-full object-cover" />
                     <button 
                        onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white/60 opacity-0 group-hover:opacity-100 transition-opacity"
                     >
                        <X size={12} />
                     </button>
                     {/* IMAGE ROLE PRE-PICKER (Step 4) */}
                     {status === "enriched" && (
                       <div className="absolute bottom-2 left-2 right-2">
                          <div className="px-2 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 flex items-center justify-between">
                             <span className="text-[8px] uppercase tracking-widest text-[#C9A84C] font-bold">
                                {Object.values(item.imageRoles || {})[i] || "Extra"}
                             </span>
                             <ChevronRight className="w-2 h-2 text-white/20" />
                          </div>
                       </div>
                     )}
                  </div>
                ))}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-2xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-colors"
                >
                   <Plus className="w-4 h-4 text-white/20" />
                   <span className="text-[8px] uppercase tracking-widest text-white/20">Add</span>
                </button>
             </div>
           )}
        </div>

        {/* Action Button: ENRICH */}
        {status === "uploaded" && (
           <VenusButton 
             variant="solid" 
             onClick={handleEnrich}
             disabled={isProcessing}
             className="w-full py-6 h-auto text-xs font-bold uppercase tracking-[0.3em] bg-white text-black shadow-2xl rounded-full relative overflow-hidden group"
           >
              {isProcessing ? (
                <span className="flex items-center gap-3">
                   <div className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                   Estratégia AI em Processamento...
                </span>
              ) : (
                <span className="flex items-center gap-3">
                   Gerar Enriquecimento Premium
                   <Sparkles className="w-4 h-4 group-hover:scale-125 transition-transform" />
                </span>
              )}
              {isProcessing && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              )}
           </VenusButton>
        )}

        {/* ENRICHED FIELDS PREVIEW (Step 3) */}
        {status === "enriched" && (
          <div className="space-y-10 animate-fade-in">
             {/* Text Fields */}
             <div className="space-y-6">
                <div className="flex items-center justify-between">
                   <Heading as="h3" className="text-sm uppercase tracking-widest text-white/60">2. Narrativa de Venda</Heading>
                   <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/30">
                      <ShieldCheck className="w-3 h-3 text-[#C9A84C]" />
                      <span className="text-[8px] text-[#C9A84C] font-bold uppercase tracking-widest">IA Validada</span>
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="space-y-2">
                      <Text className="text-[9px] uppercase tracking-widest text-white/30 font-bold ml-1">Título Premium</Text>
                      <input 
                         className="w-full bg-white/[0.03] border border-white/10 p-4 rounded-2xl text-sm focus:outline-none focus:border-[#C9A84C]/50 transition-colors" 
                         value={item.premiumTitle}
                         onChange={(e) => setItem({...item, premiumTitle: e.target.value})}
                      />
                   </div>

                   <div className="space-y-2">
                      <Text className="text-[9px] uppercase tracking-widest text-white/30 font-bold ml-1">Impact Line (Persuasão)</Text>
                      <input 
                         className="w-full bg-white/[0.03] border border-white/10 p-4 rounded-2xl text-xs font-medium italic focus:outline-none focus:border-[#C9A84C]/50 transition-colors" 
                         value={item.impactLine}
                         onChange={(e) => setItem({...item, impactLine: e.target.value})}
                      />
                   </div>

                   <div className="space-y-2">
                      <Text className="text-[9px] uppercase tracking-widest text-white/30 font-bold ml-1">Benefício Estrutural</Text>
                      <textarea 
                         className="w-full bg-white/[0.03] border border-white/10 p-4 rounded-2xl text-xs leading-relaxed h-20 focus:outline-none focus:border-[#C9A84C]/50 transition-colors" 
                         value={item.functionalBenefit}
                         onChange={(e) => setItem({...item, functionalBenefit: e.target.value})}
                      />
                   </div>

                   <div className="space-y-2">
                      <Text className="text-[9px] uppercase tracking-widest text-white/30 font-bold ml-1">Efeito Social</Text>
                      <textarea 
                         className="w-full bg-white/[0.03] border border-white/10 p-4 rounded-2xl text-xs leading-relaxed h-20 focus:outline-none focus:border-[#C9A84C]/50 transition-colors" 
                         value={item.socialEffect}
                         onChange={(e) => setItem({...item, socialEffect: e.target.value})}
                      />
                   </div>
                </div>
             </div>

             {/* Style & Tags Section (Step 6) */}
             <div className="space-y-6">
                <Heading as="h3" className="text-sm uppercase tracking-widest text-white/60">3. Inteligência de Matching</Heading>
                
                <div className="space-y-6">
                   <div className="space-y-3">
                      <Text className="text-[9px] uppercase tracking-widest text-white/30 font-bold ml-1">Style Tags</Text>
                      <div className="flex flex-wrap gap-2">
                         {item.styleTags?.map((tag, i) => (
                           <div key={i} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] uppercase tracking-widest font-medium">
                              {tag}
                           </div>
                         ))}
                         <button className="w-8 h-6 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5">
                            <Plus className="w-3 h-3 text-white/40" />
                         </button>
                      </div>
                   </div>

                   <div className="bg-[#C9A84C]/5 border border-[#C9A84C]/10 p-6 rounded-[32px] space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                         <Star className="w-4 h-4 text-[#C9A84C]" />
                         <span className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">Sugestões de Venda</span>
                      </div>
                      <div className="space-y-4">
                         <div className="flex flex-col gap-1">
                            <span className="text-[8px] text-white/30 uppercase tracking-widest">Público Alvo</span>
                            <span className="text-[11px] text-white/80 font-medium">{item.sellerSuggestions?.idealFor}</span>
                         </div>
                         <div className="flex flex-col gap-1">
                            <span className="text-[8px] text-white/30 uppercase tracking-widest">Cross-sell Recomendado</span>
                            <span className="text-[11px] text-white/80 font-medium italic">{item.sellerSuggestions?.pairsBestWith.join(" • ")}</span>
                         </div>
                      </div>
                   </div>
                </div>
             </div>

             {/* Final Actions */}
             <div className="pt-10 space-y-4">
                <VenusButton 
                  variant="solid" 
                  onClick={handleSave}
                  className="w-full py-8 h-auto text-[11px] font-bold uppercase tracking-[0.3em] bg-[#C9A84C] text-black shadow-2xl rounded-full active:scale-[0.98] transition-all group"
                >
                   <span className="flex items-center justify-center gap-3">
                     Publicar Catálogo Master
                     <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                   </span>
                </VenusButton>
                
                <button className="w-full flex items-center justify-center gap-2 text-white/40 text-[9px] uppercase tracking-[0.4em] font-bold py-4 hover:text-white transition-colors">
                   <Eye className="w-3 h-3" /> Preview no Dossiê
                </button>
             </div>
          </div>
        )}

        {status === "saved" && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8 text-center space-y-8 animate-fade-in">
             <div className="w-20 h-20 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/30 flex items-center justify-center text-[#C9A84C]">
                <CheckCircle2 size={40} className="animate-bounce" />
             </div>
             <div className="space-y-4">
                <Heading as="h2" className="text-3xl tracking-tighter">Produto Publicado</Heading>
                <Text className="text-white/40 text-xs leading-relaxed max-w-[240px] mx-auto">
                   Seu produto recebeu 14 novas camadas de inteligência e está pronto para converter.
                </Text>
             </div>
             <VenusButton 
                variant="solid" 
                onClick={() => window.location.reload()}
                className="w-full max-w-xs py-6 h-auto text-[10px] font-bold uppercase tracking-[0.3em] bg-white text-black rounded-full"
             >
                Adicionar Outro
             </VenusButton>
             <button className="text-white/20 text-[9px] uppercase tracking-widest font-bold underline" onClick={() => (window as any).location.href = "/"}>Voltar ao Painel</button>
          </div>
        )}
      </div>

      {/* Background Accent */}
      <div className="fixed top-0 left-0 w-full h-[60vh] bg-gradient-to-b from-[#C9A84C]/5 to-transparent pointer-events-none -z-10" />
    </div>
  );
}
