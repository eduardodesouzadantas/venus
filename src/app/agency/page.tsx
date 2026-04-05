"use client";

import { LayoutGrid, Users, DollarSign, Zap, ShieldCheck, HeartPulse, Settings, FileText, ChevronRight, ArrowUpRight, TrendingUp, AlertCircle, Search, Filter, MessageSquare, Activity } from "lucide-react";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";

export default function AgencyDashboard() {
  
  const stats = [
    { label: "Total Merchants", value: "82", trend: "+12", icon: <Users className="w-5 h-5 text-[#D4AF37]" /> },
    { label: "Active Now", value: "65", trend: "+5", icon: <Activity className="w-5 h-5 text-green-500" /> },
    { label: "Platform MRR", value: "R$ 142k", trend: "+R$ 12k", icon: <DollarSign className="w-5 h-5 text-[#D4AF37]" /> },
    { label: "AI Health Score", value: "98%", trend: "STABLE", icon: <Zap className="w-5 h-5 text-[#D4AF37]" /> },
  ];

  const topMerchants = [
    { name: "Maison Elite", status: "Active", health: 95, revenue: "R$ 420k", ads: "Gold Plan", waActive: true, waVolume: "4.2k msgs" },
    { name: "Noir Concept", status: "Active", health: 88, revenue: "R$ 310k", ads: "Platinum", waActive: true, waVolume: "12k msgs" },
    { name: "Saphira Luxury", status: "Active", health: 62, revenue: "R$ 120k", ads: "Basic", risk: true, waActive: false, waVolume: "0" },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Agency Sidebar */}
      <aside className="w-64 border-r border-white/5 flex flex-col p-6 space-y-10 sticky top-0 h-screen overflow-y-auto no-scrollbar">
         <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-[#D4AF37] flex items-center justify-center text-black font-serif font-bold transition-transform hover:scale-110">V</div>
            <Heading as="h1" className="text-sm tracking-widest uppercase">Agency Master</Heading>
         </div>

         <nav className="flex-1 space-y-2">
            <NavItem icon={<div className="text-[10px] uppercase font-bold">🏠</div>} label="Comando" active />
            <NavItem icon={<Users size={16} />} label="Lojistas (Tenants)" />
            <NavItem icon={<MessageSquare size={16} />} label="WhatsApp Ops" />
            <NavItem icon={<DollarSign size={16} />} label="Financeiro" />
            <NavItem icon={<Zap size={16} />} label="AI Ops" />
            <NavItem icon={<HeartPulse size={16} />} label="Crescimento" />
            <NavItem icon={<ShieldCheck size={16} />} label="Controles" />
         </nav>


         <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden">
               <img src="https://i.pravatar.cc/150?u=agency_admin" alt="Admin" />
            </div>
            <div className="flex flex-col">
               <span className="text-[10px] font-bold text-white/80">Agency Owner</span>
               <span className="text-[8px] text-white/40 uppercase tracking-widest">Master Auth</span>
            </div>
         </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-12 overflow-y-auto">
         <header className="flex items-center justify-between mb-16">
            <div className="space-y-1">
               <Text className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#D4AF37]">Global Control Center</Text>
               <Heading as="h1" className="text-3xl tracking-tighter uppercase">Visão Macro da Plataforma</Heading>
            </div>
            <div className="flex gap-4">
               <VenusButton variant="outline" className="border-white/10 rounded-full text-[10px] tracking-widest uppercase font-bold h-12 px-6">Atualizar Rede</VenusButton>
               <VenusButton variant="solid" className="bg-white text-black rounded-full text-[10px] tracking-widest uppercase font-bold h-12 px-6">Novo Tenant</VenusButton>
            </div>
         </header>

         {/* Stats Grid */}
         <div className="grid grid-cols-4 gap-6 mb-16">
            {stats.map((s, i) => (
              <div key={i} className="p-8 rounded-[40px] bg-white/[0.03] border border-white/5 space-y-4">
                 <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center">{s.icon}</div>
                    <span className={`text-[10px] font-bold ${s.trend.startsWith('+') ? "text-green-500" : "text-white/40"}`}>{s.trend}</span>
                 </div>
                 <div className="space-y-1">
                    <Heading as="h2" className="text-3xl tracking-tighter">{s.value}</Heading>
                    <Text className="text-[10px] uppercase tracking-widest text-white/30 font-bold">{s.label}</Text>
                 </div>
              </div>
            ))}
         </div>

         <div className="grid grid-cols-3 gap-8">
            {/* Tenant Health Manager */}
            <section className="col-span-2 space-y-8">
               <div className="flex items-center justify-between px-2">
                  <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">Health Manager (Tenants)</Heading>
                  <button className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest flex items-center gap-2">Explorar Tudo <ChevronRight size={12} /></button>
               </div>

               <div className="space-y-4">
                  {topMerchants.map((m, i) => (
                    <div key={i} className="p-6 rounded-[32px] bg-white/[0.02] border border-white/5 flex items-center justify-between group transition-colors hover:bg-white/[0.04]">
                       <div className="flex items-center gap-6">
                          <div className={`w-3 h-3 rounded-full ${m.health > 80 ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]" : "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)]"}`} />
                          <div className="flex flex-col">
                             <Heading as="h4" className="text-lg tracking-tight uppercase">{m.name}</Heading>
                             <span className="text-[9px] uppercase font-bold tracking-widest text-white/20">Plano: {m.ads} · ID: 00{i+1}</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-12">
                          <div className="flex flex-col items-end">
                             <span className="text-[9px] uppercase font-bold tracking-widest text-white/30 mb-1">Health Score</span>
                             <span className={`text-lg font-serif ${m.health > 80 ? "text-white" : "text-yellow-500"}`}>{m.health}%</span>
                          </div>
                          <div className="flex flex-col items-end">
                             <span className="text-[9px] uppercase font-bold tracking-widest text-white/30 mb-1">Faturamento</span>
                             <span className="text-lg font-serif text-white">{m.revenue}</span>
                          </div>
                          {m.risk && (
                            <div className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[8px] font-bold tracking-widest animate-pulse">RISCO CHURN</div>
                          )}
                          <button className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-white/20 hover:text-white transition-colors group-hover:border-[#D4AF37]/40">
                             <Settings size={16} />
                          </button>
                       </div>
                    </div>
                  ))}
               </div>
            </section>

            {/* AI Ops & Support alerts */}
            <section className="space-y-8">
               <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">Alertas & AI Ops</Heading>
               
               <div className="p-8 rounded-[48px] bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20 space-y-6">
                  <div className="flex items-center gap-3 text-red-500">
                     <AlertCircle size={20} />
                     <span className="text-[9px] uppercase font-bold tracking-widest">Atenção Necessária</span>
                  </div>
                  <div className="space-y-4">
                     <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                        <span className="text-[10px] font-bold text-white/80">Saphira Luxury</span>
                        <Text className="text-[10px] text-white/40 leading-relaxed">Taxa de falha no AI Enrichment: 42%. Necessita intervenção manual.</Text>
                     </div>
                     <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                        <span className="text-[10px] font-bold text-white/80">Noir Concept</span>
                        <Text className="text-[10px] text-white/40 leading-relaxed">MRR estagnado há 3 semanas. Upsell do Try-On sugerido.</Text>
                     </div>
                  </div>
                  <VenusButton variant="solid" className="w-full py-6 h-auto bg-white/10 text-white border border-white/10 text-[9px] font-bold uppercase tracking-widest rounded-full">Abrir Suporte Master</VenusButton>
               </div>

               <div className="p-8 rounded-[48px] bg-white/[0.03] border border-white/5 space-y-6">
                  <div className="flex items-center gap-3 text-[#D4AF37]">
                     <Zap size={20} />
                     <span className="text-[8px] uppercase font-bold tracking-widest">Orquestração Gen-AI</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="p-4 rounded-2xl bg-black border border-white/5 space-y-1">
                        <span className="text-[9px] text-white/40 font-bold">Try-On Loads</span>
                        <span className="text-lg font-serif">12.4k</span>
                     </div>
                     <div className="p-4 rounded-2xl bg-black border border-white/5 space-y-1">
                        <span className="text-[9px] text-white/40 font-bold">Token Cost</span>
                        <span className="text-lg font-serif">R$ 1.2k</span>
                     </div>
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
    <button className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${active ? "bg-[#D4AF37] text-black shadow-[0_0_20px_rgba(212,175,55,0.4)]" : "text-white/40 hover:bg-white/5 hover:text-white"}`}>
       {icon}
       <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}

function ActivityIcon(props: any) {
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
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

