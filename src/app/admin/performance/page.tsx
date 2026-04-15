"use client";

import { TrendingUp, ShoppingBag, Star, AlertCircle, ChevronRight, LayoutGrid, Zap, Filter, ArrowUpRight, MoreHorizontal } from "lucide-react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";

export default function AdminPerformancePage() {
  // Mock Performance Data (Aggregate & Actionable)
  const performanceHighlights = [
    {
      id: "1",
      name: "O Arquiteto do Amanhã",
      category: "look",
      metric: "78% Converção de Bundle",
      status: "excelente",
      insight: "Alta tração em perfis que buscam autoridade imediata.",
      suggestion: "Manter destaque no topo da curadoria.",
      trend: "up"
    },
    {
      id: "3",
      name: "Turtleneck em Cashmere",
      category: "product",
      metric: "42 Shares essa semana",
      status: "uprising",
      insight: "Tem forte apelo visual para compartilhamento orgânico.",
      suggestion: "Criar variação de cor (Prata/Branco) para ampliar desejo.",
      trend: "up"
    }
  ];

  const bottlenecks = [
    {
      id: "2",
      name: "Sombra Contemporânea",
      problem: "Alta abertura, baixa escolha de bundle",
      reason: "opened often, but low full-look conversion",
      fix: "Reposicionar em outro contexto de uso ou reforçar fotos de detalhe.",
      priority: "alta"
    }
  ];

  const qualityChecklist = [
    { id: "p1", name: "Blazer Estruturado", score: 95, missing: [] },
    { id: "p2", name: "Camisa Algodão", score: 62, missing: ["Imagens de Detalhe", "Style Tags"] },
  ];

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Header */}
      <div className="px-6 pt-12 pb-8 border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#C9A84C] mb-1">Merchant Intelligence</span>
            <Heading as="h1" className="text-2xl tracking-tighter uppercase">Performance & Insights</Heading>
          </div>
          <div className="flex gap-2">
            <button className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center">
              <Filter className="w-4 h-4 text-white/40" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 mt-10 space-y-12">
        {/* Quick Summary Cards (Step 1) */}
        <div className="grid grid-cols-2 gap-4">
           <div className="p-6 rounded-[32px] bg-white/[0.03] border border-white/5 space-y-3">
              <div className="flex items-center gap-2 text-[#C9A84C]">
                 <TrendingUp size={16} />
                 <span className="text-[9px] uppercase font-bold tracking-widest">Desejo Gerado</span>
              </div>
              <div className="flex items-baseline gap-2">
                 <Heading as="h2" className="text-3xl tracking-tighter">1.2k</Heading>
                 <ArrowUpRight className="w-4 h-4 text-green-500" />
              </div>
              <Text className="text-[10px] text-white/20 uppercase tracking-widest font-bold">+12% vs last week</Text>
           </div>
           
           <div className="p-6 rounded-[32px] bg-white/[0.03] border border-white/5 space-y-3">
              <div className="flex items-center gap-2 text-white/60">
                 <ShoppingBag size={16} />
                 <span className="text-[9px] uppercase font-bold tracking-widest">Intenção Bundle</span>
              </div>
              <div className="flex items-baseline gap-2">
                 <Heading as="h2" className="text-3xl tracking-tighter">450</Heading>
                 <ArrowUpRight className="w-4 h-4 text-green-500" />
              </div>
              <Text className="text-[10px] text-white/20 uppercase tracking-widest font-bold">+8% vs last week</Text>
           </div>
        </div>

        {/* Priority Actions (Step 3: Low Performance Signals) */}
        <section className="space-y-6">
           <div className="flex items-baseline justify-between">
              <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">Ações Prioritárias</Heading>
              <Text className="text-[10px] text-[#C9A84C] font-bold">3 ALERTA</Text>
           </div>
           
           {bottlenecks.map((item) => (
             <div key={item.id} className="p-6 rounded-[40px] bg-red-500/[0.03] border border-red-500/10 space-y-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 blur-3xl -mr-12 -mt-12" />
                <div className="flex items-start justify-between">
                   <div className="space-y-1">
                      <Text className="text-[10px] uppercase font-bold tracking-widest text-red-500 mb-1 flex items-center gap-2">
                         <AlertCircle size={12} /> Bottleneck de Conversão
                      </Text>
                      <Heading as="h4" className="text-lg tracking-tight">{item.name}</Heading>
                   </div>
                   <div className="px-2 py-1 rounded-full bg-red-500 text-white text-[8px] font-bold tracking-widest">PRIORIDADE ALTA</div>
                </div>
                <div className="space-y-3">
                   <Text className="text-xs text-white/60 leading-relaxed italic">&quot;{item.problem}&quot;</Text>
                   <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                      <span className="text-[9px] text-[#C9A84C] uppercase font-bold tracking-widest block mb-1">Recomendação Venus:</span>
                      <Text className="text-xs text-white/80 leading-relaxed">{item.fix}</Text>
                   </div>
                </div>
             </div>
           ))}
        </section>

        {/* Top Performance (Step 1 & 2: Actionable Insights) */}
        <section className="space-y-6">
           <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">Top Performance Insights</Heading>
           
           <div className="space-y-6">
             {performanceHighlights.map((item) => (
               <div key={item.id} className="p-6 rounded-[40px] bg-white/[0.04] border border-white/10 space-y-6 relative group active:scale-[0.98] transition-all">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center text-[#C9A84C]">
                           {item.category === "look" ? <LayoutGrid size={24} /> : <ShoppingBag size={24} />}
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[9px] uppercase tracking-widest text-[#C9A84C] font-bold mb-1">{item.category}</span>
                           <Heading as="h4" className="text-lg tracking-tight">{item.name}</Heading>
                        </div>
                     </div>
                     <div className="flex flex-col items-end">
                        <span className="text-lg font-serif text-white tracking-tighter">{item.metric}</span>
                        <div className="flex items-center gap-1">
                           <ArrowUpRight size={10} className="text-green-500" />
                           <span className="text-[8px] text-green-500 font-bold uppercase tracking-widest">Rising</span>
                        </div>
                     </div>
                  </div>

                  <div className="h-px w-full bg-white/5" />

                  <div className="grid grid-cols-1 gap-5">
                     <div className="flex gap-4">
                        <Zap className="w-5 h-5 text-[#C9A84C] flex-shrink-0" />
                        <div className="flex flex-col gap-1">
                           <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Interpretação</span>
                           <Text className="text-xs text-white/80 leading-relaxed">{item.insight}</Text>
                        </div>
                     </div>
                     <div className="flex gap-4">
                        <Star className="w-5 h-5 text-white/40 flex-shrink-0" />
                        <div className="flex flex-col gap-1">
                           <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Próximo Passo</span>
                           <Text className="text-xs text-white/60 leading-relaxed italic">{item.suggestion}</Text>
                        </div>
                     </div>
                  </div>
                  
                  <ChevronRight className="absolute bottom-6 right-6 w-5 h-5 text-white/10 group-hover:text-[#C9A84C] group-hover:translate-x-1 transition-all" />
               </div>
             ))}
           </div>
        </section>

        {/* User Taste Signals (Step 5) */}
        <section className="space-y-6">
           <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">Tendências de Atendimento</Heading>
           <div className="p-8 rounded-[48px] bg-gradient-to-br from-[#C9A84C]/10 to-transparent border border-[#C9A84C]/20 space-y-8">
              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <Text className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Estética Dominante</Text>
                    <Heading as="h4" className="text-xl tracking-tighter text-[#C9A84C]">Quiet Luxury</Heading>
                    <Text className="text-[10px] text-[#C9A84C] font-bold">92% PREFERENCE</Text>
                 </div>
                 <div className="space-y-2">
                    <Text className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Ticket de Escolha</Text>
                    <Heading as="h4" className="text-xl tracking-tighter text-white">R$ 1.8k+</Heading>
                    <Text className="text-[10px] text-white/20 font-bold tracking-widest">HIGH TICKET TREND</Text>
                 </div>
              </div>
              
              <div className="h-px w-full bg-white/5" />
              
              <div className="space-y-4">
                 <Text className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Fatores de Conversão (Visual Triggers)</Text>
                 <div className="flex flex-wrap gap-2">
                    {["Simetria Arquitetural", "Contraste Alto", "Foco Punhos", "Texturas Naturais"].map(tag => (
                      <div key={tag} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] uppercase tracking-widest font-medium text-white/80">
                         {tag}
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </section>

        {/* Catalog Readiness (Step 6) */}
        <section className="space-y-6">
           <div className="flex items-center justify-between">
              <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">Sinais de Qualidade do Catálogo</Heading>
              <Text className="text-[10px] text-white/20 font-bold tracking-widest leading-none">ALL PRODUCTS</Text>
           </div>
           
           <div className="space-y-4">
              {qualityChecklist.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-5 rounded-3xl bg-white/[0.02] border border-white/5">
                   <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${p.score > 80 ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]" : "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)]"}`} />
                      <div className="flex flex-col">
                         <span className="text-xs font-bold text-white/80">{p.name}</span>
                         {p.missing.length > 0 && (
                           <Text className="text-[9px] text-white/30 uppercase tracking-widest">Falta: {p.missing.join(", ")}</Text>
                         )}
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-white/40">{p.score}% Readiness</span>
                      <button className="p-2 rounded-full hover:bg-white/5">
                         <MoreHorizontal className="w-4 h-4 text-white/20" />
                      </button>
                   </div>
                </div>
              ))}
           </div>
        </section>
      </div>

      {/* Action CTA Toolbar */}
      <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black via-black to-transparent z-50">
         <VenusButton variant="solid" className="w-full py-8 h-auto text-[11px] font-bold uppercase tracking-[0.3em] bg-white text-black rounded-full shadow-2xl active:scale-95 transition-all">
            Ver Todos os Produtos do Catálogo
         </VenusButton>
      </div>

      {/* Floating BG Accent */}
      <div className="fixed top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-[#C9A84C]/5 to-transparent pointer-events-none -z-10" />
    </div>
  );
}
