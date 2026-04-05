import React from "react";
import { Heading } from "./Heading";
import { Text } from "./Text";
import { TrendingDown, Zap } from "lucide-react";

interface PriceAnchoringProps {
  items: Array<{ price: string }>;
  discount?: number;
  label?: string;
}

export const PriceAnchoring = ({ items, discount = 410, label = "Investimento de Transformação" }: PriceAnchoringProps) => {
  const total = items.reduce((acc, item) => {
    const val = parseInt(item.price.replace(/\D/g, '')) || 0;
    return acc + val;
  }, 0);

  const formattedTotal = (total / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const discountedTotal = ((total - (discount * 100)) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="p-8 rounded-[40px] bg-white/[0.03] border border-white/10 space-y-6 relative overflow-hidden group hover:bg-white/[0.05] transition-all">
      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
         <Zap size={40} className="text-[#D4AF37]" />
      </div>
      
      <div className="space-y-1">
         <Text className="text-[10px] uppercase font-bold tracking-widest text-white/30">Peças Separadas</Text>
         <Heading as="h4" className="text-xl text-white/40 line-through tracking-tighter">{formattedTotal}</Heading>
      </div>

      <div className="space-y-2">
         <div className="flex items-center gap-3">
            <div className="px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20 flex items-center gap-2">
               <TrendingDown size={12} className="text-green-500" />
               <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Economia de Look Completo</span>
            </div>
         </div>
         <Heading as="h3" className="text-4xl text-[#D4AF37] tracking-tighter leading-none">{discountedTotal}</Heading>
         <Text className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#D4AF37]">{label}</Text>
      </div>

      <div className="pt-4 border-t border-white/5">
         <Text className="text-[10px] text-white/40 leading-relaxed italic">
            &quot;Este look foi pensado como um sistema completo de autoridade, não peças isoladas. A eficiência é máxima na composição integral.&quot;
         </Text>
      </div>
    </div>
  );
};
