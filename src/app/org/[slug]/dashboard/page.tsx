"use client";

import { LayoutGrid, ShoppingBag, Eye, Share2, PackageCheck, Star, Users, Briefcase, Settings, TrendingUp, Sparkles, MessageSquare, Plus, Edit3, Image as ImageIcon, Tag, Target, ArrowUpRight, ArrowDownRight, ChevronRight, PieChart, Activity, Zap, Layers, AlertCircle, BrainCircuit } from "lucide-react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import Link from "next/link";

export default function MerchantDashboard({ params }: { params: { slug: string } }) {
  
  const stats = [
    { label: "Vendas Totais", value: "R$ 420.500", trend: "+12.4%", icon: <DollarSign size={18} className="text-[#D4AF37]" /> },
    { label: "Ticket Médio", value: "R$ 1.840", trend: "+2.1%", icon: <TrendingUp size={18} className="text-[#D4AF37]" /> },
    { label: "Conversão Look Full", value: "24.2%", trend: "+5.1%", icon: <ShoppingBag size={18} className="text-[#D4AF37]" /> },
    { label: "Try-On Retention", value: "45.1%", trend: "+3.4%", icon: <Zap size={18} className="text-[#D4AF37]" /> },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Merchant Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-white/5 flex flex-col p-6 space-y-10 sticky top-0 h-screen">
         <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full border border-[#D4AF37] flex items-center justify-center text-[#D4AF37] font-serif font-bold">M</div>
            <Heading as="h1" className="text-sm tracking-widest uppercase">{params.slug || "Maison Elite"}</Heading>
         </div>

         <nav className="flex-1 space-y-2">
            <NavItem icon={<Heading as="h4" className="text-[10px]">🏠</Heading>} label="Executivo" active />
            <NavItem icon={<ImageIcon size={16} />} label="Catálogo AI" />
            <NavItem icon={<Activity size={16} />} label="Performance" />
            <NavItem icon={<Users size={16} />} label="Audiência" />
            <NavItem icon={<Sparkles size={16} />} label="Sujestões IA" />
            <NavItem icon={<Settings size={16} />} label="Configurações" />
         </nav>

         <div className="p-4 rounded-2xl bg-[#D4AF37]/5 border border-[#D4AF37]/10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-bold">JD</div>
            <div className="flex flex-col">
               <span className="text-[10px] font-bold text-white/80">João Delaury</span>
               <span className="text-[8px] text-[#D4AF37] uppercase tracking-widest leading-none">Store Owner</span>
            </div>
         </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-12 overflow-y-auto no-scrollbar">
         <header className="flex items-center justify-between mb-16">
            <div className="space-y-1">
               <div className="flex items-center gap-2">
                  <div className="w-px h-6 bg-[#D4AF37]" />
                  <Text className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#D4AF37]">Maison Elite Dashboard</Text>
               </div>
               <Heading as="h1" className="text-3xl tracking-tighter uppercase whitespace-nowrap">Inteligência de Faturamento</Heading>
            </div>
            <div className="flex gap-4">
               <VenusButton variant="outline" className="border-white/10 rounded-full text-[10px] tracking-widest uppercase font-bold h-12 px-6">Exportar Dossiê</VenusButton>
               <VenusButton variant="solid" className="bg-white text-black rounded-full text-[10px] tracking-widest uppercase font-bold h-12 px-6">Adicionar Produto</VenusButton>
            </div>
         </header>

         {/* Part 4: Real-Time WhatsApp Alert System (Intent-driven triggers) */}
         <div className="mb-16 animate-in slide-in-from-top-4 duration-700">
            <div className="p-10 rounded-[56px] bg-gradient-to-br from-[#D4AF37]/20 to-transparent border border-[#D4AF37]/30 flex flex-col md:flex-row items-center justify-between gap-10 group hover:border-[#D4AF37]/50 transition-all">
               <div className="flex flex-col md:flex-row items-center gap-10">
                  <div className="relative">
                     <div className="w-24 h-24 rounded-full bg-[#D4AF37] flex items-center justify-center text-black font-serif text-3xl font-bold shadow-[0_0_50px_rgba(212,175,55,0.4)] group-hover:scale-110 transition-transform">A</div>
                     <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-4 border-black flex items-center justify-center animate-bounce">
                        <AlertCircle size={10} className="text-white" />
                     </div>
                  </div>
                  <div className="space-y-4 text-center md:text-left">
                     <div className="flex items-center justify-center md:justify-start gap-3">
                        <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
                        <Text className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#D4AF37]">Alta Intenção: Arthur Rezende</Text>
                     </div>
                     <Heading as="h3" className="text-3xl tracking-tighter uppercase leading-none">Aguardando intervenção humana</Heading>
                     <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                        <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white/60 flex items-center gap-2">
                           <BrainCircuit size={12} className="text-[#D4AF37]" /> AI Detect: Fechamento Próximo
                        </div>
                        <div className="px-3 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[9px] font-bold uppercase tracking-widest text-[#D4AF37] flex items-center gap-2">
                           <Activity size={12} /> Score: 85%
                        </div>
                        <Text className="text-[10px] uppercase tracking-widest text-white/30 italic">Validando Look &quot;O Arquiteto&quot; · 4 Try-ons</Text>
                     </div>
                  </div>
               </div>
               <Link href={`/org/${params.slug}/whatsapp/inbox`} className="w-full md:w-auto">
                  <VenusButton variant="solid" className="w-full h-20 px-12 bg-white text-black text-[12px] font-bold uppercase tracking-[0.4em] rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all">
                     Assumir Conversa & Fechar
                  </VenusButton>
               </Link>
            </div>
         </div>

         {/* KPIs */}
         <div className="grid grid-cols-4 gap-6 mb-16">
            {stats.map((s, i) => (
              <div key={i} className="p-8 rounded-[48px] bg-white/[0.03] border border-white/5 space-y-4 hover:bg-white/[0.05] transition-colors relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    {s.icon}
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-white/30">{s.label}</span>
                    <span className="text-[10px] font-bold text-green-500 flex items-center gap-1"><ArrowUpRight size={10} /> {s.trend}</span>
                 </div>
                 <Heading as="h2" className="text-3xl tracking-tighter">{s.value}</Heading>
              </div>
            ))}
         </div>

         <div className="grid grid-cols-3 gap-8">
            <section className="col-span-2 space-y-12">
               {/* Catalog Quick view (Enrichment Status) */}
               <div className="space-y-8">
                  <div className="flex items-center justify-between px-2">
                     <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">Controle de Catálogo AI</Heading>
                     <button className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest flex items-center gap-2">Gerenciar Acervo <ChevronRight size={12} /></button>
                  </div>
                  
                  <div className="space-y-4">
                     {[
                       { name: "Blazer Lã Merino", status: "Enriquecido", score: 98, updated: "2h atrás" },
                       { name: "Sombra Turtleneck", status: "Revisão Necessária", score: 65, updated: "5min atrás", alert: true },
                       { name: "Calça Tailored Dark", status: "Enriquecido", score: 92, updated: "1 dia atrás" },
                     ].map((item, i) => (
                       <div key={i} className="p-6 rounded-[32px] bg-white/[0.02] border border-white/5 flex items-center justify-center gap-8 relative hover:bg-white/[0.04]">
                          <div className="w-12 h-12 rounded-2xl bg-white/10 overflow-hidden">
                             <img src={`https://i.pravatar.cc/150?u=prod_${i}`} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex flex-col flex-1">
                             <Heading as="h4" className="text-base tracking-tight uppercase leading-none mb-1">{item.name}</Heading>
                             <span className="text-[9px] uppercase tracking-widest text-white/20 font-bold">{item.status} · {item.updated}</span>
                          </div>
                          <div className="flex items-center gap-8">
                             <div className="flex flex-col items-end">
                                <span className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-1">Look Readiness</span>
                                <span className={`text-lg font-serif ${item.score > 80 ? "text-[#D4AF37]" : "text-yellow-500"}`}>{item.score}%</span>
                             </div>
                             {item.alert ? (
                               <div className="p-3 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 active:scale-95 transition-all">
                                  <Edit3 size={16} />
                               </div>
                             ) : (
                               <div className="p-3 rounded-full bg-white/5 text-white/20 hover:text-white hover:bg-white/10 transition-colors">
                                  <Plus size={16} />
                               </div>
                             )}
                          </div>
                       </div>
                     ))}
                  </div>
               </div>

               {/* Audience Signals */}
               <div className="space-y-8">
                  <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">Comportamento da Audiência</Heading>
                  <div className="grid grid-cols-2 gap-6">
                     <div className="p-10 rounded-[60px] bg-white/[0.03] border border-white/5 space-y-6">
                        <div className="flex items-center gap-3 text-[#D4AF37]">
                           <Target size={18} />
                           <span className="text-[10px] uppercase font-bold tracking-widest">Intenção Dominante</span>
                        </div>
                        <Heading as="h4" className="text-3xl tracking-tighter">Eventos Corporativos</Heading>
                        <Text className="text-xs text-white/40 leading-relaxed uppercase tracking-widest font-bold">Mapeado em 62% das simulações</Text>
                     </div>
                     <div className="p-10 rounded-[60px] bg-white/[0.03] border border-white/5 space-y-6">
                        <div className="flex items-center gap-3 text-[#D4AF37]">
                           <Layers size={18} />
                           <span className="text-[10px] uppercase font-bold tracking-widest">Estética Preferida</span>
                        </div>
                        <Heading as="h4" className="text-3xl tracking-tighter">Quiet Luxury</Heading>
                        <Text className="text-xs text-white/40 leading-relaxed uppercase tracking-widest font-bold">84% Engagement Rate</Text>
                     </div>
                  </div>
               </div>
            </section>

            {/* AI Insights Sidebar */}
            <section className="space-y-8">
               <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-[#D4AF37] font-bold text-center">IA Strategic Advisor</Heading>
               
               <div className="p-8 rounded-[48px] bg-gradient-to-br from-[#D4AF37]/10 to-transparent border border-[#D4AF37]/20 space-y-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 blur-[80px] -mr-16 -mt-16" />
                  
                  <div className="space-y-4">
                     <div className="flex items-center gap-3 text-[#D4AF37]">
                        <Zap size={18} />
                        <span className="text-[10px] uppercase font-bold tracking-widest">Oportunidade Detectada</span>
                     </div>
                     <div className="p-6 rounded-3xl bg-black border border-white/5 space-y-2">
                        <span className="text-[9px] uppercase font-bold text-green-500 tracking-widest">+ R$ 42k Potencial</span>
                        <Heading as="h5" className="text-base tracking-tight leading-tight">Gargalo no Try-On detectado no look &quot;Noite Contemporânea&quot;.</Heading>
                        <Text className="text-[10px] text-white/40 leading-relaxed">O sistema sugere trocar a imagem de textura principal para seda fria para aumentar o desejo em 24%.</Text>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <div className="flex items-center gap-3 text-[#D4AF37]">
                        <TrendingUp size={18} />
                        <span className="text-[10px] uppercase font-bold tracking-widest">Performance de Bundle</span>
                     </div>
                     <div className="p-6 rounded-3xl bg-black border border-white/5 space-y-2">
                        <span className="text-[9px] uppercase font-bold text-[#D4AF37] tracking-widest">Aumentar AOV</span>
                        <Heading as="h5" className="text-base tracking-tight leading-tight">Look &quot;Executive Minimalism&quot; tem 12% mais conversão quando o relógio prata é o acessório 1.</Heading>
                        <Text className="text-[10px] text-white/40 leading-relaxed">Sugestão: Tornar este bundle fixo nas recomendações premium.</Text>
                     </div>
                  </div>

                  <VenusButton variant="solid" className="w-full py-6 h-auto bg-white text-black text-[10px] font-bold uppercase tracking-[0.3em] rounded-full shadow-2xl active:scale-95 transition-all">Ativar Otimizações IA</VenusButton>
               </div>

               <div className="p-8 rounded-[48px] bg-white/[0.03] border border-white/5 space-y-4">
                  <div className="flex items-center gap-3 text-white/40">
                     <PieChart size={18} />
                     <span className="text-[9px] uppercase font-bold tracking-widest">Distribuição de Inventário</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex">
                     <div className="h-full bg-[#D4AF37] w-[60%]" title="Looks" />
                     <div className="h-full bg-white/20 w-[30%]" title="Acessórios" />
                     <div className="h-full bg-white/5 w-[10%]" title="Enriching" />
                  </div>
                  <div className="flex justify-between text-[8px] uppercase tracking-widest text-white/20 font-bold">
                     <span>Looks (60%)</span>
                     <span>Acessórios (30%)</span>
                  </div>
               </div>
            </section>
         </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: any, label: string, active?: boolean }) {
  return (
    <button className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${active ? "bg-white text-black shadow-2xl" : "text-white/40 hover:bg-white/5 hover:text-white"}`}>
       {icon}
       <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}

function DollarSign(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
