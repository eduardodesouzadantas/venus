"use client";

import { useEffect, useState } from "react";
import { X, ShoppingBag, ArrowRight, PackageCheck, Star, Info, ChevronRight, ExternalLink } from "lucide-react";
import { Heading } from "./Heading";
import { Text } from "./Text";
import { VenusButton } from "./VenusButton";
import { LookData, LookItem } from "@/types/result";
import { getWhatsAppHandoffPhone } from "@/lib/whatsapp/handoff";

interface LookSelectionModalProps {
  look: LookData | null;
  onClose: () => void;
  onSelectItem?: (item: LookItem) => void;
  onRequestWhatsApp?: () => void;
}

export function LookSelectionModal({ look, onClose, onSelectItem, onRequestWhatsApp }: LookSelectionModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const whatsappPhone = getWhatsAppHandoffPhone();

  useEffect(() => {
    if (look) {
      setIsVisible(true);
      document.body.style.overflow = "hidden";
    } else {
      setIsVisible(false);
      document.body.style.overflow = "auto";
    }
  }, [look]);

  if (!look) return null;

  // Mock pricing logic for bundle
  const basePrice = look.items.reduce((acc, item) => acc + 1000, 0);
  const bundleDiscount = 450;
  const totalPrice = basePrice - bundleDiscount;

  return (
    <div 
      className={`fixed inset-0 z-[150] flex flex-col bg-black transition-all duration-500 ease-out overflow-y-auto ${isVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
    >
      <div className="absolute inset-0 z-0 bg-black min-h-full" onClick={onClose} />

      {/* Top Bar */}
      <div className="relative z-20 flex items-center justify-between px-6 pt-12 pb-6 flex-shrink-0">
        <div className="flex flex-col">
           <span className="text-[10px] uppercase font-bold tracking-[0.3em] text-[#D4AF37] mb-1">Look Completo</span>
           <span className="text-white/60 text-[9px] uppercase tracking-widest leading-none">Composição Estratégica</span>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform">
          <X size={20} />
        </button>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center px-6 pb-20">
        {/* Look Header Image */}
        <div className="w-full aspect-[4/3] rounded-[40px] overflow-hidden border border-white/10 shadow-2xl relative mb-10">
           <img src={look.items[0]?.photoUrl} className="w-full h-full object-cover" />
           <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
           <div className="absolute bottom-8 left-8 right-8">
              <Heading as="h2" className="text-3xl text-white tracking-tighter shimmer-text">{look.name}</Heading>
           </div>
        </div>

        {/* Persuasion Block: Why buy the full look? */}
        <div className="w-full p-8 rounded-[40px] bg-[#D4AF37]/5 border border-[#D4AF37]/20 space-y-6 mb-12">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37]">
                <Star size={18} />
              </div>
              <Heading as="h4" className="text-base uppercase tracking-tight">O Poder da Composição</Heading>
           </div>
           <Text className="text-xs text-white/70 leading-relaxed italic">
             &quot;Comprar peças isoladas resolve sintomas. Comprar o look completo resolve sua presença. Cada item aqui foi selecionado para reforçar o outro, criando uma silhueta de autoridade inabalável.&quot;
           </Text>
           <div className="flex items-center gap-4 pt-4 border-t border-[#D4AF37]/10">
              <div className="flex items-center gap-2">
                 <PackageCheck className="w-4 h-4 text-[#D4AF37]" />
                 <span className="text-[10px] text-white/90 uppercase tracking-widest font-bold">100% Compatível</span>
              </div>
              <div className="flex items-center gap-2">
                 <Info className="w-4 h-4 text-[#D4AF37]" />
                 <span className="text-[10px] text-white/90 uppercase tracking-widest font-bold">Ajuste de Autoridade</span>
              </div>
           </div>
        </div>

        {/* Product List */}
        <div className="w-full space-y-6 mb-16">
           {look.items.map((item) => (
             <div key={item.id} className="flex items-center justify-between group p-4 rounded-3xl bg-white/[0.03] border border-white/5 active:scale-[0.98] transition-all">
                <div className="flex items-center gap-5">
                   <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0">
                      <img src={item.photoUrl} className="w-full h-full object-cover" />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[9px] uppercase tracking-widest text-[#D4AF37] font-bold mb-1">{item.brand}</span>
                      <span className="text-xs text-white font-medium leading-tight mb-2">{item.name}</span>
                      <span className="text-[10px] font-serif text-white/40">R$ 1.000</span>
                   </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                   <button
                      type="button"
                      onClick={() => onSelectItem?.(item)}
                      className="p-2 rounded-full border border-white/10 text-white/40 group-hover:text-[#D4AF37] group-hover:border-[#D4AF37] transition-all"
                   >
                      <ExternalLink size={14} />
                   </button>
                </div>
             </div>
           ))}
        </div>

        {/* Pricing Summary & Final CTA */}
        <div className="w-full mt-auto space-y-8 bg-[#0A0A0A] p-8 rounded-[48px] border border-white/5 shadow-[0_-40px_80px_rgba(0,0,0,0.5)]">
           <div className="space-y-4">
              <div className="flex justify-between items-center text-white/40 text-[10px] uppercase font-bold tracking-widest">
                 <span>Subtotal de Itens</span>
                 <span>R$ {basePrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[#D4AF37] text-[10px] uppercase font-bold tracking-widest">
                 <span>Benefício do Bundle</span>
                 <span>- R$ {bundleDiscount.toLocaleString()}</span>
              </div>
              <div className="h-px w-full bg-white/5 my-4" />
              <div className="flex justify-between items-end">
                 <div className="flex flex-col">
                    <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Investimento de Transformação</span>
                    <span className="text-3xl font-serif text-white tracking-tighter shimmer-text">R$ {totalPrice.toLocaleString()}</span>
                 </div>
                 <div className="flex flex-col items-end">
                    <span className="text-[8px] text-white/20 uppercase tracking-[0.2em] font-bold mb-1">Em até 12x de</span>
                    <span className="text-base text-white/80 font-serif">R$ {(totalPrice/12).toFixed(2)}</span>
                 </div>
              </div>
           </div>

           <VenusButton
              type="button"
              variant="solid"
              onClick={() => {
                if (onRequestWhatsApp) {
                  onRequestWhatsApp();
                  return;
                }

                if (!whatsappPhone) return;

                const message = encodeURIComponent(`Quero testar o look completo ${look.name} e ver como fica no meu perfil.`);
                window.open(`https://wa.me/${whatsappPhone}?text=${message}`, "_blank", "noopener,noreferrer");
              }}
              className="w-full py-8 h-auto text-[11px] font-bold uppercase tracking-[0.3em] bg-white text-black shadow-[0_20px_50px_rgba(255,255,255,0.1)] rounded-full active:scale-[0.98] transition-all group"
           >
              <span className="flex items-center justify-center gap-3">
                Ver no WhatsApp
                <ShoppingBag className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              </span>
           </VenusButton>

           <p className="text-[8px] text-center text-white/20 uppercase tracking-widest leading-relaxed">
             Acesso vitalício ao dossiê de ajuste e guia de uso incluído.
           </p>
        </div>
      </div>
    </div>
  );
}
