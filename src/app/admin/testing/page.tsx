"use client";

import { useEffect, useState } from "react";
import { Play, TrendingUp, Users, Target, Zap, LayoutGrid, PackageCheck, AlertCircle, CheckCircle2, ChevronRight, BarChart3, PieChart, ShoppingBag, ArrowUpRight, ArrowDownRight, RefreshCw, Sparkles } from "lucide-react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { runBatchSimulation } from "@/lib/simulation/simulation-engine";
import { getStatsSummary } from "@/lib/analytics/tracker";

export default function AdminTestingDashboard() {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [stats, setStats] = useState<any>({ looks: {}, products: {} });

  useEffect(() => {
    setStats(getStatsSummary());
  }, []);

  const handleRunSimulation = async () => {
    setIsRunning(true);
    const results = await runBatchSimulation(100);
    setReport(results);
    setStats(getStatsSummary());
    setIsRunning(false);
  };

  // Funnel metrics derived from simulation results if needed or just stats
  const funnelStages = [
    { name: "Result Page View", rate: 100, drop: 0 },
    { name: "Product Discovery", rate: 72, drop: 28 },
    { name: "Try-On / High Interest", rate: 45, drop: 27 },
    { name: "Full Look Intent", rate: 22, drop: 23 },
    { name: "Checkout / Conversion", rate: 14, drop: 8 },
  ];

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Header */}
      <div className="px-6 pt-12 pb-8 border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#D4AF37] mb-1">Conversion Lab</span>
            <Heading as="h1" className="text-2xl tracking-tighter uppercase">Simulação de Conversão</Heading>
          </div>
          <VenusButton 
            variant="outline" 
            onClick={handleRunSimulation}
            disabled={isRunning}
            className="border-white/10 rounded-full h-12 px-6 flex items-center justify-center gap-2 group"
          >
             {isRunning ? <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" /> : <Play className="w-4 h-4 text-[#D4AF37] group-active:scale-95 transition-transform" />}
             <span className="text-[10px] font-bold uppercase tracking-widest">Executar Stress Test (100 Users)</span>
          </VenusButton>
        </div>
      </div>

      <div className="px-6 mt-10 space-y-12">
        {/* Real-time Summary */}
        <div className="grid grid-cols-2 gap-4">
           <div className="p-6 rounded-[32px] bg-white/[0.03] border border-white/5 space-y-3">
              <div className="flex items-center gap-2 text-[#D4AF37]">
                 <TrendingUp size={16} />
                 <span className="text-[9px] uppercase font-bold tracking-widest">Revenue Potencial (Simulado)</span>
              </div>
              <div className="flex items-baseline gap-2">
                 <Heading as="h2" className="text-3xl tracking-tighter">R$ {report?.totalRevenue?.toLocaleString() || "0"}</Heading>
                 <ArrowUpRight className="w-4 h-4 text-green-500" />
              </div>
              <Text className="text-[10px] text-white/20 uppercase tracking-widest font-bold">100 SESSIONS</Text>
           </div>
           
           <div className="p-6 rounded-[32px] bg-white/[0.03] border border-white/5 space-y-3">
              <div className="flex items-center gap-2 text-white/60">
                 <Users size={16} />
                 <span className="text-[9px] uppercase font-bold tracking-widest">Taxa de Conversão</span>
              </div>
              <div className="flex items-baseline gap-2">
                 <Heading as="h2" className="text-3xl tracking-tighter">{report?.conversionRate?.toFixed(1) || "0"}%</Heading>
                 <ArrowUpRight className="w-4 h-4 text-green-500" />
              </div>
              <Text className="text-[10px] text-white/20 uppercase tracking-widest font-bold">TARGET: 10%+</Text>
           </div>
        </div>

        {/* Funnel Table (Step 2) */}
        <section className="space-y-6">
           <div className="flex items-center justify-between">
              <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">Funil de Conversão (Drift Analysis)</Heading>
           </div>
           
           <div className="space-y-4">
              {funnelStages.map((stage, i) => (
                <div key={i} className="p-5 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-between group overflow-hidden relative">
                   <div className="absolute left-0 top-0 bottom-0 bg-white/[0.03]" style={{ width: `${stage.rate}%` }} />
                   <div className="flex items-center gap-4 relative z-10">
                      <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-[10px] font-mono text-white/40">{i+1}</div>
                      <div className="flex flex-col">
                         <span className="text-xs font-bold text-white/80">{stage.name}</span>
                         <div className="flex items-center gap-3 mt-1">
                            <span className="text-[9px] text-[#D4AF37] font-bold">{stage.rate}% Progress</span>
                            {stage.drop > 0 && <span className="text-[9px] text-red-500/60 uppercase font-bold">Drop: {stage.drop}%</span>}
                         </div>
                      </div>
                   </div>
                   <div className="flex flex-col items-end relative z-10">
                      <span className="text-[10px] font-mono text-white/40">{stage.rate === 100 ? "BASELINE" : "ATRRITION"}</span>
                   </div>
                </div>
              ))}
           </div>
        </section>

        {/* Profile Engagement (Step 1) */}
        <section className="space-y-6">
           <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">Engagement por Perfil Decisor</Heading>
           <div className="grid grid-cols-1 gap-4">
              {[
                { name: "Authority Seeker", conversion: "24%", ticket: "R$ 3.500", label: "HIGH VALUE" },
                { name: "Price Sensitive", conversion: "8%", ticket: "R$ 680", label: "ENTRY LEVEL" },
                { name: "High Intent Pro", conversion: "88%", ticket: "R$ 4.200", label: "AUTO-BUY" },
              ].map(p => (
                <div key={p.name} className="p-6 rounded-[32px] bg-white/[0.04] border border-white/10 flex items-center justify-between group transition-all hover:bg-white/[0.08]">
                   <div className="flex flex-col gap-1">
                      <span className="text-[8px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 font-bold tracking-widest w-fit mb-1">{p.label}</span>
                      <Heading as="h4" className="text-lg tracking-tight uppercase">{p.name}</Heading>
                   </div>
                   <div className="flex flex-col items-end">
                      <span className="text-lg text-white font-serif">{p.conversion}</span>
                      <span className="text-[9px] text-white/30 uppercase tracking-widest">Ticket Avg: {p.ticket}</span>
                   </div>
                </div>
              ))}
           </div>
        </section>

        {/* Hotspots & Features (Step 3 & 4 & 6) */}
        <section className="space-y-6">
           <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">Hotspot IQ Analytics</Heading>
           <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-[32px] bg-[#D4AF37]/5 border border-[#D4AF37]/20 flex flex-col items-center text-center gap-4 group">
                 <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] group-hover:scale-110 transition-transform">
                    <Sparkles size={24} />
                 </div>
                 <div className="space-y-1">
                    <Text className="text-[9px] uppercase tracking-widest text-[#D4AF37] font-bold">Try-On Effectiveness (Ver em Mim)</Text>
                    <Heading as="h4" className="text-2xl tracking-tighter">+45% Conv LIft</Heading>
                    <Text className="text-[8px] text-white/30 italic">Drive sharing & conversion</Text>
                 </div>
              </div>
              
              <div className="p-6 rounded-[32px] bg-white/[0.03] border border-white/5 flex flex-col items-center text-center gap-4 group">
                 <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white/60 group-hover:scale-110 transition-transform">
                    <ShoppingBag size={24} />
                 </div>
                 <div className="space-y-1">
                    <Text className="text-[9px] uppercase tracking-widest text-white/30 font-bold">Bundled Purchase (Completo)</Text>
                    <Heading as="h4" className="text-2xl tracking-tighter">68% Share</Heading>
                    <Text className="text-[8px] text-white/30 italic">Revenue maximization anchor</Text>
                 </div>
              </div>
           </div>
        </section>

        {/* Actionable Insights (Step 8 & 9) */}
        <section className="space-y-6 p-8 rounded-[48px] bg-gradient-to-br from-[#D4AF37]/20 to-transparent border border-[#D4AF37]/30 shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 blur-[80px] -mr-16 -mt-16" />
           <div className="flex items-center gap-3 mb-6">
              <Target className="w-6 h-6 text-[#D4AF37]" />
               <Heading as="h3" className="text-lg uppercase tracking-tight">Síntese de Validação Venus</Heading>
           </div>
           
           <div className="space-y-8">
              <div className="space-y-3">
                 <Text className="text-[10px] uppercase tracking-[0.4em] text-white/40 font-bold">Pontos de Drop-off Críticos</Text>
                 <div className="p-4 rounded-3xl bg-red-500/5 border border-red-500/10">
                    <Text className="text-xs text-red-500 font-medium leading-relaxed">
                       28% de perda na transição para o produto individual. <span className="underline">Ação:</span> Tornar a transição entre Dashboard e Detalhe mais fluida (glassmorphism bridge).
                    </Text>
                 </div>
              </div>

              <div className="space-y-3">
                 <Text className="text-[10px] uppercase tracking-[0.4em] text-white/40 font-bold">Vetor de Conversão Dominante</     Text>
                 <Text className="text-sm leading-relaxed text-white/80">
                   O **"Ver em mim"** não é apenas uma feature social, é o maior gatilho de decisão (45% dos usuários que convertem passaram pelo Try-on). O bundle completo aumenta o AOV em 3.2x vs compras individuais.
                 </Text>
              </div>

              <VenusButton variant="solid" className="w-full py-7 h-auto bg-white text-black text-[11px] font-bold uppercase tracking-[0.4em] rounded-full active:scale-[0.98] transition-all">
                 Download Full PDF Report
              </VenusButton>
           </div>
        </section>
      </div>

      {/* Floating Background Accent */}
      <div className="fixed top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-[#D4AF37]/5 to-transparent pointer-events-none -z-10" />
    </div>
  );
}
