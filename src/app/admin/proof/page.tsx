"use client";

import { TrendingUp, Users, Target, Zap, LayoutGrid, Sparkles, BarChart3, ShoppingBag, ArrowUpRight, ChevronRight, PieChart, ShieldCheck, DollarSign, MousePointer2 } from "lucide-react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";

export default function MerchantProofDashboard() {
  
  const funnelStages = [
    { name: "Visualização do Dossiê", value: "100%", desc: "Sessões Iniciadas" },
    { name: "Engajamento com Produto", value: "72%", desc: "Interesse Ativo" },
    { name: "Virtual Try-On", value: "45%", desc: "Gatilho de Decisão", highlight: true },
    { name: "Conversão Final", value: "25%", desc: "Venda Realizada", success: true },
  ];

  const valueDrivers = [
    {
      title: "O Efeito Try-On",
      metric: "+45%",
      label: "Conversão Adicional",
      desc: "O recurso 'Ver em mim' remove a última barreira de dúvida, transformando a visualização em posse imediata.",
      icon: <Sparkles className="w-6 h-6 text-[#D4AF37]" />,
      whyItMatters: "Aumenta a confiança do cliente e reduz drasticamente a taxa de abandono de carrinho."
    },
    {
      title: "Poder do Bundle (Look Completo)",
      metric: "68%",
      label: "Preferência de Venda",
      desc: "A maioria absoluta dos clientes prefere investir na imagem completa do que em peças isoladas.",
      icon: <ShoppingBag className="w-6 h-6 text-white" />,
      whyItMatters: "Eleva o ticket médio (AOV) em até 3.2x comparado a lojas de moda convencionais."
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white pb-32 selection:bg-[#D4AF37] selection:text-black">
      
      {/* Premium Hero Section */}
      <div className="relative px-6 pt-24 pb-16 overflow-hidden">
         <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[500px] bg-gradient-to-b from-[#D4AF37]/10 via-transparent to-transparent blur-[120px] pointer-events-none" />
         
         <div className="relative z-10 flex flex-col items-center text-center space-y-6">
            <div className="w-16 h-px bg-[#D4AF37] mb-2 shadow-[0_0_20px_rgba(212,175,55,0.8)]" />
            <Text className="text-[10px] uppercase font-bold tracking-[0.6em] text-[#D4AF37]">Business Intelligence Proof</Text>
            <Heading as="h1" className="text-4xl tracking-tighter uppercase max-w-[320px] leading-none">
               Por que o Venus Vende Mais?
            </Heading>
            <Text className="text-sm text-white/40 max-w-[280px] leading-relaxed italic">
               A prova matemática de como a curadoria inteligente e a visualização virtual transformam desejo em faturamento.
            </Text>
         </div>
      </div>

      <div className="px-6 space-y-16">
        
        {/* Core KPIs - THE PITCH (Step 1) */}
        <div className="grid grid-cols-1 gap-6">
           <div className="p-10 rounded-[60px] bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 relative overflow-hidden group">
              <div className="absolute bottom-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                 <TrendingUp size={120} />
              </div>
              <div className="space-y-6 relative z-10">
                 <div className="flex items-baseline gap-3">
                    <Heading as="h2" className="text-6xl tracking-tighter text-white">25%</Heading>
                    <ArrowUpRight className="w-6 h-6 text-green-500" />
                 </div>
                 <div className="space-y-1">
                    <Heading as="h3" className="text-md uppercase tracking-widest font-bold">Taxa de Conversão</Heading>
                    <Text className="text-white/30 text-xs uppercase tracking-widest">Industry Avg: 2.3%</Text>
                 </div>
                 <div className="h-px w-full bg-white/5" />
                 <Text className="text-xs text-white/60 leading-relaxed max-w-[240px]">
                    Nossa taxa de conversão é <strong>10x superior</strong> ao e-commerce tradicional devido ao funil de curadoria personalizada.
                 </Text>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-6">
              <div className="p-8 rounded-[48px] bg-white/[0.03] border border-white/5 space-y-4">
                 <Heading as="h2" className="text-3xl tracking-tighter">R$ 2.4k</Heading>
                 <Text className="text-[9px] uppercase tracking-widest text-white/40 font-bold leading-tight">Ticket Médio (AOV)</Text>
                 <Text className="text-[10px] text-[#D4AF37] font-bold">3.2x BOOST</Text>
              </div>
              <div className="p-8 rounded-[48px] bg-white/[0.03] border border-white/5 space-y-4">
                 <Heading as="h2" className="text-3xl tracking-tighter">+45%</Heading>
                 <Text className="text-[9px] uppercase tracking-widest text-white/40 font-bold leading-tight">Decisão via Try-On</Text>
                 <Text className="text-[10px] text-[#D4AF37] font-bold">GAP KILLER</Text>
              </div>
           </div>
        </div>

        {/* Visual Funnel (Step 3) */}
        <section className="space-y-8">
           <div className="flex flex-col items-center text-center gap-2">
              <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">O Funil de Persuasão</Heading>
              <Text className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Engagement Journey</Text>
           </div>
           
           <div className="space-y-4">
              {funnelStages.map((stage, i) => (
                <div key={i} className={`p-6 rounded-[32px] border flex items-center justify-between transition-all ${stage.success ? "bg-[#D4AF37] text-black border-[#D4AF37]" : stage.highlight ? "bg-white/[0.08] border-[#D4AF37]/30" : "bg-white/[0.02] border-white/5 opacity-60"}`}>
                   <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${stage.success ? "bg-black text-[#D4AF37]" : "bg-white/10 text-white/40"}`}>{i+1}</div>
                      <div className="flex flex-col">
                         <span className={`text-[10px] uppercase font-bold tracking-widest ${stage.success ? "text-black/60" : "text-white/40"}`}>{stage.desc}</span>
                         <Heading as="h4" className="text-sm tracking-tight">{stage.name}</Heading>
                      </div>
                   </div>
                   <Text className="text-xl tracking-tighter font-serif">{stage.value}</Text>
                </div>
              ))}
           </div>
        </section>

        {/* Value Interpretation (Step 2) */}
        <section className="space-y-8">
           <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">A Ciência das Vendas</Heading>
           <div className="space-y-6">
              {valueDrivers.map((driver, i) => (
                <div key={i} className="p-10 rounded-[60px] bg-white/[0.03] border border-white/10 space-y-8 relative group overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 blur-[80px] -mr-16 -mt-16" />
                   
                   <div className="flex items-center justify-between">
                      <div className="w-14 h-14 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
                         {driver.icon}
                      </div>
                      <div className="flex flex-col items-end">
                         <span className="text-3xl tracking-tighter text-[#D4AF37]">{driver.metric}</span>
                         <span className="text-[10px] uppercase font-bold tracking-widest text-[#D4AF37]">{driver.label}</span>
                      </div>
                   </div>
                   
                   <div className="space-y-4">
                      <Heading as="h4" className="text-xl tracking-tight">{driver.title}</Heading>
                      <Text className="text-sm text-white/60 leading-relaxed italic">&quot;{driver.desc}&quot;</Text>
                      
                      <div className="pt-6 border-t border-white/5">
                         <div className="flex items-start gap-4">
                            <ShieldCheck className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            <div className="space-y-1">
                               <span className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Por que isso importa</span>
                               <Text className="text-xs text-white/80 leading-relaxed font-medium">{driver.whyItMatters}</Text>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </section>

        {/* Revenue Opportunities (Step 4) */}
        <section className="p-10 rounded-[60px] bg-[#D4AF37] text-black space-y-10 shadow-[0_0_80px_rgba(212,175,55,0.2)]">
           <div className="space-y-2">
              <Heading as="h3" className="text-xl uppercase tracking-tighter">O Potencial Adormecido</Heading>
              <Text className="text-xs text-black/60 font-medium uppercase tracking-widest">Revenue Growth Analytics</Text>
           </div>
           
           <div className="space-y-6">
              <div className="flex items-start gap-5">
                 <div className="w-10 h-10 rounded-2xl bg-black/10 flex items-center justify-center flex-shrink-0">
                    <MousePointer2 className="w-5 h-5" />
                 </div>
                 <div className="space-y-1">
                    <Heading as="h4" className="text-base tracking-tight leading-tight">Recupere 28% de Desistência</Heading>
                    <Text className="text-sm text-black/60 leading-relaxed">
                       Detectamos um gargalo na transição para o produto individual. Corrigindo isso, o faturamento estimado sobe em <strong>+R$ 45.000/mês</strong>.
                    </Text>
                 </div>
              </div>

              <div className="flex items-start gap-5">
                 <div className="w-10 h-10 rounded-2xl bg-black/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5" />
                 </div>
                 <div className="space-y-1">
                    <Heading as="h4" className="text-base tracking-tight leading-tight">Alavancagem de Bundle</Heading>
                    <Text className="text-sm text-black/60 leading-relaxed">
                       Aumentar a exposição de looks completos no topo da página triplica a probabilidade de fechamento de carrinho de alto ticket.
                    </Text>
                 </div>
              </div>
           </div>
           
           <VenusButton variant="solid" className="w-full py-8 h-auto bg-black text-[#D4AF37] rounded-full text-[11px] font-bold uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all">
              Ativar Engine Completa agora
           </VenusButton>
        </section>

        {/* Footer Proof (Step 5) */}
        <footer className="pt-20 pb-40 text-center space-y-6 border-t border-white/5">
           <div className="flex justify-center -space-x-3 mb-6">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-black bg-[#111] overflow-hidden">
                   <img src={`https://i.pravatar.cc/150?u=${i*100}`} alt="Merchant" />
                </div>
              ))}
              <div className="w-10 h-10 rounded-full border-2 border-black bg-[#D4AF37] flex items-center justify-center text-black text-[10px] font-bold">+82</div>
           </div>
           <Heading as="h3" className="text-lg uppercase tracking-tight">82 lojistas de luxo já operam com Venus</Heading>
           <Text className="text-[10px] text-white/20 uppercase tracking-[0.5em] font-mono uppercase">Validated excellence · 2026</Text>
        </footer>

      </div>

      {/* Floating Accent */}
      <div className="fixed bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#D4AF37]/5 to-transparent pointer-events-none -z-10" />
    </div>
  );
}
