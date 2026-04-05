"use client";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { ShieldCheck, Briefcase, ChevronRight, Lock, Globe } from "lucide-react";
import Link from "next/link";

export default function AdminPortal() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/[0.05] via-transparent to-transparent">
      
      <div className="w-full max-w-lg space-y-12">
         <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#D4AF37] flex items-center justify-center text-black font-serif text-2xl font-bold shadow-[0_0_40px_rgba(212,175,55,0.4)]">V</div>
            <div className="space-y-1">
               <Text className="text-[10px] uppercase font-bold tracking-[0.6em] text-[#D4AF37]">Venus Architecture</Text>
               <Heading as="h1" className="text-3xl tracking-tighter uppercase">Portal de Controle</Heading>
            </div>
         </div>

         <div className="grid grid-cols-1 gap-6">
            {/* Agency Path */}
            <Link href="/agency" className="group">
               <div className="p-8 rounded-[48px] bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-[#D4AF37]/40 transition-all flex items-center justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                     <ShieldCheck size={120} />
                  </div>
                  <div className="flex items-center gap-6">
                     <div className="w-14 h-14 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-[#D4AF37] group-hover:text-black transition-all">
                        <Lock size={24} />
                     </div>
                     <div className="flex flex-col">
                        <Heading as="h3" className="text-xl tracking-tight uppercase">Agency Master</Heading>
                        <Text className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold">Multi-Tenant Control · Health Center</Text>
                     </div>
                  </div>
                  <ChevronRight size={20} className="text-white/10 group-hover:text-[#D4AF37] group-hover:translate-x-1 transition-all" />
               </div>
            </Link>

            {/* Merchant Path */}
            <Link href="/merchant" className="group">
               <div className="p-8 rounded-[48px] bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/20 transition-all flex items-center justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                     <Briefcase size={120} />
                  </div>
                  <div className="flex items-center gap-6">
                     <div className="w-14 h-14 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white group-hover:text-black transition-all">
                        <Globe size={24} />
                     </div>
                     <div className="flex flex-col">
                        <Heading as="h3" className="text-xl tracking-tight uppercase">Merchant Panel</Heading>
                        <Text className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold">Maison Elite · Catalog & Conversions</Text>
                     </div>
                  </div>
                  <ChevronRight size={20} className="text-white/10 group-hover:text-white group-hover:translate-x-1 transition-all" />
               </div>
            </Link>
         </div>

         {/* Separation Info */}
         <div className="p-10 rounded-[60px] bg-[#D4AF37]/5 border border-[#D4AF37]/20 flex items-start gap-5">
            <ShieldCheck className="w-6 h-6 text-[#D4AF37] flex-shrink-0 mt-1" />
            <div className="space-y-4">
               <Heading as="h4" className="text-sm tracking-tight uppercase">Protocolo de Isolamento</Heading>
               <Text className="text-xs text-white/60 leading-relaxed">
                  Os dados entre Agency (Master) e Merchant (Lojista) estão segregados em camadas de acesso independentes. Master Operators têm visão total da saúde da rede, enquanto Merchant Owners operam exclusivamente no escopo de suas unidades de negócio.
               </Text>
               <div className="flex items-center gap-8 pt-2">
                  <div className="flex flex-col gap-1">
                     <span className="text-[9px] text-[#D4AF37] font-bold uppercase tracking-widest">Agency Levels</span>
                     <span className="text-[8px] text-white/30 font-bold uppercase tracking-[0.2em]">Owner · Admin · Ops</span>
                  </div>
                  <div className="flex flex-col gap-1">
                     <span className="text-[9px] text-white/60 font-bold uppercase tracking-widest">Merchant Levels</span>
                     <span className="text-[8px] text-white/30 font-bold uppercase tracking-[0.2em]">Owner · Editor · Viewer</span>
                  </div>
               </div>
            </div>
         </div>

         <div className="flex justify-center pt-8">
            <Link href="/">
               <Text className="text-[10px] uppercase font-bold tracking-[0.4em] text-white/20 hover:text-white transition-colors underline underline-offset-8">Voltar para a Loja Pública</Text>
            </Link>
         </div>
      </div>

    </div>
  );
}
