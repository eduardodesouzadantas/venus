"use client";

import { LayoutGrid, Settings, Lock, Palette, CreditCard, ChevronRight, Globe, Image as ImageIcon, ArrowLeft, LogOut, ShieldAlert } from "lucide-react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";

export default function MerchantSettings({ params }: { params: { slug: string } }) {
  const { logout, user } = useAuth();
  
  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Merchant Sidebar */}
      <aside className="w-64 border-r border-white/5 flex flex-col p-6 space-y-10 sticky top-0 h-screen">
         <Link href={`/org/${params.slug}/dashboard`} className="flex items-center gap-3 px-2 group">
            <ArrowLeft size={16} className="text-white/20 group-hover:text-white transition-colors" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">Dashboard</span>
         </Link>

         <nav className="flex-1 space-y-2">
            <NavItem icon={<Globe size={16} />} label="Loja & Branding" active />
            <NavItem icon={<Lock size={16} />} label="Segurança & Senha" />
            <NavItem icon={<CreditCard size={16} />} label="Plano & Faturamento" />
            <NavItem icon={<Settings size={16} />} label="Equipe" />
         </nav>

         <button onClick={logout} className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-center gap-3 group hover:bg-red-500/10 transition-colors">
            <LogOut size={16} className="text-red-500" />
            <div className="flex flex-col text-left">
               <span className="text-[10px] font-bold text-red-500">Sair da Conta</span>
               <span className="text-[8px] text-red-500/40 uppercase tracking-widest leading-none">Encerrar Sessão</span>
            </div>
         </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-12 overflow-y-auto no-scrollbar">
         <header className="flex items-center justify-between mb-16">
            <div className="space-y-1">
               <div className="flex items-center gap-2">
                  <div className="w-px h-6 bg-[#D4AF37]" />
                  <Text className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#D4AF37]">Maison Elite Configurações</Text>
               </div>
               <Heading as="h1" className="text-3xl tracking-tighter uppercase whitespace-nowrap">Gestão de Identidade</Heading>
            </div>
            <VenusButton variant="solid" className="bg-white text-black rounded-full text-[10px] tracking-widest uppercase font-bold h-12 px-8">Salvar Alterações</VenusButton>
         </header>

         <div className="max-w-2xl space-y-12">
            {/* Store Basics */}
            <section className="space-y-8">
               <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">Identidade da Loja</Heading>
               <div className="grid grid-cols-1 gap-8">
                  <div className="flex items-center gap-10 p-10 rounded-[60px] bg-white/[0.03] border border-white/5 group">
                     <div className="w-24 h-24 rounded-full border border-white/10 bg-white/5 flex items-center justify-center relative overflow-hidden group-hover:border-[#D4AF37]/40 transition-colors">
                        <img src="https://i.pravatar.cc/150?u=org_logo" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <ImageIcon size={24} className="text-white/60" />
                        </div>
                     </div>
                     <div className="space-y-4 flex-1">
                        <div className="space-y-1">
                           <Text className="text-[10px] uppercase font-bold tracking-widest text-[#D4AF37]">URL da Loja</Text>
                           <Text className="text-xl text-white font-serif tracking-tight">maison-elite.venus.ai</Text>
                        </div>
                        <button className="text-[10px] text-white/20 uppercase font-bold tracking-widest hover:text-[#D4AF37] transition-colors">Alterar Subdomínio</button>
                     </div>
                  </div>

                  <div className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[9px] uppercase font-bold tracking-widest text-white/30 ml-4">Nome da Instância</label>
                        <input type="text" defaultValue="Maison Elite" className="w-full h-14 bg-white/5 border border-white/10 rounded-3xl px-6 text-sm text-white focus:border-[#D4AF37]/40 outline-none transition-all" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[9px] uppercase font-bold tracking-widest text-white/30 ml-4">Biografía Curta (Meta)</label>
                        <textarea defaultValue="Curadoria de luxo silencioso para autoridade e elegância contemporânea." className="w-full h-32 bg-white/5 border border-white/10 rounded-[32px] p-6 text-sm text-white focus:border-[#D4AF37]/40 outline-none transition-all resize-none" />
                     </div>
                  </div>
               </div>
            </section>

            {/* Plan Info */}
            <section className="p-10 rounded-[60px] bg-gradient-to-br from-[#D4AF37]/10 via-transparent to-transparent border border-[#D4AF37]/20 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Palette size={120} className="text-[#D4AF37]" />
               </div>
               <div className="space-y-6 relative z-10">
                  <div className="flex items-center justify-between">
                     <span className="px-3 py-1 rounded-full bg-[#D4AF37] text-black text-[9px] font-bold uppercase tracking-widest">Plano Platinum</span>
                     <span className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest">Renovação em 12 Dias</span>
                  </div>
                  <div className="space-y-2">
                     <Heading as="h4" className="text-3xl tracking-tighter uppercase leading-none">Acesso Total Ativado</Heading>
                     <Text className="text-xs text-white/60 leading-relaxed">Você possui limites expandidos para geração de Try-On e Enrichment AI ilimitado.</Text>
                  </div>
                  <VenusButton variant="outline" className="border-white/20 text-white rounded-full text-[10px] tracking-widest uppercase font-bold h-12 px-8">Gerenciar Faturamento</VenusButton>
               </div>
            </section>

            {/* Security Danger Zone */}
            <section className="space-y-6">
               <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-red-500/40 font-bold">Protocolos Críticos</Heading>
               <div className="p-8 rounded-[48px] bg-red-500/[0.03] border border-red-500/10 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                     <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                        <ShieldAlert size={24} />
                     </div>
                     <div className="flex flex-col">
                        <Heading as="h4" className="text-base tracking-tight uppercase">Reset Master Password</Heading>
                        <Text className="text-[10px] text-white/30 uppercase tracking-widest font-bold font-mono leading-none">Last changed 42 days ago</Text>
                     </div>
                  </div>
                  <VenusButton variant="outline" className="border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-full text-[10px] tracking-widest uppercase font-bold h-12 px-8">Solicitar Reset</VenusButton>
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
