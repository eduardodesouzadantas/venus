"use client";

import { useState } from "react";
import { MessageSquare, Link as LinkIcon, Database, ArrowLeft, CheckCircle2, AlertCircle, X, ChevronRight, Zap, ShieldCheck } from "lucide-react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import Link from "next/link";

export default function MerchantIntegrations({ params }: { params: { slug: string } }) {
  const [waConnected, setWaConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const toggleWa = () => {
    setIsLoading(true);
    setTimeout(() => {
      setWaConnected(!waConnected);
      setIsLoading(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Merchant Sidebar */}
      <aside className="w-64 border-r border-white/5 flex flex-col p-6 space-y-10 sticky top-0 h-screen">
         <Link href={`/org/${params.slug}/dashboard`} className="flex items-center gap-3 px-2 group">
            <ArrowLeft size={16} className="text-white/20 group-hover:text-white transition-colors" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">Dashboard</span>
         </Link>

         <nav className="flex-1 space-y-2">
            <NavItem icon={<MessageSquare size={16} />} label="WhatsApp Concierge" active />
            <NavItem icon={<LinkIcon size={16} />} label="API Corporativa" />
            <NavItem icon={<Database size={16} />} label="CRM Connect" />
         </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-12 overflow-y-auto no-scrollbar">
         <header className="flex items-center justify-between mb-16">
            <div className="space-y-1">
               <div className="flex items-center gap-2">
                  <div className="w-px h-6 bg-[#D4AF37]" />
                  <Text className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#D4AF37]">Maison Elite Ecosystem</Text>
               </div>
               <Heading as="h1" className="text-3xl tracking-tighter uppercase whitespace-nowrap">Conectividade & Dados</Heading>
            </div>
            <VenusButton variant="outline" className="border-white/10 rounded-full text-[10px] tracking-widest uppercase font-bold h-12 px-8">Refresh Sync</VenusButton>
         </header>

         <div className="max-w-2xl space-y-12">
            {/* WhatsApp Section (Part 6) */}
            <section className="space-y-8">
               <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">Canais de Conversão</Heading>
               
               <div className={`p-10 rounded-[60px] border transition-all duration-700 ${waConnected ? "bg-green-500/[0.03] border-green-500/20 shadow-[0_0_80px_rgba(34,197,94,0.05)]" : "bg-white/[0.03] border-white/5"}`}>
                  <div className="flex items-start justify-between mb-10">
                     <div className="flex items-center gap-6">
                        <div className={`w-20 h-20 rounded-[32px] flex items-center justify-center transition-all duration-700 ${waConnected ? "bg-green-500 text-black shadow-[0_0_40px_rgba(34,197,94,0.4)]" : "bg-white/5 text-white/20"}`}>
                           <MessageSquare size={32} />
                        </div>
                        <div className="flex flex-col">
                           <Heading as="h4" className="text-2xl tracking-tighter uppercase mb-1">WhatsApp Concierge</Heading>
                           <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${waConnected ? "bg-green-500" : "bg-red-500"}`} />
                              <span className="text-[9px] uppercase font-bold tracking-widest text-white/40">
                                {waConnected ? "Status: Conectado & Sincronizando" : "Status: Desconectado"}
                              </span>
                           </div>
                        </div>
                     </div>
                     <VenusButton 
                       onClick={toggleWa}
                       variant={waConnected ? "outline" : "solid"} 
                       className={`rounded-full text-[9px] font-bold uppercase tracking-widest h-10 px-6 transition-all ${waConnected ? "border-red-500/20 text-red-500 bg-red-500/5" : "bg-[#D4AF37] text-black"}`}>
                        {isLoading ? "Processando..." : (waConnected ? "Desconectar API" : "Conectar API")}
                     </VenusButton>
                  </div>

                  {!waConnected ? (
                    <div className="space-y-6 p-8 rounded-[40px] bg-black/40 border border-white/5 animate-in fade-in slide-in-from-bottom-2 duration-700">
                       <Text className="text-xs text-white/40 leading-relaxed max-w-sm">Insira o Token de Integração do Facebook Business para ativar o auto-atendimento Venus pelo WhatsApp.</Text>
                       <div className="space-y-4">
                          <input type="text" placeholder="Access Token (EAA...)" className="w-full h-14 bg-white/5 border border-white/10 rounded-3xl px-6 text-xs text-white/60 focus:border-[#D4AF37]/40 outline-none transition-all placeholder:text-white/10" />
                          <div className="flex gap-4">
                             <input type="text" placeholder="Business ID" className="flex-1 h-14 bg-white/5 border border-white/10 rounded-3xl px-6 text-xs text-white/60 focus:border-[#D4AF37]/40 outline-none transition-all placeholder:text-white/10" />
                             <input type="text" placeholder="Phone ID" className="flex-1 h-14 bg-white/5 border border-white/10 rounded-3xl px-6 text-xs text-white/60 focus:border-[#D4AF37]/40 outline-none transition-all placeholder:text-white/10" />
                          </div>
                       </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 animate-in zoom-in-95 duration-700">
                       <div className="p-6 rounded-[32px] bg-black/40 border border-white/5 space-y-2">
                          <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Mensagens Atendidas</span>
                          <Heading as="h5" className="text-2xl tracking-tighter">1.4k</Heading>
                       </div>
                       <div className="p-6 rounded-[32px] bg-black/40 border border-white/5 space-y-2">
                          <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Conversion Rate WA</span>
                          <Heading as="h5" className="text-2xl tracking-tighter text-[#D4AF37]">32.4%</Heading>
                       </div>
                    </div>
                  )}
               </div>
            </section>

            {/* Integration Future Roadmap (Part 6) */}
            <section className="space-y-8">
               <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">Roadmap de Conectividade</Heading>
               <div className="grid grid-cols-1 gap-4">
                  <div className="p-8 rounded-[48px] bg-white/[0.03] border border-white/5 flex items-center justify-between opacity-40 group hover:opacity-100 transition-opacity">
                     <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-white/20">
                           <Database size={24} />
                        </div>
                        <div className="flex flex-col">
                           <Heading as="h4" className="text-base tracking-tight uppercase leading-none mb-1">CRM Hyper-Personalization</Heading>
                           <span className="text-[8px] uppercase tracking-widest font-bold text-white/20">Em Desenvolvimento</span>
                        </div>
                     </div>
                     <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest">Q3 2026</span>
                  </div>
               </div>
            </section>

            {/* Integration Security (Part 7) */}
            <div className="p-8 rounded-[48px] bg-[#D4AF37]/5 border border-[#D4AF37]/20 flex items-start gap-4">
               <ShieldCheck className="w-5 h-5 text-[#D4AF37] flex-shrink-0 mt-1" />
               <div className="space-y-2">
                  <Heading as="h5" className="text-sm tracking-tight uppercase">Criptografia de Ponta-a-Ponta</Heading>
                  <Text className="text-[10px] text-white/40 leading-relaxed italic">
                     Todos os tokens de integração são criptografados no nível de tenant e nunca deixam o ambiente de execução seguro da Venus Engine.
                  </Text>
               </div>
            </div>
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
